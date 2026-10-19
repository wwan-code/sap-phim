/**
 * @file social.service.js
 * @module Modules_User_Services
 * @description Xử lý nghiệp vụ mạng xã hội: theo dõi, hủy theo dõi, danh sách follower.
 */

import { sequelize } from "../../../config/database.config.js";
import { User, Follower } from "../../../models/index.js";
import { AppError } from "../../../utils/app-error.js";
import { levelService } from "./level.service.js";
import { EXP_REWARDS } from "../../../constants/level.constant.js";

export const socialService = {
  /**
   * Theo dõi một người dùng khác.
   */
  async follow(followerId, followingId) {
    if (followerId === followingId) {
      throw new AppError("Không thể tự theo dõi chính mình", 400);
    }

    const targetUser = await User.findByPk(followingId, { attributes: ["id", "status"] });
    if (!targetUser || targetUser.status !== "active") {
      throw new AppError("Người dùng không tồn tại hoặc đã bị khóa", 404);
    }

    const existingFollow = await Follower.findOne({
      where: { follower_id: followerId, following_id: followingId },
    });

    if (existingFollow) {
      throw new AppError("Bạn đã theo dõi người dùng này rồi", 400);
    }

    // Thực thi transaction để đảm bảo atomic update
    await sequelize.transaction(async (t) => {
      await Follower.create({ follower_id: followerId, following_id: followingId }, { transaction: t });

      await User.increment("following_count", { by: 1, where: { id: followerId }, transaction: t });
      await User.increment("followers_count", { by: 1, where: { id: followingId }, transaction: t });
    });

    // Thưởng EXP cho hành động follow (fire-and-forget)
    levelService.awardExp(followerId, EXP_REWARDS.FOLLOW).catch(() => {});

    return { success: true };
  },

  /**
   * Hủy theo dõi một người dùng.
   */
  async unfollow(followerId, followingId) {
    if (followerId === followingId) {
      throw new AppError("Không thể hủy tự theo dõi chính mình", 400);
    }

    const existingFollow = await Follower.findOne({
      where: { follower_id: followerId, following_id: followingId },
    });

    if (!existingFollow) {
      throw new AppError("Bạn chưa theo dõi người dùng này", 400);
    }

    await sequelize.transaction(async (t) => {
      await existingFollow.destroy({ transaction: t });

      await User.decrement("following_count", { by: 1, where: { id: followerId }, transaction: t });
      await User.decrement("followers_count", { by: 1, where: { id: followingId }, transaction: t });
    });

    return { success: true };
  },

  /**
   * Lấy danh sách người theo dõi.
   */
  async getFollowers(userId, { page = 1, limit = 20 } = {}) {
    const offset = (page - 1) * limit;

    const { count, rows } = await Follower.findAndCountAll({
      where: { following_id: userId },
      limit,
      offset,
      order: [["created_at", "DESC"]],
      include: [
        {
          model: User,
          as: "followerUser",
          attributes: ["id", "username", "full_name", "avatar_url", "level", "is_verified", "is_premium"],
        },
      ],
    });

    return {
      items: rows.map(r => r.followerUser),
      total: count,
      page,
      limit,
    };
  },

  /**
   * Lấy danh sách đang theo dõi.
   */
  async getFollowing(userId, { page = 1, limit = 20 } = {}) {
    const offset = (page - 1) * limit;

    const { count, rows } = await Follower.findAndCountAll({
      where: { follower_id: userId },
      limit,
      offset,
      order: [["created_at", "DESC"]],
      include: [
        {
          model: User,
          as: "followingUser",
          attributes: ["id", "username", "full_name", "avatar_url", "level", "is_verified", "is_premium"],
        },
      ],
    });

    return {
      items: rows.map(r => r.followingUser),
      total: count,
      page,
      limit,
    };
  },
};
