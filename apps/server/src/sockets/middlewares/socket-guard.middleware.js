/**
 * @file socket-guard.middleware.js
 * @module Sockets_Middlewares
 * @description Wrapper HOF bảo vệ event handlers dựa trên:
 * 1. Authentication status (Guest check)
 * 2. Role-based authorization
 * 3. Payload validation (tùy chọn)
 *
 * Thay vì rải logic kiểm tra trong từng handler, wrapper này chuẩn hóa
 * toàn bộ quy trình bảo vệ.
 */

import { logger } from "../../utils/logger.js";
import { SOCKET_ERROR_CODES } from "../constants/socket-events.constants.js";

/**
 * Higher-Order Function bao bọc một Event Handler để thực thi kiểm tra phân quyền.
 *
 * @param {import('socket.io').Socket} socket - Socket instance
 * @param {string|string[]} allowedRoles - Danh sách role được phép
 * @param {Function} handler - Hàm xử lý sự kiện chính: (data, callback) => void
 * @param {string} [eventName="unknown"] - Tên sự kiện dùng cho logging
 * @param {Function} [validator=null] - Hàm validate payload: (data) => { valid, data?, error? }
 * @returns {Function} Hàm xử lý sự kiện đã được bảo vệ
 */
export const withAuth = (socket, allowedRoles, handler, eventName = "unknown", validator = null) => {
  return async (data, callback) => {
    try {
      // ── 1. Kiểm tra Guest ──
      if (socket.isGuest) {
        logger.warn(
          `[SocketGuard] Guest bị chặn cho sự kiện '${eventName}'. Socket: ${socket.id}`,
        );

        if (typeof callback === "function") {
          callback({
            success: false,
            error: SOCKET_ERROR_CODES.UNAUTHORIZED,
            message: "Bạn cần đăng nhập để sử dụng tính năng này",
          });
        }
        return;
      }

      // ── 2. Kiểm tra Role ──
      const userRoles = socket.user?.roles || [];
      const rolesToCheck = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
      const hasPermission = rolesToCheck.some((role) => userRoles.includes(role));

      if (!hasPermission) {
        logger.warn(
          `[SocketGuard] Access denied cho sự kiện '${eventName}'. User ${socket.user?.id || 'Unknown'} thiếu role: ${rolesToCheck.join(', ')}`,
        );

        if (typeof callback === "function") {
          callback({
            success: false,
            error: SOCKET_ERROR_CODES.FORBIDDEN,
            message: "Bạn không có quyền thực hiện thao tác này",
          });
        }
        return;
      }

      // ── 3. Validate Payload (tùy chọn) ──
      let validatedData = data;
      if (validator && typeof validator === "function") {
        const result = validator(data);
        if (!result.valid) {
          logger.warn(
            `[SocketGuard] Payload không hợp lệ cho sự kiện '${eventName}': ${result.error}`,
          );

          if (typeof callback === "function") {
            callback({
              success: false,
              error: SOCKET_ERROR_CODES.INVALID_PAYLOAD,
              message: result.error,
            });
          }
          return;
        }
        validatedData = result.data;
      }

      // ── 4. Thực thi Handler ──
      await handler(validatedData, callback);
    } catch (error) {
      logger.error(`[SocketGuard] Lỗi khi thực thi sự kiện '${eventName}':`, error);
      if (typeof callback === "function") {
        callback({
          success: false,
          error: SOCKET_ERROR_CODES.INTERNAL_ERROR,
          message: "Lỗi hệ thống khi xử lý yêu cầu",
        });
      }
    }
  };
};
