/**
 * @file index.js
 * @module Sockets
 * @description Trung tâm điều phối kết nối thời gian thực cho ứng dụng Sạp Phim.
 * Quản lý khởi tạo Server, đăng ký các bộ xử lý sự kiện (Handlers), và cung cấp các tiện ích gửi thông báo (Emit) toàn cục.
 */

import { Server } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { logger } from "../utils/logger.js";
import { initializeProgressService } from "../modules/jobs/services/progress.service.js";
import { getRedisClient, cacheConfig } from '../config/redis.config.js';
import { socketAuthMiddleware } from './middlewares/socket-auth.middleware.js';
import { registerConnectionHandlers } from "./handlers/connection.handler.js";
import { registerJobHandlers } from "./handlers/job.handler.js";
import { registerEpisodeHandlers } from "./handlers/episode.handler.js";
import { getOnlineUsersCount, removeFromOnlineSet } from "./services/session.service.js";
import { SOCKET_EVENTS } from "./constants/socket-events.constants.js";
import { SOCKET_ROOMS } from "./constants/socket-rooms.constants.js";
import socketConfig from "../config/socket.config.js";

/** Instance toàn cục của Socket.IO Server và các client Adapter */
let io = null;
let pubClient = null;
let subClient = null;

const registerAdapterClientListeners = (client, label) => {
  if (!client) return;

  client.on("connect", () => logger.info(`[Socket][RedisAdapter] ${label} connect`));
  client.on("ready", () => logger.info(`[Socket][RedisAdapter] ${label} ready`));
  client.on("close", () => logger.warn(`[Socket][RedisAdapter] ${label} close`));
  client.on("end", () => logger.info(`[Socket][RedisAdapter] ${label} end`));
  client.on("reconnecting", () => logger.warn(`[Socket][RedisAdapter] ${label} reconnecting`));
  client.on("error", (err) => logger.warn(`[Socket][RedisAdapter] ${label} error: ${err.message}`));
};

const closeRedisAdapterClient = async (client, label) => {
  if (!client) return;

  try {
    if (client.status && ["end", "close"].includes(client.status)) {
      logger.info(`[Socket][RedisAdapter] ${label} already closed`);
      return;
    }

    await client.quit();
    logger.info(`[Socket][RedisAdapter] ${label} closed`);
  } catch (error) {
    logger.warn(`[Socket][RedisAdapter] ${label} quit failed, forcing disconnect: ${error.message}`);
    client.disconnect?.();
  }
};

// ════════════════════════════════════════
// KHỞI TẠO (INITIALIZATION)
// ════════════════════════════════════════

/**
 * Khởi tạo máy chủ Socket.IO và thiết lập các cấu hình cơ bản.
 *
 * @param {Object} server - Đối tượng HTTP Server (Node.js)
 * @returns {Server} Instance của Socket.IO Server đã khởi tạo
 */
export const initializeSocket = (server) => {
  io = new Server(server, socketConfig);

  // ── Redis Adapter (Horizontal Scaling) ──
  try {
    const redisClient = getRedisClient();
    const adapterOpts = { enableOfflineQueue: true, lazyConnect: false };
    pubClient = redisClient.duplicate(adapterOpts);
    subClient = redisClient.duplicate(adapterOpts);

    // Đăng ký error handler để tránh uncaughtException khi Redis ngắt kết nối đột ngột
    registerAdapterClientListeners(pubClient, "pub");
    registerAdapterClientListeners(subClient, "sub");

    io.adapter(createAdapter(pubClient, subClient));
    logger.info('[Socket] ✓ Redis Adapter đã kết nối (scale ngang sẵn sàng)');
  } catch (error) {
    logger.warn('[Socket] ⚠ Redis Adapter thất bại, hoạt động single-node:', error.message);
  }

  initializeProgressService(io);

  io.use(socketAuthMiddleware(io));

  io.on("connection", (socket) => {
    registerConnectionHandlers(io, socket);
    registerJobHandlers(io, socket);
    registerEpisodeHandlers(io, socket);
  });

  import("../utils/events.util.js").then(({ default: events, EVENTS }) => {
    events.on(EVENTS.AUTH.LOGOUT_ALL, ({ userId }) => {
      forceLogoutUser(userId, "Tài khoản đăng xuất từ thiết bị khác");
    });

    events.on(EVENTS.AUTH.PERMISSIONS_UPDATED, ({ userId }) => {
      forceRefreshPermissions(userId);
    });
  });

  logger.info("[SocketMain] ✓ Máy chủ Socket.IO đã được khởi tạo thành công");
  return io;
};

/**
 * Truy xuất Instance hiện tại của Socket.IO Server.
 *
 * @returns {Server} Instance của Socket.IO
 * @throws {Error} Khi máy chủ chưa được khởi tạo qua initializeSocket
 */
export const getIO = () => {
  if (!io) {
    throw new Error("Máy chủ Socket.IO chưa được khởi tạo");
  }
  return io;
};

/**
 * Đóng Socket.IO Server một cách an toàn và giải phóng các tài nguyên Redis Adapter.
 * Hỗ trợ Graceful Shutdown.
 *
 * @returns {Promise<void>}
 */
export const closeSocket = async () => {
  if (!io) return;

  return new Promise((resolve) => {
    logger.info("[Socket] Bắt đầu đóng kết nối Socket.IO Server...");
    io.close(async (err) => {
      if (err) {
        logger.error("[Socket] Lỗi khi đóng Socket.IO Server:", err);
      } else {
        logger.info("[Socket] ✓ Socket.IO Server đã đóng thành công");
      }

      try {
        await closeRedisAdapterClient(pubClient, "pub");
        await closeRedisAdapterClient(subClient, "sub");
      } catch (redisError) {
        logger.warn("[Socket] Lỗi đóng Redis Adapter clients:", redisError.message);
      }

      io = null;
      pubClient = null;
      subClient = null;
      resolve();
    });
  });
};

// ════════════════════════════════════════
// ĐIỀU KHIỂN PHIÊN (SESSION CONTROL)
// ════════════════════════════════════════

/**
 * Buộc đăng xuất một phiên làm việc (thiết bị) cụ thể của người dùng.
 * Thường dùng khi một thiết bị bị thu hồi quyền truy cập.
 *
 * @param {string} userId - ID người dùng
 * @param {string} sessionId - ID phiên làm việc cần thu hồi
 * @param {string} [reason="Phiên làm việc đã bị thu hồi"] - Lý do ngắt kết nối
 */
export const forceLogoutSession = async (
  userId,
  sessionId,
  reason = "Phiên làm việc đã bị thu hồi",
) => {
  const currentIo = io; // capture reference in closure
  if (!currentIo) return;

  const room = SOCKET_ROOMS.user(userId);
  const sockets = await currentIo.in(room).fetchSockets();

  for (const socket of sockets) {
    if (socket.user?.sessionId === sessionId) {
      socket.emit(SOCKET_EVENTS.FORCE_LOGOUT, {
        reason,
        message: "Phiên làm việc của bạn đã kết thúc",
        timestamp: new Date().toISOString(),
      });

      // Tạo khoảng trễ nhỏ để Client kịp nhận và xử lý sự kiện Logout trước khi ngắt kết nối vật lý
      setTimeout(() => {
        socket.disconnect(true);
      }, 1000);
    }
  }
};

/**
 * Buộc đăng xuất người dùng trên tất cả các thiết bị đang kết nối.
 * Dùng cho các trường hợp đổi mật khẩu, bị khóa tài khoản hoặc đăng xuất toàn cục.
 * Hỗ trợ ngắt kết nối xuyên suốt cluster nhờ sử dụng io.in().disconnectSockets()
 *
 * @param {string} userId - ID người dùng
 * @param {string} [reason="Tài khoản yêu cầu đăng xuất"] - Lý do ngắt kết nối
 */
export const forceLogoutUser = async (
  userId,
  reason = "Tài khoản yêu cầu đăng xuất",
) => {
  const currentIo = io; // capture reference in closure
  if (!currentIo) return;

  const room = SOCKET_ROOMS.user(userId);

  // Gửi sự kiện logout cho toàn bộ thiết bị trong cluster
  currentIo.to(room).emit(SOCKET_EVENTS.FORCE_LOGOUT, {
    reason,
    message: "Phiên làm việc của bạn đã kết thúc",
    timestamp: new Date().toISOString(),
  });

  // Ngắt kết nối toàn bộ socket trong room này trên toàn bộ Node
  setTimeout(() => {
    currentIo.in(room).disconnectSockets(true);
  }, 1000);

  // Thu hồi toàn bộ đăng ký thiết bị trong hệ thống Cache (Redis) & Xóa khỏi online users set
  try {
    const redis = getRedisClient();
    const key = `${cacheConfig.prefix.session}devices:${userId}`;
    await redis.del(key);
    await removeFromOnlineSet(userId);
  } catch (error) {
    logger.error(`[SocketMain] Lỗi khi thu hồi thiết bị cho người dùng ${userId}:`, error);
  }
};

/**
 * Buộc người dùng làm mới phiên bản (force token refresh) khi có thay đổi quyền
 * 
 * @param {string} userId - ID người dùng
 */
export const forceRefreshPermissions = async (userId) => {
  const currentIo = io;
  if (!currentIo) return;

  const room = SOCKET_ROOMS.user(userId);

  // Gửi sự kiện cập nhật quyền cho toàn bộ thiết bị trong cluster của user
  currentIo.to(room).emit(SOCKET_EVENTS.PERMISSIONS_UPDATED, {
    message: "Quyền hạn của bạn đã được cập nhật, đang làm mới...",
    timestamp: new Date().toISOString(),
  });
};

export { SOCKET_EVENTS, SOCKET_ROOMS };

export default {
  initializeSocket,
  getIO,
  closeSocket,
  forceLogoutUser,
  forceLogoutSession,
  forceRefreshPermissions,
  getOnlineUsersCount,
  SOCKET_EVENTS,
  SOCKET_ROOMS,
};
