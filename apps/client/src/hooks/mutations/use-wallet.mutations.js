/**
 * @file use-wallet.mutations.js
 * @module Hooks/Mutations/Wallet
 * @description Các React Mutation Hooks phục vụ quản lý ví & dòng tiền S-Coin (Admin), tích hợp đồng bộ Cache.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import walletService from "@/shared/services/wallet.service";
import { ADMIN_WALLET_QUERY_KEYS } from "@/hooks/queries/use-wallet.queries";

/**
 * Hook Admin điều chỉnh số dư S-Coin thủ công (Cộng / Trừ / Thưởng)
 * @param {Object} [options={}] React Query Mutation Options
 * @returns {import('@tanstack/react-query').UseMutationResult}
 */
export function useAdminAdjustBalanceMutation(options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data) => walletService.adminAdjustBalance(data),
    onSuccess: (data, variables, context) => {
      // 1. Làm mới danh sách ví & thống kê
      queryClient.invalidateQueries({ queryKey: ADMIN_WALLET_QUERY_KEYS.all });

      // 2. Làm mới danh sách người dùng nếu có hiển thị số dư ví
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });

      // 3. Làm mới auth profile cá nhân nếu admin tự chỉnh ví chính mình
      queryClient.invalidateQueries({ queryKey: ["auth", "me"] });

      const typeLabel =
        variables?.type === "bonus"
          ? "Tặng thưởng"
          : variables?.type === "admin_credit"
          ? "Cộng xu"
          : "Khấu trừ xu";

      toast.success(data?.message || `${typeLabel} cho thành viên thành công!`);
      options.onSuccess?.(data, variables, context);
    },
    onError: (error, variables, context) => {
      const msg = error?.response?.data?.message || error?.message || "Lỗi khi điều chỉnh số dư ví";
      toast.error(msg);
      options.onError?.(error, variables, context);
    },
    ...options,
  });
}

/**
 * Hook Admin khóa ví người dùng
 * @param {Object} [options={}] React Query Mutation Options
 * @returns {import('@tanstack/react-query').UseMutationResult}
 */
export function useAdminLockWalletMutation(options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, reason }) => walletService.adminLockWallet(userId, { reason }),
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: ADMIN_WALLET_QUERY_KEYS.all });
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });

      toast.success("Đã khóa ví người dùng thành công!");
      options.onSuccess?.(data, variables, context);
    },
    onError: (error, variables, context) => {
      const msg = error?.response?.data?.message || error?.message || "Lỗi khi khóa ví người dùng";
      toast.error(msg);
      options.onError?.(error, variables, context);
    },
    ...options,
  });
}

/**
 * Hook Admin mở khóa ví người dùng
 * @param {Object} [options={}] React Query Mutation Options
 * @returns {import('@tanstack/react-query').UseMutationResult}
 */
export function useAdminUnlockWalletMutation(options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId }) => walletService.adminUnlockWallet(userId),
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: ADMIN_WALLET_QUERY_KEYS.all });
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });

      toast.success("Đã mở khóa ví người dùng thành công!");
      options.onSuccess?.(data, variables, context);
    },
    onError: (error, variables, context) => {
      const msg = error?.response?.data?.message || error?.message || "Lỗi khi mở khóa ví người dùng";
      toast.error(msg);
      options.onError?.(error, variables, context);
    },
    ...options,
  });
}
