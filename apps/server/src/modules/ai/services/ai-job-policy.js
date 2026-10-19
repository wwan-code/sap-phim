/**
 * @file ai-job-policy.js
 * @module AI_Job_Policy
 * @description Hợp đồng job và kiểm tra quyền thuần, dùng chung REST, Socket và kiểm thử.
 */

import { AppError } from '../../../utils/app-error.js';

export const ACTIVE_AI_STATUSES = ['queued', 'processing'];
export const TERMINAL_AI_STATUSES = ['completed', 'failed', 'cancelled'];

/** Tạo lỗi nghiệp vụ có mã ổn định cho client. */
export const aiJobError = (message, statusCode, code) => {
  const error = new AppError(message, statusCode);
  error.code = code;
  return error;
};

export const hasAiPermission = (actor, permission) => {
  const roles = new Set(actor?.roles || []);
  const permissions = new Set(actor?.permissions || []);
  return roles.has('boss') || permissions.has(permission);
};

/** Từ chối truy cập nếu quyền quản trị hoặc quyền chỉnh sửa hiện tại đã bị thu hồi. */
export const assertAiAccess = (actor, options = {}) => {
  const { target = null, ownerId = null, manage = false } = options;
  const checkingOwner = Object.hasOwn(options, 'ownerId');
  if (!actor?.id) throw aiJobError('Vui lòng đăng nhập.', 401, 'UNAUTHENTICATED');
  if (!hasAiPermission(actor, 'admin.access')) {
    throw aiJobError('Bạn không có quyền truy cập trợ lý quản trị.', 403, 'AI_FORBIDDEN');
  }
  const isManager = hasAiPermission(actor, 'ai.manage');
  if (manage && !isManager) throw aiJobError('Bạn không có quyền quản lý AI.', 403, 'AI_FORBIDDEN');
  if (checkingOwner && (!ownerId || (ownerId !== actor.id && !isManager))) {
    throw aiJobError('Bạn không có quyền truy cập job AI này.', 403, 'AI_FORBIDDEN');
  }
  if (isManager && (checkingOwner || manage)) return;
  const allowed = target?.movieId
    ? hasAiPermission(actor, 'movies.edit')
    : target?.draftId
      ? hasAiPermission(actor, 'movies.create')
      : hasAiPermission(actor, 'movies.create') || hasAiPermission(actor, 'movies.edit');
  if (!allowed) throw aiJobError('Bạn không có quyền dùng AI cho form phim này.', 403, 'AI_FORBIDDEN');
};

/** Chỉ xuất trường công khai, không gửi prompt/context riêng tư qua Socket. */
export const toAiJobDto = (record) => {
  const job = record?.get ? record.get({ plain: true }) : record;
  return {
    jobId: job.job_id, requestId: job.request_id, ownerId: job.user_id,
    target: job.target, jobType: 'ai', title: job.request_payload?.title || '',
    status: job.status, stage: job.stage, progress: job.progress, percent: job.progress,
    attempt: job.attempt, sequence: job.sequence,
    result: job.result || null, outputs: job.result || null, error: job.error || null,
    terminal: TERMINAL_AI_STATUSES.includes(job.status),
    createdAt: job.created_at || job.createdAt,
    updatedAt: job.updated_at || job.updatedAt,
  };
};
