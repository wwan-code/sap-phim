/**
 * @file use-job-store.js
 * @module Store/UseJobStore
 * @description Global Zustand Store quản lý trạng thái các tiến trình nền làm Single Source of Truth cho toàn bộ ứng dụng.
 *              Tách biệt hoàn toàn Lifecycle của Job khỏi Component Tree, hỗ trợ đa tác vụ
 *              đồng thời (Multi-job Concurrency), Throttling 150ms, Sequence Ordering,
 *              Giữ kết quả AI cho tới khi quản trị viên đóng và phục hồi kết nối.
 */

import { create } from 'zustand';

import { acceptsJobEvent } from '@/shared/utils/job-lifecycle.util';
import socketClient from '@/shared/lib/socket-client';
import {
  SOCKET_EVENTS,
  TERMINAL_JOB_STATUSES,
} from '@/shared/constants/socket-events.constants';
import {
  JOB_STATUSES,
  STAGE_LABELS,
} from '@/shared/constants/jobs.constants';

const THROTTLE_MS = 150;
const STALE_TIMEOUT_MS = 5 * 60 * 1000;
const AUTO_DISMISS_DELAY_MS = 5000;

/**
 * Cấu trúc Job State mặc định
 */
const createInitialJobRecord = (jobId, meta = {}) => {
  const now = Date.now();
  return {
    jobId,
    jobType: meta.jobType || 'movie',
    title: meta.title || 'Xử lý tác phẩm điện ảnh',
    movieId: meta.movieId || null,
    ownerId: meta.ownerId || null,
    target: meta.target || null,
    requestId: meta.requestId || null,
    attempt: meta.attempt || 0,
    status: JOB_STATUSES.QUEUED,
    percent: 0,
    stage: meta.jobType === 'ai' ? 'QUEUED' : 'upload_images',
    stageLabel: STAGE_LABELS[meta.jobType === 'ai' ? 'QUEUED' : 'upload_images'],
    message: meta.message || 'Đang chuẩn bị tiến trình...',
    outputs: null,
    failures: [],
    error: null,
    totalItems: meta.totalItems ?? null,
    processedItems: meta.processedItems ?? null,
    failedItems: meta.failedItems ?? null,

    isActive: true,
    isProcessing: false,
    isCompleted: false,
    isPartialFailure: false,
    isFailed: false,
    isTerminal: false,
    isStale: false,
    isDismissed: false,

    sequence: -1,
    startedAt: now,
    updatedAt: now,
    completedAt: null,
  };
};

export const useJobStore = create((set, get) => ({
  // Dictionary lưu các Job State theo ID: { [jobId]: JobRecord }
  jobs: {},
  // Danh sách ID các job đang hoạt động hoặc chưa bị dismiss (theo thứ tự mới nhất trước)
  activeJobIds: [],
  // ID của Movie Job đang được chọn hiển thị chính
  activeMovieJobId: null,
  // Trạng thái thu gọn/mở rộng của Floating Widget
  isFloatingMinimized: false,

  // ── Actions: State Updates ──────────────────────────────────────────────

  /**
   * Đăng ký một Job mới vào Global Store và kích hoạt Socket Room Subscription
   * @param {string} jobId 
   * @param {Object} [meta={}] 
   */
  registerJob: (jobId, meta = {}) => {
    if (!jobId) return;

    set((state) => {
      const existing = state.jobs[jobId];
      const initialRecord = existing || createInitialJobRecord(jobId, meta);

      // Đảm bảo jobId nằm trong activeJobIds (đưa lên đầu danh sách)
      const nextActiveIds = [jobId, ...state.activeJobIds.filter((id) => id !== jobId)];

      return {
        jobs: {
          ...state.jobs,
          [jobId]: {
            ...initialRecord,
            ...meta,
            isDismissed: false,
            updatedAt: Date.now(),
          },
        },
        activeJobIds: nextActiveIds,
        activeMovieJobId: jobId, // Tự động focus vào job vừa tạo
      };
    });

    // The global store owns one retained subscription independent of page hooks.
    const { _refs } = get();
    if (!_refs.subscribedJobs.has(jobId) && !get().jobs[jobId]?.isTerminal) {
      const jobType = meta.jobType || 'movie';
      _refs.subscribedJobs.set(jobId, jobType);
      socketClient.subscribeJob(jobId, jobType);
    }
  },

  /**
   * Chuyển đổi job đang hiển thị chính
   * @param {string} jobId 
   */
  setActiveMovieJobId: (jobId) => {
    set({ activeMovieJobId: jobId });
  },

  /**
   * Đóng/Ẩn một job khỏi Floating Widget
   * @param {string} jobId 
   */
  dismissJob: (jobId) => {
    if (!jobId) return;

    const { _refs } = get();
    // Xóa timer auto-dismiss nếu có
    if (_refs.autoDismissTimers.has(jobId)) {
      clearTimeout(_refs.autoDismissTimers.get(jobId));
      _refs.autoDismissTimers.delete(jobId);
    }

    set((state) => {
      const targetJob = state.jobs[jobId];
      if (!targetJob) return state;

      const nextActiveIds = state.activeJobIds.filter((id) => id !== jobId);
      let nextActiveMovieId = state.activeMovieJobId;

      if (state.activeMovieJobId === jobId) {
        nextActiveMovieId = nextActiveIds.length > 0 ? nextActiveIds[0] : null;
      }

      return {
        jobs: {
          ...state.jobs,
          [jobId]: {
            ...targetJob,
            isDismissed: true,
          },
        },
        activeJobIds: nextActiveIds,
        activeMovieJobId: nextActiveMovieId,
      };
    });
  },

  /**
   * Thu nhỏ / Mở rộng Floating Widget
   */
  toggleFloatingMinimized: () => {
    set((state) => ({ isFloatingMinimized: !state.isFloatingMinimized }));
  },

  setFloatingMinimized: (isMinimized) => {
    set({ isFloatingMinimized: Boolean(isMinimized) });
  },

  /**
   * Xóa tất cả các job đã hoàn thành
   */
  clearCompletedJobs: () => {
    set((state) => {
      const remainingActiveIds = state.activeJobIds.filter(
        (id) => !state.jobs[id]?.isCompleted
      );
      return {
        activeJobIds: remainingActiveIds,
        activeMovieJobId: remainingActiveIds.length > 0 ? remainingActiveIds[0] : null,
      };
    });
  },

  /**
   * Cập nhật tiến độ Job (Xử lý Sequence, Deduplication, Auto-dismiss 5s)
   * @param {Object} payload 
   */
  updateJobProgress: (payload) => {
    if (!payload || !payload.jobId) return;

    const { jobId } = payload;
    if (!acceptsJobEvent(get().jobs[jobId], payload)) return;
    const { _refs, dismissJob } = get();

    set((state) => {
      const currentJob = state.jobs[jobId] || createInitialJobRecord(jobId, payload);

      // 1. Chống Race Condition: Bỏ qua event có sequence thấp hơn
      const incomingSeq = payload.sequence ?? (currentJob.sequence + 1);
      if (incomingSeq < currentJob.sequence) {
        return state;
      }

      const rawStatus = payload.status || (payload.terminal ? 'completed' : 'processing');
      const isCompleted = rawStatus === 'completed';
      const isPartialFailure = rawStatus === 'partial_failure';
      const isFailed = rawStatus === 'failed' || rawStatus === 'error';
      const isTerminal = payload.terminal || TERMINAL_JOB_STATUSES.has(rawStatus) || isCompleted || isPartialFailure || isFailed;

      const percent = Math.min(
        100,
        Math.max(0, payload.percent ?? payload.percentage ?? payload.progress ?? currentJob.percent)
      );

      const stage = payload.stage || currentJob.stage;
      const stageLabel = stage ? (STAGE_LABELS[stage] || payload.stageLabel || stage) : currentJob.stageLabel;
      const failures = Array.isArray(payload.failures) ? payload.failures : currentJob.failures;
      const outputs = payload.outputs ?? payload.result ?? payload.finalImages ?? currentJob.outputs;
      const error = payload.error ?? payload.failedReason ?? currentJob.error;
      const now = Date.now();

      const updatedJob = {
        ...currentJob,
        jobType: payload.jobType || currentJob.jobType,
        ownerId: payload.ownerId ?? currentJob.ownerId,
        target: payload.target ?? currentJob.target,
        requestId: payload.requestId ?? currentJob.requestId,
        attempt: payload.attempt ?? currentJob.attempt,
        status: rawStatus,
        percent,
        stage,
        stageLabel,
        message: payload.message || currentJob.message || '',
        outputs,
        result: outputs,
        failures,
        error,
        totalItems: payload.totalImages ?? payload.totalItems ?? currentJob.totalItems,
        processedItems: payload.currentImage ?? payload.processedItems ?? currentJob.processedItems,
        failedItems: failures.length > 0 ? failures.length : currentJob.failedItems,

        isActive: rawStatus === 'queued' || rawStatus === 'processing',
        isProcessing: rawStatus === 'processing',
        isCompleted,
        isPartialFailure,
        isFailed,
        isTerminal,
        isStale: false,

        sequence: incomingSeq,
        updatedAt: now,
        completedAt: isTerminal ? (currentJob.completedAt || now) : null,
      };

      // Đảm bảo job nằm trong activeJobIds nếu chưa bị dismiss
      const nextActiveIds = currentJob.isDismissed
        ? state.activeJobIds
        : state.activeJobIds.includes(jobId)
          ? state.activeJobIds
          : [jobId, ...state.activeJobIds];

      return {
        jobs: {
          ...state.jobs,
          [jobId]: updatedJob,
        },
        activeJobIds: nextActiveIds,
        activeMovieJobId: state.activeMovieJobId || jobId,
      };
    });

    // 2. Quản lý Auto-dismiss 5s khi Hoàn Thành (Success 100%)
    const rawStatus = payload.status || (payload.terminal ? 'completed' : 'processing');
    if (TERMINAL_JOB_STATUSES.has(rawStatus) && _refs.subscribedJobs.has(jobId)) {
      socketClient.unsubscribeJob(jobId, _refs.subscribedJobs.get(jobId));
      _refs.subscribedJobs.delete(jobId);
    }
    if (rawStatus === 'completed' && get().jobs[jobId]?.jobType !== 'ai') {
      if (_refs.autoDismissTimers.has(jobId)) {
        clearTimeout(_refs.autoDismissTimers.get(jobId));
      }
      const autoDismissTimer = setTimeout(() => {
        dismissJob(jobId);
        _refs.autoDismissTimers.delete(jobId);
      }, AUTO_DISMISS_DELAY_MS);
      _refs.autoDismissTimers.set(jobId, autoDismissTimer);
    } else if (rawStatus === 'failed' || rawStatus === 'partial_failure' || rawStatus === 'error') {
      // Giữ nguyên lỗi cho Admin kiểm tra và bấm Retry
      if (_refs.autoDismissTimers.has(jobId)) {
        clearTimeout(_refs.autoDismissTimers.get(jobId));
        _refs.autoDismissTimers.delete(jobId);
      }
    }
  },

  setJobStale: (jobId) => {
    set((state) => {
      const currentJob = state.jobs[jobId];
      if (!currentJob || currentJob.isTerminal) return state;
      return {
        jobs: {
          ...state.jobs,
          [jobId]: { ...currentJob, isStale: true },
        },
      };
    });
  },

  // ── Throttling & Stale Management ─────────────────────────────────────

  _refs: {
    subscribedJobs: new Map(),
    pendingUpdates: new Map(),
    throttleTimers: new Map(),
    staleTimers: new Map(),
    autoDismissTimers: new Map(),
  },

  queueJobUpdate: (payload) => {
    if (!payload || !payload.jobId) return;

    // 1. Khử trùng lặp qua eventId
    if (payload.eventId && !socketClient.trackEventId(payload.eventId)) {
      return;
    }

    const { jobId } = payload;
    const { _refs, updateJobProgress, setJobStale } = get();

    // 2. Reset Stale Timer (5 phút)
    if (_refs.staleTimers.has(jobId)) {
      clearTimeout(_refs.staleTimers.get(jobId));
    }
    const staleTimer = setTimeout(() => {
      setJobStale(jobId);
    }, STALE_TIMEOUT_MS);
    _refs.staleTimers.set(jobId, staleTimer);

    // 3. Queue update để throttle
    const pending = _refs.pendingUpdates.get(jobId);
    if (!acceptsJobEvent(pending || get().jobs[jobId], payload)) return;
    _refs.pendingUpdates.set(jobId, payload);

    const isTerminal = payload.terminal || TERMINAL_JOB_STATUSES.has(payload.status);

    // Nếu là terminal event -> flush ngay lập tức không chờ throttle
    if (isTerminal) {
      if (_refs.throttleTimers.has(jobId)) {
        clearTimeout(_refs.throttleTimers.get(jobId));
        _refs.throttleTimers.delete(jobId);
      }

      const finalPayload = _refs.pendingUpdates.get(jobId);
      _refs.pendingUpdates.delete(jobId);
      if (finalPayload) updateJobProgress(finalPayload);

      // Clear stale timer for terminal
      if (_refs.staleTimers.has(jobId)) {
        clearTimeout(_refs.staleTimers.get(jobId));
        _refs.staleTimers.delete(jobId);
      }
      return;
    }

    // Nếu chưa có timer, khởi tạo timer throttle 150ms
    if (!_refs.throttleTimers.has(jobId)) {
      const timer = setTimeout(() => {
        _refs.throttleTimers.delete(jobId);
        const batchedPayload = _refs.pendingUpdates.get(jobId);
        _refs.pendingUpdates.delete(jobId);

        if (batchedPayload) {
          updateJobProgress(batchedPayload);
        }
      }, THROTTLE_MS);
      _refs.throttleTimers.set(jobId, timer);
    }
  },

  // ── Global Socket Listeners ──────────────────────────────────────────

  _isListening: false,
  _unsubscribeFn: null,

  initSocketListeners: () => {
    const state = get();
    if (state._isListening) return;

    const handleProgress = (payload) => {
      get().queueJobUpdate(payload);
    };

    const unsubProgress = socketClient.on(SOCKET_EVENTS.JOB_PROGRESS, handleProgress);
    const unsubSubscribed = socketClient.on(SOCKET_EVENTS.JOB_SUBSCRIBED, handleProgress);


    set({
      _isListening: true,
      _unsubscribeFn: () => {
        unsubProgress();
        unsubSubscribed();


        // Cleanup all timers
        const { _refs } = get();
        _refs.throttleTimers.forEach(clearTimeout);
        _refs.staleTimers.forEach(clearTimeout);
        _refs.autoDismissTimers.forEach(clearTimeout);
        _refs.throttleTimers.clear();
        _refs.staleTimers.clear();
        _refs.autoDismissTimers.clear();
        _refs.pendingUpdates.clear();
      },
    });
  },

  cleanupSocketListeners: () => {
    const state = get();
    if (state._unsubscribeFn) {
      state._unsubscribeFn();
      set({ _isListening: false, _unsubscribeFn: null });
    }
  },
}));

export default useJobStore;
