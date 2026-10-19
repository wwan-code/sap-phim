/**
 * @file subscription.service.js
 * @module Modules_Subscription_Services
 * @description Nghiệp vụ Đăng ký Gói hội viên (Subscribe, Prorated Upgrade, Downgrade, Renew, Cancel, Auto-renew).
 */

import { Op } from "sequelize";
import {
  Subscription,
  MembershipPlan,
  User,
  Wallet,
  WalletTransaction,
  AuditLog,
  Role,
  sequelize,
} from "../../../models/index.js";
import { AppError } from "../../../utils/app-error.js";
import { walletService, LCOIN_VND_RATE } from "../../wallet/services/wallet.service.js";
import { entitlementService } from "./entitlement.service.js";
import { emitToUser } from "../../../sockets/services/emit.service.js";
import { SOCKET_EVENTS } from "../../../sockets/constants/socket-events.constants.js";
import { ROLES } from "../../../constants/roles.constant.js";
import { logger } from "../../../utils/logger.js";
import { cacheConfig, cacheHelper } from "../../../config/redis.config.js";

export const subscriptionService = {
  /**
   * Lấy gói Subscription đang có hiệu lực của Người dùng
   * @param {string} userId
   * @returns {Promise<Object>}
   */
  async getActiveSubscription(userId) {
    const activeSub = await Subscription.findOne({
      where: {
        user_id: userId,
        status: { [Op.in]: ["active", "grace_period"] },
      },
      include: [{ model: MembershipPlan, as: "plan" }],
      order: [["created_at", "DESC"]],
    });

    if (!activeSub) {
      // Fallback: Gói miễn phí mặc định
      const freePlan = await MembershipPlan.findOne({ where: { tier: "free" } });
      return {
        id: null,
        tier: "free",
        tier_level: 0,
        status: "active",
        billing_cycle: "monthly",
        starts_at: null,
        expires_at: null,
        auto_renew: false,
        days_left: 0,
        plan: freePlan ? freePlan.toJSON() : null,
      };
    }

    const plain = activeSub.toJSON();
    const now = new Date();
    const expiresAt = new Date(plain.expires_at);
    const msDiff = expiresAt.getTime() - now.getTime();
    plain.days_left = Math.max(0, Math.ceil(msDiff / (1000 * 60 * 60 * 24)));
    return plain;
  },

  /**
   * Lấy Lịch sử Đăng ký gói của Người dùng (Phân trang)
   * @param {string} userId
   * @param {Object} query
   * @returns {Promise<Object>}
   */
  async getUserSubscriptionHistory(userId, { page = 1, limit = 20 }) {
    const offset = (page - 1) * limit;

    const { count, rows } = await Subscription.findAndCountAll({
      where: { user_id: userId },
      limit,
      offset,
      order: [["created_at", "DESC"]],
      include: [{ model: MembershipPlan, as: "plan", attributes: ["name", "tier", "badge_color", "icon_name"] }],
    });

    return {
      items: rows,
      total: count,
      page: Number(page),
      limit: Number(limit),
    };
  },

  /**
   * Tính toán Proration (Quy đổi số S-Coin còn thừa khi Nâng cấp gói)
   * @param {string} userId
   * @param {string} newPlanId
   * @param {string} billingCycle - 'monthly' hoặc 'yearly'
   * @returns {Promise<Object>}
   */
  async calculateProration(userId, newPlanId, billingCycle = "monthly") {
    const newPlan = await MembershipPlan.findByPk(newPlanId);
    if (!newPlan) throw new AppError("Gói thành viên mới không tồn tại", 404);

    const priceVnd = billingCycle === "yearly" ? newPlan.price_yearly : newPlan.price_monthly;
    const newPlanPriceSCoin = Math.ceil(Number(priceVnd) / LCOIN_VND_RATE);

    const currentSub = await Subscription.findOne({
      where: { user_id: userId, status: "active" },
      include: [{ model: MembershipPlan, as: "plan" }],
    });

    if (!currentSub || currentSub.tier === "free") {
      return {
        is_upgrade: false,
        unused_credit_scoin: 0,
        new_plan_price_scoin: newPlanPriceSCoin,
        net_charge_scoin: newPlanPriceSCoin,
        net_charge_vnd: newPlanPriceSCoin * LCOIN_VND_RATE,
        remaining_days: 0,
      };
    }

    const now = new Date();
    const expiresAt = new Date(currentSub.expires_at);
    const startsAt = new Date(currentSub.starts_at);

    if (expiresAt <= now) {
      return {
        is_upgrade: false,
        unused_credit_scoin: 0,
        new_plan_price_scoin: newPlanPriceSCoin,
        net_charge_scoin: newPlanPriceSCoin,
        net_charge_vnd: newPlanPriceSCoin * LCOIN_VND_RATE,
        remaining_days: 0,
      };
    }

    const currentPlanLevel = currentSub.plan?.tier_level || 0;
    const isUpgrade = newPlan.tier_level > currentPlanLevel;

    const totalDays = Math.max(1, Math.ceil((expiresAt.getTime() - startsAt.getTime()) / (1000 * 60 * 60 * 24)));
    const remainingDays = Math.max(0, Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

    const amountPaidSCoin = Math.ceil(Number(currentSub.amount_paid || currentSub.amount || 0) / LCOIN_VND_RATE);
    const dailyRate = amountPaidSCoin / totalDays;
    const unusedCreditSCoin = isUpgrade ? Math.floor(dailyRate * remainingDays) : 0;

    const netChargeSCoin = Math.max(0, newPlanPriceSCoin - unusedCreditSCoin);

    return {
      is_upgrade: isUpgrade,
      current_tier: currentSub.tier,
      new_tier: newPlan.tier,
      unused_credit_scoin: unusedCreditSCoin,
      new_plan_price_scoin: newPlanPriceSCoin,
      net_charge_scoin: netChargeSCoin,
      net_charge_vnd: netChargeSCoin * LCOIN_VND_RATE,
      remaining_days: remainingDays,
    };
  },

  /**
   * Đăng ký mới hoặc Nâng cấp gói hội viên bằng Ví S-Coin (ACID Transaction)
   * @param {string} userId
   * @param {Object} data
   * @param {string} data.plan_id
   * @param {string} [data.billing_cycle='monthly']
   * @param {boolean} [data.auto_renew=true]
   * @returns {Promise<Object>}
   */
  async subscribe(userId, { plan_id, billing_cycle = "monthly", auto_renew = true }) {
    const newPlan = await MembershipPlan.findByPk(plan_id);
    if (!newPlan) throw new AppError("Gói thành viên không tồn tại", 404);
    if (!newPlan.is_active) throw new AppError("Gói thành viên này đang tạm dừng kinh doanh", 400);

    const proration = await this.calculateProration(userId, plan_id, billing_cycle);
    const netChargeSCoin = proration.net_charge_scoin;

    let newSubscription = null;

    await sequelize.transaction(async (t) => {
      // 1. Pessimistic Lock Ví người dùng
      const wallet = await Wallet.findOne({
        where: { user_id: userId },
        transaction: t,
        lock: t.LOCK.UPDATE,
      });

      if (!wallet) {
        throw new AppError("Ví người dùng không tồn tại. Vui lòng thử lại", 404);
      }

      if (wallet.is_locked) {
        throw new AppError(`Ví của bạn đang bị khóa. Lý do: ${wallet.locked_reason || "Không xác định"}`, 403);
      }

      if (wallet.balance < netChargeSCoin) {
        throw new AppError(
          `Số dư S-Coin trong ví không đủ. Cần ${netChargeSCoin} S-Coin, hiện có ${wallet.balance} S-Coin. Vui lòng nạp thêm S-Coin!`,
          400
        );
      }

      const balanceBefore = wallet.balance;

      // 2. Trừ S-Coin trong ví nếu có phí net_charge
      if (netChargeSCoin > 0) {
        wallet.balance -= netChargeSCoin;
        wallet.total_spent += netChargeSCoin;
        await wallet.save({ transaction: t });
      }

      const balanceAfter = wallet.balance;

      // 3. Đóng hoặc cập nhật Subscription cũ
      const existingSub = await Subscription.findOne({
        where: { user_id: userId, status: ["active", "grace_period"] },
        transaction: t,
      });

      if (existingSub) {
        await existingSub.update(
          {
            status: "cancelled",
            cancelled_at: new Date(),
            metadata: {
              ...(existingSub.metadata || {}),
              cancelled_reason: `Nâng cấp lên gói ${newPlan.name}`,
              replaced_by_plan_id: newPlan.id,
            },
          },
          { transaction: t }
        );
      }

      // 4. Tính toán thời gian bắt đầu và kết thúc gói mới
      const now = new Date();
      const durationDays = billing_cycle === "yearly" ? 365 : 30;
      const expiresAt = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);

      const priceVnd = billing_cycle === "yearly" ? newPlan.price_yearly : newPlan.price_monthly;

      newSubscription = await Subscription.create(
        {
          user_id: userId,
          plan_id: newPlan.id,
          tier: newPlan.tier,
          billing_cycle,
          status: "active",
          amount: priceVnd,
          amount_paid: netChargeSCoin * LCOIN_VND_RATE,
          currency: "VND",
          payment_method: "wallet",
          starts_at: now,
          expires_at: expiresAt,
          auto_renew,
          metadata: {
            proration_applied: proration.is_upgrade,
            unused_credit_scoin: proration.unused_credit_scoin,
            net_charge_scoin: netChargeSCoin,
          },
        },
        { transaction: t }
      );

      // 5. Tạo WalletTransaction
      if (netChargeSCoin > 0) {
        await WalletTransaction.create(
          {
            wallet_id: wallet.id,
            user_id: userId,
            type: "purchase",
            amount: netChargeSCoin,
            balance_before: balanceBefore,
            balance_after: balanceAfter,
            status: "completed",
            description: `Thanh toán đăng ký gói VIP ${newPlan.name} (${billing_cycle === "yearly" ? "1 Năm" : "1 Tháng"})`,
            reference_type: "subscription",
            reference_id: newSubscription.id,
            vnd_amount: netChargeSCoin * LCOIN_VND_RATE,
            metadata: {
              plan_id: newPlan.id,
              tier: newPlan.tier,
              billing_cycle,
            },
          },
          { transaction: t }
        );
      }

      // 6. Đồng bộ Role & Hạng VIP người dùng (membership_tier, is_premium)
      const user = await User.findByPk(userId, { include: [{ model: Role, as: "role" }], transaction: t });
      if (user) {
        const userUpdates = {
          membership_tier: newPlan.tier,
          is_premium: newPlan.tier !== "free",
        };
        if (newPlan.tier !== "free" && user.role && user.role.slug === ROLES.USER) {
          const premiumRole = await Role.findOne({ where: { slug: ROLES.PREMIUM_USER }, transaction: t });
          if (premiumRole) {
            userUpdates.role_id = premiumRole.id;
          }
        }
        await user.update(userUpdates, { transaction: t });
      }

      // 7. Ghi Audit Log
      await AuditLog.create(
        {
          user_id: userId,
          event_type: "subscription.purchased",
          event_category: "billing",
          severity: "info",
          status: "success",
          description: `Người dùng ${userId} đăng ký gói VIP ${newPlan.name} thành công`,
          metadata: {
            subscription_id: newSubscription.id,
            plan_id: newPlan.id,
            net_charge_scoin: netChargeSCoin,
          },
        },
        { transaction: t }
      );
    });

    // Invalidate Entitlements, Profile & User Cache
    await Promise.all([
      entitlementService.invalidateUserEntitlements(userId),
      cacheHelper.del(`${cacheConfig.prefix.profile}${userId}`),
      cacheHelper.del(`${cacheConfig.prefix.user}${userId}`),
    ]);

    // Phát Realtime Socket Events
    const updatedWallet = await walletService.getWallet(userId);
    emitToUser(userId, SOCKET_EVENTS.WALLET_BALANCE_UPDATED, updatedWallet);
    emitToUser(userId, SOCKET_EVENTS.NOTIFICATION_NEW, {
      type: "system",
      title: `Kích hoạt gói VIP ${newPlan.name} thành công!`,
      message: `Cảm ơn bạn đã hỗ trợ Sạp Phim. Gói có hiệu lực đến ${new Date(newSubscription.expires_at).toLocaleDateString("vi-VN")}.`,
    });

    logger.info(`[SubscriptionService] User ${userId} subscribed to plan ${newPlan.name} (${netChargeSCoin} S-Coin)`);

    return newSubscription.toJSON();
  },

  /**
   * Đổi cài đặt Tự động gia hạn (Auto Renew)
   * @param {string} userId
   * @param {boolean} auto_renew
   * @returns {Promise<Object>}
   */
  async toggleAutoRenew(userId, auto_renew) {
    const activeSub = await Subscription.findOne({
      where: { user_id: userId, status: ["active", "grace_period"] },
    });

    if (!activeSub) {
      throw new AppError("Bạn chưa đăng ký gói hội viên nào", 404);
    }

    await activeSub.update({ auto_renew: Boolean(auto_renew) });
    await entitlementService.invalidateUserEntitlements(userId);

    logger.info(`[SubscriptionService] User ${userId} toggled auto_renew -> ${auto_renew}`);
    return activeSub.toJSON();
  },

  /**
   * Hủy Đăng ký gói VIP (Vẫn giữ hiệu lực gói cho đến ngày hết hạn)
   * @param {string} userId
   * @param {string} [reason]
   * @returns {Promise<Object>}
   */
  async cancelSubscription(userId, reason = null) {
    const activeSub = await Subscription.findOne({
      where: { user_id: userId, status: ["active", "grace_period"] },
    });

    if (!activeSub) {
      throw new AppError("Không tìm thấy gói hội viên đang hoạt động", 404);
    }

    await activeSub.update({
      auto_renew: false,
      metadata: {
        ...(activeSub.metadata || {}),
        cancel_requested_at: new Date(),
        cancel_reason: reason || "Người dùng chủ động hủy",
      },
    });

    await entitlementService.invalidateUserEntitlements(userId);

    logger.info(`[SubscriptionService] User ${userId} requested subscription cancellation`);
    return activeSub.toJSON();
  },
};

export default subscriptionService;
