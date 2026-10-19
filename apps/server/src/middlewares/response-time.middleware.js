/**
 * Middleware Nhật ký Thời gian Phản hồi (Response Time Logger)
 *
 * @file response-time.middleware.js
 * @module Middlewares
 * @description Giúp theo dõi và nhận diện các yêu cầu HTTP chậm để tối ưu hóa hiệu năng hệ thống.
 * Tự động ghi nhật ký thời gian xử lý và cảnh báo nếu vượt quá ngưỡng cho phép.
 *
 * @note Ngưỡng cảnh báo mặc định là 500ms.
 */

import { logger } from "../utils/logger.js";

/**
 * Middleware ghi nhận thời gian phản hồi của từng yêu cầu.
 *
 * @param {Object} req - Express Request
 * @param {Object} res - Express Response
 * @param {Function} next - Next Middleware
 */
export const responseTimeLogger = (req, res, next) => {
  const start = process.hrtime();

  res.on("finish", () => {
    const diff = process.hrtime(start);
    const timeInMs = (diff[0] * 1e3 + diff[1] * 1e-6).toFixed(2);

    const logData = {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration: `${timeInMs}ms`,
      ip: req.ip,
      userAgent: req.get("user-agent"),
    };

    // Tự động cảnh báo nếu thời gian xử lý vượt quá 500ms
    if (timeInMs > 500) {
      logger.warn(
        `[ResponseTimeMiddleware] PHÁT HIỆN YÊU CẦU CHẬM: ${req.method} ${req.originalUrl}`,
        logData,
      );
    } else {
      logger.debug(
        `[ResponseTimeMiddleware] ${req.method} ${req.originalUrl} hoàn tất trong ${timeInMs}ms`,
      );
    }
  });

  next();
};
