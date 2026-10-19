/**
 * @file job-access.util.js
 * @module Socket_Job_Access
 * @description Đọc snapshot có dependency injection; AI luôn xác minh quyền canonical trước khi subscribe hoặc sync.
 */

import { ROLES } from '../../constants/roles.constant.js';

import { SOCKET_ERROR_CODES, TERMINAL_JOB_STATUSES } from '../constants/socket-events.constants.js';

const PRIVILEGED_ROLES = new Set([ROLES.ADMIN, ROLES.BOSS]);

/** Lỗi giao thức Socket không gửi thông tin nguồn dữ liệu nội bộ. */
const accessError = (code, message) => Object.assign(new Error(message), { code });

/** Giữ hợp đồng snapshot hiện có cho job ảnh/video và sự kiện legacy. */
export const normalizeJobStatusSnapshot = (jobId, jobType, currentStatus = null) => {
  const now = new Date().toISOString();
  const outputs = currentStatus?.data ?? currentStatus?.outputs ?? currentStatus?.result ?? null;
  const error = currentStatus?.failedReason ?? currentStatus?.error ?? null;
  const percent = currentStatus?.percent ?? currentStatus?.progress ?? currentStatus?.percentage ?? 0;
  const rawStatus = currentStatus?.status === 'error' ? 'failed' : currentStatus?.status;
  const states = { waiting: 'queued', 'waiting-children': 'queued', prioritized: 'queued',
    delayed: 'queued', active: 'processing', completed: 'completed', failed: 'failed', unknown: 'processing' };
  let status = ['completed', 'partial_failure', 'failed', 'cancelled', 'queued', 'processing', 'started'].includes(rawStatus)
    ? rawStatus : states[currentStatus?.state] || (currentStatus ? 'processing' : 'queued');
  if (status === 'completed' && outputs?.status === 'partial_failure') status = 'partial_failure';
  if (error && currentStatus?.state === 'failed') status = 'failed';
  const sequence = currentStatus?.sequence ?? 0;
  const emittedAt = currentStatus?.emittedAt ?? currentStatus?.timestamp ?? now;
  return {
    ...currentStatus, jobId, jobType: currentStatus?.jobType || jobType,
    state: currentStatus?.state ?? null, status,
    stage: currentStatus?.stage ?? (status === 'queued' ? 'QUEUED' : status),
    stageIndex: currentStatus?.stageIndex ?? null,
    percent, percentage: percent, progress: percent, message: currentStatus?.message ?? null,
    sequence, attempt: currentStatus?.attempt ?? currentStatus?.attemptsMade ?? 0,
    traceId: currentStatus?.traceId ?? `${jobId}:snapshot`,
    eventId: currentStatus?.eventId ?? `${jobId}:${sequence}:snapshot`, emittedAt,
    result: outputs, outputs, failures: currentStatus?.failures ?? null,
    error, terminal: TERMINAL_JOB_STATUSES.has(status), timestamp: now,
  };
};

/**
 * @param {object} dependencies - Hai cổng đọc lazy, canonical AI service và progress service legacy.
 * @returns {Function} Reader dùng chung cho subscribe, status và reconnect sync.
 */
export const createJobSnapshotReader = ({ readAiJob, readProgressJob }) => async (socket, jobId, jobType) => {
  if (!socket.user?.id) throw accessError(SOCKET_ERROR_CODES.UNAUTHORIZED, 'Authentication is required');
  if (jobType === 'ai' || jobId.startsWith('ai-')) {
    try {
      // Service tải lại tài khoản/quyền từ DB; không tin roles/permissions cũ trên socket.
      const snapshot = await readAiJob(jobId, { id: socket.user.id });
      if (!snapshot?.ownerId) throw accessError(SOCKET_ERROR_CODES.FORBIDDEN, 'AI jobs require a verified owner');
      return snapshot;
    } catch (error) {
      throw accessError(error.statusCode === 403 ? SOCKET_ERROR_CODES.FORBIDDEN
        : error.code || SOCKET_ERROR_CODES.INTERNAL_ERROR, error.message);
    }
  }
  const status = await readProgressJob(jobId);
  if (!status) return null;
  if (status.jobType === 'ai') {
    throw accessError(SOCKET_ERROR_CODES.FORBIDDEN, 'AI jobs require canonical ownership verification');
  }
  const ownerId = status.ownerId ?? status.userId ?? status.createdBy ?? status.created_by;
  const roles = socket.user.roles || [socket.user.role].filter(Boolean);
  const privileged = roles.some((role) => PRIVILEGED_ROLES.has(role));
  if (ownerId && ownerId !== socket.user.id && !privileged) {
    throw accessError(SOCKET_ERROR_CODES.FORBIDDEN, 'You cannot access this job');
  }
  return normalizeJobStatusSnapshot(jobId, jobType, status);
};
