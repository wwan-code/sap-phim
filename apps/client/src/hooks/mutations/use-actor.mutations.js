/**
 * @file use-actor.mutations.js
 * @module Hooks/Mutations/Actor
 * @description Các React Mutation Hooks phục vụ thao tác thay đổi diễn viên (Actor - Admin).
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import actorService from "@/shared/services/actor.service";
import { ACTOR_QUERY_KEYS } from "@/hooks/queries/use-actor.queries";

/**
 * Mutation tạo diễn viên mới (Admin)
 */
export function useAdminCreateActorMutation(options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload) => actorService.create(payload),
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: ACTOR_QUERY_KEYS.all });
      options.onSuccess?.(data, variables, context);
    },
    ...options,
  });
}

/**
 * Mutation cập nhật diễn viên (Admin)
 */
export function useAdminUpdateActorMutation(options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...payload }) => actorService.update(id, payload),
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: ACTOR_QUERY_KEYS.adminDetail(variables.id) });
      queryClient.invalidateQueries({ queryKey: ACTOR_QUERY_KEYS.all });
      options.onSuccess?.(data, variables, context);
    },
    ...options,
  });
}

/**
 * Mutation xóa mềm diễn viên (Admin)
 */
export function useAdminDeleteActorMutation(options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id) => actorService.delete(id),
    onSuccess: (data, id, context) => {
      queryClient.invalidateQueries({ queryKey: ACTOR_QUERY_KEYS.adminDetail(id) });
      queryClient.invalidateQueries({ queryKey: ACTOR_QUERY_KEYS.all });
      options.onSuccess?.(data, id, context);
    },
    ...options,
  });
}

/**
 * Mutation khôi phục diễn viên đã xóa mềm (Admin)
 */
export function useAdminRestoreActorMutation(options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id) => actorService.restore(id),
    onSuccess: (data, id, context) => {
      queryClient.invalidateQueries({ queryKey: ACTOR_QUERY_KEYS.adminDetail(id) });
      queryClient.invalidateQueries({ queryKey: ACTOR_QUERY_KEYS.all });
      options.onSuccess?.(data, id, context);
    },
    ...options,
  });
}

/**
 * Mutation xóa mềm hàng loạt diễn viên (Admin)
 */
export function useAdminBulkDeleteActorMutation(options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (ids) => actorService.bulkDelete(ids),
    onSuccess: (data, ids, context) => {
      queryClient.invalidateQueries({ queryKey: ACTOR_QUERY_KEYS.all });
      options.onSuccess?.(data, ids, context);
    },
    ...options,
  });
}

/**
 * Mutation khôi phục hàng loạt diễn viên (Admin)
 */
export function useAdminBulkRestoreActorMutation(options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (ids) => actorService.bulkRestore(ids),
    onSuccess: (data, ids, context) => {
      queryClient.invalidateQueries({ queryKey: ACTOR_QUERY_KEYS.all });
      options.onSuccess?.(data, ids, context);
    },
    ...options,
  });
}

/**
 * Mutation xóa vĩnh viễn diễn viên (Admin)
 */
export function useAdminForceDeleteActorMutation(options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id) => actorService.forceDelete(id),
    onSuccess: (data, id, context) => {
      queryClient.invalidateQueries({ queryKey: ACTOR_QUERY_KEYS.adminDetail(id) });
      queryClient.invalidateQueries({ queryKey: ACTOR_QUERY_KEYS.all });
      options.onSuccess?.(data, id, context);
    },
    ...options,
  });
}

/**
 * Mutation xóa vĩnh viễn hàng loạt diễn viên (Admin)
 */
export function useAdminBulkForceDeleteActorMutation(options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (ids) => actorService.bulkForceDelete(ids),
    onSuccess: (data, ids, context) => {
      queryClient.invalidateQueries({ queryKey: ACTOR_QUERY_KEYS.all });
      options.onSuccess?.(data, ids, context);
    },
    ...options,
  });
}

/**
 * Mutation dọn sạch thùng rác diễn viên (Admin)
 */
export function useAdminEmptyTrashActorMutation(options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => actorService.emptyTrash(),
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: ACTOR_QUERY_KEYS.all });
      options.onSuccess?.(data, variables, context);
    },
    ...options,
  });
}

export default {
  useAdminCreateActorMutation,
  useAdminUpdateActorMutation,
  useAdminDeleteActorMutation,
  useAdminRestoreActorMutation,
  useAdminBulkDeleteActorMutation,
  useAdminBulkRestoreActorMutation,
  useAdminForceDeleteActorMutation,
  useAdminBulkForceDeleteActorMutation,
  useAdminEmptyTrashActorMutation,
};
