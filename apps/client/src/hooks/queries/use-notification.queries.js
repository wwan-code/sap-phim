/**
 * @file use-notification.queries.js
 * @module Hooks/Queries/Notification
 * @description Các React Query Hooks phục vụ truy vấn dữ liệu thông báo (Member & Admin), hỗ trợ phân trang tiêu chuẩn và cuộn vô tận (Infinite Scroll).
 */

import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import { useSelector } from "react-redux";
import notificationService from "@/shared/services/notification.service";
import { selectIsAuthenticated } from "@/store/slices/auth.slice";

/**
 * Factory quản lý Query Keys cho Notification Member
 */
export const NOTIFICATION_QUERY_KEYS = {
  all: ["notifications"],
  lists: () => [...NOTIFICATION_QUERY_KEYS.all, "list"],
  list: (params) => [...NOTIFICATION_QUERY_KEYS.lists(), params],
  infinites: () => [...NOTIFICATION_QUERY_KEYS.all, "infinite"],
  infinite: (params) => [...NOTIFICATION_QUERY_KEYS.infinites(), params],
  unreadCount: () => [...NOTIFICATION_QUERY_KEYS.all, "unread-count"],
  stats: () => [...NOTIFICATION_QUERY_KEYS.all, "stats"],
};

/**
 * Factory quản lý Query Keys cho Notification Admin
 */
export const ADMIN_NOTIFICATION_QUERY_KEYS = {
  all: ["admin", "notifications"],
  lists: () => [...ADMIN_NOTIFICATION_QUERY_KEYS.all, "list"],
  list: (params) => [...ADMIN_NOTIFICATION_QUERY_KEYS.lists(), params],
  stats: () => [...ADMIN_NOTIFICATION_QUERY_KEYS.all, "stats"],
};

// ════════════════════════════════════════════════════════════════
// MEMBER QUERIES
// ════════════════════════════════════════════════════════════════

/**
 * Hook truy vấn danh sách thông báo người dùng theo phân trang tiêu chuẩn
 * @param {Object} [params={}] { page, limit, type, isRead, order_by, sort }
 * @param {Object} [options={}] React Query Options
 * @returns {import('@tanstack/react-query').UseQueryResult}
 */
export function useNotificationsQuery(params = {}, options = {}) {
  const isAuthenticated = useSelector(selectIsAuthenticated);

  return useQuery({
    queryKey: NOTIFICATION_QUERY_KEYS.list(params),
    queryFn: () => notificationService.getNotifications(params),
    enabled: isAuthenticated && (options.enabled ?? true),
    staleTime: 1000 * 30, // 30 giây
    ...options,
  });
}

/**
 * Hook truy vấn danh sách thông báo dạng cuộn vô tận (Infinite Scroll) phục vụ Header Popover & Notification Feed
 * @param {Object} [params={}] { limit, type, isRead, order_by, sort }
 * @param {Object} [options={}] React Query Options
 * @returns {import('@tanstack/react-query').UseInfiniteQueryResult}
 */
export function useInfiniteNotificationsQuery(params = {}, options = {}) {
  const isAuthenticated = useSelector(selectIsAuthenticated);

  return useInfiniteQuery({
    queryKey: NOTIFICATION_QUERY_KEYS.infinite(params),
    queryFn: ({ pageParam = 1 }) =>
      notificationService.getNotifications({
        ...params,
        page: pageParam,
        limit: params.limit || 15,
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage?.hasNextPage ? (lastPage.page || 1) + 1 : undefined,
    getPreviousPageParam: (firstPage) =>
      firstPage?.hasPrevPage ? (firstPage.page || 1) - 1 : undefined,
    enabled: isAuthenticated && (options.enabled ?? true),
    staleTime: 1000 * 30,
    ...options,
  });
}

/**
 * Hook truy vấn số lượng thông báo chưa đọc của người dùng
 * @param {Object} [options={}] React Query Options
 * @returns {import('@tanstack/react-query').UseQueryResult} Trả về số lượng unread count
 */
export function useNotificationUnreadCountQuery(options = {}) {
  const isAuthenticated = useSelector(selectIsAuthenticated);

  return useQuery({
    queryKey: NOTIFICATION_QUERY_KEYS.unreadCount(),
    queryFn: () => notificationService.getUnreadCount(),
    select: (data) => (typeof data?.unread === "number" ? data.unread : Number(data) || 0),
    enabled: isAuthenticated && (options.enabled ?? true),
    staleTime: 1000 * 60, // 1 phút
    refetchOnWindowFocus: true,
    ...options,
  });
}

/**
 * Hook truy vấn thống kê tổng quan thông báo (total, unread, read)
 * @param {Object} [options={}] React Query Options
 * @returns {import('@tanstack/react-query').UseQueryResult}
 */
export function useNotificationStatsQuery(options = {}) {
  const isAuthenticated = useSelector(selectIsAuthenticated);

  return useQuery({
    queryKey: NOTIFICATION_QUERY_KEYS.stats(),
    queryFn: () => notificationService.getStats(),
    enabled: isAuthenticated && (options.enabled ?? true),
    staleTime: 1000 * 60,
    ...options,
  });
}

// ════════════════════════════════════════════════════════════════
// ADMIN QUERIES
// ════════════════════════════════════════════════════════════════

/**
 * Hook truy vấn danh sách thông báo toàn hệ thống của Quản trị viên
 * @param {Object} [params={}] { page, limit, type, priority, isRead, search, order_by, sort }
 * @param {Object} [options={}] React Query Options
 * @returns {import('@tanstack/react-query').UseQueryResult}
 */
export function useAdminNotificationsQuery(params = {}, options = {}) {
  const isAuthenticated = useSelector(selectIsAuthenticated);

  return useQuery({
    queryKey: ADMIN_NOTIFICATION_QUERY_KEYS.list(params),
    queryFn: () => notificationService.listAdminNotifications(params),
    enabled: isAuthenticated && (options.enabled ?? true),
    staleTime: 1000 * 30,
    ...options,
  });
}

/**
 * Hook truy vấn thống kê thông báo quản trị viên (Admin)
 * @param {Object} [options={}] React Query Options
 * @returns {import('@tanstack/react-query').UseQueryResult}
 */
export function useAdminNotificationStatsQuery(options = {}) {
  const isAuthenticated = useSelector(selectIsAuthenticated);

  return useQuery({
    queryKey: ADMIN_NOTIFICATION_QUERY_KEYS.stats(),
    queryFn: () => notificationService.getAdminStats(),
    enabled: isAuthenticated && (options.enabled ?? true),
    staleTime: 1000 * 30,
    ...options,
  });
}

export default {
  NOTIFICATION_QUERY_KEYS,
  ADMIN_NOTIFICATION_QUERY_KEYS,
  useNotificationsQuery,
  useInfiniteNotificationsQuery,
  useNotificationUnreadCountQuery,
  useNotificationStatsQuery,
  useAdminNotificationsQuery,
  useAdminNotificationStatsQuery,
};
