/**
 * @file use-job-progress.js
 * @module Widgets/JobProgressWidget/Hooks/useJobProgress
 * @description Hook chuẩn hóa dữ liệu tiến trình job, tính toán trạng thái, percent,
 *              counters, failures và quản lý trạng thái Failure Inspector.
 */

import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

import { ROUTES } from '@/shared/constants/routes.constants';
import { useJobStore } from '@/store/use-job-store';

import {
  JOB_STATUSES,
  JOB_STATUS_VARIANTS,
  JOB_STATUS_LABELS,
  STAGE_LABELS,
  COPY_FEEDBACK_TIMEOUT_MS,
} from '../job-progress-widget.constants';

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Chuẩn hóa giá trị percent về khoảng [0, 100], tránh NaN và vượt ngưỡng.
 * @param {number|string|null|undefined} raw
 * @returns {number}
 */
const normalizePercent = (raw) => {
  const num = parseFloat(raw);
  if (!isFinite(num)) return 0;
  return Math.min(100, Math.max(0, Math.round(num)));
};

/**
 * Lấy label stage thân thiện từ mã stage kỹ thuật.
 * @param {string|undefined} stage
 * @returns {string|null}
 */
const resolveStageLabel = (stage) => {
  if (!stage) return null;
  return STAGE_LABELS[stage] || stage;
};

/**
 * Format danh sách failures thành cấu trúc chuẩn để hiển thị.
 * @param {Array<{type?:string, error?:string, message?:string, file?:string}>} failures
 * @returns {Array<{id:string, type:string, message:string, file?:string}>}
 */
const normalizeFailures = (failures) => {
  if (!Array.isArray(failures) || failures.length === 0) return [];
  return failures.map((item, index) => ({
    id:      item.id     || `failure-${index}-${item.type || 'unknown'}`,
    type:    item.type   || 'unknown',
    message: item.error  || item.message || 'Lỗi không xác định',
    file:    item.file   || item.path    || null,
  }));
};

// ─────────────────────────────────────────────────────────────────────────────
// HOOK
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @hook useJobProgress
 * @description Hook chuẩn hóa và quản lý dữ liệu tiến trình job background xử lý phim.
 * @param {object|null} job - Raw job object từ WebSocket / API / Zustand Store
 * @param {object} options
 * @param {Function} [options.onRetry] - Callback khi bấm thử lại
 * @param {boolean} [options.isRetrying=false] - Loading state của retry action
 * @returns {object} Normalized state và handlers
 */
export const useJobProgress = (job, options = {}) => {
  const { onRetry, isRetrying = false } = options;
  const navigate = useNavigate();

  // ─── Local UI State ────────────────────────────────────────────────────────
  const [isFailuresExpanded, setIsFailuresExpanded] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(null); // 'success' | 'error' | null

  // ─── Normalized Progress Payload ──────────────────────────────────────────
  const progress = useMemo(() => {
    const raw = job?.progress && typeof job.progress === 'object' ? job.progress : job || {};
    const percentValue = raw.percent ?? raw.percentage ?? raw.progress;

    return {
      jobType: raw.jobType || job?.jobType,
      ownerId: raw.ownerId || job?.ownerId,
      target: raw.target || job?.target,
      result: raw.result || raw.outputs || job?.result || job?.outputs,
      error: typeof raw.error === 'string' ? raw.error : typeof raw.error?.message === 'string' ? raw.error.message : raw.error ? 'Tác vụ chưa thể hoàn tất.' : null,
      jobId:          raw.jobId          || job?.jobId          || null,
      title:          raw.title          || job?.title          || null,
      status:         raw.status         || JOB_STATUSES.QUEUED,
      percent:        normalizePercent(percentValue),
      message:        raw.message        || null,
      stage:          raw.stage          || null,
      failures:       normalizeFailures(raw.failures),
      totalItems:     raw.totalItems     ?? raw.totalImages ?? null,
      processedItems: raw.processedItems ?? raw.currentImage ?? null,
      failedItems:    raw.failedItems    ?? null,
    };
  }, [job]);

  // ─── Status Derived Flags ─────────────────────────────────────────────────
  const statusFlags = useMemo(() => {
    const { status } = progress;
    return {
      isQueued:       status === JOB_STATUSES.QUEUED,
      isActive:       status === JOB_STATUSES.PROCESSING || status === JOB_STATUSES.QUEUED,
      isProcessing:   status === JOB_STATUSES.PROCESSING,
      isReconnecting: status === JOB_STATUSES.RECONNECTING || job?.isReconnecting === true,
      isCompleted:    status === JOB_STATUSES.COMPLETED,
      isPartialFail:  status === JOB_STATUSES.PARTIAL_FAILURE,
      isFailed:       status === JOB_STATUSES.FAILED || status === JOB_STATUSES.ERROR,
      isError:        status === JOB_STATUSES.FAILED || status === JOB_STATUSES.ERROR || status === JOB_STATUSES.PARTIAL_FAILURE,
      isTerminal:     status === JOB_STATUSES.COMPLETED || status === JOB_STATUSES.FAILED || status === JOB_STATUSES.ERROR || status === JOB_STATUSES.PARTIAL_FAILURE || status === JOB_STATUSES.CANCELLED,
    };
  }, [progress, job?.isReconnecting]);

  // ─── Display Metadata ─────────────────────────────────────────────────────
  const display = useMemo(() => {
    const stageText = resolveStageLabel(progress.stage);
    const defaultTitle = progress.title || (progress.jobId ? `Tác vụ: ${progress.jobId}` : 'Xử lý hình ảnh phim');

    return {
      statusLabel:   JOB_STATUS_LABELS[progress.status]   || 'Đang xử lý',
      statusVariant: JOB_STATUS_VARIANTS[progress.status] || 'info',
      stageLabel:    stageText,
      titleText:     defaultTitle,
      counterText:   (() => {
        const { totalItems, processedItems } = progress;
        if (totalItems != null && processedItems != null) {
          return `${processedItems}/${totalItems} ảnh`;
        }
        return null;
      })(),
      percentText: `${progress.percent}%`,
    };
  }, [progress]);

  // ─── CircularProgress Mode ────────────────────────────────────────────────
  const progressVariant = statusFlags.isProcessing && progress.percent === 0
    ? 'indeterminate'
    : 'determinate';

  // ─── Failures Summary ─────────────────────────────────────────────────────
  const hasFailures  = progress.failures.length > 0;
  const failureCount = progress.failures.length;

  // ─── Handlers ─────────────────────────────────────────────────────────────
  const handleToggleFailures = useCallback(() => {
    setIsFailuresExpanded((prev) => !prev);
  }, []);

  const handleRetry = useCallback(() => {
    if (typeof onRetry === 'function' && !isRetrying) {
      onRetry(progress.jobId, job);
    }
  }, [onRetry, isRetrying, progress.jobId, job]);

  const handleCopyErrors = useCallback(async () => {
    if (!hasFailures) return;
    const text = progress.failures
      .map((f) => `[${f.type}] ${f.message}${f.file ? ` (${f.file})` : ''}`)
      .join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopyFeedback('success');
    } catch {
      setCopyFeedback('error');
    } finally {
      setTimeout(() => setCopyFeedback(null), COPY_FEEDBACK_TIMEOUT_MS);
    }
  }, [progress.failures, hasFailures]);

  const handleOpenAiResult = useCallback(() => {
    if (progress.jobType !== 'ai' || !progress.target) return;
    const path = progress.target.movieId ? ROUTES.ADMIN.MOVIE_EDIT(progress.target.movieId) : ROUTES.ADMIN.MOVIE_CREATE;
    if (progress.jobId) {
      useJobStore.getState().dismissJob(progress.jobId);
    }
    navigate(path, { state: { aiJobId: progress.jobId } });
  }, [navigate, progress]);

  // ─── Return ───────────────────────────────────────────────────────────────
  return {
    progress,
    handleOpenAiResult,
    display,
    ...statusFlags,
    progressVariant,
    hasFailures,
    failureCount,
    isFailuresExpanded,
    copyFeedback,
    handleToggleFailures,
    handleRetry,
    handleCopyErrors,
  };
};

export default useJobProgress;
