/**
 * Dịch vụ Quản lý Phiên kết nối (Session Service)
 *
 * @file session.service.js
 * @module Sockets_Services
 * @description Quản lý trạng thái trực tuyến và kiểm soát giới hạn thiết bị bằng Redis.
 * Thay thế hoàn toàn in-memory state tracking để hỗ trợ Horizontal Scaling (Multi-node).
 *
 * @note Sử dụng Redis Sorted Set cho online tracking và Pipeline cho atomic operations.
 */

import { getRedisClient, cacheConfig } from '../../config/redis.config.js';
import { SOCKET_ROOMS } from '../constants/socket-rooms.constants.js';
import { User } from '../../models/index.js';
import { logger } from '../../utils/logger.js';

export const DEVICE_LIMIT = 10;
const DEVICE_SET_PREFIX = `${cacheConfig.prefix.session}devices:`;
export const ONLINE_SET_KEY = 'socket:online_users';
const SESSION_TTL = cacheConfig.ttl.session || 86400; // 24h

/**
 * Đăng ký thiết bị (Socket) mới cho người dùng.
 *
 * @param {string} userId - ID người dùng
 * @param {string} socketId - Socket ID
 */
export const registerDevice = async (userId, socketId) => {
  try {
    const redis = getRedisClient();
    const key = `${DEVICE_SET_PREFIX}${userId}`;
    await redis.sadd(key, socketId);
    await redis.expire(key, SESSION_TTL);
  } catch (error) {
    logger.warn(`[SocketSession] Redis error on registerDevice for user ${userId}: ${error.message}`);
  }
};

/**
 * Hủy đăng ký thiết bị (Socket) khi người dùng ngắt kết nối.
 *
 * @param {string} userId - ID người dùng
 * @param {string} socketId - Socket ID
 * @returns {Promise<number>} Số lượng thiết bị còn lại đang kết nối (hoặc -1 nếu lỗi)
 */
export const unregisterDevice = async (userId, socketId) => {
  try {
    const redis = getRedisClient();
    const key = `${DEVICE_SET_PREFIX}${userId}`;
    await redis.srem(key, socketId);
    const remaining = await redis.scard(key);
    return remaining;
  } catch (error) {
    logger.warn(`[SocketSession] Redis error on unregisterDevice for user ${userId}: ${error.message}`);
    return -1;
  }
};

/**
 * Kiểm tra xem người dùng có vượt quá giới hạn thiết bị cho phép hay không.
 * Sử dụng Redis Pipeline để đảm bảo atomic cleanup cho stale sockets.
 *
 * @param {string} userId - ID người dùng
 * @param {import('socket.io').Server} io - Socket.IO Server Instance
 * @returns {Promise<boolean>} True nếu chưa vượt giới hạn thiết bị
 */
export const checkDeviceLimit = async (userId, io) => {
  try {
    const redis = getRedisClient();
    const key = `${DEVICE_SET_PREFIX}${userId}`;
    const devices = await redis.smembers(key);

    if (!devices || devices.length === 0) return true;

    // Fetch all active sockets in the cluster (hỗ trợ Redis Adapter)
    const activeSockets = await io.in(SOCKET_ROOMS.user(userId)).fetchSockets();
    const activeSocketIds = new Set(activeSockets.map((s) => s.id));

    // Lọc bỏ stale data
    const validDevices = devices.filter((socketId) => activeSocketIds.has(socketId));

    // Cleanup stale sockets bằng Redis Pipeline (atomic)
    if (validDevices.length < devices.length) {
      const pipeline = redis.pipeline();
      pipeline.del(key);
      if (validDevices.length > 0) {
        pipeline.sadd(key, ...validDevices);
        pipeline.expire(key, SESSION_TTL);
      }
      await pipeline.exec();

      logger.debug(
        `[SocketSession] Đã dọn dẹp ${devices.length - validDevices.length} stale sockets cho user ${userId}`,
      );
    }

    return validDevices.length < DEVICE_LIMIT;
  } catch (error) {
    logger.warn(`[SocketSession] Lỗi kiểm tra giới hạn thiết bị cho user ${userId}: ${error.message}`);
    // Fallback: Cho phép kết nối nếu Redis lỗi để đảm bảo availability
    return true;
  }
};

/**
 * Cập nhật trạng thái trực tuyến (Online/Offline) của người dùng vào DB.
 *
 * @param {string} userId - ID người dùng
 * @param {boolean} isOnline - Trạng thái trực tuyến
 */
export const updateUserOnlineStatus = async (userId, isOnline) => {
  try {
    await User.update(
      {
        is_online: isOnline,
        last_online: isOnline ? null : new Date(),
      },
      { where: { id: userId }, silent: true },
    );
  } catch (error) {
    logger.error(`[SocketSession] Lỗi cập nhật trạng thái trực tuyến DB cho user ${userId}:`, error);
  }
};

/**
 * Kiểm tra xem người dùng có đang online trên toàn bộ cluster hay không.
 *
 * @param {string} userId - ID người dùng
 * @returns {Promise<boolean>} True nếu có ít nhất 1 thiết bị đang kết nối
 */
export const isUserOnlineGlobally = async (userId) => {
  try {
    const redis = getRedisClient();
    const count = await redis.scard(`${DEVICE_SET_PREFIX}${userId}`);
    return count > 0;
  } catch (error) {
    logger.warn(`[SocketSession] Lỗi kiểm tra trạng thái toàn cục cho user ${userId}: ${error.message}`);
    return false;
  }
};

/**
 * Thêm người dùng vào Sorted Set tracking online.
 * Score = timestamp hiện tại.
 *
 * @param {string} userId - ID người dùng
 */
export const addToOnlineSet = async (userId) => {
  try {
    const redis = getRedisClient();
    await redis.zadd(ONLINE_SET_KEY, Date.now(), userId);
  } catch (error) {
    logger.warn(`[SocketSession] Lỗi khi thêm user ${userId} vào online set: ${error.message}`);
  }
};

/**
 * Xóa người dùng khỏi Sorted Set tracking online.
 *
 * @param {string} userId - ID người dùng
 */
export const removeFromOnlineSet = async (userId) => {
  try {
    const redis = getRedisClient();
    await redis.zrem(ONLINE_SET_KEY, userId);
  } catch (error) {
    logger.warn(`[SocketSession] Lỗi khi xóa user ${userId} khỏi online set: ${error.message}`);
  }
};

/**
 * Thống kê tổng số lượng người dùng đang trực tuyến trên hệ thống.
 * Sử dụng Redis Sorted Set `socket:online_users` — ZCARD cho O(1) count.
 *
 * @returns {Promise<number>} Số lượng người dùng Online
 */
export const getOnlineUsersCount = async () => {
  try {
    const redis = getRedisClient();
    return await redis.zcard(ONLINE_SET_KEY);
  } catch (error) {
    logger.warn(`[SocketSession] Lỗi đếm số người dùng online: ${error.message}`);
    return 0;
  }
};
