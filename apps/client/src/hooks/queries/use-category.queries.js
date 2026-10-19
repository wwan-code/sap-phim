/**
 * @file use-category.queries.js
 * @module Hooks/Queries/Category
 * @description Các React Query Hooks phục vụ truy vấn dữ liệu danh mục phim (Category - Public & Admin).
 */

import { useQuery } from "@tanstack/react-query";
import categoryService from "@/shared/services/category.service";

export const CATEGORY_QUERY_KEYS = {
  all: ["categories"],
  publicList: (params) => [...CATEGORY_QUERY_KEYS.all, "public", "list", params],
  publicDetail: (slug) => [...CATEGORY_QUERY_KEYS.all, "public", "detail", slug],
  adminList: (params) => [...CATEGORY_QUERY_KEYS.all, "admin", "list", params],
  adminDetail: (id) => [...CATEGORY_QUERY_KEYS.all, "admin", "detail", id],
};

// ════════════════════════════════════════
// PUBLIC QUERIES
// ════════════════════════════════════════

/**
 * Hook lấy danh sách danh mục công khai
 */
export function usePublicCategoriesQuery(params = {}, options = {}) {
  return useQuery({
    queryKey: CATEGORY_QUERY_KEYS.publicList(params),
    queryFn: () => categoryService.listPublic(params),
    staleTime: 1000 * 60 * 15,
    ...options,
  });
}

/**
 * Hook lấy chi tiết danh mục theo slug
 */
export function usePublicCategoryDetailQuery(slug, options = {}) {
  return useQuery({
    queryKey: CATEGORY_QUERY_KEYS.publicDetail(slug),
    queryFn: () => categoryService.getBySlug(slug),
    enabled: Boolean(slug) && (options.enabled ?? true),
    staleTime: 1000 * 60 * 15,
    ...options,
  });
}

// ════════════════════════════════════════
// ADMIN QUERIES
// ════════════════════════════════════════

/**
 * Hook lấy danh sách danh mục đầy đủ cho Admin
 */
export function useAdminCategoriesQuery(params = {}, options = {}) {
  return useQuery({
    queryKey: CATEGORY_QUERY_KEYS.adminList(params),
    queryFn: () => categoryService.getAll(params),
    staleTime: 1000 * 30,
    ...options,
  });
}

/**
 * Hook lấy chi tiết danh mục theo ID cho Admin
 */
export function useAdminCategoryDetailQuery(id, options = {}) {
  return useQuery({
    queryKey: CATEGORY_QUERY_KEYS.adminDetail(id),
    queryFn: () => categoryService.getById(id),
    enabled: Boolean(id) && (options.enabled ?? true),
    staleTime: 1000 * 60,
    ...options,
  });
}

export default {
  CATEGORY_QUERY_KEYS,
  usePublicCategoriesQuery,
  usePublicCategoryDetailQuery,
  useAdminCategoriesQuery,
  useAdminCategoryDetailQuery,
};
