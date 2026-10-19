/**
 * @file database.config.js
 * @module Config
 * @description Quản lý kết nối PostgreSQL bằng Sequelize, thiết lập Connection Pool, Logging và cơ chế Retry.
 */

import { Sequelize } from "sequelize";
import { env } from "./env.config.js";
import { logger } from "../utils/logger.js";

/**
 * Instance Sequelize chính của ứng dụng
 *
 * @description Quản lý kết nối cơ sở dữ liệu PostgreSQL với cơ chế Connection Pool,
 * Logging thông minh (phát hiện Slow Query) và chính sách Retry.
 */
export const sequelize = new Sequelize({
  database: env.db.name,
  username: env.db.user,
  password: env.db.password,
  host: env.db.host,
  port: env.db.port,
  dialect: env.db.dialect,
  timezone: env.db.timezone || "+07:00",

  // Cơ chế Logging: Chỉ bật ở môi trường dev, cảnh báo nếu query chậm (> 200ms)
  logging: env.isDevelopment
    ? (sql, timing) => {
      if (timing > 200) {
        logger.warn(`[DatabaseConfig] Slow Query: ${timing}ms | ${sql}`);
      } else {
        logger.debug(`[DatabaseConfig] Query: ${timing}ms | ${sql}`);
      }
    }
    : false,

  pool: {
    ...env.dbPool,
    /**
     * Kiểm tra tính khả dụng của kết nối trước khi trả về từ pool
     *
     * @param {Object} connection - Đối tượng kết nối cần kiểm tra
     * @returns {Promise<boolean>}
     */
    validate: async (connection) => {
      try {
        await connection.query("SELECT 1");
        return true;
      } catch (error) {
        return false;
      }
    },
    maxIdleTime: 30000,
  },

  define: {
    underscored: true, // Chuyển camelCase sang snake_case cho tên cột/bảng
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    deletedAt: "deleted_at",
    paranoid: false, // Mặc định không dùng Soft Delete trừ khi model yêu cầu
  },

  benchmark: env.isDevelopment,
  minifyAliases: true,

  dialectOptions: {
    connectTimeout: 10000,
    timezone: env.db.timezone,
    application_name: "sap-phim-backend",
    ssl: env.db.enableSSL
      ? { require: true, rejectUnauthorized: false }
      : false,
    dateStrings: true,
    typeCast: true,
  },

  // Cơ chế thử lại khi gặp lỗi mạng tạm thời
  retry: {
    match: [
      /ETIMEDOUT/,
      /EHOSTUNREACH/,
      /ECONNRESET/,
      /ECONNREFUSED/,
      /ESOCKETTIMEDOUT/,
      /EPIPE/,
      /SequelizeConnectionError/,
      /SequelizeConnectionRefusedError/,
      /SequelizeHostNotFoundError/,
      /SequelizeHostNotReachableError/,
      /SequelizeInvalidConnectionError/,
      /SequelizeConnectionTimedOutError/,
    ],
    max: 3,
    backoffBase: 1000,
    backoffExponent: 1.8,
  },
  query: { raw: false },
});

// Giám sát trạng thái Connection Pool trong môi trường Development
if (env.isDevelopment) {
  setInterval(() => {
    try {
      const pool = sequelize.connectionManager?.pool;
      if (pool && pool.available) {
        logger.debug("[DatabaseConfig] Trạng thái Connection Pool:", {
          total: pool.size,
          available: pool.available.length,
          inUse: pool.size - pool.available.length,
        });
      }
    } catch (error) {
      logger.warn(`[DatabaseConfig] Không thể lấy trạng thái Connection Pool: ${error.message}`);
    }
  }, 60000);
}

/**
 * Khởi tạo kết nối tới cơ sở dữ liệu
 *
 * @description Xác thực kết nối và thiết lập môi trường DB ban đầu.
 * @returns {Promise<void>}
 * @throws {Error} Khi không thể kết nối sau các lần thử lại
 */

export const initDatabase = async () => {
  try {
    await sequelize.authenticate();
    logger.info("[DatabaseConfig] Kết nối Database thành công");
  } catch (error) {
    logger.error(`[DatabaseConfig] Lỗi kết nối Database: ${error.message}`);
    throw error;
  }
};

/**
 * Đóng kết nối cơ sở dữ liệu an toàn
 *
 * @description Sử dụng cho quy trình Graceful Shutdown để giải phóng tài nguyên.
 * @returns {Promise<void>}
 */
export const closeDatabase = async () => {
  try {
    await sequelize.close();
    logger.info("[DatabaseConfig] Đã đóng kết nối Database");
  } catch (error) {
    logger.error(`[DatabaseConfig] Lỗi khi đóng Database: ${error.message}`);
  }
};

/**
 * Kiểm tra sức khỏe kết nối (Health Check)
 *
 * @description Kiểm tra xem DB còn phản hồi hay không.
 * @returns {Promise<Object>} Trạng thái sức khỏe của DB
 */
export const checkDatabaseHealth = async () => {
  try {
    await sequelize.authenticate();
    return { status: "healthy", message: "OK" };
  } catch (error) {
    return { status: "unhealthy", message: error.message };
  }
};

export default sequelize;
