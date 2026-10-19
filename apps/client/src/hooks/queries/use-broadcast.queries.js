/**
 * @file use-broadcast.queries.js
 * @module Hooks/Queries/Broadcast
 * @description Các React Query Hooks phục vụ truy vấn dữ liệu lịch phát sóng (Broadcast Calendar - Public & Admin).
 */

import { useQuery } from '@tanstack/react-query';
import broadcastService from '@/shared/services/broadcast.service';

export const BROADCAST_QUERY_KEYS = {
  all: ['broadcast-schedules'],
  weekly: (weekOffset = 0) => [...BROADCAST_QUERY_KEYS.all, 'weekly', weekOffset],
  publicCalendar: (params = {}) => [...BROADCAST_QUERY_KEYS.all, 'public-calendar', params],
  movieSchedule: (movieId) => [...BROADCAST_QUERY_KEYS.all, 'movie', movieId],
  movieCalendar: (movieId, params = {}) => [...BROADCAST_QUERY_KEYS.all, 'movie', movieId, 'calendar', params],
};

/**
 * Hook lấy danh sách lịch phát sóng theo tuần (dành cho Admin & Client)
 * @param {number} [weekOffset=0] - Độ lệch tuần (-1: tuần trước, 0: tuần này, 1: tuần sau)
 * @param {Object} [options={}] - Các tùy chọn bổ sung cho useQuery
 */
export function useWeeklyBroadcastScheduleQuery(weekOffset = 0, options = {}) {
  return useQuery({
    queryKey: BROADCAST_QUERY_KEYS.weekly(weekOffset),
    queryFn: () => broadcastService.listWeekly(weekOffset),
    staleTime: 1000 * 60 * 5, // 5 phút
    ...options,
  });
}

/**
 * Hook lấy danh sách lịch chiếu công khai theo khoảng thời gian
 * @param {Object} [params={}] { start_date, end_date }
 * @param {Object} [options={}]
 */
export function usePublicBroadcastCalendarQuery(params = {}, options = {}) {
  return useQuery({
    queryKey: BROADCAST_QUERY_KEYS.publicCalendar(params),
    queryFn: () => broadcastService.getPublicCalendar(params),
    staleTime: 1000 * 60 * 10,
    ...options,
  });
}

/**
 * Hook lấy chi tiết cấu hình lịch phát sóng & rules của một bộ phim
 * @param {string} movieId - UUID của phim
 * @param {Object} [options={}]
 */
export function useMovieBroadcastScheduleQuery(movieId, options = {}) {
  return useQuery({
    queryKey: BROADCAST_QUERY_KEYS.movieSchedule(movieId),
    queryFn: () => broadcastService.getByMovieId(movieId),
    enabled: Boolean(movieId) && (options.enabled ?? true),
    staleTime: 1000 * 60 * 5,
    ...options,
  });
}

/**
 * Hook lấy lịch chiếu chi tiết của 1 phim theo khoảng ngày
 * @param {string} movieId - UUID của phim
 * @param {Object} [params={}] { start_date, end_date }
 * @param {Object} [options={}]
 */
export function useMovieBroadcastCalendarQuery(movieId, params = {}, options = {}) {
  return useQuery({
    queryKey: BROADCAST_QUERY_KEYS.movieCalendar(movieId, params),
    queryFn: () => broadcastService.getCalendarByDateRange(movieId, params),
    enabled: Boolean(movieId) && (options.enabled ?? true),
    staleTime: 1000 * 60 * 5,
    ...options,
  });
}
