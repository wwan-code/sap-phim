/**
 * @file use-movie.queries.js
 * @module Hooks/Queries/Movie
 * @description Các React Query Hooks phục vụ truy vấn dữ liệu tác phẩm điện ảnh/anime (Movie - Public & Admin).
 */

import { useQuery } from "@tanstack/react-query";
import movieService from "@/shared/services/movie.service";

export const MOVIE_QUERY_KEYS = {
  all: ["movies"],
  publicList: (params) => [...MOVIE_QUERY_KEYS.all, "public", "list", params],
  publicDetail: (slug) => [...MOVIE_QUERY_KEYS.all, "public", "detail", slug],
  adminList: (params) => [...MOVIE_QUERY_KEYS.all, "admin", "list", params],
  adminDetail: (id) => [...MOVIE_QUERY_KEYS.all, "admin", "detail", id],
  adminMetadata: () => [...MOVIE_QUERY_KEYS.all, "admin", "metadata"],
};

// ════════════════════════════════════════
// PUBLIC QUERIES
// ════════════════════════════════════════

/**
 * Hook lấy danh sách phim công khai
 * @param {Object} [params={}]
 * @param {Object} [options={}]
 */
export function usePublicMoviesQuery(params = {}, options = {}) {
  return useQuery({
    queryKey: MOVIE_QUERY_KEYS.publicList(params),
    queryFn: () => movieService.listPublic(params),
    staleTime: 1000 * 60 * 10,
    ...options,
  });
}

/**
 * Hook lấy chi tiết phim theo slug (SEO)
 * @param {string} slug
 * @param {Object} [options={}]
 */
export function usePublicMovieDetailQuery(slug, options = {}) {
  return useQuery({
    queryKey: MOVIE_QUERY_KEYS.publicDetail(slug),
    queryFn: () => movieService.getBySlug(slug),
    enabled: Boolean(slug) && (options.enabled ?? true),
    staleTime: 1000 * 60 * 15,
    ...options,
  });
}

// ════════════════════════════════════════
// ADMIN QUERIES
// ════════════════════════════════════════

/**
 * Hook lấy danh sách phim đầy đủ cho Quản trị viên (Admin DataGrid)
 * @param {Object} [params={}]
 * @param {Object} [options={}]
 */
export function useAdminMoviesQuery(params = {}, options = {}) {
  return useQuery({
    queryKey: MOVIE_QUERY_KEYS.adminList(params),
    queryFn: () => movieService.getAll(params),
    staleTime: 1000 * 30,
    ...options,
  });
}

/**
 * Hook lấy chi tiết phim theo ID cho Quản trị viên (Admin Edit Form)
 * @param {string} id
 * @param {Object} [options={}]
 */
export function useAdminMovieDetailQuery(id, options = {}) {
  return useQuery({
    queryKey: MOVIE_QUERY_KEYS.adminDetail(id),
    queryFn: () => movieService.getById(id),
    enabled: Boolean(id) && (options.enabled ?? true),
    staleTime: 1000 * 60,
    ...options,
  });
}

/**
 * Hook lấy siêu dữ liệu gộp (Genres, Categories, Countries, Studios, Actors, Series) cho Admin Movie Form
 * @param {Object} [options={}]
 */
export function useAdminMovieMetadataQuery(options = {}) {
  return useQuery({
    queryKey: MOVIE_QUERY_KEYS.adminMetadata(),
    queryFn: () => movieService.getMetadata(),
    staleTime: 1000 * 60 * 10, // Cache 10 phút
    ...options,
  });
}

export default {
  MOVIE_QUERY_KEYS,
  usePublicMoviesQuery,
  usePublicMovieDetailQuery,
  useAdminMoviesQuery,
  useAdminMovieDetailQuery,
  useAdminMovieMetadataQuery,
};
