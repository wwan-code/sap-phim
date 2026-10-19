/**
 * @file broadcast-cache.util.js
 * @module Utils_BroadcastCache
 * @description Utility quản lý bộ nhớ đệm Redis cho module Lịch phát sóng (Broadcast Schedules).
 */

import { cacheHelper } from '../../../config/redis.config.js';
import { logger } from '../../../utils/logger.js';

export const BROADCAST_CACHE_CONFIG = {
  TTL_WEEKLY: 300, // 5 phút
  TTL_PUBLIC_CALENDAR: 300, // 5 phút
  PREFIX: 'broadcast:',
};

/**
 * Tạo cache key cho lịch tuần
 * @param {number} weekOffset
 * @returns {string}
 */
export const getWeeklyCacheKey = (weekOffset = 0) => {
  return `${BROADCAST_CACHE_CONFIG.PREFIX}weekly:${weekOffset}`;
};

/**
 * Tạo cache key cho public calendar theo date range
 * @param {string} [from='']
 * @param {string} [to='']
 * @returns {string}
 */
export const getPublicCalendarCacheKey = (from = '', to = '') => {
  return `${BROADCAST_CACHE_CONFIG.PREFIX}public:${from || 'all'}:${to || 'all'}`;
};

/**
 * Lấy lịch tuần từ cache
 * @param {number} weekOffset
 * @returns {Promise<any|null>}
 */
export const getCachedWeeklySchedule = async (weekOffset = 0) => {
  try {
    const key = getWeeklyCacheKey(weekOffset);
    return await cacheHelper.get(key);
  } catch (error) {
    logger.warn(`[BroadcastCache] Failed to get cached weekly schedule: ${error.message}`);
    return null;
  }
};

/**
 * Lưu lịch tuần vào cache
 * @param {number} weekOffset
 * @param {any} data
 * @returns {Promise<boolean>}
 */
export const setCachedWeeklySchedule = async (weekOffset, data) => {
  try {
    const key = getWeeklyCacheKey(weekOffset);
    return await cacheHelper.set(key, data, BROADCAST_CACHE_CONFIG.TTL_WEEKLY);
  } catch (error) {
    logger.warn(`[BroadcastCache] Failed to set cached weekly schedule: ${error.message}`);
    return false;
  }
};

/**
 * Lấy public calendar từ cache
 * @param {string} from
 * @param {string} to
 * @returns {Promise<any|null>}
 */
export const getCachedPublicCalendar = async (from, to) => {
  try {
    const key = getPublicCalendarCacheKey(from, to);
    return await cacheHelper.get(key);
  } catch (error) {
    logger.warn(`[BroadcastCache] Failed to get cached public calendar: ${error.message}`);
    return null;
  }
};

/**
 * Lưu public calendar vào cache
 * @param {string} from
 * @param {string} to
 * @param {any} data
 * @returns {Promise<boolean>}
 */
export const setCachedPublicCalendar = async (from, to, data) => {
  try {
    const key = getPublicCalendarCacheKey(from, to);
    return await cacheHelper.set(key, data, BROADCAST_CACHE_CONFIG.TTL_PUBLIC_CALENDAR);
  } catch (error) {
    logger.warn(`[BroadcastCache] Failed to set cached public calendar: ${error.message}`);
    return false;
  }
};

/**
 * Xóa toàn bộ cache liên quan đến broadcast khi có cập nhật lịch phát sóng
 * @returns {Promise<boolean>}
 */
export const invalidateBroadcastCache = async () => {
  try {
    await cacheHelper.delByPattern(`${BROADCAST_CACHE_CONFIG.PREFIX}*`);
    logger.info('[BroadcastCache] Invalidated all broadcast cache entries');
    return true;
  } catch (error) {
    logger.warn(`[BroadcastCache] Failed to invalidate broadcast cache: ${error.message}`);
    return false;
  }
};

export default {
  BROADCAST_CACHE_CONFIG,
  getWeeklyCacheKey,
  getPublicCalendarCacheKey,
  getCachedWeeklySchedule,
  setCachedWeeklySchedule,
  getCachedPublicCalendar,
  setCachedPublicCalendar,
  invalidateBroadcastCache,
};
