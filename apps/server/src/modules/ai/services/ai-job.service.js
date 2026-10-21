/**
 * @file ai-job.service.js
 * @module AI_Job_Service
 * @description Quản lý toàn diện vòng đời job AI: BullMQ queue, progress tracking, access control, audit & metrics.
 */

import { randomUUID } from "node:crypto";
import { Op } from "sequelize";
import client from "prom-client";

import { AIJob, Movie, User, Role, Permission, AIAuditLog, sequelize } from "../../../models/index.js";
import { aiQueue } from "../../../config/queue.config.js";
import { cacheHelper, getRedisClient } from "../../../config/redis.config.js";
import { env } from "../../../config/env.config.js";
import { logger } from "../../../utils/logger.js";
import { register } from "../../../middlewares/monitoring.middleware.js";
import { progressService, PROGRESS_EVENTS } from "../../jobs/services/progress.service.js";

import {
  ACTIVE_AI_STATUSES,
  TERMINAL_AI_STATUSES,
  aiJobError,
  assertAiAccess,
  toAiJobDto,
  createResolutionBinding,
  createMovieCatalogLookup,
} from "../helpers/ai-job.helper.js";
import { generateAiCacheKey } from "../helpers/ai-metadata.helper.js";
import {
  AIProviderError,
  assertExecutionAvailable,
  consumeSynthesisPass,
  geminiProvider,
  normalizeExecutionBudget,
  normalizeProviderError,
  openRouterProvider,
} from "../helpers/ai-providers.helper.js";
import { movieResolutionService, aiOrchestrator, AIOrchestratorService } from "./ai.service.js";

// ============================================================================
// 1. METRICS & MONITORING
// ============================================================================

const jobsCounter = new client.Counter({
  name: "ai_jobs_total",
  help: "Số job AI kết thúc theo trạng thái và mức độ đầy đủ.",
  labelNames: ["status", "partial"],
  registers: [register],
});

const durationHistogram = new client.Histogram({
  name: "ai_job_duration_seconds",
  help: "Thời gian xử lý job AI kể cả retry.",
  buckets: [1, 5, 15, 30, 60, 90, 120, 180],
  registers: [register],
});

const providerErrorsCounter = new client.Counter({
  name: "ai_provider_errors_total",
  help: "Job có giới hạn hoặc lỗi provider, bao gồm kết quả một phần.",
  labelNames: ["reason"],
  registers: [register],
});

const reviewedCounter = new client.Counter({
  name: "ai_review_fields_total",
  help: "Số trường đã được admin duyệt theo quyết định.",
  labelNames: ["decision"],
  registers: [register],
});

export const aiMetrics = {
  job(dto, record) {
    jobsCounter.inc({ status: dto.status, partial: dto.result?.partial_reason ? "true" : "false" });
    if (record.started_at) {
      durationHistogram.observe(Math.max(0, (Date.now() - new Date(record.started_at).getTime()) / 1000));
    }
    const code = String(dto.result?.provider_error?.code || dto.result?.partial_reason?.code || dto.error?.code || "");
    if (code && code !== "AI_CANCELLED") {
      const reason = /QUOTA|RATE_LIMIT|COOLDOWN/.test(code) ? "quota"
        : /DEADLINE|TIMEOUT/.test(code) ? "deadline"
          : /PROVIDER|MODEL/.test(code) ? "provider" : "other";
      providerErrorsCounter.inc({ reason });
    }
  },
  review({ appliedFields, skippedCount }) {
    reviewedCounter.inc({ decision: "applied" }, appliedFields.length);
    reviewedCounter.inc({ decision: "skipped" }, skippedCount);
  },
};

// ============================================================================
// 2. AUDIT SERVICE
// ============================================================================

class AIAuditService {
  async createInitialAudit(data) {
    try {
      const record = await AIAuditLog.create({
        job_id: data.jobId,
        user_id: data.userId || null,
        query_title: data.title,
        query_year: data.year ? Number(data.year) : null,
        query_type: data.type || "all",
        provider: "gemini",
        model: "pending",
        prompt_version: data.promptVersion || "v1.2.0",
        status: "pending",
      });
      return record;
    } catch (err) {
      logger.error(`[AI Audit] Lỗi tạo bản ghi audit ban đầu: ${err.message}`);
      return null;
    }
  }

  async recordSuccess(jobId, resultData) {
    try {
      await AIAuditLog.update(
        {
          status: "completed",
          provider: resultData.provider || "gemini",
          model: resultData.model || "gemini-2.5-flash",
          prompt_tokens: resultData.usage?.promptTokens || 0,
          completion_tokens: resultData.usage?.completionTokens || 0,
          total_tokens: resultData.usage?.totalTokens || 0,
          estimated_cost_usd: resultData.estimatedCostUsd || 0,
          latency_ms: resultData.latencyMs || 0,
          stage_timings: resultData.stageTimings || {},
          confidence_score: resultData.confidenceScore || 0,
          confidence_breakdown: resultData.confidenceBreakdown || {},
          conflicts: resultData.conflicts || [],
          flags: resultData.flags || [],
          field_provenance: resultData.fieldProvenance || {},
          evidence_snapshot: resultData.evidenceSnapshot || {},
          circuit_breaker_tripped: Boolean(resultData.circuitBreakerTripped),
        },
        { where: { job_id: jobId } }
      );
    } catch (err) {
      logger.error(`[AI Audit] Lỗi cập nhật audit thành công cho Job ${jobId}: ${err.message}`);
    }
  }

  async recordFailure(jobId, error, extraData = {}) {
    try {
      await AIAuditLog.update(
        {
          status: extraData.status || "failed",
          error_code: error.name || "AI_ERROR",
          error_message: error.message,
          latency_ms: extraData.latencyMs || 0,
          stage_timings: extraData.stageTimings || {},
          circuit_breaker_tripped: Boolean(extraData.circuitBreakerTripped),
        },
        { where: { job_id: jobId } }
      );
    } catch (err) {
      logger.error(`[AI Audit] Lỗi cập nhật audit thất bại cho Job ${jobId}: ${err.message}`);
    }
  }
}

export const aiAuditService = new AIAuditService();

// ============================================================================
// 3. AI ORCHESTRATOR SERVICE
// ============================================================================
// 3. AI ORCHESTRATOR SERVICE (Re-exported from ai.service.js)
// ============================================================================

export { aiOrchestrator, AIOrchestratorService };

// ============================================================================
// 4. CORE JOB SERVICE FACTORY & SINGLETON
// ============================================================================

export const createAiJobService = ({
  Job, sequelize: db, queue, cache, resolver, loadActor, movieExists, publish,
  acquireLock, releaseLock, metrics, config = {}, now = () => new Date(), uuid = randomUUID,
}) => {
  const enabled = () => {
    if (config.enabled === false) throw aiJobError("Trợ lý AI đang tạm dừng.", 503, "AI_DISABLED");
  };
  const actorFor = async (actor) => loadActor ? loadActor(actor) : actor;
  const getRecord = async (jobId) => {
    const job = await Job.findOne({ where: { job_id: jobId } });
    if (!job) throw aiJobError("Không tìm thấy job AI.", 404, "AI_JOB_NOT_FOUND");
    return job;
  };
  const emit = async (job) => {
    const dto = toAiJobDto(job);
    if (dto.terminal) {
      try { metrics?.job?.(dto, job); } catch { /* Bỏ qua lỗi telemetry */ }
    }
    try { await publish?.(dto); } catch { /* Bỏ qua lỗi transport */ }
    return dto;
  };
  const findActive = (userId, fingerprint) => Job.findOne({
    where: { user_id: userId, fingerprint, status: { [Op.in]: ACTIVE_AI_STATUSES } },
    order: [["created_at", "DESC"]],
  });
  const enqueue = async (record) => {
    let timer;
    try {
      return await Promise.race([
        queue.add("suggest-movie", { jobId: record.job_id }, {
          jobId: record.job_id, attempts: 2, backoff: { type: "exponential", delay: 2000 },
        }),
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(aiJobError("Hàng đợi chưa phản hồi.", 503, "AI_ENQUEUE_TIMEOUT")), config.enqueueTimeoutMs || 5000);
        }),
      ]);
    } finally { clearTimeout(timer); }
  };

  const service = {
    async resolve(input, actor, { signal } = {}) {
      enabled();
      actor = await actorFor(actor);
      assertAiAccess(actor, { target: input.target });
      if (input.target?.movieId && !await movieExists(input.target.movieId)) throw aiJobError("Phim không tồn tại.", 404, "MOVIE_NOT_FOUND");
      const resolved = await resolver.resolve({
        title: input.title, year: input.year, mediaType: input.media_type || "all",
        userId: actor.id, context: input.context || {}, target: input.target, signal,
      });
      const resolutionId = uuid();
      const candidates = resolved.candidates || [];
      const status = !candidates.length ? "not_found" : resolved.requiresSelection ? "ambiguous" : "matched";
      const result = {
        resolutionId, status, candidates, selectedCandidate: status === "matched" ? resolved.selectedCandidate || candidates[0] : null,
        source_errors: resolved.source_errors || [],
        query: {
          title: input.title.normalize("NFKC").trim().toLowerCase(), year: input.year || null,
          mediaType: input.media_type || "all", binding: createResolutionBinding(input, actor.id),
        },
      };
      const stored = await cache.set(`ai:v3:resolution:${actor.id}:${resolutionId}`, result, 600);
      if (stored === false) throw aiJobError("Không thể lưu bước chọn tác phẩm. Vui lòng thử lại.", 503, "AI_RESOLUTION_UNAVAILABLE");
      return result;
    },

    async submit(input, actor) {
      enabled();
      actor = await actorFor(actor);
      const target = { movieId: input.target?.movieId || null, draftId: input.target?.draftId || (input.target?.movieId ? null : uuid()) };
      assertAiAccess(actor, { target });
      if (config.acceptingJobs === false) throw aiJobError("Hệ thống AI đang bảo trì, vui lòng thử lại sau.", 503, "AI_DRAINING");
      if (target.movieId && !await movieExists(target.movieId)) throw aiJobError("Phim không tồn tại.", 404, "MOVIE_NOT_FOUND");
      const requestId = input.requestId || uuid();
      const clientSignature = generateAiCacheKey({
        ...input, ownerId: actor.id, target,
        selectedCandidate: { clientCandidateId: input.candidateId || null, resolutionId: input.resolutionId || null, forceRefresh: Boolean(input.force_refresh) },
      }).hash;
      const previous = await Job.findOne({ where: { user_id: actor.id, request_id: requestId } });
      if (previous) {
        if (previous.request_payload?.clientSignature !== clientSignature) {
          throw aiJobError("Mã yêu cầu đã thuộc một form hoặc tác phẩm khác.", 409, "AI_REQUEST_CONFLICT");
        }
        return toAiJobDto(previous);
      }
      let resolved;
      if (input.resolutionId) {
        resolved = await cache.get(`ai:v3:resolution:${actor.id}:${input.resolutionId}`);
        if (!resolved) throw aiJobError("Bước chọn tác phẩm đã hết hạn. Vui lòng tra cứu lại.", 409, "AI_RESOLUTION_EXPIRED");
      } else {
        resolved = await service.resolve({ ...input, target }, actor);
      }
      if (resolved.query?.binding !== createResolutionBinding({ ...input, target: input.resolutionId ? input.target : target }, actor.id)) {
        throw aiJobError("Thông tin tra cứu đã thay đổi. Vui lòng chọn lại tác phẩm.", 409, "AI_RESOLUTION_MISMATCH");
      }
      const selected = input.candidateId
        ? resolved.candidates.find((candidate) => candidate.candidateId === input.candidateId)
        : resolved.selectedCandidate;
      if (!selected) throw aiJobError("Vui lòng chọn đúng tác phẩm trước khi tổng hợp.", 409, "AI_IDENTITY_REQUIRED");
      const payload = {
        title: input.title, year: input.year || null, type: input.type || "all",
        mediaType: input.media_type || "all", forceRefresh: Boolean(input.force_refresh),
        mode: input.mode || "auto", enable_web_search: false, context: input.context || {},
        target, requestId, selectedCandidate: selected, ownerId: actor.id, clientSignature,
      };
      const { hash: fingerprint, resultCacheKey, lockKey } = generateAiCacheKey(payload);
      const active = await findActive(actor.id, fingerprint);
      if (active) return toAiJobDto(active);
      if (!input.force_refresh) {
        const cachedId = await cache.get(resultCacheKey);
        if (cachedId) {
          const cached = await Job.findOne({ where: { job_id: cachedId, user_id: actor.id, fingerprint, status: "completed" } });
          if (cached) return { ...toAiJobDto(cached), from_cache: true };
        }
      }
      const token = uuid();
      let acquired;
      try { acquired = await acquireLock(lockKey, token, 10); }
      catch { throw aiJobError("Hàng đợi AI tạm thời không khả dụng.", 503, "AI_QUEUE_UNAVAILABLE"); }
      if (!acquired) {
        const concurrent = await findActive(actor.id, fingerprint);
        if (concurrent) return toAiJobDto(concurrent);
        throw aiJobError("Yêu cầu đang được tiếp nhận. Vui lòng thử lại.", 409, "AI_ENQUEUE_BUSY");
      }
      let record;
      try {
        const concurrent = await findActive(actor.id, fingerprint);
        if (concurrent) return toAiJobDto(concurrent);
        try {
          record = await Job.create({
            id: uuid(), job_id: `ai-${uuid()}`, request_id: requestId, user_id: actor.id,
            target, fingerprint, request_payload: payload, status: "queued", stage: "QUEUED",
            progress: 0, attempt: 0, sequence: 1,
          });
        } catch (error) {
          if (error.name === "SequelizeUniqueConstraintError") {
            const existing = await findActive(actor.id, fingerprint)
              || await Job.findOne({ where: { user_id: actor.id, request_id: requestId } });
            if (existing && existing.request_id === requestId && existing.request_payload?.clientSignature !== clientSignature) {
              throw aiJobError("Mã yêu cầu đã được dùng cho một nội dung khác.", 409, "AI_REQUEST_CONFLICT");
            }
            if (existing) return toAiJobDto(existing);
          }
          throw error;
        }
        try {
          await enqueue(record);
        } catch (error) {
          const snapshot = await service.update(record.job_id, {
            status: "failed", stage: "FAILED", completed_at: now(),
            error: { code: "AI_ENQUEUE_FAILED", message: "Không thể đưa yêu cầu vào hàng đợi." },
          });
          if (snapshot.status === "completed" || snapshot.status === "cancelled") return snapshot;
          throw aiJobError("Không thể đưa yêu cầu vào hàng đợi.", 503, "AI_ENQUEUE_FAILED");
        }
        const accepted = await getRecord(record.job_id);
        return accepted.status === "queued" ? emit(accepted) : toAiJobDto(accepted);
      } finally {
        await releaseLock(lockKey, token);
      }
    },

    async get(jobId, actor) {
      actor = await actorFor(actor);
      const job = await getRecord(jobId);
      assertAiAccess(actor, { ownerId: job.user_id, target: job.target });
      return toAiJobDto(job);
    },

    async list(query, actor) {
      actor = await actorFor(actor);
      const target = query.movieId ? { movieId: query.movieId } : query.draftId ? { draftId: query.draftId } : null;
      assertAiAccess(actor, { target });
      const where = { user_id: actor.id };
      if (target) where.target = { [Op.contains]: target };
      if (query.status) where.status = query.status;
      const page = Math.max(1, Number(query.page) || 1);
      const limit = Math.min(50, Math.max(1, Number(query.limit) || 20));
      const { count, rows } = await Job.findAndCountAll({ where, order: [["created_at", "DESC"]], offset: (page - 1) * limit, limit });
      return { items: rows.map(toAiJobDto), pagination: { page, limit, total: count, totalPages: Math.ceil(count / limit) } };
    },

    async update(jobId, patch, { allowTerminal = false } = {}) {
      let changed = false;
      const record = await db.transaction(async (transaction) => {
        const job = await Job.findOne({ where: { job_id: jobId }, transaction, lock: transaction.LOCK.UPDATE });
        if (!job) throw aiJobError("Không tìm thấy job AI.", 404, "AI_JOB_NOT_FOUND");
        if (TERMINAL_AI_STATUSES.includes(job.status) && !allowTerminal) return job;
        const values = typeof patch === "function" ? patch(job) : patch;
        if (values.progress !== undefined && !TERMINAL_AI_STATUSES.includes(values.status)) {
          values.progress = Math.min(99, Math.max(job.progress || 0, Number(values.progress) || 0));
        }
        await job.update({ ...values, sequence: job.sequence + 1 }, { transaction });
        changed = true;
        return job;
      });
      return changed ? emit(record) : toAiJobDto(record);
    },

    async cancel(jobId, actor) {
      await service.get(jobId, actor);
      const result = await service.update(jobId, { status: "cancelled", stage: "CANCELLED", completed_at: now(), error: { code: "AI_CANCELLED", message: "Đã hủy yêu cầu AI." } });
      try {
        const queued = await queue.getJob(jobId);
        if (queued && ["waiting", "delayed", "prioritized"].includes(await queued.getState())) await queued.remove();
      } catch { /* Bỏ qua nếu job đang xử lý */ }
      return result;
    },

    async recordReview(jobId, input, actor) {
      await service.get(jobId, actor);
      const appliedFields = [...new Set(input.appliedFields)];
      if (appliedFields.length + input.skippedCount !== input.consideredCount) {
        throw aiJobError("Thống kê áp dụng không khớp danh sách đã duyệt.", 422, "AI_REVIEW_INVALID");
      }
      await db.transaction(async (transaction) => {
        const job = await Job.findOne({ where: { job_id: jobId }, transaction, lock: transaction.LOCK.UPDATE });
        if (job.status !== "completed" || !job.result) throw aiJobError("Job chưa có kết quả để duyệt.", 409, "AI_REVIEW_NOT_READY");
        const previous = job.review || {};
        await job.update({
          review: {
            eventsCount: (previous.eventsCount || 0) + 1,
            appliedCount: (previous.appliedCount || 0) + appliedFields.length,
            consideredCount: (previous.consideredCount || 0) + input.consideredCount,
            skippedCount: (previous.skippedCount || 0) + input.skippedCount,
            last: { appliedFields, skippedCount: input.skippedCount, consideredCount: input.consideredCount, actorId: actor.id, at: now() },
          },
        }, { transaction });
      });
      try { metrics?.review?.({ ...input, appliedFields }); } catch { /* Bỏ qua telemetry */ }
      return { recorded: true };
    },

    async complete(jobId, result) {
      const dto = await service.update(jobId, { status: "completed", stage: "COMPLETED", progress: 100, result, error: null, completed_at: now() });
      if (dto.status === "completed") {
        const record = await getRecord(jobId);
        try { await cache.set(`ai:v2:result:${record.fingerprint}`, jobId, 3600); } catch { /* Bỏ qua cache */ }
      }
      return dto;
    },

    getRecord,
  };
  return service;
};

// ============================================================================
// 5. PRODUCTION AI JOB SERVICE SINGLETON
// ============================================================================

const loadActor = async (actor) => {
  if (!actor?.id) throw aiJobError("Vui lòng đăng nhập.", 401, "UNAUTHENTICATED");
  const user = await User.findByPk(actor.id, {
    attributes: ["id", "status"],
    include: [{ model: Role, as: "role", attributes: ["slug"], include: [{ model: Permission, as: "permissions", attributes: ["slug"], through: { attributes: [] } }] }],
  });
  if (!user || user.status !== "active") throw aiJobError("Tài khoản không còn hoạt động.", 403, "AI_FORBIDDEN");
  return { id: user.id, roles: user.role ? [user.role.slug] : [], permissions: (user.role?.permissions || []).map((p) => p.slug) };
};

export const aiJobService = createAiJobService({
  Job: AIJob,
  sequelize,
  queue: aiQueue,
  cache: cacheHelper,
  resolver: { resolve: (params) => movieResolutionService.resolve(params) },
  loadActor,
  config: env.ai,
  metrics: aiMetrics,
  movieExists: async (id) => Boolean(await Movie.findByPk(id, { attributes: ["id"] })),
  acquireLock: async (key, token, ttl) => await getRedisClient().set(key, token, "EX", ttl, "NX") === "OK",
  releaseLock: async (key, token) => {
    try {
      await getRedisClient().eval("if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end", 1, key, token);
    } catch { /* Bỏ qua lỗi redis */ }
  },
  publish: async (dto) => {
    await progressService.cacheProgress(dto.jobId, dto);
    progressService.broadcastProgress(dto.jobId, PROGRESS_EVENTS.JOB_PROGRESS, dto, "ai");
  },
});

export const getAiAuditHistory = async (query, actor) => {
  const principal = await loadActor(actor);
  assertAiAccess(principal, { manage: true });
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(query.limit) || 20));
  const { count, rows } = await AIAuditLog.findAndCountAll({
    attributes: ["id", "job_id", "query_title", "query_year", "provider", "model", "status", "confidence_score", "flags", "latency_ms", "created_at"],
    order: [["created_at", "DESC"]], limit, offset: (page - 1) * limit,
  });
  return { items: rows, pagination: { page, limit, total: count, totalPages: Math.ceil(count / limit) } };
};

export default {
  aiJobService,
  createAiJobService,
  aiMetrics,
  aiAuditService,
  aiOrchestrator,
  getAiAuditHistory,
};
