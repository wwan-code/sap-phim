/**
 * @file use-security.mutations.js
 * @module Hooks/Mutations/Security
 * @description React Query mutations phục vụ thu hồi phiên đăng nhập và xuất nhật ký kiểm toán.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import securityService from "@/shared/services/security.service";
import { ADMIN_SECURITY_QUERY_KEYS } from "../queries/use-security.queries";

/**
 * Mutation thu hồi một phiên đăng nhập cụ thể
 */
export function useAdminRevokeSessionMutation(options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (sessionId) => securityService.revokeAdminSession(sessionId),
    onSuccess: (data, sessionId) => {
      queryClient.invalidateQueries({
        queryKey: ADMIN_SECURITY_QUERY_KEYS.all,
      });
      toast.success(data?.message || "Thu hồi phiên đăng nhập thành công");
      options.onSuccess?.(data, sessionId);
    },
    onError: (error) => {
      const message = error?.message || "Thu hồi phiên đăng nhập thất bại";
      toast.error(message);
      options.onError?.(error);
    },
    ...options,
  });
}

/**
 * Mutation cưỡng chế thu hồi tất cả phiên đăng nhập của một người dùng
 */
export function useAdminRevokeUserAllSessionsMutation(options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, reason }) =>
      securityService.revokeAdminUserAllSessions(userId, reason),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ADMIN_SECURITY_QUERY_KEYS.all,
      });
      toast.success(
        data?.message || "Đã cưỡng chế đăng xuất tất cả thiết bị của người dùng"
      );
      options.onSuccess?.(data, variables);
    },
    onError: (error) => {
      const message =
        error?.message || "Cưỡng chế đăng xuất tất cả thiết bị thất bại";
      toast.error(message);
      options.onError?.(error);
    },
    ...options,
  });
}

/**
 * Mutation xuất báo cáo nhật ký kiểm toán (Export Audit Logs)
 */
export function useAdminExportAuditLogsMutation(options = {}) {
  return useMutation({
    mutationFn: (params) => securityService.exportAdminAuditLogs(params),
    onSuccess: (data) => {
      toast.success("Dữ liệu báo cáo kiểm toán đã sẵn sàng");
      options.onSuccess?.(data);
    },
    onError: (error) => {
      toast.error(error?.message || "Xuất báo cáo kiểm toán thất bại");
      options.onError?.(error);
    },
    ...options,
  });
}
