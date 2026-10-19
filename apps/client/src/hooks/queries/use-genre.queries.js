/**
 * @file use-genre.queries.js
 * @module Hooks/Queries/Genre
 * @description Các React Query Hooks phục vụ truy vấn dữ liệu thể loại phim (Genre - Public & Admin).
 */

import { useQuery } from "@tanstack/react-query";
import genreService from "@/shared/services/genre.service";

export const GENRE_QUERY_KEYS = {
  all: ["genres"],
  publicList: (params) => [...GENRE_QUERY_KEYS.all, "public", "list", params],
  publicDetail: (slug) => [...GENRE_QUERY_KEYS.all, "public", "detail", slug],
  adminList: (params) => [...GENRE_QUERY_KEYS.all, "admin", "list", params],
  adminDetail: (id) => [...GENRE_QUERY_KEYS.all, "admin", "detail", id],
};

// ════════════════════════════════════════
// PUBLIC QUERIES
// ════════════════════════════════════════

/**
 * Hook lấy danh sách thể loại công khai (chỉ active)
 */
export function usePublicGenresQuery(params = {}, options = {}) {
  return useQuery({
    queryKey: GENRE_QUERY_KEYS.publicList(params),
    queryFn: () => genreService.listPublic(params),
    staleTime: 1000 * 60 * 15, // 15 phút
    ...options,
  });
}

/**
 * Hook lấy chi tiết thể loại theo slug
 */
export function usePublicGenreDetailQuery(slug, options = {}) {
  return useQuery({
    queryKey: GENRE_QUERY_KEYS.publicDetail(slug),
    queryFn: () => genreService.getBySlug(slug),
    enabled: Boolean(slug) && (options.enabled ?? true),
    staleTime: 1000 * 60 * 15,
    ...options,
  });
}

// ════════════════════════════════════════
// ADMIN QUERIES
// ════════════════════════════════════════

/**
 * Hook lấy danh sách thể loại đầy đủ cho Admin
 */
export function useAdminGenresQuery(params = {}, options = {}) {
  return useQuery({
    queryKey: GENRE_QUERY_KEYS.adminList(params),
    queryFn: () => genreService.getAll(params),
    staleTime: 1000 * 30, // 30 giây
    ...options,
  });
}

/**
 * Hook lấy chi tiết thể loại theo ID cho Admin
 */
export function useAdminGenreDetailQuery(id, options = {}) {
  return useQuery({
    queryKey: GENRE_QUERY_KEYS.adminDetail(id),
    queryFn: () => genreService.getById(id),
    enabled: Boolean(id) && (options.enabled ?? true),
    staleTime: 1000 * 60,
    ...options,
  });
}

export default {
  GENRE_QUERY_KEYS,
  usePublicGenresQuery,
  usePublicGenreDetailQuery,
  useAdminGenresQuery,
  useAdminGenreDetailQuery,
};
