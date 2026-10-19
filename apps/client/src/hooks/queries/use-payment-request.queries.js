/**
 * @file use-payment-request.queries.js
 * @module Hooks/Queries/PaymentRequest
 * @description Các React Query Hooks phục vụ truy vấn Yêu cầu Thanh toán / Hàng đợi nạp rút (Admin), tích hợp caching, deduplication và phân trang.
 */

import { useQuery, keepPreviousData } from "@tanstack/react-query";
import paymentRequestService from "@/shared/services/payment-request.service";

/**
 * Factory quản lý Query Keys cho Payment Requests Admin
 */
export const ADMIN_PAYMENT_REQUEST_QUERY_KEYS = {
  all: ["admin", "payment-requests"],
  lists: () => [...ADMIN_PAYMENT_REQUEST_QUERY_KEYS.all, "list"],
  list: (params) => [...ADMIN_PAYMENT_REQUEST_QUERY_KEYS.lists(), params],
  stats: () => [...ADMIN_PAYMENT_REQUEST_QUERY_KEYS.all, "stats"],
};

/**
 * Hook truy vấn danh sách yêu cầu thanh toán cho Admin Dashboard
 * @param {Object} [params={}] { page, limit, search, type, status, sortBy, sortOrder }
 * @param {Object} [options={}] React Query Options
 * @returns {import('@tanstack/react-query').UseQueryResult}
 */
export function useAdminPaymentRequestsQuery(params = {}, options = {}) {
  return useQuery({
    queryKey: ADMIN_PAYMENT_REQUEST_QUERY_KEYS.list(params),
    queryFn: () => paymentRequestService.adminGetPaymentRequests(params),
    placeholderData: keepPreviousData,
    staleTime: 1000 * 20, // 20 giây
    ...options,
  });
}

/**
 * Hook truy vấn số liệu thống kê tài chính thời gian thực của yêu cầu thanh toán cho Admin
 * @param {Object} [options={}] React Query Options
 * @returns {import('@tanstack/react-query').UseQueryResult}
 */
export function useAdminPaymentRequestStatsQuery(options = {}) {
  return useQuery({
    queryKey: ADMIN_PAYMENT_REQUEST_QUERY_KEYS.stats(),
    queryFn: () => paymentRequestService.adminGetStats(),
    staleTime: 1000 * 30, // 30 giây
    refetchInterval: 1000 * 45, // Tự động làm mới mỗi 45 giây
    ...options,
  });
}
