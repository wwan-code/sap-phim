/**
 * @file use-socket.js
 * @module Hooks/Socket
 * @description Các React Custom Hooks chuyên sâu phục vụ kết nối thời gian thực, giám sát Job, Episode, Presence và Notification.
 */

import { useEffect, useState, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSocket } from '@/app/providers/SocketProvider';
import socketClient from '@/shared/lib/socket-client';
import {
  SOCKET_EVENTS,
  TERMINAL_JOB_STATUSES,
} from '@/shared/constants/socket-events.constants';
import useNotificationSync from './use-notification-sync';

export { useSocket };

/**
 * Hook lắng nghe một sự kiện Socket.IO với cơ chế tự động dọn dẹp (Cleanup) chống Memory Leak
 * @param {string} eventName - Tên sự kiện cần lắng nghe
 * @param {Function} handler - Hàm callback xử lý khi nhận sự kiện
 * @param {Array} [deps=[]] - Dependency array
 */
export function useSocketEvent(eventName, handler, deps = []) {
  const savedHandler = useRef(handler);

  useEffect(() => {
    savedHandler.current = handler;
  }, [handler]);

  useEffect(() => {
    if (!eventName) return;

    const eventListener = (...args) => {
      savedHandler.current?.(...args);
    };

    const cleanup = socketClient.on(eventName, eventListener);
    return () => {
      cleanup();
    };
  }, [eventName, ...deps]);
}

/**
 * Hook theo dõi tiến trình xử lý Job (Video Transcoding, AI Suggestion,...) thời gian thực
 * @param {string|number} jobId - Mã định danh của Job
 * @param {string} [jobType='movie'] - Loại Job ('movie' | 'suggest' | ...)
 * @param {Object} [options={}] - Cấu hình thêm (onComplete, onError, invalidateQueries)
 * @returns {Object} { progress, status, stage, message, outputs, error, isTerminal, isCompleted, isFailed }
 */
export function useJobProgress(jobId, jobType = 'movie', options = {}) {
  const queryClient = useQueryClient();
  const [jobState, setJobState] = useState({
    jobId,
    jobType,
    progress: 0,
    status: 'queued',
    stage: 'Đang chuẩn bị...',
    message: '',
    outputs: null,
    error: null,
    isTerminal: false,
    isCompleted: false,
    isFailed: false,
  });

  const lastSequenceRef = useRef(-1);
  const optionsRef = useRef(options);

  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  const handleProgressEvent = useCallback((payload) => {
    if (!payload || payload.jobId !== jobId) return;

    // 1. Khử trùng lặp qua eventId
    if (payload.eventId && !socketClient.trackEventId(payload.eventId)) {
      return;
    }

    // 2. Chống Race Condition: Bỏ qua các event cũ có sequence thấp hơn
    const incomingSeq = payload.sequence ?? 0;
    if (incomingSeq < lastSequenceRef.current) {
      return;
    }
    lastSequenceRef.current = incomingSeq;

    const percent = Math.min(100, Math.max(0, payload.percent ?? payload.percentage ?? payload.progress ?? 0));
    const rawStatus = payload.status || 'processing';
    const isTerminal = payload.terminal || TERMINAL_JOB_STATUSES.has(rawStatus);
    const isCompleted = rawStatus === 'completed';
    const isFailed = rawStatus === 'failed' || rawStatus === 'partial_failure' || rawStatus === 'error';
    const outputs = payload.outputs ?? payload.result ?? payload.data ?? null;
    const error = payload.error ?? payload.failedReason ?? null;

    setJobState({
      jobId,
      jobType,
      progress: percent,
      status: rawStatus,
      stage: payload.stage || (isCompleted ? 'Hoàn thành' : 'Đang xử lý...'),
      message: payload.message || '',
      outputs,
      error,
      isTerminal,
      isCompleted,
      isFailed,
    });

    if (isTerminal) {
      if (isCompleted) {
        optionsRef.current.onComplete?.(payload);
      } else if (isFailed) {
        optionsRef.current.onError?.(error || payload);
      }

      if (optionsRef.current.invalidateQueries) {
        queryClient.invalidateQueries({ queryKey: optionsRef.current.invalidateQueries });
      }
    }
  }, [jobId, jobType, queryClient]);

  useEffect(() => {
    if (!jobId) return;

    lastSequenceRef.current = -1;
    socketClient.subscribeJob(jobId, jobType);

    const unsubProgress = socketClient.on(SOCKET_EVENTS.JOB_PROGRESS, handleProgressEvent);
    const unsubSubscribed = socketClient.on(SOCKET_EVENTS.JOB_SUBSCRIBED, handleProgressEvent);
    const unsubAiProgress = socketClient.on(SOCKET_EVENTS.AI_JOB_PROGRESS, handleProgressEvent);
    const unsubAiCompleted = socketClient.on(SOCKET_EVENTS.AI_JOB_COMPLETED, handleProgressEvent);
    const unsubAiFailed = socketClient.on(SOCKET_EVENTS.AI_JOB_FAILED, handleProgressEvent);

    return () => {
      unsubProgress();
      unsubSubscribed();
      unsubAiProgress();
      unsubAiCompleted();
      unsubAiFailed();
      socketClient.unsubscribeJob(jobId, jobType);
    };
  }, [jobId, jobType, handleProgressEvent]);

  return jobState;
}

/**
 * Hook theo dõi tiến trình mã hóa tập phim (Episode) dành cho Quản trị viên
 * @param {string|number} episodeId - Mã tập phim
 * @param {Object} [options={}]
 * @returns {Object} { progress, stage, isCompleted, isFailed, error }
 */
export function useEpisodeProgress(episodeId, options = {}) {
  const queryClient = useQueryClient();
  const [episodeState, setEpisodeState] = useState({
    episodeId,
    progress: 0,
    stage: 'Đang chuẩn bị...',
    isCompleted: false,
    isFailed: false,
    error: null,
  });

  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  useEffect(() => {
    if (!episodeId) return;

    socketClient.subscribeEpisode(episodeId);

    const unsubProgress = socketClient.on(SOCKET_EVENTS.EPISODE_PROGRESS, (data) => {
      const epId = data?.episodeId || data?.episode_id;
      if (epId && epId !== episodeId) return;

      const progress = Math.min(100, Math.max(0, data?.progress ?? data?.processing_progress ?? 0));
      const stage = data?.stage || data?.processing_stage || data?.stage_message || 'Đang xử lý...';
      const isDone = data?.status === 'ready' || data?.phase === 'done' || progress >= 100;

      setEpisodeState((prev) => ({
        ...prev,
        progress,
        stage: stage || prev.stage,
        isCompleted: isDone,
      }));

      if (isDone) {
        optionsRef.current.onComplete?.(data);
        if (optionsRef.current.invalidateQueries) {
          queryClient.invalidateQueries({ queryKey: optionsRef.current.invalidateQueries });
        }
      }
    });

    const unsubCompleted = socketClient.on(SOCKET_EVENTS.EPISODE_COMPLETED, (data) => {
      const epId = data?.episodeId || data?.episode_id;
      if (epId && epId !== episodeId) return;

      setEpisodeState({
        episodeId,
        progress: 100,
        stage: 'Hoàn tất xử lý tập phim',
        isCompleted: true,
        isFailed: false,
        error: null,
      });

      optionsRef.current.onComplete?.(data);
      if (optionsRef.current.invalidateQueries) {
        queryClient.invalidateQueries({ queryKey: optionsRef.current.invalidateQueries });
      }
    });

    const unsubFailed = socketClient.on(SOCKET_EVENTS.EPISODE_FAILED, (data) => {
      const epId = data?.episodeId || data?.episode_id;
      if (epId && epId !== episodeId) return;

      setEpisodeState((prev) => ({
        ...prev,
        isFailed: true,
        error: data?.error || data?.stage_message || data?.message || 'Lỗi mã hóa video',
      }));

      optionsRef.current.onError?.(data);
    });

    return () => {
      unsubProgress();
      unsubCompleted();
      unsubFailed();
      socketClient.unsubscribeEpisode(episodeId);
    };
  }, [episodeId, queryClient]);

  return episodeState;
}

/**
 * Hook truy vấn và theo dõi trạng thái Online/Offline của danh sách người dùng
 * @param {Array<string|number>} userIds
 * @returns {Object} { presenceMap, isOnline(userId) }
 */
export function usePresence(userIds = []) {
  const [presenceMap, setPresenceMap] = useState({});

  useEffect(() => {
    if (!Array.isArray(userIds) || userIds.length === 0) return;

    // Truy vấn trạng thái ban đầu qua Socket Ack
    socketClient
      .emitWithAck(SOCKET_EVENTS.PRESENCE_QUERY, { userIds })
      .then((presenceList) => {
        if (Array.isArray(presenceList)) {
          const map = {};
          presenceList.forEach((item) => {
            map[item.userId] = Boolean(item.isOnline);
          });
          setPresenceMap((prev) => ({ ...prev, ...map }));
        }
      })
      .catch(() => { });

    // Lắng nghe sự kiện Online/Offline thời gian thực
    const unsubOnline = socketClient.on(SOCKET_EVENTS.USER_ONLINE, (data) => {
      if (data?.userId && userIds.includes(data.userId)) {
        setPresenceMap((prev) => ({ ...prev, [data.userId]: true }));
      }
    });

    const unsubOffline = socketClient.on(SOCKET_EVENTS.USER_OFFLINE, (data) => {
      if (data?.userId && userIds.includes(data.userId)) {
        setPresenceMap((prev) => ({ ...prev, [data.userId]: false }));
      }
    });

    return () => {
      unsubOnline();
      unsubOffline();
    };
  }, [JSON.stringify(userIds)]);

  const isOnline = useCallback(
    (userId) => Boolean(presenceMap[userId]),
    [presenceMap]
  );

  return { presenceMap, isOnline };
}


/**
 * @deprecated Sử dụng `useNotificationSync` từ `@/hooks/socket/use-notification-sync` để đồng bộ đầy đủ cache và Redux
 */
export const useRealtimeNotifications = (options = {}) => {
  return useNotificationSync(options);
};

export default {
  useSocket,
  useSocketEvent,
  useJobProgress,
  useEpisodeProgress,
  usePresence,
  useNotificationSync,
  useRealtimeNotifications,
};
