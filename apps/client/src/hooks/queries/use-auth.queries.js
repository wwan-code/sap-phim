/**
 * @file use-auth.queries.js
 * @module Hooks/Queries/Auth
 * @description Các React Query Hooks phục vụ truy vấn dữ liệu tài khoản và phiên đăng nhập.
 */

import { useQuery } from "@tanstack/react-query";
import { useSelector } from "react-redux";
import authService from "@/shared/services/auth.service";
import { selectIsAuthenticated } from "@/store/slices/auth.slice";

export const AUTH_QUERY_KEYS = {
  all: ["auth"],
  me: () => [...AUTH_QUERY_KEYS.all, "me"],
  sessions: () => [...AUTH_QUERY_KEYS.all, "sessions"],
};

/**
 * Hook truy vấn thông tin Profile của User hiện tại
 * @param {Object} options React Query options
 */
export function useCurrentUserQuery(options = {}) {
  const isAuthenticated = useSelector(selectIsAuthenticated);

  return useQuery({
    queryKey: AUTH_QUERY_KEYS.me(),
    queryFn: () => authService.getMe(),
    enabled: isAuthenticated && (options.enabled ?? true),
    staleTime: 1000 * 60 * 5, // 5 phút
    retry: 1,
    ...options,
  });
}

/**
 * Hook truy vấn danh sách các phiên đăng nhập (Active Sessions)
 * @param {Object} options React Query options
 */
export function useSessionsQuery(options = {}) {
  const isAuthenticated = useSelector(selectIsAuthenticated);

  return useQuery({
    queryKey: AUTH_QUERY_KEYS.sessions(),
    queryFn: () => authService.getSessions(),
    enabled: isAuthenticated && (options.enabled ?? true),
    staleTime: 1000 * 60 * 2, // 2 phút
    ...options,
  });
}

/**
 * Hook truy vấn thông tin khởi tạo thiết lập MFA (QR Code & Secret)
 * @param {string} tempToken - Token tạm thời của phiên đăng nhập chờ MFA
 * @param {Object} options React Query options
 */
export function useMfaSetupQuery(tempToken, options = {}) {
  return useQuery({
    queryKey: [...AUTH_QUERY_KEYS.all, "mfa-setup", tempToken],
    queryFn: () => authService.setupMfa(tempToken),
    enabled: Boolean(tempToken) && (options.enabled ?? true),
    staleTime: 1000 * 60 * 5, // 5 phút
    gcTime: 1000 * 60 * 10,
    retry: false,
    refetchOnWindowFocus: false,
    ...options,
  });
}

export default {
  AUTH_QUERY_KEYS,
  useCurrentUserQuery,
  useSessionsQuery,
  useMfaSetupQuery,
};
