/**
 * @file use-studio.queries.js
 * @module Hooks/Queries/Studio
 * @description Các React Query Hooks phục vụ truy vấn dữ liệu hãng sản xuất (Studio - Public & Admin).
 */

import { useQuery } from "@tanstack/react-query";
import studioService from "@/shared/services/studio.service";

export const STUDIO_QUERY_KEYS = {
  all: ["studios"],
  publicList: (params) => [...STUDIO_QUERY_KEYS.all, "public", "list", params],
  publicDetail: (slug) => [...STUDIO_QUERY_KEYS.all, "public", "detail", slug],
  adminList: (params) => [...STUDIO_QUERY_KEYS.all, "admin", "list", params],
  adminDetail: (id) => [...STUDIO_QUERY_KEYS.all, "admin", "detail", id],
};

// ════════════════════════════════════════
// PUBLIC QUERIES
// ════════════════════════════════════════

/**
 * Hook lấy danh sách hãng sản xuất công khai
 */
export function usePublicStudiosQuery(params = {}, options = {}) {
  return useQuery({
    queryKey: STUDIO_QUERY_KEYS.publicList(params),
    queryFn: () => studioService.listPublic(params),
    staleTime: 1000 * 60 * 15,
    ...options,
  });
}

/**
 * Hook lấy chi tiết hãng sản xuất theo slug
 */
export function usePublicStudioDetailQuery(slug, options = {}) {
  return useQuery({
    queryKey: STUDIO_QUERY_KEYS.publicDetail(slug),
    queryFn: () => studioService.getBySlug(slug),
    enabled: Boolean(slug) && (options.enabled ?? true),
    staleTime: 1000 * 60 * 15,
    ...options,
  });
}

// ════════════════════════════════════════
// ADMIN QUERIES
// ════════════════════════════════════════

/**
 * Hook lấy danh sách hãng sản xuất đầy đủ cho Admin
 */
export function useAdminStudiosQuery(params = {}, options = {}) {
  return useQuery({
    queryKey: STUDIO_QUERY_KEYS.adminList(params),
    queryFn: () => studioService.getAll(params),
    staleTime: 1000 * 30,
    ...options,
  });
}

/**
 * Hook lấy chi tiết hãng sản xuất theo ID cho Admin
 */
export function useAdminStudioDetailQuery(id, options = {}) {
  return useQuery({
    queryKey: STUDIO_QUERY_KEYS.adminDetail(id),
    queryFn: () => studioService.getById(id),
    enabled: Boolean(id) && (options.enabled ?? true),
    staleTime: 1000 * 60,
    ...options,
  });
}

export default {
  STUDIO_QUERY_KEYS,
  usePublicStudiosQuery,
  usePublicStudioDetailQuery,
  useAdminStudiosQuery,
  useAdminStudioDetailQuery,
};
