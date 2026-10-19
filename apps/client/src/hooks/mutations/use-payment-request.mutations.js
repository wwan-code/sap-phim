/**
 * @file use-payment-request.mutations.js
 * @module Hooks/Mutations/PaymentRequest
 * @description Các React Mutation Hooks phục vụ phê duyệt / từ chối yêu cầu thanh toán (Admin), tích hợp đồng bộ Cache.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import paymentRequestService from "@/shared/services/payment-request.service";
import { ADMIN_PAYMENT_REQUEST_QUERY_KEYS } from "@/hooks/queries/use-payment-request.queries";
import { ADMIN_WALLET_QUERY_KEYS } from "@/hooks/queries/use-wallet.queries";

/**
 * Hook Admin xử lý Phê duyệt / Từ chối yêu cầu thanh toán
 * @param {Object} [options={}] React Query Mutation Options
 * @returns {import('@tanstack/react-query').UseMutationResult}
 */
export function useAdminProcessPaymentRequestMutation(options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, status, rejection_reason }) =>
      paymentRequestService.adminProcessRequest(id, { status, rejection_reason }),
    onSuccess: (data, variables, context) => {
      // 1. Làm mới danh sách yêu cầu thanh toán & thống kê tài chính
      queryClient.invalidateQueries({ queryKey: ADMIN_PAYMENT_REQUEST_QUERY_KEYS.all });

      // 2. Làm mới danh sách ví & dòng tiền hệ thống
      queryClient.invalidateQueries({ queryKey: ADMIN_WALLET_QUERY_KEYS.all });

      // 3. Làm mới danh sách thuê bao nếu có liên quan
      queryClient.invalidateQueries({ queryKey: ["admin", "subscriptions"] });

      const isApproved = variables?.status === "approved";
      toast.success(
        data?.message || (isApproved ? "Đã phê duyệt lệnh thành công!" : "Đã từ chối lệnh thanh toán!")
      );
      options.onSuccess?.(data, variables, context);
    },
    onError: (error, variables, context) => {
      const msg =
        error?.response?.data?.message ||
        error?.message ||
        "Lỗi khi xử lý yêu cầu thanh toán";
      toast.error(msg);
      options.onError?.(error, variables, context);
    },
    ...options,
  });
}
