/**
 * @file use-user.mutations.js
 * @module Hooks/Mutations/User
 * @description Các React Mutation Hooks phục vụ các thao tác thay đổi dữ liệu người dùng (Member & Admin).
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import userService from "@/shared/services/user.service";
import { USER_QUERY_KEYS, ADMIN_USER_QUERY_KEYS } from "@/hooks/queries/use-user.queries";

// ════════════════════════════════════════════════════════════════
// MEMBER MUTATIONS
// ════════════════════════════════════════════════════════════════

/**
 * Mutation cập nhật thông tin Profile cá nhân
 */
export function useUpdateProfileMutation(options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload) => userService.updateMyProfile(payload),
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: USER_QUERY_KEYS.me() });
      options.onSuccess?.(data, variables, context);
    },
    ...options,
  });
}

/**
 * Mutation cập nhật Avatar
 */
export function useUpdateAvatarMutation(options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload) => userService.updateAvatar(payload),
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: USER_QUERY_KEYS.me() });
      options.onSuccess?.(data, variables, context);
    },
    ...options,
  });
}

/**
 * Mutation cập nhật ảnh bìa Cover
 */
export function useUpdateCoverMutation(options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload) => userService.updateCover(payload),
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: USER_QUERY_KEYS.me() });
      options.onSuccess?.(data, variables, context);
    },
    ...options,
  });
}

/**
 * Mutation cập nhật tùy chọn cá nhân
 */
export function useUpdatePreferencesMutation(options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload) => userService.updatePreferences(payload),
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: USER_QUERY_KEYS.preferences() });
      options.onSuccess?.(data, variables, context);
    },
    ...options,
  });
}

/**
 * Mutation cập nhật quyền riêng tư
 */
export function useUpdatePrivacyMutation(options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload) => userService.updatePrivacy(payload),
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: USER_QUERY_KEYS.preferences() });
      queryClient.invalidateQueries({ queryKey: USER_QUERY_KEYS.me() });
      options.onSuccess?.(data, variables, context);
    },
    ...options,
  });
}

/**
 * Mutation khôi phục tùy chọn về mặc định
 */
export function useResetPreferencesMutation(options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => userService.resetPreferences(),
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: USER_QUERY_KEYS.preferences() });
      options.onSuccess?.(data, variables, context);
    },
    ...options,
  });
}

/**
 * Mutation áp dụng Preset tùy chọn
 */
export function useApplyPresetMutation(options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload) => userService.applyPreset(payload),
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: USER_QUERY_KEYS.preferences() });
      options.onSuccess?.(data, variables, context);
    },
    ...options,
  });
}

/**
 * Mutation xóa tài khoản cá nhân
 */
export function useDeleteAccountMutation(options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload) => userService.deleteAccount(payload),
    onSuccess: (data, variables, context) => {
      queryClient.clear();
      options.onSuccess?.(data, variables, context);
    },
    ...options,
  });
}

/**
 * Mutation theo dõi người dùng
 */
export function useFollowUserMutation(options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId) => userService.followUser(userId),
    onSuccess: (data, userId, context) => {
      queryClient.invalidateQueries({ queryKey: USER_QUERY_KEYS.profile(userId) });
      queryClient.invalidateQueries({ queryKey: USER_QUERY_KEYS.stats() });
      options.onSuccess?.(data, userId, context);
    },
    ...options,
  });
}

/**
 * Mutation hủy theo dõi người dùng
 */
export function useUnfollowUserMutation(options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId) => userService.unfollowUser(userId),
    onSuccess: (data, userId, context) => {
      queryClient.invalidateQueries({ queryKey: USER_QUERY_KEYS.profile(userId) });
      queryClient.invalidateQueries({ queryKey: USER_QUERY_KEYS.stats() });
      options.onSuccess?.(data, userId, context);
    },
    ...options,
  });
}

// ════════════════════════════════════════════════════════════════
// ADMIN MUTATIONS
// ════════════════════════════════════════════════════════════════

/**
 * Mutation tạo người dùng mới (Admin)
 */
export function useAdminCreateUserMutation(options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload) => userService.createUser(payload),
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: ADMIN_USER_QUERY_KEYS.all });
      options.onSuccess?.(data, variables, context);
    },
    ...options,
  });
}

/**
 * Mutation cập nhật thông tin người dùng (Admin)
 */
export function useAdminUpdateUserMutation(options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...payload }) => userService.updateUser(id, payload),
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: ADMIN_USER_QUERY_KEYS.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: ADMIN_USER_QUERY_KEYS.all });
      queryClient.invalidateQueries({ queryKey: USER_QUERY_KEYS.all });
      options.onSuccess?.(data, variables, context);
    },
    ...options,
  });
}

/**
 * Mutation cập nhật cấp bậc người dùng (Admin)
 */
export function useAdminUpdateLevelMutation(options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...payload }) => userService.updateUserLevel(id, payload),
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: ADMIN_USER_QUERY_KEYS.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: ADMIN_USER_QUERY_KEYS.all });
      queryClient.invalidateQueries({ queryKey: USER_QUERY_KEYS.all });
      options.onSuccess?.(data, variables, context);
    },
    ...options,
  });
}

/**
 * Mutation khôi phục tài khoản đã xóa (Admin)
 */
export function useAdminRestoreUserMutation(options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id) => userService.restoreUser(id),
    onSuccess: (data, id, context) => {
      queryClient.invalidateQueries({ queryKey: ADMIN_USER_QUERY_KEYS.detail(id) });
      queryClient.invalidateQueries({ queryKey: ADMIN_USER_QUERY_KEYS.all });
      options.onSuccess?.(data, id, context);
    },
    ...options,
  });
}

/**
 * Mutation xóa tài khoản vĩnh viễn (Admin / Boss)
 */
export function useAdminDeleteUserMutation(options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id) => userService.deleteUser(id),
    onSuccess: (data, id, context) => {
      queryClient.invalidateQueries({ queryKey: ADMIN_USER_QUERY_KEYS.all });
      options.onSuccess?.(data, id, context);
    },
    ...options,
  });
}

/**
 * Mutation cập nhật trạng thái hàng loạt (Admin)
 */
export function useAdminBulkStatusMutation(options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload) => userService.bulkUpdateStatus(payload),
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: ADMIN_USER_QUERY_KEYS.all });
      options.onSuccess?.(data, variables, context);
    },
    ...options,
  });
}

/**
 * Mutation thu hồi phiên đăng nhập của người dùng (Admin)
 */
export function useAdminRevokeSessionMutation(options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, sessionId }) => userService.revokeUserSession(id, sessionId),
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: ADMIN_USER_QUERY_KEYS.sessions(variables.id) });
      options.onSuccess?.(data, variables, context);
    },
    ...options,
  });
}

/**
 * Mutation khóa ví người dùng (Admin)
 */
export function useAdminLockWalletMutation(options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...payload }) => userService.lockUserWallet(id, payload),
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: ADMIN_USER_QUERY_KEYS.wallet(variables.id) });
      options.onSuccess?.(data, variables, context);
    },
    ...options,
  });
}

/**
 * Mutation mở khóa ví người dùng (Admin)
 */
export function useAdminUnlockWalletMutation(options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id) => userService.unlockUserWallet(id),
    onSuccess: (data, id, context) => {
      queryClient.invalidateQueries({ queryKey: ADMIN_USER_QUERY_KEYS.wallet(id) });
      options.onSuccess?.(data, id, context);
    },
    ...options,
  });
}

export default {
  useUpdateProfileMutation,
  useUpdateAvatarMutation,
  useUpdateCoverMutation,
  useUpdatePreferencesMutation,
  useUpdatePrivacyMutation,
  useResetPreferencesMutation,
  useApplyPresetMutation,
  useDeleteAccountMutation,
  useFollowUserMutation,
  useUnfollowUserMutation,
  useAdminCreateUserMutation,
  useAdminUpdateUserMutation,
  useAdminUpdateLevelMutation,
  useAdminRestoreUserMutation,
  useAdminDeleteUserMutation,
  useAdminBulkStatusMutation,
  useAdminRevokeSessionMutation,
  useAdminLockWalletMutation,
  useAdminUnlockWalletMutation,
};
