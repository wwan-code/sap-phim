/**
 * @file use-series.queries.js
 * @module Hooks/Queries/Series
 * @description Các React Query Hooks phục vụ truy vấn dữ liệu thương hiệu/vũ trụ phim (Series - Public & Admin).
 */

import { useQuery } from "@tanstack/react-query";
import seriesService from "@/shared/services/series.service";

export const SERIES_QUERY_KEYS = {
  all: ["series"],
  publicList: (params) => [...SERIES_QUERY_KEYS.all, "public", "list", params],
  publicDetail: (slug) => [...SERIES_QUERY_KEYS.all, "public", "detail", slug],
  adminList: (params) => [...SERIES_QUERY_KEYS.all, "admin", "list", params],
  adminDetail: (id) => [...SERIES_QUERY_KEYS.all, "admin", "detail", id],
};

// ════════════════════════════════════════
// PUBLIC QUERIES
// ════════════════════════════════════════

/**
 * Hook lấy danh sách thương hiệu phim công khai
 */
export function usePublicSeriesQuery(params = {}, options = {}) {
  return useQuery({
    queryKey: SERIES_QUERY_KEYS.publicList(params),
    queryFn: () => seriesService.listPublic(params),
    staleTime: 1000 * 60 * 15,
    ...options,
  });
}

/**
 * Hook lấy chi tiết thương hiệu phim theo slug
 */
export function usePublicSeriesDetailQuery(slug, options = {}) {
  return useQuery({
    queryKey: SERIES_QUERY_KEYS.publicDetail(slug),
    queryFn: () => seriesService.getBySlug(slug),
    enabled: Boolean(slug) && (options.enabled ?? true),
    staleTime: 1000 * 60 * 15,
    ...options,
  });
}

// ════════════════════════════════════════
// ADMIN QUERIES
// ════════════════════════════════════════

/**
 * Hook lấy danh sách thương hiệu phim đầy đủ cho Admin
 */
export function useAdminSeriesQuery(params = {}, options = {}) {
  return useQuery({
    queryKey: SERIES_QUERY_KEYS.adminList(params),
    queryFn: () => seriesService.getAll(params),
    staleTime: 1000 * 30,
    ...options,
  });
}

/**
 * Hook lấy chi tiết thương hiệu phim theo ID cho Admin
 */
export function useAdminSeriesDetailQuery(id, options = {}) {
  return useQuery({
    queryKey: SERIES_QUERY_KEYS.adminDetail(id),
    queryFn: () => seriesService.getById(id),
    enabled: Boolean(id) && (options.enabled ?? true),
    staleTime: 1000 * 60,
    ...options,
  });
}

export default {
  SERIES_QUERY_KEYS,
  usePublicSeriesQuery,
  usePublicSeriesDetailQuery,
  useAdminSeriesQuery,
  useAdminSeriesDetailQuery,
};
