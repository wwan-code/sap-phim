/**
 * @file profile.service.js
 * @module Modules_User_Services
 * @description Xử lý nghiệp vụ liên quan đến hồ sơ người dùng (Public/Private Profile).
 */

import { Op } from "sequelize";
import { User, Role, Follower, Friendship } from "../../../models/index.js";
import { cacheConfig, cacheHelper } from "../../../config/redis.config.js";
import { AppError } from "../../../utils/app-error.js";
import { levelService } from "./level.service.js";

/**
 * Xây dựng danh sách ID bạn bè để kiểm tra quyền riêng tư (friends_only).
 * Lấy danh sách bạn bè 2 chiều (đã chấp thuận).
 * @param {string} userId - ID người dùng
 * @returns {Promise<Set<string>>}
 */
export const buildFriendIdsSet = async (userId) => {
  if (!userId) return new Set();

  const friendships = await Friendship.findAll({
    where: {
      status: "accepted",
      [Op.or]: [{ requester_id: userId }, { addressee_id: userId }],
    },
    attributes: ["requester_id", "addressee_id"],
  });

  const friendIds = new Set();
  for (const f of friendships) {
    if (f.requester_id !== userId) friendIds.add(f.requester_id);
    if (f.addressee_id !== userId) friendIds.add(f.addressee_id);
  }
  return friendIds;
};

/**
 * Ẩn các trường thông tin nhạy cảm dựa trên privacy_settings và mối quan hệ với người xem.
 * @param {Object} user - Dữ liệu người dùng
 * @param {Object} privacySettings - Thiết lập quyền riêng tư
 * @param {string} viewerRelation - Mối quan hệ: "self", "friend", "public"
 */
export const maskActivity = (user, privacySettings, viewerRelation) => {
  if (viewerRelation === "self") return;

  const resolveVisibility = (setting) => {
    if (setting === "private") return false;
    if (setting === "friends_only" && viewerRelation !== "friend") return false;
    return true; // public
  };

  const showEmail = resolveVisibility(privacySettings?.show_email);
  if (!showEmail) delete user.email;

  const showDob = resolveVisibility(privacySettings?.show_dob);
  if (!showDob) delete user.date_of_birth;

  const showSocial = resolveVisibility(privacySettings?.show_social);
  if (!showSocial) delete user.social_links;

  const showActivity = resolveVisibility(privacySettings?.show_activity);
  if (!showActivity) {
    delete user.movies_watched;
    delete user.total_ratings;
    delete user.total_comments;
  }
};

export const profileService = {
  /**
   * Lấy hồ sơ người dùng (hỗ trợ Cache).
   * Áp dụng quyền riêng tư nếu người xem khác với chủ hồ sơ.
   *
   * @param {string} userId - ID chủ hồ sơ
   * @param {string|null} viewerId - ID người xem (từ req.userId)
   */
  async getProfile(userId, viewerId = null) {
    const isSelf = userId === viewerId;

    // Chỉ dùng cache nếu xem public profile để tránh rò rỉ dữ liệu (vì maskActivity thay đổi theo viewer)
    const cacheKey = `${cacheConfig.prefix.profile}${userId}`;
    let profileData = null;

    if (!isSelf) {
      profileData = await cacheHelper.get(cacheKey);
    }

    if (!profileData) {
      const user = await User.findByPk(userId, {
        attributes: [
          "id", "username", "email", "full_name", "bio", "avatar_url", "cover_url",
          "gender", "date_of_birth", "country", "city", "location", "social_links",
          "status", "is_verified", "is_premium", "membership_tier", "level", "exp",
          "followers_count", "following_count", "movies_watched",
          "total_ratings", "total_comments", "privacy_settings",
          "created_at", "last_login_at"
        ],
        include: [{ model: Role, as: "role", attributes: ["id", "name", "slug", "description", "priority"] }],
      });

      if (!user) throw new AppError("Người dùng không tồn tại", 404);
      if (user.status !== "active") throw new AppError("Hồ sơ không khả dụng", 403);

      profileData = user.toJSON();

      // Thông tin cấp độ
      profileData.levelInfo = levelService.buildLevelInfo({ level: profileData.level, exp: profileData.exp });

      // Cập nhật Cache (không có thông tin nhạy cảm đã bị ẩn)
      await cacheHelper.set(cacheKey, profileData, cacheConfig.ttl.profile);
    } else {
      // deep copy để maskActivity không đổi cache
      profileData = JSON.parse(JSON.stringify(profileData));
    }

    let viewerRelation = "public";
    if (isSelf) {
      viewerRelation = "self";
    } else if (viewerId) {
      const friendIds = await buildFriendIdsSet(userId);
      if (friendIds.has(viewerId)) {
        viewerRelation = "friend";
      }
    }

    maskActivity(profileData, profileData.privacy_settings || {}, viewerRelation);

    // Nếu không phải là self, giấu thuộc tính privacy_settings đi
    if (!isSelf) {
      delete profileData.privacy_settings;
    }

    return profileData;
  },

  /**
   * Cập nhật hồ sơ cá nhân.
   */
  async updateProfile(userId, data) {
    const allowedFields = [
      "full_name", "bio", "date_of_birth", "gender",
      "country", "city", "location", "social_links"
    ];

    const updateData = {};
    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        updateData[field] = data[field];
      }
    }

    if (Object.keys(updateData).length === 0) {
      return null;
    }

    await User.update(updateData, { where: { id: userId } });

    // Xóa cache
    await cacheHelper.del(`${cacheConfig.prefix.profile}${userId}`);

    return updateData;
  },

  /**
   * Cập nhật ảnh đại diện.
   */
  async updateAvatar(userId, avatarUrl) {
    await User.update({ avatar_url: avatarUrl }, { where: { id: userId } });

    // Xóa cả profile cache và auth cache (vì auth chứa avatar_url)
    await Promise.all([
      cacheHelper.del(`${cacheConfig.prefix.profile}${userId}`),
      cacheHelper.del(`${cacheConfig.prefix.user}${userId}`)
    ]);

    return { avatar_url: avatarUrl };
  },

  /**
   * Cập nhật ảnh bìa.
   */
  async updateCover(userId, coverUrl) {
    await User.update({ cover_url: coverUrl }, { where: { id: userId } });
    await cacheHelper.del(`${cacheConfig.prefix.profile}${userId}`);
    return { cover_url: coverUrl };
  }
};