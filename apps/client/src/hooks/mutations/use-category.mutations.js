/**
 * @file use-category.mutations.js
 * @module Hooks/Mutations/Category
 * @description Các React Mutation Hooks phục vụ thao tác thay đổi danh mục phim (Category - Admin).
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import categoryService from "@/shared/services/category.service";
import { CATEGORY_QUERY_KEYS } from "@/hooks/queries/use-category.queries";

/**
 * Mutation tạo danh mục mới (Admin)
 */
export function useAdminCreateCategoryMutation(options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload) => categoryService.create(payload),
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: CATEGORY_QUERY_KEYS.all });
      options.onSuccess?.(data, variables, context);
    },
    ...options,
  });
}

/**
 * Mutation cập nhật danh mục (Admin)
 */
export function useAdminUpdateCategoryMutation(options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...payload }) => categoryService.update(id, payload),
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: CATEGORY_QUERY_KEYS.adminDetail(variables.id) });
      queryClient.invalidateQueries({ queryKey: CATEGORY_QUERY_KEYS.all });
      options.onSuccess?.(data, variables, context);
    },
    ...options,
  });
}

/**
 * Mutation xóa mềm danh mục (Admin)
 */
export function useAdminDeleteCategoryMutation(options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id) => categoryService.delete(id),
    onSuccess: (data, id, context) => {
      queryClient.invalidateQueries({ queryKey: CATEGORY_QUERY_KEYS.adminDetail(id) });
      queryClient.invalidateQueries({ queryKey: CATEGORY_QUERY_KEYS.all });
      options.onSuccess?.(data, id, context);
    },
    ...options,
  });
}

/**
 * Mutation khôi phục danh mục đã xóa mềm (Admin)
 */
export function useAdminRestoreCategoryMutation(options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id) => categoryService.restore(id),
    onSuccess: (data, id, context) => {
      queryClient.invalidateQueries({ queryKey: CATEGORY_QUERY_KEYS.adminDetail(id) });
      queryClient.invalidateQueries({ queryKey: CATEGORY_QUERY_KEYS.all });
      options.onSuccess?.(data, id, context);
    },
    ...options,
  });
}

/**
 * Mutation xóa mềm hàng loạt danh mục (Admin)
 */
export function useAdminBulkDeleteCategoryMutation(options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (ids) => categoryService.bulkDelete(ids),
    onSuccess: (data, ids, context) => {
      queryClient.invalidateQueries({ queryKey: CATEGORY_QUERY_KEYS.all });
      options.onSuccess?.(data, ids, context);
    },
    ...options,
  });
}

/**
 * Mutation khôi phục hàng loạt danh mục (Admin)
 */
export function useAdminBulkRestoreCategoryMutation(options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (ids) => categoryService.bulkRestore(ids),
    onSuccess: (data, ids, context) => {
      queryClient.invalidateQueries({ queryKey: CATEGORY_QUERY_KEYS.all });
      options.onSuccess?.(data, ids, context);
    },
    ...options,
  });
}

/**
 * Mutation xóa vĩnh viễn danh mục (Admin)
 */
export function useAdminForceDeleteCategoryMutation(options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id) => categoryService.forceDelete(id),
    onSuccess: (data, id, context) => {
      queryClient.invalidateQueries({ queryKey: CATEGORY_QUERY_KEYS.adminDetail(id) });
      queryClient.invalidateQueries({ queryKey: CATEGORY_QUERY_KEYS.all });
      options.onSuccess?.(data, id, context);
    },
    ...options,
  });
}

/**
 * Mutation xóa vĩnh viễn hàng loạt danh mục (Admin)
 */
export function useAdminBulkForceDeleteCategoryMutation(options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (ids) => categoryService.bulkForceDelete(ids),
    onSuccess: (data, ids, context) => {
      queryClient.invalidateQueries({ queryKey: CATEGORY_QUERY_KEYS.all });
      options.onSuccess?.(data, ids, context);
    },
    ...options,
  });
}

/**
 * Mutation dọn sạch thùng rác danh mục (Admin)
 */
export function useAdminEmptyTrashCategoryMutation(options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => categoryService.emptyTrash(),
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: CATEGORY_QUERY_KEYS.all });
      options.onSuccess?.(data, variables, context);
    },
    ...options,
  });
}

export default {
  useAdminCreateCategoryMutation,
  useAdminUpdateCategoryMutation,
  useAdminDeleteCategoryMutation,
  useAdminRestoreCategoryMutation,
  useAdminBulkDeleteCategoryMutation,
  useAdminBulkRestoreCategoryMutation,
  useAdminForceDeleteCategoryMutation,
  useAdminBulkForceDeleteCategoryMutation,
  useAdminEmptyTrashCategoryMutation,
};
