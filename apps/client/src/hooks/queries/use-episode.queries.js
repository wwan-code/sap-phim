/**
 * @file use-episode.queries.js
 * @module Hooks/Queries/Episode
 * @description React Query Hooks phục vụ truy vấn dữ liệu tập phim, danh sách phụ đề và thông tin playback.
 */

import { useQuery } from "@tanstack/react-query";

import episodeService from "@/shared/services/episode.service";

export const EPISODE_QUERY_KEYS = {
  all: ["episodes"],
  list: (params) => [...EPISODE_QUERY_KEYS.all, "list", params],
  detail: (id) => [...EPISODE_QUERY_KEYS.all, "detail", id],
  subtitles: (id) => [...EPISODE_QUERY_KEYS.all, "subtitles", id],
  playback: (id) => [...EPISODE_QUERY_KEYS.all, "playback", id],
};

/**
 * Hook lấy danh sách tập phim Admin
 * @param {Object} [params={}]
 * @param {Object} [options={}]
 */
export function useEpisodeListQuery(params = {}, options = {}) {
  return useQuery({
    queryKey: EPISODE_QUERY_KEYS.list(params),
    queryFn: () => episodeService.listAdmin(params),
    staleTime: 1000 * 30, // 30s
    ...options,
  });
}

/**
 * Hook lấy chi tiết tập phim
 * @param {string} id
 * @param {Object} [options={}]
 */
export function useEpisodeDetailQuery(id, options = {}) {
  return useQuery({
    queryKey: EPISODE_QUERY_KEYS.detail(id),
    queryFn: () => episodeService.getById(id),
    enabled: Boolean(id) && (options.enabled ?? true),
    staleTime: 1000 * 60,
    ...options,
  });
}

/**
 * Hook lấy danh sách phụ đề của tập phim
 * @param {string} id
 * @param {Object} [options={}]
 */
export function useEpisodeSubtitlesQuery(id, options = {}) {
  return useQuery({
    queryKey: EPISODE_QUERY_KEYS.subtitles(id),
    queryFn: () => episodeService.listSubtitles(id),
    enabled: Boolean(id) && (options.enabled ?? true),
    staleTime: 0,
    ...options,
  });
}

/**
 * Hook lấy dữ liệu playback cho Video Player
 * @param {string} id
 * @param {Object} [options={}]
 */
export function useEpisodePlaybackQuery(id, options = {}) {
  return useQuery({
    queryKey: EPISODE_QUERY_KEYS.playback(id),
    queryFn: () => episodeService.getPlayback(id),
    enabled: Boolean(id) && (options.enabled ?? true),
    staleTime: 1000 * 60 * 5, // 5 phút
    ...options,
  });
}

export default {
  useEpisodeListQuery,
  useEpisodeDetailQuery,
  useEpisodeSubtitlesQuery,
  useEpisodePlaybackQuery,
};
