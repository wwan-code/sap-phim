/**
 * @file use-series.mutations.js
 * @module Hooks/Mutations/Series
 * @description Các React Mutation Hooks phục vụ thao tác thay đổi thương hiệu phim (Series - Admin).
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import seriesService from "@/shared/services/series.service";
import { SERIES_QUERY_KEYS } from "@/hooks/queries/use-series.queries";

/**
 * Mutation tạo thương hiệu phim mới (Admin)
 */
export function useAdminCreateSeriesMutation(options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload) => seriesService.create(payload),
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: SERIES_QUERY_KEYS.all });
      options.onSuccess?.(data, variables, context);
    },
    ...options,
  });
}

/**
 * Mutation cập nhật thương hiệu phim (Admin)
 */
export function useAdminUpdateSeriesMutation(options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...payload }) => seriesService.update(id, payload),
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: SERIES_QUERY_KEYS.adminDetail(variables.id) });
      queryClient.invalidateQueries({ queryKey: SERIES_QUERY_KEYS.all });
      options.onSuccess?.(data, variables, context);
    },
    ...options,
  });
}

/**
 * Mutation xóa mềm thương hiệu phim (Admin)
 */
export function useAdminDeleteSeriesMutation(options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id) => seriesService.delete(id),
    onSuccess: (data, id, context) => {
      queryClient.invalidateQueries({ queryKey: SERIES_QUERY_KEYS.adminDetail(id) });
      queryClient.invalidateQueries({ queryKey: SERIES_QUERY_KEYS.all });
      options.onSuccess?.(data, id, context);
    },
    ...options,
  });
}

/**
 * Mutation khôi phục thương hiệu phim đã xóa mềm (Admin)
 */
export function useAdminRestoreSeriesMutation(options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id) => seriesService.restore(id),
    onSuccess: (data, id, context) => {
      queryClient.invalidateQueries({ queryKey: SERIES_QUERY_KEYS.adminDetail(id) });
      queryClient.invalidateQueries({ queryKey: SERIES_QUERY_KEYS.all });
      options.onSuccess?.(data, id, context);
    },
    ...options,
  });
}

/**
 * Mutation xóa mềm hàng loạt thương hiệu phim (Admin)
 */
export function useAdminBulkDeleteSeriesMutation(options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (ids) => seriesService.bulkDelete(ids),
    onSuccess: (data, ids, context) => {
      queryClient.invalidateQueries({ queryKey: SERIES_QUERY_KEYS.all });
      options.onSuccess?.(data, ids, context);
    },
    ...options,
  });
}

/**
 * Mutation khôi phục hàng loạt thương hiệu phim (Admin)
 */
export function useAdminBulkRestoreSeriesMutation(options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (ids) => seriesService.bulkRestore(ids),
    onSuccess: (data, ids, context) => {
      queryClient.invalidateQueries({ queryKey: SERIES_QUERY_KEYS.all });
      options.onSuccess?.(data, ids, context);
    },
    ...options,
  });
}

/**
 * Mutation xóa vĩnh viễn thương hiệu phim (Admin)
 */
export function useAdminForceDeleteSeriesMutation(options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id) => seriesService.forceDelete(id),
    onSuccess: (data, id, context) => {
      queryClient.invalidateQueries({ queryKey: SERIES_QUERY_KEYS.adminDetail(id) });
      queryClient.invalidateQueries({ queryKey: SERIES_QUERY_KEYS.all });
      options.onSuccess?.(data, id, context);
    },
    ...options,
  });
}

/**
 * Mutation xóa vĩnh viễn hàng loạt thương hiệu phim (Admin)
 */
export function useAdminBulkForceDeleteSeriesMutation(options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (ids) => seriesService.bulkForceDelete(ids),
    onSuccess: (data, ids, context) => {
      queryClient.invalidateQueries({ queryKey: SERIES_QUERY_KEYS.all });
      options.onSuccess?.(data, ids, context);
    },
    ...options,
  });
}

/**
 * Mutation dọn sạch thùng rác thương hiệu phim (Admin)
 */
export function useAdminEmptyTrashSeriesMutation(options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => seriesService.emptyTrash(),
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: SERIES_QUERY_KEYS.all });
      options.onSuccess?.(data, variables, context);
    },
    ...options,
  });
}

export default {
  useAdminCreateSeriesMutation,
  useAdminUpdateSeriesMutation,
  useAdminDeleteSeriesMutation,
  useAdminRestoreSeriesMutation,
  useAdminBulkDeleteSeriesMutation,
  useAdminBulkRestoreSeriesMutation,
  useAdminForceDeleteSeriesMutation,
  useAdminBulkForceDeleteSeriesMutation,
  useAdminEmptyTrashSeriesMutation,
};
