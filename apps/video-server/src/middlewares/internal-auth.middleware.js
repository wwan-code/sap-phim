/**
 * @file internal-auth.middleware.js
 * @module VideoServer_Middlewares
 * @description Middleware bảo vệ các API nội bộ giữa Main Backend và Video Server bằng X-Internal-Key.
 */

import { env } from "../config/env.config.js";
import { safeCompare } from "../utils/security.util.js";
import { logger } from "../utils/logger.js";

/**
 * Middleware kiểm tra X-Internal-Key
 */
export const internalAuthMiddleware = (req, res, next) => {
  const incomingKey = req.headers["x-internal-key"] || req.headers["x-api-key"];

  if (!env.internalKey) {
    logger.warn("[InternalAuth] Cảnh báo: INTERNAL_KEY chưa được thiết lập!");
    return next();
  }

  if (!incomingKey || !safeCompare(incomingKey, env.internalKey)) {
    logger.warn(`[InternalAuth] Truy cập trái phép từ IP ${req.ip}, path: ${req.originalUrl}`);
    return res.status(403).json({
      success: false,
      message: "Forbidden: Khóa xác thực nội bộ không hợp lệ",
    });
  }

  next();
};

export default internalAuthMiddleware;
