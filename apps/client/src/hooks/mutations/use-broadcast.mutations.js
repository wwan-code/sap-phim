/**
 * @file use-broadcast.mutations.js
 * @module Hooks/Mutations/Broadcast
 * @description Các React Mutation Hooks phục vụ thao tác thêm/sửa/xóa lịch phát sóng, ghi đè và cập nhật trạng thái (Broadcast - Admin).
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import broadcastService from '@/shared/services/broadcast.service';
import { BROADCAST_QUERY_KEYS } from '@/hooks/queries/use-broadcast.queries';

/**
 * Mutation tạo mới hoặc cập nhật cấu hình lịch phát sóng & rules cho phim
 * @param {Object} [options={}]
 */
export function useUpsertBroadcastScheduleMutation(options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ movieId, data, payload }) => broadcastService.upsert(movieId, payload || data),
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: BROADCAST_QUERY_KEYS.all });
      options.onSuccess?.(data, variables, context);
    },
    ...options,
  });
}

/**
 * Mutation xóa cấu hình lịch phát sóng của một phim
 * @param {Object} [options={}]
 */
export function useDeleteBroadcastScheduleMutation(options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ movieId }) => broadcastService.delete(movieId),
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: BROADCAST_QUERY_KEYS.all });
      options.onSuccess?.(data, variables, context);
    },
    ...options,
  });
}

/**
 * Mutation ghi đè thời gian phát sóng của 1 tập cụ thể
 * @param {Object} [options={}]
 */
export function useOverrideBroadcastCalendarMutation(options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ calendarId, releaseTime }) =>
      broadcastService.overrideCalendar(calendarId, releaseTime),
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: BROADCAST_QUERY_KEYS.all });
      options.onSuccess?.(data, variables, context);
    },
    ...options,
  });
}

/**
 * Mutation khôi phục thời gian phát sóng của 1 tập về mốc mặc định theo rule
 * @param {Object} [options={}]
 */
export function useRestoreBroadcastCalendarMutation(options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ calendarId }) => broadcastService.restoreCalendar(calendarId),
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: BROADCAST_QUERY_KEYS.all });
      options.onSuccess?.(data, variables, context);
    },
    ...options,
  });
}

/**
 * Mutation cập nhật trạng thái phát sóng của 1 tập (upcoming, delayed, cancelled, released)
 * @param {Object} [options={}]
 */
export function useUpdateBroadcastStatusMutation(options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ calendarId, status, delayReason }) =>
      broadcastService.updateStatus(calendarId, status, delayReason),
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: BROADCAST_QUERY_KEYS.all });
      options.onSuccess?.(data, variables, context);
    },
    ...options,
  });
}

/**
 * Mutation cưỡng chế tính toán và tái tạo lại toàn bộ lịch tương lai của phim
 * @param {Object} [options={}]
 */
export function useRegenerateBroadcastCalendarMutation(options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ movieId }) => broadcastService.regenerate(movieId),
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: BROADCAST_QUERY_KEYS.all });
      options.onSuccess?.(data, variables, context);
    },
    ...options,
  });
}

/**
 * Mutation ghi đè hàng loạt danh sách lịch chiếu
 * @param {Object} [options={}]
 */
export function useBatchOverrideBroadcastCalendarMutation(options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ overrides }) => broadcastService.batchOverride(overrides),
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: BROADCAST_QUERY_KEYS.all });
      options.onSuccess?.(data, variables, context);
    },
    ...options,
  });
}
