/**
 * @file account.service.js
 * @module Modules_User_Services
 * @description Xử lý nghiệp vụ tài khoản: thống kê, xuất dữ liệu GDPR, xóa tài khoản (soft-delete).
 */

import { v4 as uuidv4 } from "uuid";
import * as argon2 from "argon2";
import { User, WatchHistory, Watchlist, Rating, Comment } from "../../../models/index.js";
import { cacheConfig, cacheHelper } from "../../../config/redis.config.js";
import { AppError } from "../../../utils/app-error.js";
import { levelService } from "./level.service.js";
import { revokeAllUserSessions } from "../../auth/helpers/session.helper.js";
import { emitToUser } from "../../../sockets/services/emit.service.js";
import { SOCKET_EVENTS } from "../../../sockets/constants/socket-events.constants.js";

export const accountService = {
  /**
   * Lấy thống kê tài khoản cá nhân.
   */
  async getProfileStats(userId) {
    const user = await User.findByPk(userId, {
      attributes: [
        "movies_watched", "followers_count", "following_count",
        "total_ratings", "total_comments", "level", "exp",
        "created_at", "last_login_at"
      ]
    });

    if (!user) throw new AppError("Người dùng không tồn tại", 404);

    const levelInfo = levelService.buildLevelInfo({ level: user.level, exp: user.exp });

    return {
      stats: {
        movies_watched: user.movies_watched,
        followers_count: user.followers_count,
        following_count: user.following_count,
        total_ratings: user.total_ratings,
        total_comments: user.total_comments,
      },
      level_info: levelInfo,
      created_at: user.created_at,
      last_login_at: user.last_login_at,
    };
  },

  /**
   * Trích xuất dữ liệu người dùng (Tuân thủ GDPR).
   */
  async exportUserData(userId) {
    const user = await User.findByPk(userId, {
      attributes: { exclude: ["password_hash"] }
    });

    if (!user) throw new AppError("Người dùng không tồn tại", 404);

    const [watchHistory, watchlists, ratings, comments] = await Promise.all([
      WatchHistory.findAll({
        where: { user_id: userId },
        attributes: [
          "movie_id",
          "episode_id",
          "position_seconds",
          "duration_seconds",
          "progress_percent",
          "completed_at",
          "last_watched_at",
          "updated_at",
        ],
      }),
      Watchlist.findAll({
        where: { user_id: userId },
        attributes: ["movie_id", "status", "created_at"],
      }),
      Rating.findAll({
        where: { user_id: userId },
        attributes: ["movie_id", "score", "review", "created_at"],
      }),
      Comment.findAll({
        where: { user_id: userId },
        attributes: ["movie_id", "episode_id", "content", "created_at"],
      }),
    ]);

    return {
      profile: user.toJSON(),
      activity: {
        watch_history: watchHistory,
        watchlist: watchlists,
        ratings: ratings,
        comments: comments
      },
      exported_at: new Date()
    };
  },

  /**
   * Xóa tài khoản bằng phương pháp Soft-delete và Anonymize dữ liệu nhạy cảm.
   */
  async deleteAccount(userId, password) {
    const user = await User.findByPk(userId);
    if (!user) throw new AppError("Người dùng không tồn tại", 404);

    if (user.status === "inactive") {
      throw new AppError("Tài khoản đã bị xóa", 400);
    }

    // Xác nhận mật khẩu hiện tại
    const isPasswordValid = await argon2.verify(user.password_hash, password);
    if (!isPasswordValid) {
      throw new AppError("Mật khẩu không chính xác", 400);
    }

    const shortId = user.id.split('-')[0];
    const originalPii = {
      email: user.email,
      username: user.username,
      phone_number: user.phone_number,
      full_name: user.full_name,
    };

    // Soft-delete and anonymize
    await User.update({
      status: "inactive",
      email: `deleted_${uuidv4()}@anon.local`,
      username: `deleted_${shortId}`,
      phone_number: null,
      full_name: "Deleted User",
      // Lưu lại thông tin cũ vào metadata để admin có thể khôi phục trong vòng 30 ngày
      metadata: { ...user.metadata, original_pii: originalPii, deleted_at: new Date() },
      // Tăng token_version để force logout tất cả phiên đăng nhập
      token_version: (user.token_version || 1) + 1,
    }, { where: { id: userId } });

    // Invalidate tất cả cache liên quan
    await Promise.all([
      cacheHelper.del(`${cacheConfig.prefix.profile}${userId}`),
      cacheHelper.del(`${cacheConfig.prefix.user}${userId}`),
      cacheHelper.del(`me:${userId}`), // Legacy cache key if exists
    ]);
    await revokeAllUserSessions(userId, "self_delete");
    emitToUser(userId, SOCKET_EVENTS.FORCE_LOGOUT, { reason: "account_deleted" });

    return { success: true };
  }
};