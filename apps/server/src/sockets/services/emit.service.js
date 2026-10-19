/**
 * @file emit.service.js
 * @module Sockets_Services
 * @description Dịch vụ phát sự kiện an toàn với dedup và ACK-based delivery guarantee.
 *
 * @note Lưu ý kiến trúc quan trọng:
 * - `io.to(room).emit()` là fire-and-forget — KHÔNG THỂ retry vì không throw error.
 * - Dedup cache hoạt động per-node (in-memory). Trong multi-node cluster,
 *   cùng event có thể được emit từ nhiều node khác nhau.
 * - Nếu cần delivery guarantee, sử dụng `emitToSocket()` với ACK timeout
 *   cho individual socket thay vì room broadcast.
 */

import { getIO } from '../index.js';
import { SOCKET_ROOMS } from '../constants/socket-rooms.constants.js';
import { logger } from '../../utils/logger.js';

// ════════════════════════════════════════
// DEDUP CACHE (SINGLE-NODE)
// ════════════════════════════════════════

/** Dedup cache: eventKey → timestamp */
const emitCache = new Map();
const DEDUP_WINDOW = 2000; // 2s dedup window

// Cleanup dedup cache định kỳ — `.unref()` để không giữ process alive
const dedupCleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [key, ts] of emitCache) {
    if (now - ts > DEDUP_WINDOW * 2) emitCache.delete(key);
  }
}, 60_000);
dedupCleanupTimer.unref();

// ════════════════════════════════════════
// ROOM BROADCAST (FIRE-AND-FORGET)
// ════════════════════════════════════════

/**
 * Emit event tới room cụ thể với cơ chế dedup.
 *
 * @param {string} room - Tên room
 * @param {string} event - Tên sự kiện
 * @param {object} data - Dữ liệu gửi kèm
 * @param {object} [options] - Tùy chọn
 * @param {string} [options.dedupKey] - Khóa dedup. Nếu có, event sẽ bị chặn nếu gửi trùng trong DEDUP_WINDOW
 */
export const safeEmitToRoom = (room, event, data, options = {}) => {
  const { dedupKey = null } = options;

  // Dedup check
  if (dedupKey) {
    const lastEmit = emitCache.get(dedupKey);
    if (lastEmit && Date.now() - lastEmit < DEDUP_WINDOW) {
      logger.debug(`[Socket][Emit] Dedup blocked: ${dedupKey}`);
      return;
    }
    emitCache.set(dedupKey, Date.now());
  }

  const io = getIO();
  io.to(room).emit(event, data);
};

// ════════════════════════════════════════
// INDIVIDUAL SOCKET EMIT (WITH ACK)
// ════════════════════════════════════════

/**
 * Gửi sự kiện tới một Socket cụ thể với ACK timeout.
 * Đây là phương thức duy nhất hỗ trợ delivery guarantee thực sự.
 *
 * @param {import('socket.io').Socket} socket - Socket instance đích
 * @param {string} event - Tên sự kiện
 * @param {any} data - Dữ liệu đính kèm
 * @param {number} [timeoutMs=5000] - Thời gian chờ ACK (ms)
 * @returns {Promise<any>} Dữ liệu ACK từ client
 * @throws {Error} Khi timeout hoặc client không phản hồi
 */
export const emitToSocket = async (socket, event, data, timeoutMs = 5000) => {
  return socket.timeout(timeoutMs).emitWithAck(event, data);
};

// ════════════════════════════════════════
// TIỆN ÍCH PHÁT SỰ KIỆN (EMIT UTILS)
// ════════════════════════════════════════

/**
 * Gửi sự kiện đến một người dùng cụ thể trên tất cả các thiết bị họ đang kết nối.
 *
 * @param {string} userId - ID người dùng
 * @param {string} event - Tên sự kiện (Event Name)
 * @param {any} data - Dữ liệu đính kèm sự kiện
 */
export const emitToUser = (userId, event, data) => {
  try {
    const io = getIO();
    if (!io) return;
    const room = SOCKET_ROOMS.user(userId);
    io.to(room).emit(event, data);
  } catch (_) {
    // Socket.IO chưa được khởi tạo (VD: standalone scripts hoặc tests)
  }
};

/**
 * Gửi sự kiện đến toàn bộ các Quản trị viên (Admin) đang trực tuyến.
 *
 * @param {string} event - Tên sự kiện
 * @param {any} data - Dữ liệu đính kèm
 */
export const emitToAdmin = (event, data) => {
  try {
    const io = getIO();
    if (!io) return;
    io.to(SOCKET_ROOMS.admin()).emit(event, data);
  } catch (_) {
    // Socket.IO chưa được khởi tạo
  }
};

/**
 * Gửi sự kiện đến tất cả các Client đang kết nối tới Server.
 *
 * @param {string} event - Tên sự kiện
 * @param {any} data - Dữ liệu đính kèm
 */
export const emitToAll = (event, data) => {
  try {
    const io = getIO();
    if (!io) return;
    io.emit(event, data);
  } catch (_) {
    // Socket.IO chưa được khởi tạo
  }
};

/**
 * Gửi sự kiện đến một phòng (Room) cụ thể.
 *
 * @param {string} room - Tên phòng
 * @param {string} event - Tên sự kiện
 * @param {any} data - Dữ liệu đính kèm
 */
export const emitToRoom = (room, event, data) => {
  try {
    const io = getIO();
    if (!io) return;
    io.to(room).emit(event, data);
  } catch (_) {
    // Socket.IO chưa được khởi tạo
  }
};
