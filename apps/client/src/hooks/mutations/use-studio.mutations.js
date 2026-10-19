/**
 * @file use-studio.mutations.js
 * @module Hooks/Mutations/Studio
 * @description Các React Mutation Hooks phục vụ thao tác thay đổi hãng sản xuất (Studio - Admin).
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import studioService from "@/shared/services/studio.service";
import { STUDIO_QUERY_KEYS } from "@/hooks/queries/use-studio.queries";

/**
 * Mutation tạo hãng sản xuất mới (Admin)
 */
export function useAdminCreateStudioMutation(options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload) => studioService.create(payload),
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: STUDIO_QUERY_KEYS.all });
      options.onSuccess?.(data, variables, context);
    },
    ...options,
  });
}

/**
 * Mutation cập nhật hãng sản xuất (Admin)
 */
export function useAdminUpdateStudioMutation(options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...payload }) => studioService.update(id, payload),
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: STUDIO_QUERY_KEYS.adminDetail(variables.id) });
      queryClient.invalidateQueries({ queryKey: STUDIO_QUERY_KEYS.all });
      options.onSuccess?.(data, variables, context);
    },
    ...options,
  });
}

/**
 * Mutation xóa mềm hãng sản xuất (Admin)
 */
export function useAdminDeleteStudioMutation(options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id) => studioService.delete(id),
    onSuccess: (data, id, context) => {
      queryClient.invalidateQueries({ queryKey: STUDIO_QUERY_KEYS.adminDetail(id) });
      queryClient.invalidateQueries({ queryKey: STUDIO_QUERY_KEYS.all });
      options.onSuccess?.(data, id, context);
    },
    ...options,
  });
}

/**
 * Mutation khôi phục hãng sản xuất đã xóa mềm (Admin)
 */
export function useAdminRestoreStudioMutation(options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id) => studioService.restore(id),
    onSuccess: (data, id, context) => {
      queryClient.invalidateQueries({ queryKey: STUDIO_QUERY_KEYS.adminDetail(id) });
      queryClient.invalidateQueries({ queryKey: STUDIO_QUERY_KEYS.all });
      options.onSuccess?.(data, id, context);
    },
    ...options,
  });
}

/**
 * Mutation xóa mềm hàng loạt hãng sản xuất (Admin)
 */
export function useAdminBulkDeleteStudioMutation(options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (ids) => studioService.bulkDelete(ids),
    onSuccess: (data, ids, context) => {
      queryClient.invalidateQueries({ queryKey: STUDIO_QUERY_KEYS.all });
      options.onSuccess?.(data, ids, context);
    },
    ...options,
  });
}

/**
 * Mutation khôi phục hàng loạt hãng sản xuất (Admin)
 */
export function useAdminBulkRestoreStudioMutation(options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (ids) => studioService.bulkRestore(ids),
    onSuccess: (data, ids, context) => {
      queryClient.invalidateQueries({ queryKey: STUDIO_QUERY_KEYS.all });
      options.onSuccess?.(data, ids, context);
    },
    ...options,
  });
}

/**
 * Mutation xóa vĩnh viễn hãng sản xuất (Admin)
 */
export function useAdminForceDeleteStudioMutation(options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id) => studioService.forceDelete(id),
    onSuccess: (data, id, context) => {
      queryClient.invalidateQueries({ queryKey: STUDIO_QUERY_KEYS.adminDetail(id) });
      queryClient.invalidateQueries({ queryKey: STUDIO_QUERY_KEYS.all });
      options.onSuccess?.(data, id, context);
    },
    ...options,
  });
}

/**
 * Mutation xóa vĩnh viễn hàng loạt hãng sản xuất (Admin)
 */
export function useAdminBulkForceDeleteStudioMutation(options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (ids) => studioService.bulkForceDelete(ids),
    onSuccess: (data, ids, context) => {
      queryClient.invalidateQueries({ queryKey: STUDIO_QUERY_KEYS.all });
      options.onSuccess?.(data, ids, context);
    },
    ...options,
  });
}

/**
 * Mutation dọn sạch thùng rác hãng sản xuất (Admin)
 */
export function useAdminEmptyTrashStudioMutation(options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => studioService.emptyTrash(),
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: STUDIO_QUERY_KEYS.all });
      options.onSuccess?.(data, variables, context);
    },
    ...options,
  });
}

export default {
  useAdminCreateStudioMutation,
  useAdminUpdateStudioMutation,
  useAdminDeleteStudioMutation,
  useAdminRestoreStudioMutation,
  useAdminBulkDeleteStudioMutation,
  useAdminBulkRestoreStudioMutation,
  useAdminForceDeleteStudioMutation,
  useAdminBulkForceDeleteStudioMutation,
  useAdminEmptyTrashStudioMutation,
};
