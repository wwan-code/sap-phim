/**
 * @file subscription-scheduler.worker.js
 * @module Modules_Subscription_Workers
 * @description Background Worker tự động quét vòng đời Subscriptions (Gia hạn tự động, Nhắc nhở hết hạn, Grace Period, Thu hồi VIP).
 */

import { Op } from "sequelize";
import { Subscription, MembershipPlan, User, Wallet, Role, sequelize } from "../../../models/index.js";
import { subscriptionService } from "../services/subscription.service.js";
import { entitlementService } from "../services/entitlement.service.js";
import { notifySubscriptionExpiring, notifySubscriptionExpired } from "../../notification/helpers/notification.helper.js";
import { emitToUser } from "../../../sockets/services/emit.service.js";
import { SOCKET_EVENTS } from "../../../sockets/constants/socket-events.constants.js";
import { ROLES } from "../../../constants/roles.constant.js";
import { logger } from "../../../utils/logger.js";
import { cacheConfig, cacheHelper } from "../../../config/redis.config.js";

let schedulerInterval = null;
const SCAN_INTERVAL_MS = 30 * 60 * 1000; // Quét mỗi 30 phút
const GRACE_PERIOD_DAYS = 3;

/**
 * Xử lý thông báo nhắc nhở các gói sắp hết hạn (3 ngày và 1 ngày)
 */
const processExpiringReminders = async () => {
  const now = new Date();
  const threeDaysLater = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  const oneDayLater = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000);

  // Subscriptions sắp hết hạn trong 3 ngày
  const expiringSubs = await Subscription.findAll({
    where: {
      status: "active",
      expires_at: {
        [Op.gt]: now,
        [Op.lte]: threeDaysLater,
      },
    },
    include: [{ model: MembershipPlan, as: "plan" }],
  });

  for (const sub of expiringSubs) {
    const daysLeft = Math.max(1, Math.ceil((new Date(sub.expires_at).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
    notifySubscriptionExpiring({
      userId: sub.user_id,
      subscriptionId: sub.id,
      planName: sub.plan?.name || "VIP",
      daysLeft,
      actionUrl: "/goi-vip",
    });
  }
};

/**
 * Xử lý Gia hạn tự động và Quản lý Grace Period / Expiry
 */
const processAutoRenewalsAndExpirations = async () => {
  const now = new Date();

  // 1. Quét các gói Active đã đến hoặc qua ngày hết hạn
  const dueSubs = await Subscription.findAll({
    where: {
      status: "active",
      expires_at: { [Op.lte]: now },
    },
    include: [{ model: MembershipPlan, as: "plan" }],
  });

  for (const sub of dueSubs) {
    const userId = sub.user_id;

    if (sub.auto_renew) {
      try {
        // Thử gia hạn tự động qua Ví S-Coin
        logger.info(`[SubScheduler] Attempting auto-renewal for user ${userId} (Plan: ${sub.plan?.name})`);
        await subscriptionService.subscribe(userId, {
          plan_id: sub.plan_id,
          billing_cycle: sub.billing_cycle,
          auto_renew: true,
        });
        logger.info(`[SubScheduler] Auto-renewal SUCCESS for user ${userId}`);
        continue; // Gia hạn thành công -> Chuyển sang sub tiếp theo
      } catch (renewError) {
        logger.warn(`[SubScheduler] Auto-renewal failed for user ${userId}: ${renewError.message}`);
      }
    }

    // Nếu không gia hạn tự động hoặc ví thiếu S-Coin -> Chuyển sang Grace Period (3 ngày)
    await sub.update({ status: "grace_period" });
    await entitlementService.invalidateUserEntitlements(userId);

    emitToUser(userId, SOCKET_EVENTS.NOTIFICATION_NEW, {
      type: "system",
      title: "Gói VIP hết hạn - Đang trong thời gian gia hạn",
      message: `Gói VIP ${sub.plan?.name || ""} của bạn đã hết hạn. Nạp S-Coin và gia hạn trong 3 ngày tới để không gián đoạn đặc quyền!`,
    });
  }

  // 2. Quét các gói Grace Period đã quá 3 ngày -> Chuyển thành Expired & Thu hồi VIP
  const gracePeriodCutoff = new Date(now.getTime() - GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000);
  const expiredGraceSubs = await Subscription.findAll({
    where: {
      status: "grace_period",
      expires_at: { [Op.lte]: gracePeriodCutoff },
    },
    include: [{ model: MembershipPlan, as: "plan" }],
  });

  for (const sub of expiredGraceSubs) {
    const userId = sub.user_id;

    await sequelize.transaction(async (t) => {
      await sub.update({ status: "expired" }, { transaction: t });

      // Kiểm tra xem user còn subscription active nào khác không
      const otherActiveSub = await Subscription.findOne({
        where: {
          user_id: userId,
          status: ["active", "grace_period"],
          id: { [Op.ne]: sub.id },
        },
        transaction: t,
      });

      const user = await User.findByPk(userId, { include: [{ model: Role, as: "role" }], transaction: t });
      if (user) {
        if (!otherActiveSub) {
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
        } else {
          await user.update({
            membership_tier: otherActiveSub.tier,
            is_premium: otherActiveSub.tier !== "free",
          }, { transaction: t });
        }
      }
    });

    await Promise.all([
      entitlementService.invalidateUserEntitlements(userId),
      cacheHelper.del(`${cacheConfig.prefix.profile}${userId}`),
      cacheHelper.del(`${cacheConfig.prefix.user}${userId}`),
    ]);

    notifySubscriptionExpired({
      userId,
      subscriptionId: sub.id,
      planName: sub.plan?.name || "VIP",
      actionUrl: "/goi-vip",
    });

    emitToUser(userId, SOCKET_EVENTS.USER_LEVEL_UPDATED, {
      user_id: userId,
      role: ROLES.USER,
      is_vip: false,
    });

    logger.info(`[SubScheduler] Subscription ${sub.id} of user ${userId} set to EXPIRED`);
  }
};

/**
 * Khởi chạy Subscription Scheduler Worker
 */
export const initSubscriptionSchedulerWorker = () => {
  if (schedulerInterval) {
    logger.warn("[SubScheduler] Worker already running, skipping initialization.");
    return;
  }

  logger.info("[SubScheduler] Starting Subscription Lifetime Scheduler Worker...");

  // Chạy ngay 1 lần khi server start (sau 10 giây để DB sẵn sàng)
  setTimeout(() => {
    processExpiringReminders().catch((err) => logger.error("[SubScheduler] Reminders error:", err));
    processAutoRenewalsAndExpirations().catch((err) => logger.error("[SubScheduler] Auto-renew error:", err));
  }, 10000);

  // Lên lịch định kỳ
  schedulerInterval = setInterval(() => {
    processExpiringReminders().catch((err) => logger.error("[SubScheduler] Reminders error:", err));
    processAutoRenewalsAndExpirations().catch((err) => logger.error("[SubScheduler] Auto-renew error:", err));
  }, SCAN_INTERVAL_MS);
};

export const closeSubscriptionSchedulerWorker = () => {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    logger.info("[SubScheduler] Subscription Scheduler Worker stopped.");
  }
};

export default initSubscriptionSchedulerWorker;
