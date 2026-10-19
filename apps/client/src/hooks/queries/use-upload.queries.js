/**
 * @file use-upload.queries.js
 * @module Hooks/Queries/Upload
 * @description React Query Hooks phục vụ truy vấn trạng thái tiến độ công việc và thống kê hệ thống lưu trữ/hàng đợi.
 */

import { useQuery } from "@tanstack/react-query";
import { useSelector } from "react-redux";
import uploadService from "@/shared/services/upload.service";
import { selectIsAuthenticated } from "@/store/slices/auth.slice";

/**
 * Factory quản lý Query Keys phân cấp cho Upload Module
 */
export const UPLOAD_QUERY_KEYS = {
  all: ["upload"],
  statuses: () => [...UPLOAD_QUERY_KEYS.all, "status"],
  status: (jobId) => [...UPLOAD_QUERY_KEYS.statuses(), jobId],
  stats: () => [...UPLOAD_QUERY_KEYS.all, "stats"],
};

/**
 * Hook truy vấn trạng thái chi tiết của công việc xử lý ảnh/upload (Job Status)
 * Hỗ trợ tự động Polling thông minh khi công việc đang chạy và dừng hẳn khi đạt trạng thái kết thúc (Terminal Status).
 *
 * @param {string} jobId Mã ID công việc cần theo dõi
 * @param {Object} [options={}] Tùy chọn bổ sung cho React Query
 * @returns {import('@tanstack/react-query').UseQueryResult}
 */
export function useUploadJobStatusQuery(jobId, options = {}) {
  const isAuthenticated = useSelector(selectIsAuthenticated);

  return useQuery({
    queryKey: UPLOAD_QUERY_KEYS.status(jobId),
    queryFn: ({ signal }) => uploadService.getJobStatus(jobId, { signal }),
    enabled: Boolean(jobId) && isAuthenticated && (options.enabled ?? true),
    staleTime: 1000 * 2, // 2 giây
    refetchInterval: (query) => {
      if (options.refetchInterval !== undefined && typeof options.refetchInterval !== "function") {
        return options.refetchInterval;
      }
      const data = query.state.data;
      const status = data?.status || data?.data?.status;
      const isTerminal = ["completed", "failed", "partial_failure", "cancelled"].includes(status);
      if (isTerminal) return false;
      return typeof options.refetchInterval === "function"
        ? options.refetchInterval(query)
        : 2500; // Polling 2.5s khi đang xử lý
    },
    refetchOnWindowFocus: (query) => {
      const data = query.state.data;
      const status = data?.status || data?.data?.status;
      return !["completed", "failed", "partial_failure", "cancelled"].includes(status);
    },
    ...options,
  });
}

/**
 * Hook truy vấn số liệu thống kê Hàng đợi xử lý và Dung lượng Lưu trữ (Dành cho Admin)
 * @param {Object} [options={}]
 * @returns {import('@tanstack/react-query').UseQueryResult}
 */
export function useUploadStatsQuery(options = {}) {
  const isAuthenticated = useSelector(selectIsAuthenticated);

  return useQuery({
    queryKey: UPLOAD_QUERY_KEYS.stats(),
    queryFn: ({ signal }) => uploadService.getStats({ signal }),
    enabled: isAuthenticated && (options.enabled ?? true),
    staleTime: 1000 * 30, // 30 giây
    ...options,
  });
}

export default {
  UPLOAD_QUERY_KEYS,
  useUploadJobStatusQuery,
  useUploadStatsQuery,
};
