/**
 * @file use-subscription.mutations.js
 * @module Hooks/Mutations/Subscription
 * @description Các React Mutation Hooks phục vụ các thao tác Gói thành viên & Thuê bao VIP (Member & Admin), tích hợp đồng bộ Cache và tự động làm mới Auth Profile.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import subscriptionService from "@/shared/services/subscription.service";
import {
  SUBSCRIPTION_QUERY_KEYS,
  ADMIN_SUBSCRIPTION_QUERY_KEYS,
} from "@/hooks/queries/use-subscription.queries";

// ════════════════════════════════════════════════════════════════
// 1. MEMBER MUTATIONS
// ════════════════════════════════════════════════════════════════

/**
 * Hook đăng ký mới hoặc nâng cấp gói hội viên bằng ví S-Coin
 * @param {Object} [options={}] React Query Mutation Options
 * @returns {import('@tanstack/react-query').UseMutationResult}
 */
export function useSubscribeMutation(options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data) => subscriptionService.subscribe(data),
    onSuccess: (data, variables, context) => {
      // 1. Làm mới cache subscription của cá nhân
      queryClient.invalidateQueries({ queryKey: SUBSCRIPTION_QUERY_KEYS.active() });
      queryClient.invalidateQueries({ queryKey: SUBSCRIPTION_QUERY_KEYS.entitlements() });
      queryClient.invalidateQueries({ queryKey: SUBSCRIPTION_QUERY_KEYS.histories() });

      // 2. Làm mới số dư ví S-Coin
      queryClient.invalidateQueries({ queryKey: ["wallet"] });

      // 3. Làm mới auth profile để lập tức đồng bộ huy hiệu VIP và đặc quyền trên Header/Player
      queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
      queryClient.invalidateQueries({ queryKey: ["auth", "profile"] });

      // 4. Làm mới cache thống kê Admin
      queryClient.invalidateQueries({ queryKey: ADMIN_SUBSCRIPTION_QUERY_KEYS.all });

      toast.success(data?.message || "Đăng ký gói hội viên VIP thành công!");
      options.onSuccess?.(data, variables, context);
    },
    onError: (error, variables, context) => {
      const msg = error?.response?.data?.message || error?.message || "Lỗi khi đăng ký gói VIP";
      toast.error(msg);
      options.onError?.(error, variables, context);
    },
    ...options,
  });
}

/**
 * Hook bật/tắt tính năng tự động gia hạn gói VIP
 * @param {Object} [options={}] React Query Mutation Options
 * @returns {import('@tanstack/react-query').UseMutationResult}
 */
export function useToggleAutoRenewMutation(options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data) => subscriptionService.toggleAutoRenew(data),
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: SUBSCRIPTION_QUERY_KEYS.active() });
      queryClient.invalidateQueries({ queryKey: SUBSCRIPTION_QUERY_KEYS.histories() });
      queryClient.invalidateQueries({ queryKey: ADMIN_SUBSCRIPTION_QUERY_KEYS.all });

      const stateLabel = variables?.auto_renew ? "Bật" : "Tắt";
      toast.success(`Đã ${stateLabel.toLowerCase()} tự động gia hạn thành công!`);
      options.onSuccess?.(data, variables, context);
    },
    onError: (error, variables, context) => {
      const msg = error?.response?.data?.message || error?.message || "Lỗi khi cập nhật tự động gia hạn";
      toast.error(msg);
      options.onError?.(error, variables, context);
    },
    ...options,
  });
}

/**
 * Hook hủy gói hội viên VIP đang hoạt động
 * @param {Object} [options={}] React Query Mutation Options
 * @returns {import('@tanstack/react-query').UseMutationResult}
 */
export function useCancelSubscriptionMutation(options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data) => subscriptionService.cancelSubscription(data),
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: SUBSCRIPTION_QUERY_KEYS.active() });
      queryClient.invalidateQueries({ queryKey: SUBSCRIPTION_QUERY_KEYS.entitlements() });
      queryClient.invalidateQueries({ queryKey: SUBSCRIPTION_QUERY_KEYS.histories() });
      queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
      queryClient.invalidateQueries({ queryKey: ADMIN_SUBSCRIPTION_QUERY_KEYS.all });

      toast.success(data?.message || "Đã hủy gói hội viên VIP thành công");
      options.onSuccess?.(data, variables, context);
    },
    onError: (error, variables, context) => {
      const msg = error?.response?.data?.message || error?.message || "Lỗi khi hủy gói VIP";
      toast.error(msg);
      options.onError?.(error, variables, context);
    },
    ...options,
  });
}

// ════════════════════════════════════════════════════════════════
// 2. ADMIN MUTATIONS
// ════════════════════════════════════════════════════════════════

/**
 * Hook Admin cấp gói VIP thủ công cho người dùng
 * @param {Object} [options={}] React Query Mutation Options
 * @returns {import('@tanstack/react-query').UseMutationResult}
 */
export function useAdminGrantVipMutation(options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data) => subscriptionService.adminGrantVip(data),
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: ADMIN_SUBSCRIPTION_QUERY_KEYS.all });
      queryClient.invalidateQueries({ queryKey: SUBSCRIPTION_QUERY_KEYS.all });
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      queryClient.invalidateQueries({ queryKey: ["auth", "me"] });

      toast.success("Đã cấp gói VIP cho người dùng thành công!");
      options.onSuccess?.(data, variables, context);
    },
    onError: (error, variables, context) => {
      const msg = error?.response?.data?.message || error?.message || "Lỗi khi cấp gói VIP";
      toast.error(msg);
      options.onError?.(error, variables, context);
    },
    ...options,
  });
}

/**
 * Hook Admin thu hồi / hủy gói VIP của người dùng
 * @param {Object} [options={}] React Query Mutation Options
 * @returns {import('@tanstack/react-query').UseMutationResult}
 */
export function useAdminRevokeSubscriptionMutation(options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, reason }) => subscriptionService.adminRevokeSubscription(id, { reason }),
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: ADMIN_SUBSCRIPTION_QUERY_KEYS.all });
      queryClient.invalidateQueries({ queryKey: SUBSCRIPTION_QUERY_KEYS.all });
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      queryClient.invalidateQueries({ queryKey: ["auth", "me"] });

      toast.success("Đã thu hồi gói VIP thành công!");
      options.onSuccess?.(data, variables, context);
    },
    onError: (error, variables, context) => {
      const msg = error?.response?.data?.message || error?.message || "Lỗi khi thu hồi gói VIP";
      toast.error(msg);
      options.onError?.(error, variables, context);
    },
    ...options,
  });
}

/**
 * Hook Admin tạo gói hội viên mới
 * @param {Object} [options={}] React Query Mutation Options
 * @returns {import('@tanstack/react-query').UseMutationResult}
 */
export function useAdminCreatePlanMutation(options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data) => subscriptionService.adminCreatePlan(data),
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "membership-plans"] });
      queryClient.invalidateQueries({ queryKey: SUBSCRIPTION_QUERY_KEYS.plans() });

      toast.success("Đã tạo gói hội viên VIP mới thành công!");
      options.onSuccess?.(data, variables, context);
    },
    onError: (error, variables, context) => {
      const msg = error?.response?.data?.message || error?.message || "Lỗi khi tạo gói thành viên";
      toast.error(msg);
      options.onError?.(error, variables, context);
    },
    ...options,
  });
}

/**
 * Hook Admin cập nhật thông tin gói hội viên
 * @param {Object} [options={}] React Query Mutation Options
 * @returns {import('@tanstack/react-query').UseMutationResult}
 */
export function useAdminUpdatePlanMutation(options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }) => subscriptionService.adminUpdatePlan(id, data),
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "membership-plans"] });
      queryClient.invalidateQueries({ queryKey: SUBSCRIPTION_QUERY_KEYS.plans() });

      toast.success("Đã cập nhật gói hội viên thành công!");
      options.onSuccess?.(data, variables, context);
    },
    onError: (error, variables, context) => {
      const msg = error?.response?.data?.message || error?.message || "Lỗi khi cập nhật gói thành viên";
      toast.error(msg);
      options.onError?.(error, variables, context);
    },
    ...options,
  });
}

/**
 * Hook Admin vô hiệu hóa / xóa gói hội viên
 * @param {Object} [options={}] React Query Mutation Options
 * @returns {import('@tanstack/react-query').UseMutationResult}
 */
export function useAdminDeletePlanMutation(options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id) => subscriptionService.adminDeletePlan(id),
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "membership-plans"] });
      queryClient.invalidateQueries({ queryKey: SUBSCRIPTION_QUERY_KEYS.plans() });

      toast.success("Đã vô hiệu hóa gói hội viên thành công!");
      options.onSuccess?.(data, variables, context);
    },
    onError: (error, variables, context) => {
      const msg = error?.response?.data?.message || error?.message || "Lỗi khi xóa gói thành viên";
      toast.error(msg);
      options.onError?.(error, variables, context);
    },
    ...options,
  });
}
