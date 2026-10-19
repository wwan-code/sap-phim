/**
 * @file entitlement.service.js
 * @module Modules_Subscription_Services
 * @description Dynamic Entitlement Engine - Trích xuất và kiểm tra đặc quyền (features) theo gói hội viên của Người dùng.
 */

import { Subscription, MembershipPlan } from "../../../models/index.js";
import { cacheHelper } from "../../../config/redis.config.js";
import { logger } from "../../../utils/logger.js";

// Cache TTL cho Entitlements (10 phút)
const ENTITLEMENT_CACHE_TTL = 600;

export const entitlementService = {
  /**
   * Lấy cấu hình Entitlements hoàn chỉnh cho người dùng dựa trên Subscription Active hiện tại
   * @param {string} userId
   * @returns {Promise<Object>}
   */
  async getUserEntitlements(userId) {
    const cacheKey = `entitlement:${userId}`;

    try {
      const cached = await cacheHelper.get(cacheKey);
      if (cached) return cached;
    } catch (err) {
      // Redis error fallback
    }

    // Tìm subscription đang hoạt động
    const activeSub = await Subscription.findOne({
      where: {
        user_id: userId,
        status: ["active", "grace_period"],
      },
      include: [{ model: MembershipPlan, as: "plan" }],
      order: [["created_at", "DESC"]],
    });

    let entitlements = {
      tier: "free",
      tier_level: 0,
      is_vip: false,
      max_quality: "full_hd",
      watch_together_limit: 2,
      offline_download: false,
      priority_support: false,
      max_devices: 1,
      custom_avatar: false,
      custom_cover: false,
      premium_avatar_frame: false,
      premium_name_effect: false,
      permanent_storage: false,
      expires_at: null,
    };

    if (activeSub && activeSub.plan) {
      const planFeatures = activeSub.plan.features || {};
      entitlements = {
        tier: activeSub.tier || activeSub.plan.tier,
        tier_level: activeSub.plan.tier_level || 0,
        is_vip: activeSub.tier !== "free",
        ...planFeatures,
        expires_at: activeSub.expires_at,
        subscription_id: activeSub.id,
        auto_renew: activeSub.auto_renew,
        status: activeSub.status,
      };
    }

    try {
      await cacheHelper.set(cacheKey, entitlements, ENTITLEMENT_CACHE_TTL);
    } catch (err) {
      logger.warn(`[Entitlement] Redis cache write error: ${err.message}`);
    }

    return entitlements;
  },

  /**
   * Xóa cache Entitlements của người dùng (khi đăng ký/nâng cấp/hết hạn gói)
   * @param {string} userId
   */
  async invalidateUserEntitlements(userId) {
    try {
      await cacheHelper.del(`entitlement:${userId}`);
    } catch (err) {
      logger.warn(`[Entitlement] Invalidate cache failed: ${err.message}`);
    }
  },

  /**
   * Middleware Express kiểm tra người dùng có đặc quyền cụ thể hay không
   * @param {string} featureKey - Tên tính năng (ví dụ: 'offline_download', 'premium_avatar_frame')
   */
  requireEntitlement(featureKey) {
    return async (req, res, next) => {
      try {
        if (!req.user || !req.user.id) {
          return res.status(401).json({ success: false, message: "Yêu cầu đăng nhập" });
        }

        const entitlements = await entitlementService.getUserEntitlements(req.user.id);
        if (!entitlements[featureKey]) {
          return res.status(403).json({
            success: false,
            message: `Tính năng này yêu cầu gói hội viên cao hơn (${featureKey})`,
            code: "ENTITLEMENT_REQUIRED",
            required_feature: featureKey,
          });
        }

        req.userEntitlements = entitlements;
        next();
      } catch (error) {
        next(error);
      }
    };
  },
};

export default entitlementService;
