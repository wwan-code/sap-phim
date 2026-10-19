/**
 * @file use-subscription.queries.js
 * @module Hooks/Queries/Subscription
 * @description Các React Query Hooks phục vụ truy vấn Gói thành viên và Thuê bao VIP (Member & Admin), tích hợp caching, deduplication và phân trang.
 */

import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { useSelector } from "react-redux";
import subscriptionService from "@/shared/services/subscription.service";
import { selectIsAuthenticated } from "@/store/slices/auth.slice";

/**
 * Factory quản lý Query Keys cho Subscriptions Member
 */
export const SUBSCRIPTION_QUERY_KEYS = {
  all: ["subscriptions"],
  plans: () => [...SUBSCRIPTION_QUERY_KEYS.all, "plans"],
  active: () => [...SUBSCRIPTION_QUERY_KEYS.all, "active"],
  entitlements: () => [...SUBSCRIPTION_QUERY_KEYS.all, "entitlements"],
  histories: () => [...SUBSCRIPTION_QUERY_KEYS.all, "history"],
  history: (params) => [...SUBSCRIPTION_QUERY_KEYS.histories(), params],
  prorations: () => [...SUBSCRIPTION_QUERY_KEYS.all, "proration"],
  proration: (params) => [...SUBSCRIPTION_QUERY_KEYS.prorations(), params],
};

/**
 * Factory quản lý Query Keys cho Subscriptions Admin
 */
export const ADMIN_SUBSCRIPTION_QUERY_KEYS = {
  all: ["admin", "subscriptions"],
  lists: () => [...ADMIN_SUBSCRIPTION_QUERY_KEYS.all, "list"],
  list: (params) => [...ADMIN_SUBSCRIPTION_QUERY_KEYS.lists(), params],
  stats: () => [...ADMIN_SUBSCRIPTION_QUERY_KEYS.all, "stats"],
  plans: (params) => ["admin", "membership-plans", "list", params],
};

// ════════════════════════════════════════════════════════════════
// MEMBER QUERIES
// ════════════════════════════════════════════════════════════════

/**
 * Hook truy vấn danh sách gói hội viên công khai đang mở bán
 * @param {Object} [options={}] React Query Options
 * @returns {import('@tanstack/react-query').UseQueryResult}
 */
export function useActivePlansQuery(options = {}) {
  return useQuery({
    queryKey: SUBSCRIPTION_QUERY_KEYS.plans(),
    queryFn: () => subscriptionService.getActivePlans(),
    staleTime: 1000 * 60 * 5, // 5 phút
    ...options,
  });
}

/**
 * Hook truy vấn gói hội viên đang hoạt động của người dùng
 * @param {Object} [options={}] React Query Options
 * @returns {import('@tanstack/react-query').UseQueryResult}
 */
export function useActiveSubscriptionQuery(options = {}) {
  const isAuthenticated = useSelector(selectIsAuthenticated);

  return useQuery({
    queryKey: SUBSCRIPTION_QUERY_KEYS.active(),
    queryFn: () => subscriptionService.getActiveSubscription(),
    enabled: isAuthenticated && (options.enabled ?? true),
    staleTime: 1000 * 60, // 1 phút
    ...options,
  });
}

/**
 * Hook truy vấn đặc quyền (Dynamic Entitlements: 4K, Tải phim, Thiết bị...)
 * @param {Object} [options={}] React Query Options
 * @returns {import('@tanstack/react-query').UseQueryResult}
 */
export function useMyEntitlementsQuery(options = {}) {
  const isAuthenticated = useSelector(selectIsAuthenticated);

  return useQuery({
    queryKey: SUBSCRIPTION_QUERY_KEYS.entitlements(),
    queryFn: () => subscriptionService.getMyEntitlements(),
    enabled: isAuthenticated && (options.enabled ?? true),
    staleTime: 1000 * 60 * 2, // 2 phút
    ...options,
  });
}

/**
 * Hook truy vấn lịch sử gia hạn/đăng ký gói của người dùng
 * @param {Object} [params={}] { page, limit, status }
 * @param {Object} [options={}] React Query Options
 * @returns {import('@tanstack/react-query').UseQueryResult}
 */
export function useSubscriptionHistoryQuery(params = {}, options = {}) {
  const isAuthenticated = useSelector(selectIsAuthenticated);

  return useQuery({
    queryKey: SUBSCRIPTION_QUERY_KEYS.history(params),
    queryFn: () => subscriptionService.getSubscriptionHistory(params),
    enabled: isAuthenticated && (options.enabled ?? true),
    placeholderData: keepPreviousData,
    staleTime: 1000 * 30, // 30 giây
    ...options,
  });
}

/**
 * Hook xem trước số tiền khấu trừ Proration khi nâng cấp gói
 * @param {Object} params { plan_id: string, billing_cycle: string }
 * @param {Object} [options={}] React Query Options
 * @returns {import('@tanstack/react-query').UseQueryResult}
 */
export function useProrationPreviewQuery(params = {}, options = {}) {
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const isValidPlan = Boolean(params?.plan_id);

  return useQuery({
    queryKey: SUBSCRIPTION_QUERY_KEYS.proration(params),
    queryFn: () => subscriptionService.previewProration(params),
    enabled: isAuthenticated && isValidPlan && (options.enabled ?? true),
    staleTime: 1000 * 10, // 10 giây
    ...options,
  });
}

// ════════════════════════════════════════════════════════════════
// ADMIN QUERIES
// ════════════════════════════════════════════════════════════════

/**
 * Hook truy vấn danh sách thuê bao VIP cho Admin Dashboard
 * @param {Object} [params={}] { page, limit, status, plan_id, user_id, search, sort, order_by }
 * @param {Object} [options={}] React Query Options
 * @returns {import('@tanstack/react-query').UseQueryResult}
 */
export function useAdminSubscriptionsQuery(params = {}, options = {}) {
  return useQuery({
    queryKey: ADMIN_SUBSCRIPTION_QUERY_KEYS.list(params),
    queryFn: () => subscriptionService.adminGetSubscriptions(params),
    placeholderData: keepPreviousData,
    staleTime: 1000 * 30, // 30 giây
    ...options,
  });
}

/**
 * Hook truy vấn thống kê KPI tổng quan Subscriptions cho Admin
 * @param {Object} [options={}] React Query Options
 * @returns {import('@tanstack/react-query').UseQueryResult}
 */
export function useAdminSubscriptionStatsQuery(options = {}) {
  return useQuery({
    queryKey: ADMIN_SUBSCRIPTION_QUERY_KEYS.stats(),
    queryFn: () => subscriptionService.adminGetStats(),
    staleTime: 1000 * 60, // 1 phút
    ...options,
  });
}

/**
 * Hook truy vấn danh sách toàn bộ các gói thành viên cho Admin (kể cả gói ẩn)
 * @param {Object} [params={}] { is_active, search, page, limit, sortBy, sortOrder }
 * @param {Object} [options={}] React Query Options
 * @returns {import('@tanstack/react-query').UseQueryResult}
 */
export function useAdminMembershipPlansQuery(params = {}, options = {}) {
  return useQuery({
    queryKey: ADMIN_SUBSCRIPTION_QUERY_KEYS.plans(params),
    queryFn: () => subscriptionService.adminGetAllPlans(params),
    placeholderData: keepPreviousData,
    staleTime: 1000 * 60, // 1 phút
    ...options,
  });
}
