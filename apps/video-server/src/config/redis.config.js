/**
 * @file redis.config.js
 * @module VideoServer_Config
 * @description Quản lý kết nối Redis cho Video Server (Pub/Sub và BullMQ queue).
 */

import IORedis from "ioredis";

import { env } from "./env.config.js";
import { logger } from "../utils/logger.js";

let redisClient = null;

/**
 * Tạo một instance IORedis độc lập với cấu hình chuẩn
 * @param {Object} [overrideOptions={}] - Các tùy chọn ghi đè
 * @returns {IORedis}
 */
export const createRedisClient = (overrideOptions = {}) => {
  const client = new IORedis({
    host: env.redis.host,
    port: env.redis.port,
    password: env.redis.password || undefined,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    ...overrideOptions,
  });

  client.on("error", (err) => {
    logger.error(`[Redis] Kết nối thất bại: ${err.message}`);
  });

  return client;
};

/**
 * Lấy singleton Redis client dùng cho các tác vụ Pub/Sub, get/set thông thường
 * @returns {IORedis}
 */
export const getRedisClient = () => {
  if (!redisClient) {
    redisClient = createRedisClient();
    redisClient.on("ready", () => {
      logger.info("[Redis] Đã kết nối thành công tới Redis");
    });
  }
  return redisClient;
};

/**
 * Đóng kết nối singleton Redis client nếu đang mở
 * @returns {Promise<void>}
 */
export const closeRedisClients = async () => {
  if (redisClient) {
    try {
      await redisClient.quit();
      logger.info("[Redis] Đã đóng kết nối Redis client singleton thành công");
    } catch (err) {
      logger.warn(`[Redis] Lỗi khi đóng Redis client singleton: ${err.message}`);
      redisClient.disconnect();
    } finally {
      redisClient = null;
    }
  }
};

export default { getRedisClient, createRedisClient, closeRedisClients };
