/**
 * @file use-user.queries.js
 * @module Hooks/Queries/User
 * @description Các React Query Hooks phục vụ truy vấn dữ liệu người dùng (Member & Admin).
 */

import { useQuery } from "@tanstack/react-query";
import { useSelector } from "react-redux";
import userService from "@/shared/services/user.service";
import { selectIsAuthenticated } from "@/store/slices/auth.slice";

export const USER_QUERY_KEYS = {
  all: ["user"],
  me: () => [...USER_QUERY_KEYS.all, "me"],
  preferences: () => [...USER_QUERY_KEYS.all, "preferences"],
  stats: () => [...USER_QUERY_KEYS.all, "stats"],
  profile: (userId) => [...USER_QUERY_KEYS.all, "profile", userId],
  followers: (userId, params) => [...USER_QUERY_KEYS.all, "followers", userId, params],
  following: (userId, params) => [...USER_QUERY_KEYS.all, "following", userId, params],
};

export const ADMIN_USER_QUERY_KEYS = {
  all: ["admin", "users"],
  list: (params) => [...ADMIN_USER_QUERY_KEYS.all, "list", params],
  detail: (id) => [...ADMIN_USER_QUERY_KEYS.all, "detail", id],
  sessions: (id) => [...ADMIN_USER_QUERY_KEYS.all, "sessions", id],
  wallet: (id) => [...ADMIN_USER_QUERY_KEYS.all, "wallet", id],
  subscriptions: (id, params) => [...ADMIN_USER_QUERY_KEYS.all, "subscriptions", id, params],
};

// ════════════════════════════════════════════════════════════════
// MEMBER QUERIES
// ════════════════════════════════════════════════════════════════

/**
 * Hook truy vấn thông tin Profile cá nhân
 */
export function useMyProfileQuery(options = {}) {
  const isAuthenticated = useSelector(selectIsAuthenticated);

  return useQuery({
    queryKey: USER_QUERY_KEYS.me(),
    queryFn: () => userService.getMyProfile(),
    enabled: isAuthenticated && (options.enabled ?? true),
    staleTime: 1000 * 60 * 5, // 5 phút
    ...options,
  });
}

/**
 * Hook truy vấn cấu hình tùy chọn cá nhân
 */
export function useUserPreferencesQuery(options = {}) {
  const isAuthenticated = useSelector(selectIsAuthenticated);

  return useQuery({
    queryKey: USER_QUERY_KEYS.preferences(),
    queryFn: () => userService.getPreferences(),
    enabled: isAuthenticated && (options.enabled ?? true),
    staleTime: 1000 * 60 * 10, // 10 phút
    ...options,
  });
}

/**
 * Hook truy vấn thống kê hoạt động tài khoản
 */
export function useUserStatsQuery(options = {}) {
  const isAuthenticated = useSelector(selectIsAuthenticated);

  return useQuery({
    queryKey: USER_QUERY_KEYS.stats(),
    queryFn: () => userService.getStats(),
    enabled: isAuthenticated && (options.enabled ?? true),
    staleTime: 1000 * 60 * 5,
    ...options,
  });
}

/**
 * Hook truy vấn hồ sơ công khai của một người dùng bất kỳ
 */
export function useUserProfileQuery(userId, options = {}) {
  return useQuery({
    queryKey: USER_QUERY_KEYS.profile(userId),
    queryFn: () => userService.getUserProfile(userId),
    enabled: Boolean(userId) && (options.enabled ?? true),
    staleTime: 1000 * 60 * 5,
    ...options,
  });
}

/**
 * Hook truy vấn danh sách người theo dõi
 */
export function useUserFollowersQuery(userId, params = {}, options = {}) {
  return useQuery({
    queryKey: USER_QUERY_KEYS.followers(userId, params),
    queryFn: () => userService.getFollowers(userId, params),
    enabled: Boolean(userId) && (options.enabled ?? true),
    staleTime: 1000 * 60 * 2,
    ...options,
  });
}

/**
 * Hook truy vấn danh sách đang theo dõi
 */
export function useUserFollowingQuery(userId, params = {}, options = {}) {
  return useQuery({
    queryKey: USER_QUERY_KEYS.following(userId, params),
    queryFn: () => userService.getFollowing(userId, params),
    enabled: Boolean(userId) && (options.enabled ?? true),
    staleTime: 1000 * 60 * 2,
    ...options,
  });
}

// ════════════════════════════════════════════════════════════════
// ADMIN QUERIES
// ════════════════════════════════════════════════════════════════

/**
 * Hook danh sách người dùng phân trang (Admin)
 */
export function useAdminUsersQuery(params = {}, options = {}) {
  return useQuery({
    queryKey: ADMIN_USER_QUERY_KEYS.list(params),
    queryFn: () => userService.listUsers(params),
    staleTime: 1000 * 30, // 30 giây
    ...options,
  });
}

/**
 * Hook xem chi tiết người dùng (Admin)
 */
export function useAdminUserDetailQuery(id, options = {}) {
  return useQuery({
    queryKey: ADMIN_USER_QUERY_KEYS.detail(id),
    queryFn: () => userService.getUser(id),
    enabled: Boolean(id) && (options.enabled ?? true),
    staleTime: 1000 * 60,
    ...options,
  });
}

/**
 * Hook xem danh sách phiên đăng nhập của người dùng (Admin)
 */
export function useAdminUserSessionsQuery(id, options = {}) {
  return useQuery({
    queryKey: ADMIN_USER_QUERY_KEYS.sessions(id),
    queryFn: () => userService.listUserSessions(id),
    enabled: Boolean(id) && (options.enabled ?? true),
    staleTime: 1000 * 30,
    ...options,
  });
}

/**
 * Hook xem thông tin ví của người dùng (Admin)
 */
export function useAdminUserWalletQuery(id, options = {}) {
  return useQuery({
    queryKey: ADMIN_USER_QUERY_KEYS.wallet(id),
    queryFn: () => userService.getUserWallet(id),
    enabled: Boolean(id) && (options.enabled ?? true),
    staleTime: 1000 * 30,
    ...options,
  });
}

/**
 * Hook xem lịch sử đăng ký gói cước VIP của người dùng (Admin)
 */
export function useAdminUserSubscriptionsQuery(id, params = {}, options = {}) {
  return useQuery({
    queryKey: ADMIN_USER_QUERY_KEYS.subscriptions(id, params),
    queryFn: () => userService.listUserSubscriptions(id, params),
    enabled: Boolean(id) && (options.enabled ?? true),
    staleTime: 1000 * 60,
    ...options,
  });
}

export default {
  USER_QUERY_KEYS,
  ADMIN_USER_QUERY_KEYS,
  useMyProfileQuery,
  useUserPreferencesQuery,
  useUserStatsQuery,
  useUserProfileQuery,
  useUserFollowersQuery,
  useUserFollowingQuery,
  useAdminUsersQuery,
  useAdminUserDetailQuery,
  useAdminUserSessionsQuery,
  useAdminUserWalletQuery,
  useAdminUserSubscriptionsQuery,
};
