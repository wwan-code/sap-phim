/**
 * @file ai-job-core.service.js
 * @module AI_Job_Core
 * @description Điều phối job có dependency injection để kiểm thử queue/cache/DB mà không gọi dịch vụ thật.
 */

import { randomUUID } from 'node:crypto';
import { Op } from 'sequelize';

import { generateAiCacheKey } from '../constants/ai.constants.js';
import { ACTIVE_AI_STATUSES, TERMINAL_AI_STATUSES, assertAiAccess, aiJobError, toAiJobDto } from './ai-job-policy.js';

/**
 * @service createAiJobService
 * @param {object} dependencies - Model và các cổng I/O được cung cấp từ composition root.
 * @returns {object} Nghiệp vụ nhận diện, yêu cầu, tra cứu, tiến trình và hủy job AI.
 */
export const createAiJobService = ({ Job, sequelize, queue, cache, resolver, loadActor, movieExists, publish, acquireLock, releaseLock, metrics, config = {}, now = () => new Date(), uuid = randomUUID }) => {
  const enabled = () => {
    if (config.enabled === false) throw aiJobError('Trợ lý AI đang tạm dừng.', 503, 'AI_DISABLED');
  };
  const actorFor = async (actor) => {
    return loadActor ? loadActor(actor) : actor;
  };
  const getRecord = async (jobId) => {
    const job = await Job.findOne({ where: { job_id: jobId } });
    if (!job) throw aiJobError('Không tìm thấy job AI.', 404, 'AI_JOB_NOT_FOUND');
    return job;
  };
  const emit = async (job) => {
    const dto = toAiJobDto(job);
    if (dto.terminal) {
      try { metrics?.job?.(dto, job); } catch { /* Quan sát không được làm thay đổi vòng đời job. */ }
    }
    // PostgreSQL là nguồn chuẩn. Lỗi transport không được chạy lại AI đã hoàn tất.
    try { await publish?.(dto); } catch { /* REST vẫn có thể phục hồi kết quả đã lưu. */ }
    return dto;
  };
  const findActive = (userId, fingerprint) => Job.findOne({
    where: { user_id: userId, fingerprint, status: { [Op.in]: ACTIVE_AI_STATUSES } },
    order: [['created_at', 'DESC']],
  });
  const enqueue = async (record) => {
    let timer;
    try {
      return await Promise.race([
        queue.add('suggest-movie', { jobId: record.job_id }, {
          jobId: record.job_id, attempts: 2, backoff: { type: 'exponential', delay: 2000 },
        }),
        new Promise((_, reject) => { timer = setTimeout(() => reject(aiJobError('Hàng đợi chưa phản hồi.', 503, 'AI_ENQUEUE_TIMEOUT')), config.enqueueTimeoutMs || 5000); }),
      ]);
    } finally { clearTimeout(timer); }
  };

  const service = {
    async resolve(input, actor) {
      enabled();
      actor = await actorFor(actor);
      assertAiAccess(actor, { target: input.target });
      const resolved = await resolver.resolve({ title: input.title, year: input.year, mediaType: input.media_type || 'all', userId: actor.id });
      const resolutionId = uuid();
      const candidates = resolved.candidates || [];
      const status = !candidates.length ? 'not_found' : resolved.requiresSelection ? 'ambiguous' : 'matched';
      const result = { resolutionId, status, candidates, selectedCandidate: status === 'matched' ? resolved.selectedCandidate || candidates[0] : null,
        query: { title: input.title.normalize('NFKC').trim().toLowerCase(), year: input.year || null, mediaType: input.media_type || 'all' } };
      const stored = await cache.set(`ai:v2:resolution:${actor.id}:${resolutionId}`, result, 600);
      if (stored === false) throw aiJobError('Không thể lưu bước chọn tác phẩm. Vui lòng thử lại.', 503, 'AI_RESOLUTION_UNAVAILABLE');
      return result;
    },

    async submit(input, actor) {
      enabled();
      actor = await actorFor(actor);
      const target = { movieId: input.target?.movieId || null, draftId: input.target?.draftId || (input.target?.movieId ? null : uuid()) };
      assertAiAccess(actor, { target });
      if (config.acceptingJobs === false) throw aiJobError('Hệ thống AI đang bảo trì, vui lòng thử lại sau.', 503, 'AI_DRAINING');
      if (target.movieId && !await movieExists(target.movieId)) throw aiJobError('Phim không tồn tại.', 404, 'MOVIE_NOT_FOUND');
      const requestId = input.requestId || uuid();
      const clientSignature = generateAiCacheKey({ ...input, ownerId: actor.id, target,
        selectedCandidate: { clientCandidateId: input.candidateId || null, resolutionId: input.resolutionId || null, forceRefresh: Boolean(input.force_refresh) } }).hash;
      const previous = await Job.findOne({ where: { user_id: actor.id, request_id: requestId } });
      if (previous) {
        if (previous.request_payload?.clientSignature !== clientSignature) {
          throw aiJobError('Mã yêu cầu đã thuộc một form hoặc tác phẩm khác.', 409, 'AI_REQUEST_CONFLICT');
        }
        return toAiJobDto(previous);
      }
      let resolved;
      if (input.resolutionId) {
        resolved = await cache.get(`ai:v2:resolution:${actor.id}:${input.resolutionId}`);
        if (!resolved) throw aiJobError('Bước chọn tác phẩm đã hết hạn. Vui lòng tra cứu lại.', 409, 'AI_RESOLUTION_EXPIRED');
      } else {
        resolved = await service.resolve({ ...input, target }, actor);
      }
      if (resolved.query && (resolved.query.title !== input.title.normalize('NFKC').trim().toLowerCase()
        || resolved.query.year !== (input.year || null) || resolved.query.mediaType !== (input.media_type || 'all'))) {
        throw aiJobError('Thông tin tra cứu đã thay đổi. Vui lòng chọn lại tác phẩm.', 409, 'AI_RESOLUTION_MISMATCH');
      }
      const selected = input.candidateId
        ? resolved.candidates.find((candidate) => candidate.candidateId === input.candidateId)
        : resolved.selectedCandidate;
      if (!selected) throw aiJobError('Vui lòng chọn đúng tác phẩm trước khi tổng hợp.', 409, 'AI_IDENTITY_REQUIRED');
      const payload = {
        title: input.title, year: input.year || null, type: input.type || 'all',
        mode: input.mode || 'auto', enable_web_search: false, context: input.context || {},
        target, requestId, selectedCandidate: selected, ownerId: actor.id, clientSignature,
      };
      const { hash: fingerprint, resultCacheKey, lockKey } = generateAiCacheKey(payload);
      const active = await findActive(actor.id, fingerprint);
      if (active) return toAiJobDto(active);
      if (!input.force_refresh) {
        const cachedId = await cache.get(resultCacheKey);
        if (cachedId) {
          const cached = await Job.findOne({ where: { job_id: cachedId, user_id: actor.id, fingerprint, status: 'completed' } });
          if (cached) return { ...toAiJobDto(cached), from_cache: true };
        }
      }
      const token = uuid();
      let acquired;
      try { acquired = await acquireLock(lockKey, token, 10); }
      catch { throw aiJobError('Hàng đợi AI tạm thời không khả dụng.', 503, 'AI_QUEUE_UNAVAILABLE'); }
      if (!acquired) {
        const concurrent = await findActive(actor.id, fingerprint);
        if (concurrent) return toAiJobDto(concurrent);
        throw aiJobError('Yêu cầu đang được tiếp nhận. Vui lòng thử lại.', 409, 'AI_ENQUEUE_BUSY');
      }
      let record;
      try {
        const concurrent = await findActive(actor.id, fingerprint);
        if (concurrent) return toAiJobDto(concurrent);
        try {
          record = await Job.create({
            id: uuid(), job_id: `ai-${uuid()}`, request_id: requestId, user_id: actor.id,
            target, fingerprint, request_payload: payload, status: 'queued', stage: 'QUEUED',
            progress: 0, attempt: 0, sequence: 1,
          });
        } catch (error) {
          if (error.name === 'SequelizeUniqueConstraintError') {
            const existing = await findActive(actor.id, fingerprint)
              || await Job.findOne({ where: { user_id: actor.id, request_id: requestId } });
            if (existing && existing.request_id === requestId && existing.request_payload?.clientSignature !== clientSignature) {
              throw aiJobError('Mã yêu cầu đã được dùng cho một nội dung khác.', 409, 'AI_REQUEST_CONFLICT');
            }
            if (existing) return toAiJobDto(existing);
          }
          throw error;
        }
        try {
          await enqueue(record);
        } catch (error) {
          const snapshot = await service.update(record.job_id, { status: 'failed', stage: 'FAILED', completed_at: now(),
            error: { code: 'AI_ENQUEUE_FAILED', message: 'Không thể đưa yêu cầu vào hàng đợi.' } });
          if (snapshot.status === 'completed' || snapshot.status === 'cancelled') return snapshot;
          throw aiJobError('Không thể đưa yêu cầu vào hàng đợi.', 503, 'AI_ENQUEUE_FAILED');
        }
        // Worker có thể hoàn tất trong khi queue.add đang trả về; đọc lại tránh phát snapshot cũ.
        const accepted = await getRecord(record.job_id);
        return accepted.status === 'queued' ? emit(accepted) : toAiJobDto(accepted);
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
      const { count, rows } = await Job.findAndCountAll({ where, order: [['created_at', 'DESC']], offset: (page - 1) * limit, limit });
      return { items: rows.map(toAiJobDto), pagination: { page, limit, total: count, totalPages: Math.ceil(count / limit) } };
    },

    async update(jobId, patch, { allowTerminal = false } = {}) {
      let changed = false;
      const record = await sequelize.transaction(async (transaction) => {
        const job = await Job.findOne({ where: { job_id: jobId }, transaction, lock: transaction.LOCK.UPDATE });
        if (!job) throw aiJobError('Không tìm thấy job AI.', 404, 'AI_JOB_NOT_FOUND');
        if (TERMINAL_AI_STATUSES.includes(job.status) && !allowTerminal) return job;
        const values = typeof patch === 'function' ? patch(job) : patch;
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
      const result = await service.update(jobId, { status: 'cancelled', stage: 'CANCELLED', completed_at: now(), error: { code: 'AI_CANCELLED', message: 'Đã hủy yêu cầu AI.' } });
      try { const queued = await queue.getJob(jobId); if (queued && ['waiting', 'delayed', 'prioritized'].includes(await queued.getState())) await queued.remove(); } catch { /* Job đang chạy sẽ thấy trạng thái hủy qua DB. */ }
      return result;
    },

    async recordReview(jobId, input, actor) {
      await service.get(jobId, actor);
      const appliedFields = [...new Set(input.appliedFields)];
      if (appliedFields.length + input.skippedCount !== input.consideredCount) {
        throw aiJobError('Thống kê áp dụng không khớp danh sách đã duyệt.', 422, 'AI_REVIEW_INVALID');
      }
      await sequelize.transaction(async (transaction) => {
        const job = await Job.findOne({ where: { job_id: jobId }, transaction, lock: transaction.LOCK.UPDATE });
        if (job.status !== 'completed' || !job.result) throw aiJobError('Job chưa có kết quả để duyệt.', 409, 'AI_REVIEW_NOT_READY');
        const previous = job.review || {};
        await job.update({ review: {
          eventsCount: (previous.eventsCount || 0) + 1,
          appliedCount: (previous.appliedCount || 0) + appliedFields.length,
          consideredCount: (previous.consideredCount || 0) + input.consideredCount,
          skippedCount: (previous.skippedCount || 0) + input.skippedCount,
          last: { appliedFields, skippedCount: input.skippedCount, consideredCount: input.consideredCount, actorId: actor.id, at: now() },
        } }, { transaction });
      });
      try { metrics?.review?.({ ...input, appliedFields }); } catch { /* Kết quả form đã được áp dụng độc lập. */ }
      return { recorded: true };
    },

    async complete(jobId, result) {
      const dto = await service.update(jobId, { status: 'completed', stage: 'COMPLETED', progress: 100, result, error: null, completed_at: now() });
      if (dto.status === 'completed') {
        const record = await getRecord(jobId);
        try { await cache.set(`ai:v2:result:${record.fingerprint}`, jobId, 3600); } catch { /* Kết quả đã bền vững trong PostgreSQL. */ }
      }
      return dto;
    },

    getRecord,
  };
  return service;
};
