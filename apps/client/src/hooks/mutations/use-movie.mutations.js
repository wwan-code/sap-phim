/**
 * @file use-movie.mutations.js
 * @module Hooks/Mutations/Movie
 * @description Các React Mutation Hooks phục vụ thao tác thêm/sửa/xóa phim/anime và cập nhật hình ảnh (Movie - Admin).
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import movieService from "@/shared/services/movie.service";
import { MOVIE_QUERY_KEYS } from "@/hooks/queries/use-movie.queries";

/**
 * Mutation tạo phim/anime mới (Admin)
 */
export function useAdminCreateMovieMutation(options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ data, payload, jobId }) => movieService.create(payload || data, { jobId }),
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: MOVIE_QUERY_KEYS.all });
      options.onSuccess?.(data, variables, context);
    },
    ...options,
  });
}

/**
 * Mutation cập nhật phim/anime (Admin)
 */
export function useAdminUpdateMovieMutation(options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data, payload, jobId }) => movieService.update(id, payload || data, { jobId }),
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: MOVIE_QUERY_KEYS.adminDetail(variables.id) });
      queryClient.invalidateQueries({ queryKey: MOVIE_QUERY_KEYS.all });
      options.onSuccess?.(data, variables, context);
    },
    ...options,
  });
}

/**
 * Mutation cập nhật riêng hình ảnh media của phim (Admin)
 */
export function useAdminUpdateMovieImagesMutation(options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, formData, jobId }) => movieService.updateImages(id, formData, { jobId }),
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: MOVIE_QUERY_KEYS.adminDetail(variables.id) });
      queryClient.invalidateQueries({ queryKey: MOVIE_QUERY_KEYS.all });
      options.onSuccess?.(data, variables, context);
    },
    ...options,
  });
}

/**
 * Mutation xóa mềm phim vào thùng rác (Admin)
 */
export function useAdminDeleteMovieMutation(options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id) => movieService.delete(id),
    onSuccess: (data, id, context) => {
      queryClient.invalidateQueries({ queryKey: MOVIE_QUERY_KEYS.adminDetail(id) });
      queryClient.invalidateQueries({ queryKey: MOVIE_QUERY_KEYS.all });
      options.onSuccess?.(data, id, context);
    },
    ...options,
  });
}

/**
 * Mutation khôi phục phim từ thùng rác (Admin)
 */
export function useAdminRestoreMovieMutation(options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id) => movieService.restore(id),
    onSuccess: (data, id, context) => {
      queryClient.invalidateQueries({ queryKey: MOVIE_QUERY_KEYS.adminDetail(id) });
      queryClient.invalidateQueries({ queryKey: MOVIE_QUERY_KEYS.all });
      options.onSuccess?.(data, id, context);
    },
    ...options,
  });
}

/**
 * Mutation xóa vĩnh viễn phim (Admin)
 */
export function useAdminForceDeleteMovieMutation(options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id) => movieService.forceDelete(id),
    onSuccess: (data, id, context) => {
      queryClient.invalidateQueries({ queryKey: MOVIE_QUERY_KEYS.adminDetail(id) });
      queryClient.invalidateQueries({ queryKey: MOVIE_QUERY_KEYS.all });
      options.onSuccess?.(data, id, context);
    },
    ...options,
  });
}

/**
 * Mutation khôi phục hàng loạt phim từ thùng rác (Admin)
 */
export function useAdminBulkRestoreMovieMutation(options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (ids) => movieService.bulkRestore(ids),
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: MOVIE_QUERY_KEYS.all });
      options.onSuccess?.(data, variables, context);
    },
    ...options,
  });
}

/**
 * Mutation xóa vĩnh viễn hàng loạt phim (Admin)
 */
export function useAdminBulkForceDeleteMovieMutation(options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (ids) => movieService.bulkForceDelete(ids),
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: MOVIE_QUERY_KEYS.all });
      options.onSuccess?.(data, variables, context);
    },
    ...options,
  });
}

/**
 * Mutation dọn sạch thùng rác (Admin)
 */
export function useAdminEmptyTrashMutation(options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => movieService.emptyTrash(),
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: MOVIE_QUERY_KEYS.all });
      options.onSuccess?.(data, variables, context);
    },
    ...options,
  });
}

export default {
  useAdminCreateMovieMutation,
  useAdminUpdateMovieMutation,
  useAdminUpdateMovieImagesMutation,
  useAdminDeleteMovieMutation,
  useAdminRestoreMovieMutation,
  useAdminForceDeleteMovieMutation,
  useAdminBulkRestoreMovieMutation,
  useAdminBulkForceDeleteMovieMutation,
  useAdminEmptyTrashMutation,
};
