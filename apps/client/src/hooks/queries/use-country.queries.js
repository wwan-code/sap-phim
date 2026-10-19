/**
 * @file use-country.queries.js
 * @module Hooks/Queries/Country
 * @description Các React Query Hooks phục vụ truy vấn dữ liệu quốc gia (Country - Public & Admin).
 */

import { useQuery } from "@tanstack/react-query";
import countryService from "@/shared/services/country.service";

export const COUNTRY_QUERY_KEYS = {
  all: ["countries"],
  publicList: (params) => [...COUNTRY_QUERY_KEYS.all, "public", "list", params],
  publicDetail: (slug) => [...COUNTRY_QUERY_KEYS.all, "public", "detail", slug],
  adminList: (params) => [...COUNTRY_QUERY_KEYS.all, "admin", "list", params],
  adminDetail: (id) => [...COUNTRY_QUERY_KEYS.all, "admin", "detail", id],
};

// ════════════════════════════════════════
// PUBLIC QUERIES
// ════════════════════════════════════════

/**
 * Hook lấy danh sách quốc gia công khai
 */
export function usePublicCountriesQuery(params = {}, options = {}) {
  return useQuery({
    queryKey: COUNTRY_QUERY_KEYS.publicList(params),
    queryFn: () => countryService.listPublic(params),
    staleTime: 1000 * 60 * 15, // 15 phút
    ...options,
  });
}

/**
 * Hook lấy chi tiết quốc gia theo slug
 */
export function usePublicCountryDetailQuery(slug, options = {}) {
  return useQuery({
    queryKey: COUNTRY_QUERY_KEYS.publicDetail(slug),
    queryFn: () => countryService.getBySlug(slug),
    enabled: Boolean(slug) && (options.enabled ?? true),
    staleTime: 1000 * 60 * 15,
    ...options,
  });
}

// ════════════════════════════════════════
// ADMIN QUERIES
// ════════════════════════════════════════

/**
 * Hook lấy danh sách quốc gia đầy đủ cho Admin
 */
export function useAdminCountriesQuery(params = {}, options = {}) {
  return useQuery({
    queryKey: COUNTRY_QUERY_KEYS.adminList(params),
    queryFn: () => countryService.getAll(params),
    staleTime: 1000 * 30, // 30 giây
    ...options,
  });
}

/**
 * Hook lấy chi tiết quốc gia theo ID cho Admin
 */
export function useAdminCountryDetailQuery(id, options = {}) {
  return useQuery({
    queryKey: COUNTRY_QUERY_KEYS.adminDetail(id),
    queryFn: () => countryService.getById(id),
    enabled: Boolean(id) && (options.enabled ?? true),
    staleTime: 1000 * 60,
    ...options,
  });
}

export default {
  COUNTRY_QUERY_KEYS,
  usePublicCountriesQuery,
  usePublicCountryDetailQuery,
  useAdminCountriesQuery,
  useAdminCountryDetailQuery,
};
