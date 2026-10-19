/**
 * Dịch vụ Quản lý Trạng thái Trực tuyến (Presence Service)
 *
 * @file presence.service.js
 * @module Sockets_Services
 * @description Module chuyên xử lý logic broadcast trạng thái online/offline
 * dựa trên cài đặt quyền riêng tư của người dùng. Hỗ trợ batch query
 * trạng thái để đồng bộ khi client reconnect.
 *
 * @note Tách biệt hoàn toàn khỏi connection handler để đảm bảo
 * single-responsibility và dễ kiểm thử.
 */

import { Op } from "sequelize";

import { User, Friendship } from "../../models/index.js";
import { ONLINE_SET_KEY, isUserOnlineGlobally } from "./session.service.js";
import { SOCKET_EVENTS } from "../constants/socket-events.constants.js";
import { SOCKET_ROOMS } from "../constants/socket-rooms.constants.js";
import { logger } from "../../utils/logger.js";
import { cacheHelper } from "../../config/redis.config.js";

// ════════════════════════════════════════
// CONSTANTS
// ════════════════════════════════════════

/**
 * Các mức hiển thị trạng thái hoạt động.
 * Tương ứng với giá trị trong `privacy_settings.activity_status`.
 * @enum {string}
 */
const ACTIVITY_VISIBILITY = {
  PUBLIC: "public",
  FRIENDS_ONLY: "friends_only",
  NOBODY: "nobody",
};

// ════════════════════════════════════════
// INTERNAL HELPERS
// ════════════════════════════════════════

/**
 * Truy xuất danh sách ID bạn bè (đã chấp nhận) của một người dùng.
 * Kết quả được cache 5 phút vì friendships ít thay đổi.
 *
 * @param {string} userId - ID người dùng
 * @returns {Promise<string[]>} Mảng các friend user IDs
 * @private
 */
const _getAcceptedFriendIds = async (userId) => {
  const cacheKey = `presence:friends:${userId}`;

  try {
    const cached = await cacheHelper.get(cacheKey);
    if (cached) return cached;
  } catch { /* ignore cache miss */ }

  try {
    const friendships = await Friendship.findAll({
      where: {
        [Op.or]: [{ requester_id: userId }, { addressee_id: userId }],
        status: "accepted",
      },
      attributes: ["requester_id", "addressee_id"],
      raw: true,
    });

    const friendIds = friendships.map((f) =>
      f.requester_id === userId ? f.addressee_id : f.requester_id
    );

    // Cache 5 phút
    cacheHelper.set(cacheKey, friendIds, 300).catch(() => {});

    return friendIds;
  } catch (error) {
    logger.error(
      `[PresenceService] Lỗi khi truy vấn danh sách bạn bè cho người dùng ${userId}:`,
      error,
    );
    return [];
  }
};

/**
 * Truy xuất cài đặt hiển thị trạng thái hoạt động của người dùng.
 * Kết quả được cache 10 phút vì privacy settings gần như không đổi.
 *
 * @param {string} userId - ID người dùng
 * @returns {Promise<string>} Mức hiển thị: "public" | "friends_only" | "nobody"
 * @private
 */
const _getActivityVisibility = async (userId) => {
  const cacheKey = `presence:visibility:${userId}`;

  try {
    const cached = await cacheHelper.getRaw(cacheKey);
    if (cached) return cached;
  } catch { /* ignore cache miss */ }

  try {
    const user = await User.findByPk(userId, {
      attributes: ["privacy_settings"],
      raw: true,
    });

    const privacy = user?.privacy_settings || {};
    const visibility = privacy.activity_status || ACTIVITY_VISIBILITY.PUBLIC;

    // Cache 10 phút
    cacheHelper.setRaw(cacheKey, visibility, 600).catch(() => {});

    return visibility;
  } catch (error) {
    logger.error(
      `[PresenceService] Lỗi khi đọc privacy settings cho người dùng ${userId}:`,
      error,
    );
    return ACTIVITY_VISIBILITY.PUBLIC;
  }
};

// ════════════════════════════════════════
// PUBLIC API
// ════════════════════════════════════════

/**
 * Phát trạng thái trực tuyến/ngoại tuyến của người dùng đến các đối tượng
 * phù hợp dựa trên cài đặt quyền riêng tư.
 *
 * @param {Object} io - Instance của máy chủ Socket.IO
 * @param {string} userId - ID người dùng
 * @param {boolean} isOnline - Trạng thái hiện tại (true = online, false = offline)
 * @param {Object} [socket=null] - Socket instance (dùng broadcast khi online để loại trừ chính mình)
 */
export const broadcastPresence = async (io, userId, isOnline, socket = null) => {
  try {
    const visibility = await _getActivityVisibility(userId);

    // Chuẩn bị payload trạng thái
    const payload = {
      userId,
      isOnline,
      lastOnline: isOnline ? null : new Date().toISOString(),
    };

    const eventName = isOnline
      ? SOCKET_EVENTS.USER_ONLINE
      : SOCKET_EVENTS.USER_OFFLINE;

    switch (visibility) {
      case ACTIVITY_VISIBILITY.PUBLIC: {
        // Thay vì io.emit (O(N) fan-out cho 10K users), chỉ broadcast tới bạn bè
        // và gửi qua broadcast room cho các components cần (VD: admin dashboard)
        const friendIds = await _getAcceptedFriendIds(userId);
        friendIds.forEach((friendId) => {
          io.to(SOCKET_ROOMS.user(friendId)).emit(eventName, payload);
        });
        // Broadcast room cho admin/dashboard theo dõi trạng thái hệ thống
        io.to(SOCKET_ROOMS.broadcast()).emit(eventName, payload);
        break;
      }

      case ACTIVITY_VISIBILITY.FRIENDS_ONLY: {
        // Chỉ thông báo cho bạn bè đã kết nối
        const friendIds = await _getAcceptedFriendIds(userId);

        friendIds.forEach((friendId) => {
          io.to(SOCKET_ROOMS.user(friendId)).emit(eventName, payload);
        });
        break;
      }

      case ACTIVITY_VISIBILITY.NOBODY:
        // Không phát trạng thái cho bất kỳ ai
        logger.debug(
          `[PresenceService] Người dùng ${userId} cài đặt ẩn trạng thái hoạt động`,
        );
        break;

      default:
        logger.warn(
          `[PresenceService] Giá trị activity_status không hợp lệ: "${visibility}" cho người dùng ${userId}`,
        );
        break;
    }
  } catch (error) {
    logger.error(
      `[PresenceService] Lỗi khi phát trạng thái ${isOnline ? "online" : "offline"} cho người dùng ${userId}:`,
      error,
    );
  }
};

/**
 * Truy vấn trạng thái trực tuyến của một danh sách người dùng.
 * Kết hợp dữ liệu realtime (Redis) với dữ liệu DB (last_online).
 *
 * @param {string[]} userIds - Mảng các ID cần truy vấn
 * @returns {Promise<Array<{userId: string, isOnline: boolean, lastOnline: string|null}>>}
 */
export const queryPresence = async (userIds) => {
  if (!Array.isArray(userIds) || userIds.length === 0) {
    return [];
  }

  // Giới hạn số lượng để tránh query quá lớn
  const limitedIds = userIds.slice(0, 200);

  try {
    // 1. Batch kiểm tra trạng thái online qua Redis Pipeline (thay vì 200 sequential round-trips)
    const pipelineResults = await cacheHelper.pipeline((pipe) => {
      for (const userId of limitedIds) {
        pipe.zscore(ONLINE_SET_KEY, userId);
      }
    });

    const onlineStatuses = limitedIds.map((userId, i) => {
      const [err, score] = pipelineResults[i] || [null, null];
      return { userId, isOnline: !err && score !== null };
    });

    // 2. Tách danh sách offline để truy vấn last_online từ DB
    const offlineUserIds = onlineStatuses
      .filter((s) => !s.isOnline)
      .map((s) => s.userId);

    let lastOnlineMap = {};
    if (offlineUserIds.length > 0) {
      const users = await User.findAll({
        where: { id: { [Op.in]: offlineUserIds } },
        attributes: ["id", "last_online"],
        raw: true,
      });

      users.forEach((u) => {
        lastOnlineMap[u.id] = u.last_online
          ? new Date(u.last_online).toISOString()
          : null;
      });
    }

    // 3. Kết hợp kết quả
    return onlineStatuses.map(({ userId, isOnline }) => {
      return {
        userId,
        isOnline,
        lastOnline: isOnline ? null : (lastOnlineMap[userId] || null),
      };
    });
  } catch (error) {
    logger.error("[PresenceService] Lỗi khi truy vấn batch presence:", error);
    return [];
  }
};

/**
 * Lấy danh sách bạn bè đang trực tuyến của một người dùng.
 * Sử dụng Promise.all để parallel hóa toàn bộ Redis lookups.
 *
 * @param {string} userId - ID người dùng
 * @returns {Promise<string[]>} Mảng ID bạn bè đang online
 */
export const getOnlineFriends = async (userId) => {
  const friendIds = await _getAcceptedFriendIds(userId);

  if (friendIds.length === 0) return [];

  // Parallel Redis lookups thay vì sequential loop
  const results = await Promise.all(
    friendIds.map(async (id) => {
      const isOnline = await isUserOnlineGlobally(id);
      return { id, isOnline };
    })
  );

  return results.filter((r) => r.isOnline).map((r) => r.id);
};
