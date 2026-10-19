/**
 * @file use-genre.mutations.js
 * @module Hooks/Mutations/Genre
 * @description Các React Mutation Hooks phục vụ thao tác thay đổi thể loại phim (Genre - Admin).
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import genreService from "@/shared/services/genre.service";
import { GENRE_QUERY_KEYS } from "@/hooks/queries/use-genre.queries";

/**
 * Mutation tạo thể loại mới (Admin)
 */
export function useAdminCreateGenreMutation(options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload) => genreService.create(payload),
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: GENRE_QUERY_KEYS.all });
      options.onSuccess?.(data, variables, context);
    },
    ...options,
  });
}

/**
 * Mutation cập nhật thể loại (Admin)
 */
export function useAdminUpdateGenreMutation(options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...payload }) => genreService.update(id, payload),
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: GENRE_QUERY_KEYS.adminDetail(variables.id) });
      queryClient.invalidateQueries({ queryKey: GENRE_QUERY_KEYS.all });
      options.onSuccess?.(data, variables, context);
    },
    ...options,
  });
}

/**
 * Mutation xóa mềm thể loại (Admin)
 */
export function useAdminDeleteGenreMutation(options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id) => genreService.delete(id),
    onSuccess: (data, id, context) => {
      queryClient.invalidateQueries({ queryKey: GENRE_QUERY_KEYS.adminDetail(id) });
      queryClient.invalidateQueries({ queryKey: GENRE_QUERY_KEYS.all });
      options.onSuccess?.(data, id, context);
    },
    ...options,
  });
}

/**
 * Mutation khôi phục thể loại đã xóa mềm (Admin)
 */
export function useAdminRestoreGenreMutation(options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id) => genreService.restore(id),
    onSuccess: (data, id, context) => {
      queryClient.invalidateQueries({ queryKey: GENRE_QUERY_KEYS.adminDetail(id) });
      queryClient.invalidateQueries({ queryKey: GENRE_QUERY_KEYS.all });
      options.onSuccess?.(data, id, context);
    },
    ...options,
  });
}

/**
 * Mutation xóa mềm hàng loạt thể loại (Admin)
 */
export function useAdminBulkDeleteGenreMutation(options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (ids) => genreService.bulkDelete(ids),
    onSuccess: (data, ids, context) => {
      queryClient.invalidateQueries({ queryKey: GENRE_QUERY_KEYS.all });
      options.onSuccess?.(data, ids, context);
    },
    ...options,
  });
}

/**
 * Mutation khôi phục hàng loạt thể loại (Admin)
 */
export function useAdminBulkRestoreGenreMutation(options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (ids) => genreService.bulkRestore(ids),
    onSuccess: (data, ids, context) => {
      queryClient.invalidateQueries({ queryKey: GENRE_QUERY_KEYS.all });
      options.onSuccess?.(data, ids, context);
    },
    ...options,
  });
}

/**
 * Mutation xóa vĩnh viễn thể loại (Admin)
 */
export function useAdminForceDeleteGenreMutation(options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id) => genreService.forceDelete(id),
    onSuccess: (data, id, context) => {
      queryClient.invalidateQueries({ queryKey: GENRE_QUERY_KEYS.adminDetail(id) });
      queryClient.invalidateQueries({ queryKey: GENRE_QUERY_KEYS.all });
      options.onSuccess?.(data, id, context);
    },
    ...options,
  });
}

/**
 * Mutation xóa vĩnh viễn hàng loạt thể loại (Admin)
 */
export function useAdminBulkForceDeleteGenreMutation(options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (ids) => genreService.bulkForceDelete(ids),
    onSuccess: (data, ids, context) => {
      queryClient.invalidateQueries({ queryKey: GENRE_QUERY_KEYS.all });
      options.onSuccess?.(data, ids, context);
    },
    ...options,
  });
}

/**
 * Mutation dọn sạch thùng rác thể loại (Admin)
 */
export function useAdminEmptyTrashGenreMutation(options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => genreService.emptyTrash(),
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: GENRE_QUERY_KEYS.all });
      options.onSuccess?.(data, variables, context);
    },
    ...options,
  });
}

export default {
  useAdminCreateGenreMutation,
  useAdminUpdateGenreMutation,
  useAdminDeleteGenreMutation,
  useAdminRestoreGenreMutation,
  useAdminBulkDeleteGenreMutation,
  useAdminBulkRestoreGenreMutation,
  useAdminForceDeleteGenreMutation,
  useAdminBulkForceDeleteGenreMutation,
  useAdminEmptyTrashGenreMutation,
};
