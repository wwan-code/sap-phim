/**
 * @file use-job-socket.js
 * @module Hooks/Socket/UseJobSocket
 * @description Hook chuyên biệt giao tiếp với Global Job Store (Zustand) và Socket.IO.
 *              Cung cấp API headless để đọc và quản lý trạng thái tác vụ phim (Movie Job),
 *              tự động kích hoạt subscription, điều phối side-effects (onComplete, onError)
 *              và làm mới cache dữ liệu React Query khi tác vụ kết thúc.
 */

import { useEffect, useRef, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSelector } from 'react-redux';

import { selectCurrentUser } from '@/store/slices/auth.slice';
import { useJobStore } from '@/store/use-job-store';
import { JOB_STATUSES } from '@/shared/constants/jobs.constants';
import { socketClient } from '@/shared/lib';

const INITIAL_JOB_STATE = {
  jobId: null,
  jobType: 'movie',
  title: 'Xử lý tác phẩm điện ảnh',
  status: JOB_STATUSES.QUEUED,
  percent: 0,
  stage: null,
  stageLabel: null,
  message: '',
  outputs: null,
  failures: [],
  error: null,
  totalItems: null,
  processedItems: null,
  failedItems: null,
  isActive: false,
  isProcessing: false,
  isCompleted: false,
  isPartialFailure: false,
  isFailed: false,
  isTerminal: false,
  isStale: false,
  isDismissed: false,
  sequence: -1,
};

/**
 * @hook useJobSocket
 * @description Hook theo dõi một Job cụ thể qua ID
 * @param {string|null} jobId - ID tác vụ cần theo dõi
 * @param {Object} [options={}] - Cấu hình callbacks và query invalidation
 * @param {Function} [options.onComplete] - Callback khi hoàn tất thành công
 * @param {Function} [options.onPartialFailure] - Callback khi có lỗi một phần
 * @param {Function} [options.onError] - Callback khi thất bại
 * @param {Function} [options.onStageChange] - Callback khi đổi giai đoạn xử lý
 * @param {Function} [options.onStart] - Callback khi bắt đầu xử lý
 * @param {Function} [options.onStale] - Callback khi tác vụ bị treo không phản hồi
 * @param {Array<string|any>} [options.invalidateQueries] - Danh sách query key cần refresh cache
 * @returns {Object} Job State từ Zustand Store
 */
export function useJobSocket(jobId, options = {}) {
  const queryClient = useQueryClient();
  const jobType = options.jobType || 'movie';

  // Đọc state từ Global Store với selector chuẩn (tránh cấp phát object mới trong selector)
  const rawJobState = useJobStore((state) => (jobId ? state.jobs[jobId] : null));
  const jobState = useMemo(
    () => rawJobState || { ...INITIAL_JOB_STATE, jobId, jobType },
    [rawJobState, jobId, jobType]
  );

  const optionsRef = useRef(options);
  const prevStatusRef = useRef(jobState.status);
  const prevStageRef = useRef(jobState.stage);
  const completedHandledRef = useRef(false);

  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  // A different job must not inherit handled-completion state from the previous one.
  useEffect(() => {
    completedHandledRef.current = false;
    prevStatusRef.current = null;
    prevStageRef.current = null;
  }, [jobId]);

  // Quản lý Socket Room Subscription theo Reference Count
  useEffect(() => {
    if (!jobId) return;

    socketClient.subscribeJob(jobId, jobType);

    return () => {
      // Unsubscribe khi component unmount
      socketClient.unsubscribeJob(jobId, jobType);
    };
  }, [jobId, jobType]);

  // Điều phối các Side Effects khi State thay đổi
  useEffect(() => {
    if (!jobId || !jobState) {
      completedHandledRef.current = false;
      return;
    }

    const opts = optionsRef.current;
    const currentStatus = jobState.status;

    // 1. Stage change side-effect
    if (jobState.stage && jobState.stage !== prevStageRef.current) {
      opts.onStageChange?.(jobState.stage, jobState);
      prevStageRef.current = jobState.stage;
    }

    // 2. Initial / Reconnect Completed check
    const isCompleted = currentStatus === JOB_STATUSES.COMPLETED || currentStatus === 'completed';
    if (isCompleted && !completedHandledRef.current) {
      completedHandledRef.current = true;
      opts.onComplete?.(jobState);
    }

    // 3. Status change side-effects
    if (currentStatus !== prevStatusRef.current) {
      if (currentStatus === JOB_STATUSES.QUEUED && opts.onQueued) {
        opts.onQueued(jobState);
      }
      if (currentStatus === JOB_STATUSES.PROCESSING && opts.onStart) {
        opts.onStart(jobState);
      }

      if (jobState.isTerminal || isCompleted) {
        if (isCompleted && opts.onComplete && !completedHandledRef.current) {
          completedHandledRef.current = true;
          opts.onComplete(jobState);
        } else if (currentStatus === JOB_STATUSES.CANCELLED) {
          opts.onCancelled?.(jobState);
        } else if (currentStatus === JOB_STATUSES.PARTIAL_FAILURE && opts.onPartialFailure) {
          opts.onPartialFailure(jobState);
        } else if (
          (currentStatus === JOB_STATUSES.FAILED || currentStatus === JOB_STATUSES.ERROR || currentStatus === 'failed') &&
          opts.onError
        ) {
          opts.onError(jobState);
        }

        // Tự động làm mới React Query cache
        if (opts.invalidateQueries) {
          queryClient.invalidateQueries({ queryKey: opts.invalidateQueries });
        }
      }

      prevStatusRef.current = currentStatus;
    }

    // 4. Stale side-effect
    if (jobState.isStale && opts.onStale) {
      if (prevStatusRef.current !== 'stale') {
        opts.onStale(jobState);
        prevStatusRef.current = 'stale';
      }
    }
  }, [jobId, jobState, queryClient]);

  return jobState;
}

/**
 * @hook useActiveJob
 * @description Hook lấy thông tin Job đang hoạt động chính hiện tại từ Global Store
 * @returns {Object} { activeJob, activeJobCount, allActiveJobs, isFloatingMinimized, ...actions }
 */
export function useActiveJob() {
  const ownerId = useSelector(selectCurrentUser)?.id;
  const activeMovieJobId = useJobStore((state) => state.activeMovieJobId);
  const activeJobIds = useJobStore((state) => state.activeJobIds);
  const jobs = useJobStore((state) => state.jobs);
  const isFloatingMinimized = useJobStore((state) => state.isFloatingMinimized);

  const dismissJob = useJobStore((state) => state.dismissJob);
  const setActiveMovieJobId = useJobStore((state) => state.setActiveMovieJobId);
  const toggleFloatingMinimized = useJobStore((state) => state.toggleFloatingMinimized);
  const setFloatingMinimized = useJobStore((state) => state.setFloatingMinimized);

  const allActiveJobs = useMemo(() => {
    return activeJobIds
      .map((id) => jobs[id])
      .filter((job) => job && !job.isDismissed && job.jobType !== 'suggest' && (job.jobType !== 'ai' || (ownerId && String(job.ownerId) === String(ownerId))));
  }, [activeJobIds, jobs, ownerId]);

  const activeJob = useMemo(() => {
    if (activeMovieJobId && jobs[activeMovieJobId] && allActiveJobs.some((job) => job.jobId === activeMovieJobId)) {
      return jobs[activeMovieJobId];
    }
    if (allActiveJobs.length > 0) {
      return allActiveJobs[0];
    }
    return null;
  }, [activeMovieJobId, allActiveJobs, jobs]);

  return {
    activeJob,
    activeJobId: activeJob?.jobId || null,
    activeJobCount: allActiveJobs.length,
    allActiveJobs,
    isFloatingMinimized,
    dismissJob,
    setActiveMovieJobId,
    toggleFloatingMinimized,
    setFloatingMinimized,
  };
}

export default useJobSocket;
