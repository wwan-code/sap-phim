/**
 * @file query-client.js
 * @module Shared/Lib/QueryClient
 * @description Cấu hình trung tâm cho TanStack React Query (Global Cache & Error Handling).
 */

import { QueryClient, QueryCache, MutationCache } from '@tanstack/react-query';
import toast from 'react-hot-toast';

// ────────────────────────────────────────────────────────────────────────────────────────────────
// HELPERS
// ────────────────────────────────────────────────────────────────────────────────────────────────

const extractMessage = (error, fallback) =>
  error?.response?.data?.message ||
  error?.data?.message ||
  error?.message ||
  fallback;

const isAuthError = (error) =>
  error?.status === 401 || error?.response?.status === 401;

/**
 * Quyết định có nên thử lại yêu cầu khi thất bại hay không
 */
const shouldRetryQuery = (failureCount, error) => {
  // Không thử lại nếu là lỗi Client (4xx) trừ 408 (timeout) và 429 (rate-limit)
  const status = error?.status || error?.response?.status;
  if (status && status >= 400 && status < 500) {
    if (status !== 408 && status !== 429) return false;
  }
  // Thử lại tối đa 2 lần cho các lỗi khác
  return failureCount < 2;
};

// ────────────────────────────────────────────────────────────────────────────────────────────────
// CACHE HANDLERS (GLOBAL)
// ────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Quản lý lỗi toàn cục cho các truy vấn dữ liệu (Queries)
 */
const queryCache = new QueryCache({
  onError(error, query) {
    // Lỗi xác thực đã được xử lý ở interceptor của api.js
    if (isAuthError(error)) return;

    // Chỉ hiển thị Toast lỗi khi dữ liệu đã tồn tại (refetch ngầm bị lỗi)
    // Với lần tải đầu tiên, lỗi nên được hiển thị trực tiếp trên UI bởi component
    if (query.state.data !== undefined) {
      const msg = extractMessage(error, 'Không thể tải dữ liệu mới nhất');
      toast.error(msg, { id: `qerr-${query.queryHash}` });
    }

    if (import.meta.env.DEV) {
      console.error('[QueryCache] Global Error:', query.queryKey, error);
    }
  },
});

/**
 * Quản lý phản hồi toàn cục cho các thao tác thay đổi dữ liệu (Mutations)
 */
const mutationCache = new MutationCache({
  onError(error, _vars, _ctx, mutation) {
    if (isAuthError(error)) return;

    // Cho phép tắt thông báo lỗi toàn cục thông qua meta
    if (mutation.options.meta?.suppressGlobalError) return;

    const msg = extractMessage(error, 'Thao tác thất bại');
    toast.error(msg, { id: `m-err-${msg}` });

    if (import.meta.env.DEV) {
      console.error('[MutationCache] Global Error:', error);
    }
  },

  onSuccess(_data, _vars, _ctx, mutation) {
    // Hiển thị thông báo thành công nếu có cấu hình trong meta
    const successMsg = mutation.options.meta?.successMessage;
    if (successMsg) {
      toast.success(successMsg);
    }
  },
});

// ────────────────────────────────────────────────────────────────────────────────────────────────
// QUERY CLIENT INSTANCE
// ────────────────────────────────────────────────────────────────────────────────────────────────

export const queryClient = new QueryClient({
  queryCache,
  mutationCache,

  defaultOptions: {
    queries: {
      retry: shouldRetryQuery,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10_000),

      // Thời gian dữ liệu được coi là "tươi" (2 phút)
      staleTime: 2 * 60 * 1000,
      // Thời gian giữ dữ liệu trong bộ nhớ trước khi bị dọn dẹp (5 phút)
      gcTime: 5 * 60 * 1000,

      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      refetchOnMount: false,
      placeholderData: (previousData) => previousData,

      // Cho phép trả về dữ liệu cũ ngay lập tức khi offline
      networkMode: 'offlineFirst',

      // Cho phép Error Boundary bắt lỗi nếu là lần tải đầu tiên
      throwOnError: (error, query) => {
        if (isAuthError(error)) return false;
        return query.state.data === undefined;
      },
    },
    mutations: {
      retry: false, // Không tự động thử lại các thao tác thay đổi dữ liệu (tránh trùng lặp)
      networkMode: 'online',
    },
  },
});

export default queryClient;
