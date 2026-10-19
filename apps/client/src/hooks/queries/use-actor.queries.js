/**
 * @file use-actor.queries.js
 * @module Hooks/Queries/Actor
 * @description Các React Query Hooks phục vụ truy vấn dữ liệu diễn viên/đạo diễn (Actor - Public & Admin).
 */

import { useQuery } from "@tanstack/react-query";
import actorService from "@/shared/services/actor.service";

export const ACTOR_QUERY_KEYS = {
  all: ["actors"],
  publicList: (params) => [...ACTOR_QUERY_KEYS.all, "public", "list", params],
  publicDetail: (slug) => [...ACTOR_QUERY_KEYS.all, "public", "detail", slug],
  adminList: (params) => [...ACTOR_QUERY_KEYS.all, "admin", "list", params],
  adminDetail: (id) => [...ACTOR_QUERY_KEYS.all, "admin", "detail", id],
};

// ════════════════════════════════════════
// PUBLIC QUERIES
// ════════════════════════════════════════

/**
 * Hook lấy danh sách diễn viên công khai
 */
export function usePublicActorsQuery(params = {}, options = {}) {
  return useQuery({
    queryKey: ACTOR_QUERY_KEYS.publicList(params),
    queryFn: () => actorService.listPublic(params),
    staleTime: 1000 * 60 * 15,
    ...options,
  });
}

/**
 * Hook lấy chi tiết diễn viên theo slug
 */
export function usePublicActorDetailQuery(slug, options = {}) {
  return useQuery({
    queryKey: ACTOR_QUERY_KEYS.publicDetail(slug),
    queryFn: () => actorService.getBySlug(slug),
    enabled: Boolean(slug) && (options.enabled ?? true),
    staleTime: 1000 * 60 * 15,
    ...options,
  });
}

// ════════════════════════════════════════
// ADMIN QUERIES
// ════════════════════════════════════════

/**
 * Hook lấy danh sách diễn viên đầy đủ cho Admin
 */
export function useAdminActorsQuery(params = {}, options = {}) {
  return useQuery({
    queryKey: ACTOR_QUERY_KEYS.adminList(params),
    queryFn: () => actorService.getAll(params),
    staleTime: 1000 * 30,
    ...options,
  });
}

/**
 * Hook lấy chi tiết diễn viên theo ID cho Admin
 */
export function useAdminActorDetailQuery(id, options = {}) {
  return useQuery({
    queryKey: ACTOR_QUERY_KEYS.adminDetail(id),
    queryFn: () => actorService.getById(id),
    enabled: Boolean(id) && (options.enabled ?? true),
    staleTime: 1000 * 60,
    ...options,
  });
}

export default {
  ACTOR_QUERY_KEYS,
  usePublicActorsQuery,
  usePublicActorDetailQuery,
  useAdminActorsQuery,
  useAdminActorDetailQuery,
};
