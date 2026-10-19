/**
 * @file admin-subscription.service.js
 * @module Modules_Subscription_Services
 * @description Xử lý nghiệp vụ Quản trị Subscriptions cho Admin (Xem danh sách, Cấp VIP miễn phí, Hủy gói cưỡng chế, Thống kê).
 */

import { Op } from "sequelize";
import {
  Subscription,
  MembershipPlan,
  User,
  Role,
  AuditLog,
  sequelize,
} from "../../../models/index.js";
import { AppError } from "../../../utils/app-error.js";
import { entitlementService } from "./entitlement.service.js";
import { emitToUser } from "../../../sockets/services/emit.service.js";
import { SOCKET_EVENTS } from "../../../sockets/constants/socket-events.constants.js";
import { ROLES } from "../../../constants/roles.constant.js";
import { logger } from "../../../utils/logger.js";
import { cacheConfig, cacheHelper } from "../../../config/redis.config.js";

export const adminSubscriptionService = {
  /**
   * Danh sách Subscriptions cho Admin (Phân trang, Lọc & Tìm kiếm)
   * @param {Object} query
   * @returns {Promise<Object>}
   */
  async getSubscriptionsAdmin({ page = 1, limit = 20, search, status, tier, billing_cycle }) {
    const offset = (page - 1) * limit;
    const where = {};
    const userWhere = {};

    if (status) where.status = status;
    if (tier) where.tier = tier;
    if (billing_cycle) where.billing_cycle = billing_cycle;

    if (search) {
      userWhere[Op.or] = [
        { username: { [Op.iLike]: `%${search}%` } },
        { email: { [Op.iLike]: `%${search}%` } },
        { full_name: { [Op.iLike]: `%${search}%` } },
      ];
    }

    const { count, rows } = await Subscription.findAndCountAll({
      where,
      limit,
      offset,
      order: [["created_at", "DESC"]],
      include: [
        {
          model: User,
          as: "user",
          where: Object.keys(userWhere).length ? userWhere : undefined,
          attributes: ["id", "username", "email", "full_name", "avatar_url"],
        },
        {
          model: MembershipPlan,
          as: "plan",
          attributes: ["id", "name", "tier", "price_monthly", "badge_color", "icon_name"],
        },
      ],
    });

    // Thống kê số lượng theo từng tab trạng thái (không phụ thuộc filter status hiện tại)
    const countsWhere = {};
    if (tier) countsWhere.tier = tier;
    if (billing_cycle) countsWhere.billing_cycle = billing_cycle;

    const countsGroup = await Subscription.findAll({
      where: countsWhere,
      attributes: ["status", [sequelize.fn("COUNT", sequelize.col("Subscription.id")), "count"]],
      include: Object.keys(userWhere).length
        ? [
            {
              model: User,
              as: "user",
              where: userWhere,
              attributes: [],
            },
          ]
        : [],
      group: ["status"],
      raw: true,
    });

    let activeCount = 0;
    let graceCount = 0;
    let expiredCount = 0;
    let cancelledCount = 0;
    let pendingCount = 0;
    let totalAllCount = 0;

    countsGroup.forEach((row) => {
      const c = parseInt(row.count, 10) || 0;
      totalAllCount += c;
      if (row.status === "active") activeCount += c;
      else if (row.status === "grace_period") graceCount += c;
      else if (row.status === "expired") expiredCount += c;
      else if (row.status === "cancelled") cancelledCount += c;
      else if (row.status === "pending") pendingCount += c;
    });

    const counts = {
      all: totalAllCount,
      active: activeCount,
      pending: pendingCount,
      grace_period: graceCount,
      expired: expiredCount,
      cancelled: cancelledCount,
    };

    return {
      items: rows,
      total: count,
      page: Number(page),
      limit: Number(limit),
      counts,
    };
  },

  /**
   * Admin Cấp Gói VIP miễn phí cho Người dùng (Admin Grant / Gift)
   * @param {string} adminId
   * @param {Object} data
   * @returns {Promise<Object>}
   */
  async grantVipAdmin(adminId, { user_id, plan_id, billing_cycle = "monthly", duration_days = 30, note }) {
    const targetUser = await User.findByPk(user_id);
    if (!targetUser) throw new AppError("Người dùng không tồn tại", 404);

    const plan = await MembershipPlan.findByPk(plan_id);
    if (!plan) throw new AppError("Gói thành viên không tồn tại", 404);

    let grantedSub = null;

    await sequelize.transaction(async (t) => {
      // Hủy gói active hiện tại nếu có
      const activeSub = await Subscription.findOne({
        where: { user_id, status: ["active", "grace_period"] },
        transaction: t,
      });

      if (activeSub) {
        await activeSub.update(
          {
            status: "cancelled",
            cancelled_at: new Date(),
            metadata: {
              ...(activeSub.metadata || {}),
              cancelled_reason: `Admin ${adminId} cấp gói VIP mới`,
            },
          },
          { transaction: t }
        );
      }

      const now = new Date();
      const expiresAt = new Date(now.getTime() + Number(duration_days) * 24 * 60 * 60 * 1000);

      grantedSub = await Subscription.create(
        {
          user_id,
          plan_id: plan.id,
          tier: plan.tier,
          billing_cycle,
          status: "active",
          amount: 0,
          amount_paid: 0,
          currency: "VND",
          payment_method: "admin_grant",
          starts_at: now,
          expires_at: expiresAt,
          auto_renew: false,
          metadata: {
            granted_by_admin_id: adminId,
            note: note || "Cấp VIP từ Quản trị viên",
          },
        },
        { transaction: t }
      );

      // Cập nhật Role và Hạng VIP người dùng
      const user = await User.findByPk(user_id, { include: [{ model: Role, as: "role" }], transaction: t });
      if (user) {
        const userUpdates = {
          membership_tier: plan.tier,
          is_premium: plan.tier !== "free",
        };
        if (user.role && user.role.slug === ROLES.USER) {
          const premiumRole = await Role.findOne({ where: { slug: ROLES.PREMIUM_USER }, transaction: t });
          if (premiumRole) {
            userUpdates.role_id = premiumRole.id;
          }
        }
        await user.update(userUpdates, { transaction: t });
      }

      // Ghi AuditLog
      await AuditLog.create(
        {
          user_id: adminId,
          event_type: "admin.subscription.granted",
          event_category: "admin",
          severity: "info",
          status: "success",
          description: `Admin ${adminId} cấp gói VIP ${plan.name} (${duration_days} ngày) cho người dùng ${user_id}`,
          metadata: {
            target_user_id: user_id,
            plan_id: plan.id,
            duration_days,
            note,
          },
        },
        { transaction: t }
      );
    });

    await Promise.all([
      entitlementService.invalidateUserEntitlements(user_id),
      cacheHelper.del(`${cacheConfig.prefix.profile}${user_id}`),
      cacheHelper.del(`${cacheConfig.prefix.user}${user_id}`),
    ]);

    // Bắn thông báo Socket Realtime
    emitToUser(user_id, SOCKET_EVENTS.NOTIFICATION_NEW, {
      type: "system",
      title: "Bạn đã được cấp Đặc quyền VIP!",
      message: `Quản trị viên vừa cấp cho bạn gói VIP ${plan.name} (${duration_days} ngày). Trải nghiệm ngay!`,
    });

    logger.info(`[AdminSub] Admin ${adminId} granted VIP ${plan.name} to user ${user_id}`);
    return grantedSub.toJSON();
  },

  /**
   * Admin Hủy gói VIP của người dùng (Revoke)
   * @param {string} adminId
   * @param {string} subscriptionId
   * @param {string} [reason]
   * @returns {Promise<Object>}
   */
  async revokeSubscriptionAdmin(adminId, subscriptionId, reason = null) {
    const subscription = await Subscription.findByPk(subscriptionId);
    if (!subscription) throw new AppError("Bản ghi đăng ký không tồn tại", 404);

    const userId = subscription.user_id;

    await sequelize.transaction(async (t) => {
      await subscription.update(
        {
          status: "cancelled",
          cancelled_at: new Date(),
          auto_renew: false,
          metadata: {
            ...(subscription.metadata || {}),
            revoked_by_admin_id: adminId,
            revoke_reason: reason || "Hủy cưỡng chế bởi Quản trị viên",
          },
        },
        { transaction: t }
      );

      // Cập nhật User: hạ về 'free' và hạ role nếu đang là premium_user
      const user = await User.findByPk(userId, { include: [{ model: Role, as: "role" }], transaction: t });
      if (user) {
        const userUpdates = {
          membership_tier: "free",
          is_premium: false,
        };
        if (user.role && user.role.slug === ROLES.PREMIUM_USER) {
          const standardUserRole = await Role.findOne({ where: { slug: ROLES.USER }, transaction: t });
          if (standardUserRole) {
            userUpdates.role_id = standardUserRole.id;
          }
        }
        await user.update(userUpdates, { transaction: t });
      }

      await AuditLog.create(
        {
          user_id: adminId,
          event_type: "admin.subscription.revoked",
          event_category: "admin",
          severity: "warn",
          status: "success",
          description: `Admin ${adminId} đã thu hồi gói VIP của người dùng ${userId}`,
          metadata: {
            subscription_id: subscriptionId,
            target_user_id: userId,
            reason,
          },
        },
        { transaction: t }
      );
    });

    await Promise.all([
      entitlementService.invalidateUserEntitlements(userId),
      cacheHelper.del(`${cacheConfig.prefix.profile}${userId}`),
      cacheHelper.del(`${cacheConfig.prefix.user}${userId}`),
    ]);

    emitToUser(userId, SOCKET_EVENTS.NOTIFICATION_NEW, {
      type: "system",
      title: "Gói VIP của bạn đã bị ngưng hiệu lực",
      message: `Quản trị viên đã thu hồi gói VIP. ${reason ? `Lý do: ${reason}` : ""}`,
    });

    logger.info(`[AdminSub] Admin ${adminId} revoked sub ${subscriptionId} of user ${userId}`);
    return subscription.toJSON();
  },

  /**
   * Thống kê Tổng quan Subscriptions cho Admin Dashboard
   * @returns {Promise<Object>}
   */
  async getSubscriptionStatsAdmin() {
    const totalActive = await Subscription.count({ where: { status: "active" } });
    const totalGracePeriod = await Subscription.count({ where: { status: "grace_period" } });
    const totalExpired = await Subscription.count({ where: { status: "expired" } });
    const totalCancelled = await Subscription.count({ where: { status: "cancelled" } });

    // Group count theo Tier
    const countByTier = await Subscription.findAll({
      attributes: ["tier", [sequelize.fn("COUNT", sequelize.col("id")), "count"]],
      where: { status: "active" },
      group: ["tier"],
      raw: true,
    });

    return {
      active_subscriptions: totalActive,
      grace_period_subscriptions: totalGracePeriod,
      expired_subscriptions: totalExpired,
      cancelled_subscriptions: totalCancelled,
      active_by_tier: countByTier,
    };
  },
};

export default adminSubscriptionService;
