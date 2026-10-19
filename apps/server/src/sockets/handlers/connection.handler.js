/**
 * @file connection.handler.js
 * @module Sockets_Handlers
 * @description Quản lý vòng đời của một kết nối Socket.
 * Bao gồm các tác vụ: Đăng ký thiết bị, thông báo trạng thái trực tuyến/ngoại tuyến và dọn dẹp tài nguyên khi người dùng ngắt kết nối.
 */

import { SOCKET_EVENTS, SOCKET_ERROR_CODES } from "../constants/socket-events.constants.js";
import { SOCKET_ROOMS } from "../constants/socket-rooms.constants.js";
import { logger } from "../../utils/logger.js";
import {
  registerDevice,
  updateUserOnlineStatus,
  unregisterDevice,
  addToOnlineSet,
  removeFromOnlineSet,
} from "../services/session.service.js";
import {
  broadcastPresence,
  queryPresence,
} from "../services/presence.service.js";
import {
  joinRoom,
  leaveAllJobRooms,
  joinUserRooms,
  leaveUserRooms,
} from "../services/room.service.js";
import { authenticateSocketToken } from "../middlewares/socket-auth.middleware.js";
import { withAuth } from "../middlewares/socket-guard.middleware.js";
import { validatePresenceQuery } from "../validators/socket-payload.validator.js";
import { globalRateLimiter } from "../middlewares/socket-rate-limit.middleware.js";
import { progressService } from "../../modules/jobs/services/progress.service.js";
import { ROLES } from "../../constants/roles.constant.js";

/**
 * Đăng ký các bộ xử lý sự kiện liên quan đến vòng đời kết nối.
 * Thực hiện thiết lập bối cảnh cho người dùng ngay khi kết nối thành công.
 *
 * @param {Object} io - Instance của máy chủ Socket.IO
 * @param {Object} socket - Instance của Client Socket hiện tại
 */
export const registerConnectionHandlers = (io, socket) => {
  const userId = socket.user?.id;
  const isGuest = socket.isGuest;

  logger.info(
    `[SocketConnection] Kết nối mới: ${socket.id}${
      userId ? ` (Người dùng: ${userId})` : isGuest ? " (Khách)" : ""
    }`,
  );

  // Mọi kết nối (kể cả Guest) đều join vào room broadcast toàn hệ thống
  joinRoom(socket, SOCKET_ROOMS.broadcast());

  // ════════════════════════════════════════
  // 1. XỬ LÝ KẾT NỐI (ON CONNECTION)
  // ════════════════════════════════════════

  // Trường hợp người dùng đã định danh (Đã đăng nhập)
  if (userId && !isGuest) {
    (async () => {
      try {
        // Đăng ký mã thiết bị vào Redis để kiểm soát phiên làm việc đồng thời
        await registerDevice(userId, socket.id);

        // Tự động gia nhập phòng cá nhân và phòng theo role để nhận thông báo
        joinUserRooms(socket, socket.user);

        // Cập nhật trạng thái 'is_online' trong Database
        await updateUserOnlineStatus(userId, true);

        // Thêm vào Sorted Set online_users của Redis
        await addToOnlineSet(userId);

        // Phát trạng thái trực tuyến dựa trên cài đặt quyền riêng tư
        await broadcastPresence(io, userId, true, socket);

        // Gửi phản hồi xác nhận kết nối thành công về Client
        socket.emit(SOCKET_EVENTS.WELCOME, {
          message: "Kết nối hệ thống thời gian thực thành công",
          socketId: socket.id,
          userId,
        });

        logger.debug(
          `[SocketConnection] Người dùng ${userId} đã được khởi tạo và gia nhập các phòng liên quan.`,
        );
      } catch (error) {
        logger.error(`[SocketConnection] Lỗi khi khởi tạo kết nối cho user ${userId}:`, error);
        socket.emit(SOCKET_EVENTS.ERROR, {
          code: SOCKET_ERROR_CODES.INTERNAL_ERROR,
          message: "Lỗi thiết lập kết nối socket",
        });
      }
    })();
  } else if (isGuest) {
    // Trường hợp kết nối dưới tư cách khách (Guest)
    socket.emit(SOCKET_EVENTS.WELCOME, {
      message: "Bạn đang kết nối dưới tư cách khách (Hạn chế tính năng)",
      socketId: socket.id,
      guest: true,
    });
  }

  // ════════════════════════════════════════
  // 2. XỬ LÝ NGẮT KẾT NỐI (ON DISCONNECT)
  // ════════════════════════════════════════
  socket.on(SOCKET_EVENTS.DISCONNECT, async (reason) => {
    logger.info(
      `[SocketConnection] disconnect socketId=${socket.id} userId=${userId || "guest"} traceId=${socket.traceId || socket.id} reason=${reason}`,
    );

    leaveAllJobRooms(socket);
    progressService.handleDisconnect(socket);
    globalRateLimiter.cleanup(socket.id);

    if (userId && !isGuest) {
      try {
        // Hủy đăng ký mã thiết bị khỏi hệ thống Redis
        const remainingDevices = await unregisterDevice(userId, socket.id);

        // Nếu không còn thiết bị nào kết nối (đơn giản, an toàn với race conditions)
        if (remainingDevices === 0) {
          // Cập nhật trạng thái Offline trong Database
          await updateUserOnlineStatus(userId, false);

          // Xóa khỏi Sorted Set online_users của Redis
          await removeFromOnlineSet(userId);

          // Phát trạng thái ngoại tuyến dựa trên cài đặt quyền riêng tư
          await broadcastPresence(io, userId, false);
        }
      } catch (error) {
        logger.error(`[SocketConnection] Lỗi khi hủy đăng ký thiết bị cho user ${userId}:`, error);
      }
    }
  });

  // ════════════════════════════════════════
  // 3. SOFT RE-AUTHENTICATION (TOKEN REFRESH)
  // ════════════════════════════════════════
  socket.on(SOCKET_EVENTS.TOKEN_REFRESH, async (payload = {}, callback) => {
    const traceId = payload?.traceId || socket.traceId || socket.id;
    const token = payload?.token;

    try {
      if (!token) {
        // Chuyển sang tư cách Khách (Guest)
        if (socket.user?.id) {
          const oldUserId = socket.user.id;
          const remainingDevices = await unregisterDevice(oldUserId, socket.id);
          if (remainingDevices === 0) {
            await updateUserOnlineStatus(oldUserId, false);
            await removeFromOnlineSet(oldUserId);
            await broadcastPresence(io, oldUserId, false);
          }
          leaveUserRooms(socket, socket.user);
        }
        socket.user = null;
        socket.isGuest = true;

        logger.info(`[SocketAuth] Socket ${socket.id} chuyển sang Guest (traceId=${traceId})`);
        if (typeof callback === "function") {
          callback({ success: true, guest: true, traceId });
        }
        return;
      }

      const { user } = await authenticateSocketToken(token, io, { checkLimit: false });
      const previousUserId = socket.user?.id;
      const isNewUser = previousUserId !== user.id;

      if (previousUserId && isNewUser) {
        // Hủy đăng ký user cũ
        const remainingDevices = await unregisterDevice(previousUserId, socket.id);
        if (remainingDevices === 0) {
          await updateUserOnlineStatus(previousUserId, false);
          await removeFromOnlineSet(previousUserId);
          await broadcastPresence(io, previousUserId, false);
        }
        leaveUserRooms(socket, socket.user);
      }

      socket.user = user;
      socket.isGuest = false;

      // Đăng ký thiết bị và tham gia các phòng mới
      await registerDevice(user.id, socket.id);
      joinUserRooms(socket, user);
      await updateUserOnlineStatus(user.id, true);
      await addToOnlineSet(user.id);

      if (isNewUser || socket.isGuest) {
        await broadcastPresence(io, user.id, true, socket);
      }

      logger.info(
        `[SocketAuth] Soft re-auth thành công: socketId=${socket.id} userId=${user.id} traceId=${traceId}`,
      );

      if (typeof callback === "function") {
        callback({
          success: true,
          userId: user.id,
          user: {
            id: user.id,
            username: user.username,
            roles: user.roles,
          },
          traceId,
        });
      }
    } catch (error) {
      const errorCode = error?.data?.code || SOCKET_ERROR_CODES.TOKEN_INVALID;
      logger.warn(
        `[SocketAuth] Soft re-auth thất bại: socketId=${socket.id} code=${errorCode} error=${error.message} traceId=${traceId}`,
      );
      if (typeof callback === "function") {
        callback({
          success: false,
          code: errorCode,
          message: error.message || "Xác thực token thất bại",
          traceId,
        });
      }
    }
  });

  // ════════════════════════════════════════
  // 4. TRUY VẤN TRẠNG THÁI (PRESENCE QUERY)
  // ════════════════════════════════════════
  socket.on(
    SOCKET_EVENTS.PRESENCE_QUERY,
    withAuth(
      socket,
      Object.values(ROLES),
      async (sanitizedData, callback) => {
        try {
          const userIds = sanitizedData?.userIds || [];
          const presenceList = await queryPresence(userIds);

          if (typeof callback === "function") {
            callback({ success: true, data: presenceList });
          } else {
            // Fallback: emit event nếu không có callback
            socket.emit(SOCKET_EVENTS.PRESENCE_SYNC, { data: presenceList });
          }
        } catch (error) {
          logger.error(
            `[SocketConnection] Lỗi xử lý presence query cho người dùng ${userId}:`,
            error,
          );
          if (typeof callback === "function") {
            callback({
              success: false,
              error: SOCKET_ERROR_CODES.INTERNAL_ERROR,
              message: "Lỗi hệ thống khi xử lý truy vấn trạng thái trực tuyến",
            });
          }
        }
      },
      SOCKET_EVENTS.PRESENCE_QUERY,
      validatePresenceQuery
    )
  );

  // ════════════════════════════════════════
  // 5. HEARTBEAT
  // ════════════════════════════════════════
  socket.on(SOCKET_EVENTS.HEARTBEAT, (payload = {}, callback) => {
    const response = {
      success: true,
      ok: true,
      socketId: socket.id,
      clientTime: payload?.clientTime ?? null,
      serverTime: Date.now(),
      traceId: socket.traceId || socket.id,
    };

    if (typeof callback === "function") {
      callback(response);
    }

    socket.emit(SOCKET_EVENTS.HEARTBEAT_ACK, response);
  });

  // ════════════════════════════════════════
  // 6. QUẢN LÝ LỖI (ERROR HANDLING)
  // ════════════════════════════════════════
  socket.on(SOCKET_EVENTS.ERROR, (error) => {
    logger.error(`[SocketConnection] Lỗi Socket [${socket.id}]:`, error);
  });

  socket.on(SOCKET_EVENTS.CONNECT_ERROR, (error) => {
    logger.error(
      `[SocketConnection] Lỗi kết nối Socket [${socket.id}]:`,
      error,
    );
  });
};
