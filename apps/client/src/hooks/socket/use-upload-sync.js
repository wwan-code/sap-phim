/**
 * @file use-upload-sync.js
 * @module Hooks/Socket/UploadSync
 * @description React Custom Hook theo dõi tiến độ tải lên và xử lý ảnh (AI Queue) thời gian thực qua Socket.IO, tự động đồng bộ vào TanStack Query Cache.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import socketClient from "@/shared/lib/socket-client";
import { SOCKET_EVENTS } from "@/shared/constants/socket-events.constants";
import { UPLOAD_QUERY_KEYS } from "@/hooks/queries/use-upload.queries";

const TERMINAL_STATUSES = new Set(["completed", "failed", "partial_failure", "error", "cancelled"]);

/**
 * Hook giám sát và đồng bộ tiến độ tải lên/xử lý ảnh Realtime qua WebSocket
 *
 * @param {string} jobId Mã định danh công việc (jobId)
 * @param {Object} [options={}] Tùy chọn cấu hình
 * @param {string} [options.jobType='upload'] Loại job ('upload' | 'image' | 'movie')
 * @param {boolean} [options.enabled=true] Kích hoạt kết nối lắng nghe
 * @param {Function} [options.onProgress] Callback khi có cập nhật % hoặc stage
 * @param {Function} [options.onComplete] Callback khi hoàn tất thành công (100%)
 * @param {Function} [options.onError] Callback khi gặp lỗi xử lý
 * @param {Array<Array<string>>|Array<string>} [options.invalidateQueries] Danh sách Query Keys cần làm mới khi xong
 * @returns {Object} State tiến độ thời gian thực
 */
export function useUploadSync(jobId, options = {}) {
  const {
    jobType = "upload",
    enabled = true,
    onProgress,
    onComplete,
    onError,
    invalidateQueries,
  } = options;

  const queryClient = useQueryClient();

  const [state, setState] = useState({
    jobId,
    progress: 0,
    percent: 0,
    status: "idle",
    stage: null,
    stageLabel: "",
    message: "",
    queuePosition: null,
    outputs: null,
    error: null,
    isCompleted: false,
    isFailed: false,
    isTerminal: false,
    isRunning: false,
  });

  const callbacksRef = useRef({ onProgress, onComplete, onError, invalidateQueries });
  useEffect(() => {
    callbacksRef.current = { onProgress, onComplete, onError, invalidateQueries };
  }, [onProgress, onComplete, onError, invalidateQueries]);

  /**
   * Xử lý payload tiến độ nhận được từ Socket
   */
  const handleProgressPayload = useCallback(
    (payload) => {
      if (!payload || (payload.jobId && payload.jobId !== jobId)) return;

      const percent = Number(
        payload.percent ?? payload.percentage ?? payload.progress ?? (payload.status === "completed" ? 100 : 0)
      ) || 0;
      const status = payload.status || (percent >= 100 ? "completed" : "processing");
      const isTerminal = TERMINAL_STATUSES.has(status);
      const isCompleted = status === "completed";
      const isFailed = status === "failed" || status === "partial_failure" || status === "error";

      const newState = {
        jobId,
        progress: percent,
        percent,
        status,
        stage: payload.stage || null,
        stageLabel: payload.stageLabel || payload.stage || "",
        message: payload.message || "",
        queuePosition: payload.position ?? payload.queuePosition ?? null,
        outputs: payload.outputs || payload.files || null,
        error: payload.error || null,
        isCompleted,
        isFailed,
        isTerminal,
        isRunning: !isTerminal && status !== "idle",
      };

      setState(newState);

      // Đồng bộ snapshot vào TanStack Query Cache
      queryClient.setQueryData(UPLOAD_QUERY_KEYS.status(jobId), (prev) => ({
        ...(prev || {}),
        ...payload,
        progress: percent,
        percent,
        status,
      }));

      // Gọi callback tương ứng
      callbacksRef.current.onProgress?.(newState);

      if (isCompleted) {
        callbacksRef.current.onComplete?.(newState);
        if (callbacksRef.current.invalidateQueries) {
          const keys = Array.isArray(callbacksRef.current.invalidateQueries[0])
            ? callbacksRef.current.invalidateQueries
            : [callbacksRef.current.invalidateQueries];
          keys.forEach((key) => queryClient.invalidateQueries({ queryKey: key }));
        }
      } else if (isFailed) {
        callbacksRef.current.onError?.(newState.error || new Error("Xử lý tải lên thất bại"), newState);
      }
    },
    [jobId, queryClient]
  );

  useEffect(() => {
    if (!jobId || !enabled) return;

    // 1. Subscribe vào Socket Room của Job
    socketClient.emit(SOCKET_EVENTS.JOB_SUBSCRIBE, { jobId, jobType });

    // 2. Lắng nghe các sự kiện cập nhật tiến độ
    const unsubJobProgress = socketClient.on(SOCKET_EVENTS.JOB_PROGRESS, handleProgressPayload);
    const unsubUploadProgress = socketClient.on(SOCKET_EVENTS.UPLOAD_PROGRESS, handleProgressPayload);
    const unsubUploadComplete = socketClient.on(SOCKET_EVENTS.UPLOAD_COMPLETE, handleProgressPayload);
    const unsubUploadError = socketClient.on(SOCKET_EVENTS.UPLOAD_ERROR, handleProgressPayload);
    const unsubQueue = socketClient.on(SOCKET_EVENTS.QUEUE_POSITION, handleProgressPayload);

    // 3. Cleanup khi unmount hoặc đổi jobId
    return () => {
      socketClient.emit(SOCKET_EVENTS.JOB_UNSUBSCRIBE, { jobId });
      unsubJobProgress();
      unsubUploadProgress();
      unsubUploadComplete();
      unsubUploadError();
      unsubQueue();
    };
  }, [jobId, jobType, enabled, handleProgressPayload]);

  return {
    ...state,
    reset: () =>
      setState({
        jobId,
        progress: 0,
        percent: 0,
        status: "idle",
        stage: null,
        stageLabel: "",
        message: "",
        queuePosition: null,
        outputs: null,
        error: null,
        isCompleted: false,
        isFailed: false,
        isTerminal: false,
        isRunning: false,
      }),
  };
}

export const useUploadProgress = useUploadSync;
export default useUploadSync;
