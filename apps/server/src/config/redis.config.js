/**
 * @file redis.config.js
 * @module Config
 * @description Quản lý kết nối máy chủ Redis, thiết lập chính sách thử lại và cung cấp bộ công cụ Helper tương tác Cache.
 */

import Redis from "ioredis";
import { env } from "./env.config.js";
import { logger } from "../utils/logger.js";

// Theo dõi trạng thái để tránh ghi log lặp lại quá nhiều
let hasLoggedFailure = false;
let isConnected = false;

const redisOptions = {
  host: env.redis.host,
  port: env.redis.port,
  password: env.redis.password || undefined,
  db: parseInt(env.redis.db) || 0,

  // Kích hoạt bảo mật TLS nếu cấu hình REDIS_TLS=true
  ...(env.redis.tls && { tls: { rejectUnauthorized: false } }),

  // Chiến lược thử lại (Retry Strategy): Thử lại với độ trễ tăng dần, tối đa 5 giây
  retryStrategy: (times) => {
    if (times > 3 && !hasLoggedFailure) {
      logger.warn("[RedisConfig] Redis không khả dụng - đang tự động thử lại kết nối ngầm...");
      hasLoggedFailure = true;
    }
    return Math.min(times * 500, 5000);
  },

  maxRetriesPerRequest: 1,
  enableReadyCheck: true,
  lazyConnect: false,
  enableOfflineQueue: true, // Xếp hàng các lệnh khi đang kết nối/reconnect thay vì từ chối lập tức
  connectTimeout: 5000,
  commandTimeout: 3000,
   /**
   * Tự động kết nối lại khi gặp lỗi cụ thể
   *
   * @param {Error} err - Lỗi xảy ra
   * @returns {boolean} Có kết nối lại hay không
   */
  reconnectOnError(err) {
    const targetErrors = ["READONLY", "ECONNRESET", "ETIMEDOUT"];
    return targetErrors.some((targetError) => err.message.includes(targetError));
  },
};

let redisClient = null;

/**
 * Lấy Instance của Redis Client (Singleton)
 *
 * @returns {Redis} Instance ioredis
 */
export const getRedisClient = () => {
  if (!redisClient) {
    redisClient = new Redis(redisOptions);

    redisClient.on("ready", () => {
      isConnected = true;
      hasLoggedFailure = false;
      logger.info("[RedisConfig] Kết nối Redis thành công");
    });

    redisClient.on("error", (err) => {
      if (!hasLoggedFailure && !isConnected) {
        const errorMsg = err?.message || err?.code || "Kết nối bị từ chối";
        logger.warn(`[RedisConfig] Lỗi: ${errorMsg}`);
      }
    });

    redisClient.on("close", () => {
      isConnected = false;
    });
  }
  return redisClient;
};

/**
 * Cấu hình bộ nhớ đệm (Cache Configuration)
 *
 * @description Định nghĩa thời gian sống (TTL) và tiền tố (Prefix) cho từng loại dữ liệu.
 */
export const cacheConfig = {
  defaultTTL: 3600, // 1 giờ

  ttl: {
    session: 7 * 24 * 3600, // 7 ngày cho phiên đăng nhập
    user: 1800, // 30 phút cho thông tin người dùng
    search: 300, // 5 phút cho kết quả tìm kiếm
    rateLimit: 60, // 1 phút
    verification: 3600, // 1 giờ cho mã xác thực
    passwordReset: 1800, // 30 phút cho mã đặt lại mật khẩu
    profile: 900, // 15 phút cho hồ sơ người dùng public

    // Hệ thống Xem cùng nhau (Watch Together)
    watchRoom: 4 * 3600, // 4 giờ cho trạng thái phòng
    watchVote: 12, // 12 giây cho mỗi phiên bình chọn
    watchChatRate: 10, // 10 giây cho giới hạn chat
    watchCreateRate: 3600, // 1 giờ cho giới hạn tạo phòng

    // Dữ liệu nghiệp vụ (Modules)
    movie: {
      list: 180,
      detail: 300,
      featured: 3600,
      trending: 600,
      category: 300,
      search: 30,
    },
    comment: {
      list: 300,
      detail: 600,
      user_count: 3600,
    },
    country: { list: 3600, detail: 3600 },
    genre: { list: 3600, detail: 3600 },
    category: { list: 3600, detail: 3600 },
  },

  prefix: {
    session: "session:",
    user: "user:",
    search: "search:",
    rateLimit: "ratelimit:",
    verification: "verify:",
    passwordReset: "pwreset:",
    blacklist: "blacklist:",
    profile: "user:profile:",
    watchRoom: "watch:room:",
    watchVote: "watch:vote:",
    watchRateChat: "watch:rate:chat:",
    watchRateCreate: "watch:rate:create:",

    // AI System
    aiJobLock: "ai:job:lock:",
    aiPrompt: "ai:prompt:",
  },
};

/**
 * Bộ công cụ hỗ trợ tương tác với Cache
 */
export const cacheHelper = {
  /**
   * Lấy dữ liệu từ cache và tự động giải mã JSON
   *
   * @param {string} key - Khóa cần lấy
   * @returns {Promise<any|null>} Dữ liệu đã giải mã hoặc null nếu không tồn tại
   */
  async get(key) {
    try {
      const client = getRedisClient();
      const data = await client.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      if (error?.message?.includes("Stream isn't writeable")) {
        logger.debug("[RedisConfig] Bỏ qua lấy Cache: Redis không khả dụng");
      } else {
        logger.error(`[RedisConfig] Lỗi khi lấy Cache: ${error.message}`);
      }
      return null;
    }
  },

  /**
   * Lưu dữ liệu vào cache với định dạng JSON
   *
   * @param {string} key - Khóa lưu trữ
   * @param {any} value - Giá trị cần lưu
   * @param {number} ttl - Thời gian sống (giây)
   * @returns {Promise<boolean>}
   */
  async set(key, value, ttl = cacheConfig.defaultTTL) {
    try {
      const client = getRedisClient();
      await client.setex(key, ttl, JSON.stringify(value));
      return true;
    } catch (error) {
      if (error?.message?.includes("Stream isn't writeable")) {
        logger.debug("[RedisConfig] Bỏ qua ghi Cache: Redis không khả dụng");
      } else {
        logger.error(`[RedisConfig] Lỗi khi ghi Cache: ${error.message}`);
      }
      return false;
    }
  },

  /**
   * Atomic SET NX with TTL. Used for lightweight distributed locks.
   *
   * @param {string} key - Lock key
   * @param {any} value - Lock value
   * @param {number} ttl - Time to live in seconds
   * @returns {Promise<boolean>} True when the lock was acquired
   */
  async setnx(key, value, ttl = cacheConfig.defaultTTL) {
    try {
      const client = getRedisClient();
      const result = await client.set(key, JSON.stringify(value), "EX", ttl, "NX");
      return result === "OK";
    } catch (error) {
      if (error?.message?.includes("Stream isn't writeable")) {
        logger.debug("[RedisConfig] Bỏ qua SETNX Cache: Redis không khả dụng");
      } else {
        logger.error(`[RedisConfig] Lỗi khi SETNX Cache: ${error.message}`);
      }
      return false;
    }
  },

  /**
   * Xóa toàn bộ cache theo mẫu (Pattern)
   *
   * @description Sử dụng SCAN thay vì KEYS để tránh gây treo máy chủ.
   * @param {string} pattern - Mẫu tìm kiếm khóa (VD: 'user:*')
   * @returns {Promise<boolean>}
   */
  async clear(pattern = "*") {
    try {
      const client = getRedisClient();
      const stream = client.scanStream({
        match: pattern,
        count: 100,
      });

      let keysDeleted = 0;

      return new Promise((resolve, reject) => {
        const pendingDeletes = [];

        stream.on("data", async (resultKeys) => {
          if (resultKeys.length > 0) {
            pendingDeletes.push(client.del(...resultKeys));
            keysDeleted += resultKeys.length;
          }
        });

        stream.on("end", async () => {
          try {
            await Promise.all(pendingDeletes);
            logger.debug(`[RedisConfig] Đã dọn dẹp Cache: ${keysDeleted} khóa đã xóa`);
            resolve(true);
          } catch (error) {
            reject(error);
          }
        });

        stream.on("error", (error) => {
          logger.error(`[RedisConfig] Lỗi khi dọn dẹp Cache: ${error.message}`);
          reject(false);
        });
      });
    } catch (error) {
      logger.error(`[RedisConfig] Lỗi hệ thống khi dọn dẹp Cache: ${error.message}`);
      return false;
    }
  },

  /**
   * Xóa một khóa cụ thể
   *
   * @param {string} key - Khóa cần xóa
   * @returns {Promise<boolean>}
   */
  async del(key) {
    try {
      const client = getRedisClient();
      await client.del(key);
      return true;
    } catch (error) {
      if (error?.message?.includes("Stream isn't writeable")) {
        logger.debug("[RedisConfig] Bỏ qua xóa Cache: Redis không khả dụng");
      } else {
        logger.error(`[RedisConfig] Lỗi khi xóa Cache: ${error.message}`);
      }
      return false;
    }
  },

  /**
   * Xóa hàng loạt khóa dựa trên Pattern (Sử dụng SCAN thay vì KEYS để tránh blocking)
   *
   * @param {string} pattern - Mẫu tìm kiếm (VD: 'user:*')
   * @returns {Promise<boolean>}
   */
  async delByPattern(pattern) {
    try {
      const client = getRedisClient();
      const stream = client.scanStream({ match: pattern, count: 100 });
      let keysDeleted = 0;

      return new Promise((resolve, reject) => {
        const pendingDeletes = [];

        stream.on("data", async (resultKeys) => {
          if (resultKeys.length > 0) {
            pendingDeletes.push(client.del(...resultKeys));
            keysDeleted += resultKeys.length;
          }
        });

        stream.on("end", async () => {
          try {
            await Promise.all(pendingDeletes);
            if (keysDeleted > 0) {
              logger.debug(`[RedisConfig] Đã xóa ${keysDeleted} khóa theo pattern: ${pattern}`);
            }
            resolve(true);
          } catch (error) {
            reject(error);
          }
        });

        stream.on("error", (error) => {
          logger.error(`[RedisConfig] Lỗi SCAN khi xóa pattern "${pattern}": ${error.message}`);
          reject(false);
        });
      });
    } catch (error) {
      if (error?.message?.includes("Stream isn't writeable")) {
        logger.debug("[RedisConfig] Bỏ qua xóa Cache theo Pattern: Redis không khả dụng");
      } else {
        logger.error(`[RedisConfig] Lỗi khi xóa Cache theo Pattern: ${error.message}`);
      }
      return false;
    }
  },

  /**
   * Thực thi batch commands qua Redis Pipeline (giảm round-trips)
   *
   * @param {Function} callback - Hàm nhận pipeline instance, gọi các commands
   * @returns {Promise<Array>} Kết quả của tất cả commands
   * @example
   * await cacheHelper.pipeline(pipe => {
   *   pipe.exists('key1');
   *   pipe.exists('key2');
   *   pipe.get('key3');
   * });
   */
  async pipeline(callback) {
    try {
      const client = getRedisClient();
      const pipe = client.pipeline();
      callback(pipe);
      return await pipe.exec();
    } catch (error) {
      logger.error(`[RedisConfig] Lỗi Pipeline: ${error.message}`);
      return [];
    }
  },

  /**
   * Kiểm tra sự tồn tại của khóa
   *
   * @param {string} key - Khóa cần kiểm tra
   * @returns {Promise<number>} Trả về 1 nếu tồn tại, 0 nếu không
   */
  async exists(key) {
    try {
      const client = getRedisClient();
      return await client.exists(key);
    } catch (error) {
      return 0;
    }
  },

  /**
   * Lấy dữ liệu thô (Dạng chuỗi)
   *
   * @param {string} key - Khóa cần lấy
   * @returns {Promise<string|null>}
   */
  async getRaw(key) {
    try {
      const client = getRedisClient();
      return await client.get(key);
    } catch (error) {
      return null;
    }
  },

  /**
   * Lưu dữ liệu thô (Dạng chuỗi)
   *
   * @param {string} key - Khóa lưu trữ
   * @param {string} value - Giá trị thô
   * @param {number} ttl - Thời gian sống (giây)
   * @returns {Promise<boolean>}
   */
  async setRaw(key, value, ttl = cacheConfig.defaultTTL) {
    try {
      const client = getRedisClient();
      if (ttl) {
        await client.set(key, value, "EX", ttl);
      } else {
        await client.set(key, value);
      }
      return true;
    } catch (error) {
      return false;
    }
  },
};

export const redisCache = cacheHelper;

export default { getRedisClient, cacheConfig, cacheHelper, redisCache };
