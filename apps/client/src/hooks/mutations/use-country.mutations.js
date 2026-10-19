/**
 * @file use-country.mutations.js
 * @module Hooks/Mutations/Country
 * @description Các React Mutation Hooks phục vụ thao tác thay đổi quốc gia (Country - Admin).
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import countryService from "@/shared/services/country.service";
import { COUNTRY_QUERY_KEYS } from "@/hooks/queries/use-country.queries";

/**
 * Mutation tạo quốc gia mới (Admin)
 */
export function useAdminCreateCountryMutation(options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload) => countryService.create(payload),
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: COUNTRY_QUERY_KEYS.all });
      options.onSuccess?.(data, variables, context);
    },
    ...options,
  });
}

/**
 * Mutation cập nhật quốc gia (Admin)
 */
export function useAdminUpdateCountryMutation(options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...payload }) => countryService.update(id, payload),
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: COUNTRY_QUERY_KEYS.adminDetail(variables.id) });
      queryClient.invalidateQueries({ queryKey: COUNTRY_QUERY_KEYS.all });
      options.onSuccess?.(data, variables, context);
    },
    ...options,
  });
}

/**
 * Mutation xóa mềm quốc gia (Admin)
 */
export function useAdminDeleteCountryMutation(options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id) => countryService.delete(id),
    onSuccess: (data, id, context) => {
      queryClient.invalidateQueries({ queryKey: COUNTRY_QUERY_KEYS.adminDetail(id) });
      queryClient.invalidateQueries({ queryKey: COUNTRY_QUERY_KEYS.all });
      options.onSuccess?.(data, id, context);
    },
    ...options,
  });
}

/**
 * Mutation khôi phục quốc gia đã xóa mềm (Admin)
 */
export function useAdminRestoreCountryMutation(options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id) => countryService.restore(id),
    onSuccess: (data, id, context) => {
      queryClient.invalidateQueries({ queryKey: COUNTRY_QUERY_KEYS.adminDetail(id) });
      queryClient.invalidateQueries({ queryKey: COUNTRY_QUERY_KEYS.all });
      options.onSuccess?.(data, id, context);
    },
    ...options,
  });
}

/**
 * Mutation xóa mềm hàng loạt quốc gia (Admin)
 */
export function useAdminBulkDeleteCountryMutation(options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (ids) => countryService.bulkDelete(ids),
    onSuccess: (data, ids, context) => {
      queryClient.invalidateQueries({ queryKey: COUNTRY_QUERY_KEYS.all });
      options.onSuccess?.(data, ids, context);
    },
    ...options,
  });
}

/**
 * Mutation khôi phục hàng loạt quốc gia (Admin)
 */
export function useAdminBulkRestoreCountryMutation(options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (ids) => countryService.bulkRestore(ids),
    onSuccess: (data, ids, context) => {
      queryClient.invalidateQueries({ queryKey: COUNTRY_QUERY_KEYS.all });
      options.onSuccess?.(data, ids, context);
    },
    ...options,
  });
}

/**
 * Mutation xóa vĩnh viễn quốc gia (Admin)
 */
export function useAdminForceDeleteCountryMutation(options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id) => countryService.forceDelete(id),
    onSuccess: (data, id, context) => {
      queryClient.invalidateQueries({ queryKey: COUNTRY_QUERY_KEYS.adminDetail(id) });
      queryClient.invalidateQueries({ queryKey: COUNTRY_QUERY_KEYS.all });
      options.onSuccess?.(data, id, context);
    },
    ...options,
  });
}

/**
 * Mutation xóa vĩnh viễn hàng loạt quốc gia (Admin)
 */
export function useAdminBulkForceDeleteCountryMutation(options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (ids) => countryService.bulkForceDelete(ids),
    onSuccess: (data, ids, context) => {
      queryClient.invalidateQueries({ queryKey: COUNTRY_QUERY_KEYS.all });
      options.onSuccess?.(data, ids, context);
    },
    ...options,
  });
}

/**
 * Mutation dọn sạch thùng rác quốc gia (Admin)
 */
export function useAdminEmptyTrashCountryMutation(options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => countryService.emptyTrash(),
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: COUNTRY_QUERY_KEYS.all });
      options.onSuccess?.(data, variables, context);
    },
    ...options,
  });
}

export default {
  useAdminCreateCountryMutation,
  useAdminUpdateCountryMutation,
  useAdminDeleteCountryMutation,
  useAdminRestoreCountryMutation,
  useAdminBulkDeleteCountryMutation,
  useAdminBulkRestoreCountryMutation,
  useAdminForceDeleteCountryMutation,
  useAdminBulkForceDeleteCountryMutation,
  useAdminEmptyTrashCountryMutation,
};
