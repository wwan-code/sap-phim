/**
 * @file use-auth.mutations.js
 * @module Hooks/Mutations/Auth
 * @description Các React Mutation Hooks phục vụ các thao tác thay đổi trạng thái xác thực và quản lý tài khoản.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import authService from "@/shared/services/auth.service";
import { AUTH_QUERY_KEYS } from "@/hooks/queries/use-auth.queries";

/**
 * Mutation hook đăng nhập
 */
export function useLoginMutation(options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (credentials) => authService.login(credentials),
    onSuccess: (data, variables, context) => {
      const isMfa =
        data?.mfaRequired ||
        data?.requireMfa ||
        data?.status === "mfa_required" ||
        data?.status === "mfa_setup_required";
      if (!isMfa) {
        queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEYS.me() });
      }
      options.onSuccess?.(data, variables, context);
    },
    ...options,
  });
}

/**
 * Mutation hook xác minh mã 2FA đăng nhập
 */
export function useMfaLoginVerifyMutation(options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload) => authService.verifyMfaLogin(payload),
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEYS.me() });
      options.onSuccess?.(data, variables, context);
    },
    ...options,
  });
}

/**
 * Mutation hook đăng ký tài khoản
 */
export function useRegisterMutation(options = {}) {
  return useMutation({
    mutationFn: (payload) => authService.register(payload),
    ...options,
  });
}

/**
 * Mutation hook đăng xuất
 */
export function useLogoutMutation(options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => authService.logout(),
    onSuccess: (data, variables, context) => {
      queryClient.clear();
      options.onSuccess?.(data, variables, context);
    },
    ...options,
  });
}

/**
 * Mutation hook đăng xuất khỏi tất cả thiết bị
 */
export function useLogoutAllMutation(options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => authService.logoutAll(),
    onSuccess: (data, variables, context) => {
      queryClient.clear();
      options.onSuccess?.(data, variables, context);
    },
    ...options,
  });
}

/**
 * Mutation hook đổi mật khẩu
 */
export function useChangePasswordMutation(options = {}) {
  return useMutation({
    mutationFn: (payload) => authService.changePassword(payload),
    ...options,
  });
}

/**
 * Mutation hook yêu cầu quên mật khẩu
 */
export function useForgotPasswordMutation(options = {}) {
  return useMutation({
    mutationFn: (payload) => authService.forgotPassword(payload),
    ...options,
  });
}

/**
 * Mutation hook đặt lại mật khẩu bằng token
 */
export function useResetPasswordMutation(options = {}) {
  return useMutation({
    mutationFn: (payload) => authService.resetPassword(payload),
    ...options,
  });
}

/**
 * Mutation hook xác thực email
 */
export function useVerifyEmailMutation(options = {}) {
  return useMutation({
    mutationFn: (token) => authService.verifyEmail(token),
    ...options,
  });
}

/**
 * Mutation hook gửi lại email xác thực
 */
export function useResendVerificationMutation(options = {}) {
  return useMutation({
    mutationFn: (payload) => authService.resendVerification(payload),
    ...options,
  });
}

/**
 * Mutation hook thu hồi phiên đăng nhập
 */
export function useRevokeSessionMutation(options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (sessionId) => authService.revokeSession(sessionId),
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEYS.sessions() });
      options.onSuccess?.(data, variables, context);
    },
    ...options,
  });
}

/**
 * Mutation hook khởi tạo cấu hình MFA (TOTP QR Code)
 */
export function useSetupMfaMutation(options = {}) {
  return useMutation({
    mutationFn: () => authService.setupMfa(),
    ...options,
  });
}

/**
 * Mutation hook kích hoạt MFA
 */
export function useEnableMfaMutation(options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload) => authService.enableMfa(payload),
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEYS.me() });
      options.onSuccess?.(data, variables, context);
    },
    ...options,
  });
}

/**
 * Mutation hook tắt MFA
 */
export function useDisableMfaMutation(options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload) => authService.disableMfa(payload),
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEYS.me() });
      options.onSuccess?.(data, variables, context);
    },
    ...options,
  });
}

export default {
  useLoginMutation,
  useMfaLoginVerifyMutation,
  useRegisterMutation,
  useLogoutMutation,
  useLogoutAllMutation,
  useChangePasswordMutation,
  useForgotPasswordMutation,
  useResetPasswordMutation,
  useVerifyEmailMutation,
  useResendVerificationMutation,
  useRevokeSessionMutation,
  useSetupMfaMutation,
  useEnableMfaMutation,
  useDisableMfaMutation,
};
