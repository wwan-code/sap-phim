/**
 * @file ai-job.service.js
 * @module AI_Job_Service
 * @description Kết nối nghiệp vụ job AI với PostgreSQL, BullMQ, Redis và quyền người dùng hiện tại.
 */

import { AIJob, Movie, User, Role, Permission, AIAuditLog, sequelize } from '../../../models/index.js';
import { aiQueue } from '../../../config/queue.config.js';
import { cacheHelper, getRedisClient } from '../../../config/redis.config.js';
import { env } from '../../../config/env.config.js';
import { progressService, PROGRESS_EVENTS } from '../../jobs/services/progress.service.js';
import { movieResolutionService } from './movie-resolution.service.js';
import { createAiJobService } from './ai-job-core.service.js';
import { assertAiAccess, aiJobError } from './ai-job-policy.js';
import { aiMetrics } from './ai-metrics.service.js';

/** Đọc quyền từ DB để cả REST và Socket không dùng quyền đã bị thu hồi trong phiên cũ. */
const loadActor = async (actor) => {
  if (!actor?.id) throw aiJobError('Vui lòng đăng nhập.', 401, 'UNAUTHENTICATED');
  const user = await User.findByPk(actor.id, {
    attributes: ['id', 'status'],
    include: [{ model: Role, as: 'role', attributes: ['slug'], include: [{ model: Permission, as: 'permissions', attributes: ['slug'], through: { attributes: [] } }] }],
  });
  if (!user || user.status !== 'active') throw aiJobError('Tài khoản không còn hoạt động.', 403, 'AI_FORBIDDEN');
  return { id: user.id, roles: user.role ? [user.role.slug] : [], permissions: (user.role?.permissions || []).map((permission) => permission.slug) };
};

export const aiJobService = createAiJobService({
  Job: AIJob, sequelize, queue: aiQueue, cache: cacheHelper, resolver: movieResolutionService,
  loadActor, config: env.ai, metrics: aiMetrics,
  movieExists: async (id) => Boolean(await Movie.findByPk(id, { attributes: ['id'] })),
  acquireLock: async (key, token, ttl) => await getRedisClient().set(key, token, 'EX', ttl, 'NX') === 'OK',
  releaseLock: async (key, token) => {
    try {
      await getRedisClient().eval("if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end", 1, key, token);
    } catch { /* TTL bảo đảm khóa được giải phóng nếu transport Redis tạm lỗi. */ }
  },
  publish: async (dto) => {
    // Lưu snapshot trước phát sự kiện; canonical DB đã commit trước khi gọi callback này.
    await progressService.cacheProgress(dto.jobId, dto);
    progressService.broadcastProgress(dto.jobId, PROGRESS_EVENTS.JOB_PROGRESS, dto, 'ai');
  },
});

/** Lịch sử audit nhẹ, có phân trang và chỉ dành cho người quản lý AI. */
export const getAiAuditHistory = async (query, actor) => {
  const principal = await loadActor(actor);
  assertAiAccess(principal, { manage: true });
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(query.limit) || 20));
  const { count, rows } = await AIAuditLog.findAndCountAll({
    attributes: ['id', 'job_id', 'query_title', 'query_year', 'provider', 'model', 'status', 'confidence_score', 'flags', 'latency_ms', 'created_at'],
    order: [['created_at', 'DESC']], limit, offset: (page - 1) * limit,
  });
  return { items: rows, pagination: { page, limit, total: count, totalPages: Math.ceil(count / limit) } };
};
