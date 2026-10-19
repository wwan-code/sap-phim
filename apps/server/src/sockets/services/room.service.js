/**
 * @file room.service.js
 * @module Sockets_Services
 * @description Quản lý logic join/leave/query room cho Socket.IO.
 */

import { SOCKET_ROOMS } from '../constants/socket-rooms.constants.js';
import { logger } from '../../utils/logger.js';

/**
 * Prefix nhận dạng room theo dõi Job
 * @type {string}
 */
const JOB_ROOM_PREFIX = 'job:';

/**
 * Join socket vào một room cụ thể.
 *
 * @param {import('socket.io').Socket} socket - Socket instance
 * @param {string} roomName - Tên room cần join
 */
export const joinRoom = (socket, roomName) => {
  socket.join(roomName);
  logger.debug(`[Socket][Room] Socket ${socket.id} joined room: ${roomName}`);
};

/**
 * Leave socket khỏi một room cụ thể.
 *
 * @param {import('socket.io').Socket} socket - Socket instance
 * @param {string} roomName - Tên room cần leave
 */
export const leaveRoom = (socket, roomName) => {
  socket.leave(roomName);
  logger.debug(`[Socket][Room] Socket ${socket.id} left room: ${roomName}`);
};

/**
 * Join socket vào nhiều rooms cùng lúc.
 *
 * @param {import('socket.io').Socket} socket - Socket instance
 * @param {string[]} roomNames - Danh sách rooms cần join
 */
export const joinRooms = (socket, roomNames) => {
  for (const room of roomNames) {
    socket.join(room);
  }
  logger.debug(
    `[Socket][Room] Socket ${socket.id} joined ${roomNames.length} rooms: ${roomNames.join(', ')}`,
  );
};

/**
 * Rời tất cả các Job rooms mà socket đang tham gia.
 * Sử dụng khi socket disconnect để cleanup resource.
 *
 * @param {import('socket.io').Socket} socket - Socket instance
 * @returns {number} Số lượng job rooms đã rời
 */
export const leaveAllJobRooms = (socket) => {
  let count = 0;

  for (const room of socket.rooms) {
    if (room.startsWith(JOB_ROOM_PREFIX)) {
      socket.leave(room);
      count++;
    }
  }

  if (count > 0) {
    logger.debug(
      `[Socket][Room] Socket ${socket.id} đã rời ${count} job rooms khi disconnect`,
    );
  }

  return count;
};

/**
 * Kiểm tra xem socket có đang ở trong một room hay không.
 *
 * @param {import('socket.io').Socket} socket - Socket instance
 * @param {string} roomName - Tên room cần kiểm tra
 * @returns {boolean} True nếu socket đang ở trong room
 */
export const isInRoom = (socket, roomName) => {
  return socket.rooms.has(roomName);
};

/**
 * Join socket vào room cá nhân và room theo vai trò.
 *
 * @param {import('socket.io').Socket} socket - Socket instance
 * @param {{ id: string, roles?: string[] }} user - Thông tin người dùng
 */
export const joinUserRooms = (socket, user) => {
  const rooms = [SOCKET_ROOMS.user(user.id)];

  if (user.roles?.includes('admin')) {
    rooms.push(SOCKET_ROOMS.admin());
  }

  joinRooms(socket, rooms);
};

/**
 * Rời socket khỏi room cá nhân và room theo vai trò.
 *
 * @param {import('socket.io').Socket} socket - Socket instance
 * @param {{ id: string, roles?: string[] }} user - Thông tin người dùng
 */
export const leaveUserRooms = (socket, user) => {
  if (!user?.id) return;
  const rooms = [SOCKET_ROOMS.user(user.id)];

  if (user.roles?.includes('admin')) {
    rooms.push(SOCKET_ROOMS.admin());
  }

  for (const room of rooms) {
    socket.leave(room);
  }
  logger.debug(`[Socket][Room] Socket ${socket.id} đã rời các phòng của user ${user.id}`);
};
