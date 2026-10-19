/**
 * @file use-security.queries.js
 * @module Hooks/Queries/Security
 * @description React Query hooks phục vụ truy vấn danh sách phiên đăng nhập và nhật ký kiểm toán bảo mật.
 */

import { useQuery } from "@tanstack/react-query";
import securityService from "@/shared/services/security.service";

export const ADMIN_SECURITY_QUERY_KEYS = {
  all: ["admin", "security"],
  sessions: (params) => [...ADMIN_SECURITY_QUERY_KEYS.all, "sessions", params],
  sessionStats: () => [...ADMIN_SECURITY_QUERY_KEYS.all, "sessions", "stats"],
  auditLogs: (params) => [...ADMIN_SECURITY_QUERY_KEYS.all, "audit-logs", params],
  auditLogStats: () => [...ADMIN_SECURITY_QUERY_KEYS.all, "audit-logs", "stats"],
  auditLogDetail: (id) => [...ADMIN_SECURITY_QUERY_KEYS.all, "audit-logs", "detail", id],
};

/**
 * Hook truy vấn danh sách các phiên đăng nhập toàn hệ thống
 * @param {Object} params - Query params (page, limit, search, role, min_risk_score, anomaly, status)
 * @param {Object} options - React Query options
 */
export function useAdminSessionsQuery(params = {}, options = {}) {
  return useQuery({
    queryKey: ADMIN_SECURITY_QUERY_KEYS.sessions(params),
    queryFn: () => securityService.getAdminSessions(params),
    staleTime: 30 * 1000,
    ...options,
  });
}

/**
 * Hook truy vấn thống kê KPI phiên đăng nhập
 * @param {Object} options - React Query options
 */
export function useAdminSessionStatsQuery(options = {}) {
  return useQuery({
    queryKey: ADMIN_SECURITY_QUERY_KEYS.sessionStats(),
    queryFn: () => securityService.getAdminSessionStats(),
    staleTime: 60 * 1000,
    ...options,
  });
}

/**
 * Hook truy vấn danh sách nhật ký kiểm toán bảo mật
 * @param {Object} params - Query params (page, limit, search, severity, event_category, status, start_date, end_date)
 * @param {Object} options - React Query options
 */
export function useAdminAuditLogsQuery(params = {}, options = {}) {
  return useQuery({
    queryKey: ADMIN_SECURITY_QUERY_KEYS.auditLogs(params),
    queryFn: () => securityService.getAdminAuditLogs(params),
    staleTime: 30 * 1000,
    ...options,
  });
}

/**
 * Hook truy vấn thống kê chỉ số nhật ký kiểm toán
 * @param {Object} options - React Query options
 */
export function useAdminAuditLogStatsQuery(options = {}) {
  return useQuery({
    queryKey: ADMIN_SECURITY_QUERY_KEYS.auditLogStats(),
    queryFn: () => securityService.getAdminAuditLogStats(),
    staleTime: 60 * 1000,
    ...options,
  });
}

/**
 * Hook truy vấn chi tiết một bản ghi Audit Log
 * @param {string} id - ID bản ghi
 * @param {Object} options - React Query options
 */
export function useAdminAuditLogDetailQuery(id, options = {}) {
  return useQuery({
    queryKey: ADMIN_SECURITY_QUERY_KEYS.auditLogDetail(id),
    queryFn: () => securityService.getAdminAuditLogDetail(id),
    enabled: Boolean(id),
    staleTime: 5 * 60 * 1000,
    ...options,
  });
}
