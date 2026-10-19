/**
 * Middleware Giới hạn Tần suất (Rate Limiting Middleware)
 *
 * @file rate-limit.middleware.js
 * @module Middlewares
 * @description Bảo vệ hệ thống khỏi các cuộc tấn công Brute-force và DoS bằng cách giới hạn số lượng yêu cầu.
 * Hỗ trợ lưu trữ trạng thái qua Redis (Cluster) và có cơ chế tự động chuyển vùng sang Memory Store nếu Redis gặp sự cố.
 *
 * @note Các cấu hình định mức được quản lý tập trung tại constants/auth.constant.js.
 */

import rateLimit from "express-rate-limit";
import RedisStore from "rate-limit-redis";
import { getRedisClient, cacheHelper } from "../config/redis.config.js";
import { logger } from "../utils/logger.js";
import {
  AUDIT_EVENTS,
  RATE_LIMITS,
} from "../constants/auth.constant.js";
import auditLogger from "../modules/auth/utils/audit.logger.js";

/**
 * Khởi tạo bộ lưu trữ trạng thái dùng chung cho tất cả Rate Limiters (Singleton).
 * Ưu tiên sử dụng Redis để đồng bộ giữa các tiến trình, ngược lại sử dụng bộ nhớ đệm (Memory).
 *
 * @returns {RedisStore|undefined} Trả về RedisStore hoặc undefined để sử dụng MemoryStore mặc định
 */
let sharedStore = null;
let storeInitialized = false;

const getSharedStore = () => {
  if (storeInitialized) return sharedStore;
  storeInitialized = true;

  try {
    const redis = getRedisClient();

    if (redis && redis.status === "ready") {
      sharedStore = new RedisStore({
        sendCommand: (...args) => redis.call(...args),
        prefix: "rl:",
      });
      return sharedStore;
    }

    logger.debug(
      "[RateLimitMiddleware] Redis chưa sẵn sàng, đang sử dụng bộ nhớ tạm (Memory Store)",
    );
  } catch (error) {
    logger.warn(
      `[RateLimitMiddleware] Không thể khởi tạo Redis Store, chuyển vùng sang Memory: ${error.message}`,
    );
  }

  return undefined;
};

/**
 * Xử lý khi yêu cầu vượt quá định mức cho phép.
 * Ghi nhận hành vi vào nhật ký kiểm toán (Audit Log) để theo dõi các dấu hiệu tấn công.
 */
const rateLimitHandler = (req, res, next, options) => {
  const { max, windowMs, message } = options;
  const minutesLeft = Math.ceil(windowMs / 60000);

  auditLogger.log({
    event: AUDIT_EVENTS.RATE_LIMIT_EXCEEDED,
    userId: req.user?.id,
    metadata: {
      endpoint: req.path,
      method: req.method,
      ip: req.ip,
      limit: max,
      window: minutesLeft,
    },
    ip: req.ip,
    userAgent: req.get("user-agent"),
    severity: "warn",
  });

  res.status(429).json({
    success: false,
    message:
      message || `Quá nhiều yêu cầu. Vui lòng thử lại sau ${minutesLeft} phút`,
    errorCode: "RATE_LIMIT_EXCEEDED",
    retryAfter: minutesLeft,
  });
};

/**
 * Tạo khóa định danh dựa trên địa chỉ IP và đường dẫn endpoint.
 */
const generateKey = (req) => {
  const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
  return `${ip}:${req.path}`;
};

/**
 * Tạo khóa định danh dựa trên địa chỉ Email của người dùng.
 */
const generateEmailKey = (req) => {
  const email = req.body?.email || "unknown";
  return `email:${email}`;
};

/**
 * Bộ giới hạn Đăng nhập: Ngăn chặn tấn công Brute-force vào tài khoản.
 */
export const loginRateLimit = rateLimit({
  store: getSharedStore(),
  windowMs: RATE_LIMITS.LOGIN.windowMs,
  max: RATE_LIMITS.LOGIN.max,
  message: RATE_LIMITS.LOGIN.message,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: RATE_LIMITS.LOGIN.skipSuccessfulRequests,
  keyGenerator: generateKey,
  handler: rateLimitHandler,
});

/**
 * Bộ giới hạn Đăng ký tài khoản mới.
 */
export const registerRateLimit = rateLimit({
  store: getSharedStore(),
  windowMs: RATE_LIMITS.REGISTER.windowMs,
  max: RATE_LIMITS.REGISTER.max,
  message: RATE_LIMITS.REGISTER.message,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: generateKey,
  handler: rateLimitHandler,
});

/**
 * Bộ giới hạn Quên mật khẩu / Khôi phục mật khẩu.
 */
export const passwordResetRateLimit = rateLimit({
  store: getSharedStore(),
  windowMs: RATE_LIMITS.PASSWORD_RESET.windowMs,
  max: RATE_LIMITS.PASSWORD_RESET.max,
  message: RATE_LIMITS.PASSWORD_RESET.message,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: generateEmailKey,
  handler: rateLimitHandler,
});

/**
 * Bộ giới hạn Làm mới Token (Refresh Token).
 */
export const refreshTokenRateLimit = rateLimit({
  store: getSharedStore(),
  windowMs: RATE_LIMITS.REFRESH_TOKEN.windowMs,
  max: RATE_LIMITS.REFRESH_TOKEN.max,
  message: RATE_LIMITS.REFRESH_TOKEN.message,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const userId = req.user?.id || req.body?.userId || "unknown";
    return `user:${userId}:refresh`;
  },
  handler: rateLimitHandler,
});

/**
 * Bộ giới hạn Gửi lại email xác thực tài khoản.
 */
export const emailVerificationRateLimit = rateLimit({
  store: getSharedStore(),
  windowMs: RATE_LIMITS.EMAIL_VERIFICATION.windowMs,
  max: RATE_LIMITS.EMAIL_VERIFICATION.max,
  message: RATE_LIMITS.EMAIL_VERIFICATION.message,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: generateEmailKey,
  handler: rateLimitHandler,
});

/**
 * Bộ giới hạn API chung: Áp dụng cho các truy vấn dữ liệu thông thường.
 */
export const generalRateLimit = rateLimit({
  store: getSharedStore(),
  windowMs: 60 * 1000,
  max: 100,
  message:
    "Hệ thống đang tiếp nhận quá nhiều yêu cầu. Vui lòng thử lại sau ít phút",
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: generateKey,
  handler: rateLimitHandler,
});

/**
 * Bộ giới hạn Nghiêm ngặt: Áp dụng cho các thao tác nhạy cảm liên quan đến bảo mật.
 */
export const strictRateLimit = rateLimit({
  store: getSharedStore(),
  windowMs: 15 * 60 * 1000,
  max: 3,
  message: "Thao tác này bị giới hạn. Vui lòng thử lại sau 15 phút",
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: generateKey,
  handler: rateLimitHandler,
});

/**
 * Khởi tạo bộ giới hạn tùy chỉnh theo nhu cầu cụ thể.
 *
 * @param {Object} options - Cấu hình tùy chỉnh (windowMs, max, message, ...)
 * @returns {Function} Express Middleware
 */
export const createRateLimit = (options = {}) => {
  const {
    windowMs = 60 * 1000,
    max = 10,
    message = "Quá nhiều yêu cầu",
    keyGenerator: customKeyGenerator = generateKey,
    skipSuccessfulRequests: skipSuccess = false,
  } = options;

  return rateLimit({
    store: getSharedStore(),
    windowMs,
    max,
    message,
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: skipSuccess,
    keyGenerator: customKeyGenerator,
    handler: rateLimitHandler,
  });
};

// ════════════════════════════════════════
// QUẢN LÝ DANH SÁCH ĐEN (IP BLACKLIST)
// ════════════════════════════════════════

// Không dùng in-memory Set để đảm bảo consistency khi horizontal scaling.
// Toàn bộ IP blacklist được lưu trữ và truy vấn qua Redis.

/**
 * Khóa một địa chỉ IP (Chặn truy cập ngay lập tức).
 *
 * @param {string} ip - Địa chỉ IP cần chặn
 */
export const blockIP = async (ip) => {
  try {
    await cacheHelper.set(`ip_block:${ip}`, true, 86400 * 30); // block 30 ngày
  } catch (err) {
    logger.warn(`[RateLimitMiddleware] Lỗi lưu block IP vào Redis: ${err.message}`);
  }
  logger.warn(`[RateLimitMiddleware] IP đã bị chặn truy cập: ${ip}`);

  auditLogger.log({
    event: AUDIT_EVENTS.IP_BLOCKED,
    metadata: { ip },
    ip,
    severity: "warn",
  });
};

/**
 * Mở khóa cho một địa chỉ IP.
 *
 * @param {string} ip - Địa chỉ IP cần mở khóa
 */
export const unblockIP = async (ip) => {
  try {
    await cacheHelper.del(`ip_block:${ip}`);
  } catch (err) {
    logger.warn(`[RateLimitMiddleware] Lỗi xóa block IP khỏi Redis: ${err.message}`);
  }
  logger.info(`[RateLimitMiddleware] IP đã được mở khóa: ${ip}`);
};

/**
 * Kiểm tra xem địa chỉ IP có đang nằm trong danh sách đen hay không.
 */
export const isIPBlocked = async (ip) => {
  try {
    const redisExists = await cacheHelper.exists(`ip_block:${ip}`);
    return redisExists === 1;
  } catch {
    return false;
  }
};

/**
 * Middleware: Kiểm tra quyền truy cập của địa chỉ IP.
 */
export const checkIPBlacklist = async (req, res, next) => {
  const rawIp = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "";
  const ip = rawIp.split(",")[0].trim();

  const blocked = await isIPBlocked(ip);
  if (blocked) {
    auditLogger.log({
      event: AUDIT_EVENTS.IP_BLOCKED,
      metadata: {
        ip,
        path: req.path,
        method: req.method,
      },
      ip,
      severity: "error",
    });

    return res.status(403).json({
      success: false,
      message: "Truy cập từ địa chỉ IP này đã bị chặn vì lý do bảo mật",
      errorCode: "IP_BLOCKED",
    });
  }

  next();
};

// ════════════════════════════════════════
// QUẢN LÝ DANH SÁCH TRẮNG (IP WHITELIST)
// ════════════════════════════════════════

const whitelistedIPs = new Set(["127.0.0.1", "::1"]);

/**
 * Thêm địa chỉ IP vào danh sách tin cậy (Bỏ qua mọi giới hạn).
 */
export const whitelistIP = (ip) => {
  whitelistedIPs.add(ip);
  logger.info(
    `[RateLimitMiddleware] IP đã được đưa vào danh sách tin cậy: ${ip}`,
  );
};

/**
 * Kiểm tra IP có thuộc danh sách tin cậy hay không.
 */
export const isIPWhitelisted = (ip) => whitelistedIPs.has(ip);

/**
 * Kiểm tra xem có nên bỏ qua giới hạn Rate Limit cho yêu cầu hiện tại hay không.
 */
export const skipWhitelistedIPs = (req) => {
  const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
  return isIPWhitelisted(ip);
};

export default {
  loginRateLimit,
  registerRateLimit,
  passwordResetRateLimit,
  refreshTokenRateLimit,
  emailVerificationRateLimit,
  generalRateLimit,
  strictRateLimit,
  createRateLimit,
  checkIPBlacklist,
  blockIP,
  unblockIP,
  isIPBlocked,
  whitelistIP,
  isIPWhitelisted,
  skipWhitelistedIPs,
};

