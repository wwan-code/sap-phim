/**
 * @file use-wallet.queries.js
 * @module Hooks/Queries/Wallet
 * @description Các React Query Hooks phục vụ truy vấn Ví & Dòng tiền S-Coin (Admin), tích hợp caching, deduplication và phân trang.
 */

import { useQuery, keepPreviousData } from "@tanstack/react-query";
import walletService from "@/shared/services/wallet.service";

/**
 * Factory quản lý Query Keys cho Wallets Admin
 */
export const ADMIN_WALLET_QUERY_KEYS = {
  all: ["admin", "wallets"],
  lists: () => [...ADMIN_WALLET_QUERY_KEYS.all, "list"],
  list: (params) => [...ADMIN_WALLET_QUERY_KEYS.lists(), params],
  stats: () => [...ADMIN_WALLET_QUERY_KEYS.all, "stats"],
  allTransactions: () => [...ADMIN_WALLET_QUERY_KEYS.all, "transactions"],
  transactions: (params) => [...ADMIN_WALLET_QUERY_KEYS.allTransactions(), params],
  userTransactions: (userId, params) => [...ADMIN_WALLET_QUERY_KEYS.all, "user-transactions", userId, params],
};

/**
 * Hook truy vấn danh sách ví người dùng cho Admin Dashboard
 * @param {Object} [params={}] { page, limit, search, is_locked, sortBy, sortOrder }
 * @param {Object} [options={}] React Query Options
 * @returns {import('@tanstack/react-query').UseQueryResult}
 */
export function useAdminWalletsQuery(params = {}, options = {}) {
  return useQuery({
    queryKey: ADMIN_WALLET_QUERY_KEYS.list(params),
    queryFn: () => walletService.adminGetWallets(params),
    placeholderData: keepPreviousData,
    staleTime: 1000 * 30, // 30 giây
    ...options,
  });
}

/**
 * Hook truy vấn số liệu thống kê tài chính KPI tổng quan cho Admin
 * @param {Object} [options={}] React Query Options
 * @returns {import('@tanstack/react-query').UseQueryResult}
 */
export function useAdminWalletStatsQuery(options = {}) {
  return useQuery({
    queryKey: ADMIN_WALLET_QUERY_KEYS.stats(),
    queryFn: () => walletService.adminGetStats(),
    staleTime: 1000 * 60, // 1 phút
    ...options,
  });
}

/**
 * Hook truy vấn lịch sử giao dịch dòng tiền toàn hệ thống
 * @param {Object} [params={}] { page, limit, search, type, status, sortBy, sortOrder }
 * @param {Object} [options={}] React Query Options
 * @returns {import('@tanstack/react-query').UseQueryResult}
 */
export function useAdminWalletTransactionsQuery(params = {}, options = {}) {
  return useQuery({
    queryKey: ADMIN_WALLET_QUERY_KEYS.transactions(params),
    queryFn: () => walletService.adminGetTransactions(params),
    placeholderData: keepPreviousData,
    staleTime: 1000 * 20, // 20 giây
    ...options,
  });
}

/**
 * Hook truy vấn lịch sử giao dịch riêng biệt của 1 ví người dùng
 * @param {string} userId - UUID người dùng
 * @param {Object} [params={}] { page, limit, type, status }
 * @param {Object} [options={}] React Query Options
 * @returns {import('@tanstack/react-query').UseQueryResult}
 */
export function useAdminUserWalletTransactionsQuery(userId, params = {}, options = {}) {
  return useQuery({
    queryKey: ADMIN_WALLET_QUERY_KEYS.userTransactions(userId, params),
    queryFn: () => walletService.adminGetUserTransactions(userId, params),
    enabled: Boolean(userId) && (options.enabled ?? true),
    placeholderData: keepPreviousData,
    staleTime: 1000 * 20, // 20 giây
    ...options,
  });
}
