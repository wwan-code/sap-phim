/**
 * @file admin-payment-request.service.js
 * @module Modules_Payment_Services
 * @description Xử lý duyệt hoặc từ chối Yêu cầu Nạp/Rút tiền (PaymentRequest) cho Admin.
 */

import { Op } from "sequelize";
import { PaymentRequest, User, MembershipPlan, AuditLog, sequelize } from "../../../models/index.js";
import { AppError } from "../../../utils/app-error.js";
import { walletService } from "../../wallet/services/wallet.service.js";
import { emitToUser } from "../../../sockets/services/emit.service.js";
import { SOCKET_EVENTS } from "../../../sockets/constants/socket-events.constants.js";
import { notifyPaymentApproved, notifyPaymentRejected } from "../../notification/helpers/notification.helper.js";
import { logger } from "../../../utils/logger.js";

export const adminPaymentRequestService = {
  /**
   * Lấy danh sách Yêu cầu Thanh toán (Phân trang & Lọc cho Admin)
   * @param {Object} query
   * @returns {Promise<Object>}
   */
  async getPaymentRequestsAdmin({ page = 1, limit = 20, search, type, status }) {
    const offset = (page - 1) * limit;
    const where = {};
    const userWhere = {};

    if (type) where.type = type;
    if (status) where.status = status;

    if (search) {
      where[Op.or] = [
        { transaction_code: { [Op.iLike]: `%${search}%` } },
        { account_number: { [Op.iLike]: `%${search}%` } },
        { account_holder: { [Op.iLike]: `%${search}%` } },
      ];
    }

    const { count, rows } = await PaymentRequest.findAndCountAll({
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
          model: User,
          as: "approver",
          attributes: ["id", "username", "email", "full_name"],
        },
        {
          model: MembershipPlan,
          as: "plan",
          attributes: ["id", "name", "price_monthly", "price_yearly"],
        },
      ],
    });

    // Thống kê số lượng theo từng tab trạng thái (không phụ thuộc filter status hiện tại)
    const countsWhere = {};
    if (type) countsWhere.type = type;
    if (search) {
      countsWhere[Op.or] = [
        { transaction_code: { [Op.iLike]: `%${search}%` } },
        { account_number: { [Op.iLike]: `%${search}%` } },
        { account_holder: { [Op.iLike]: `%${search}%` } },
      ];
    }

    const statusCountsGroup = await PaymentRequest.findAll({
      where: countsWhere,
      attributes: ["status", [sequelize.fn("COUNT", sequelize.col("id")), "count"]],
      group: ["status"],
      raw: true,
    });

    let pendingCount = 0;
    let approvedCount = 0;
    let rejectedCount = 0;
    let expiredCount = 0;
    let totalAllCount = 0;

    statusCountsGroup.forEach((row) => {
      const c = parseInt(row.count, 10) || 0;
      totalAllCount += c;
      if (row.status === "pending" || row.status === "created") {
        pendingCount += c;
      } else if (row.status === "approved") {
        approvedCount += c;
      } else if (row.status === "rejected" || row.status === "cancelled") {
        rejectedCount += c;
      } else if (row.status === "expired") {
        expiredCount += c;
      }
    });

    const counts = {
      all: totalAllCount,
      pending: pendingCount,
      approved: approvedCount,
      rejected: rejectedCount,
      expired: expiredCount,
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
   * Thống kê tài chính Yêu cầu Thanh toán cho Admin Dashboard
   * @returns {Promise<Object>}
   */
  async getPaymentRequestStatsAdmin() {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    // 1. Thống kê theo trạng thái và loại
    const statsAgg = await PaymentRequest.findAll({
      attributes: [
        "type",
        "status",
        [sequelize.fn("COUNT", sequelize.col("id")), "count"],
        [sequelize.fn("SUM", sequelize.col("amount")), "total_amount"],
        [sequelize.fn("SUM", sequelize.col("lcoin_amount")), "total_lcoin"],
      ],
      group: ["type", "status"],
      raw: true,
    });

    let pendingCount = 0;
    let pendingTopupAmount = 0;
    let pendingTopupCoin = 0;
    let pendingWithdrawalAmount = 0;
    let pendingWithdrawalCoin = 0;
    let totalAllCount = 0;

    statsAgg.forEach((row) => {
      const c = parseInt(row.count, 10) || 0;
      const amt = parseFloat(row.total_amount) || 0;
      const coin = parseInt(row.total_lcoin, 10) || 0;
      totalAllCount += c;

      if (row.status === "pending" || row.status === "created") {
        pendingCount += c;
        if (row.type === "topup") {
          pendingTopupAmount += amt;
          pendingTopupCoin += coin;
        } else if (row.type === "withdrawal") {
          pendingWithdrawalAmount += amt;
          pendingWithdrawalCoin += coin;
        }
      }
    });

    // 2. Thống kê đã xử lý hôm nay
    const todayApproved = await PaymentRequest.findOne({
      attributes: [
        [sequelize.fn("COUNT", sequelize.col("id")), "count"],
        [sequelize.fn("SUM", sequelize.col("amount")), "total_amount"],
      ],
      where: {
        status: "approved",
        approved_at: { [Op.gte]: startOfToday },
      },
      raw: true,
    });

    const todayApprovedCount = parseInt(todayApproved?.count, 10) || 0;
    const todayApprovedAmount = parseFloat(todayApproved?.total_amount) || 0;

    return {
      pending_count: pendingCount,
      pending_topup_amount: pendingTopupAmount,
      pending_topup_coin: pendingTopupCoin,
      pending_withdrawal_amount: pendingWithdrawalAmount,
      pending_withdrawal_coin: pendingWithdrawalCoin,
      today_approved_count: todayApprovedCount,
      today_approved_amount: todayApprovedAmount,
      total_requests: totalAllCount,
    };
  },

  /**
   * Phê duyệt hoặc Từ chối Yêu cầu Nạp/Rút tiền
   * @param {string} adminId
   * @param {string} requestId
   * @param {Object} data
   * @param {string} data.status - 'approved' hoặc 'rejected'
   * @param {string} [data.rejection_reason]
   * @returns {Promise<Object>}
   */
  async processPaymentRequestAdmin(adminId, requestId, { status, rejection_reason = null }) {
    const paymentRequest = await PaymentRequest.findByPk(requestId, {
      include: [{ model: User, as: "user" }],
    });

    if (!paymentRequest) {
      throw new AppError("Yêu cầu thanh toán không tồn tại", 404);
    }

    if (paymentRequest.status !== "pending" && paymentRequest.status !== "created") {
      throw new AppError(`Yêu cầu thanh toán đã được xử lý trước đó (Trạng thái: ${paymentRequest.status})`, 400);
    }

    const userId = paymentRequest.user_id;

    await sequelize.transaction(async (t) => {
      if (status === "approved") {
        if (paymentRequest.type === "topup") {
          // NẠP TIỀN: Cộng S-Coin vào số dư ví khả dụng
          await walletService.adjustBalanceTransaction({
            userId,
            amount: paymentRequest.lcoin_amount,
            type: "deposit",
            description: `Duyệt nạp ${paymentRequest.lcoin_amount} S-Coin (Mã CK: ${paymentRequest.transaction_code})`,
            referenceType: "payment_request",
            referenceId: paymentRequest.id,
            vndAmount: paymentRequest.amount,
            performedBy: adminId,
            transaction: t,
          });
        } else if (paymentRequest.type === "withdrawal") {
          // RÚT TIỀN: Hoàn tất rút -> Trừ số S-Coin ở hold_balance
          await walletService.adjustBalanceTransaction({
            userId,
            amount: paymentRequest.lcoin_amount,
            type: "withdrawal_complete",
            description: `Hoàn tất chuyển khoản rút ${paymentRequest.lcoin_amount} S-Coin về TK ${paymentRequest.bank_id} - ${paymentRequest.account_number}`,
            referenceType: "payment_request",
            referenceId: paymentRequest.id,
            vndAmount: paymentRequest.amount,
            performedBy: adminId,
            transaction: t,
          });
        }
      } else if (status === "rejected") {
        if (paymentRequest.type === "withdrawal") {
          // RÚT TIỀN BỊ TỪ CHỐI: Giải phóng hold_balance về balance khả dụng
          await walletService.adjustBalanceTransaction({
            userId,
            amount: paymentRequest.lcoin_amount,
            type: "withdrawal_refund",
            description: `Từ chối rút tiền (${rejection_reason || "Không hợp lệ"}) - Hoàn trả ${paymentRequest.lcoin_amount} S-Coin`,
            referenceType: "payment_request",
            referenceId: paymentRequest.id,
            performedBy: adminId,
            transaction: t,
          });
        }
      }

      // Cập nhật trạng thái PaymentRequest
      await paymentRequest.update(
        {
          status,
          approved_by: adminId,
          approved_at: new Date(),
          rejection_reason: status === "rejected" ? rejection_reason : null,
        },
        { transaction: t }
      );

      // Ghi Audit Log cho Admin
      await AuditLog.create(
        {
          user_id: adminId,
          event_type: `admin.payment_request.${status}`,
          event_category: "admin",
          severity: "info",
          status: "success",
          description: `Admin ${adminId} ${status} payment request ${paymentRequest.id}`,
          metadata: {
            request_id: paymentRequest.id,
            request_type: paymentRequest.type,
            target_user_id: userId,
            lcoin_amount: paymentRequest.lcoin_amount,
            amount: paymentRequest.amount,
            status,
            rejection_reason,
          },
        },
        { transaction: t }
      );
    });

    // Thông báo Realtime cho Người dùng qua Socket
    const currentWallet = await walletService.getWallet(userId);
    emitToUser(userId, SOCKET_EVENTS.WALLET_BALANCE_UPDATED, currentWallet);
    emitToUser(userId, SOCKET_EVENTS.PAYMENT_STATUS_CHANGED, {
      payment_request_id: requestId,
      type: paymentRequest.type,
      status,
      lcoin_amount: paymentRequest.lcoin_amount,
      rejection_reason,
    });

    // Tạo bản ghi Notification lưu DB & đẩy vào Hộp thư thông báo của Người dùng
    if (status === "approved") {
      notifyPaymentApproved({
        userId,
        adminId,
        paymentRequestId: requestId,
        type: paymentRequest.type,
        lcoinAmount: paymentRequest.lcoin_amount,
        amountVnd: paymentRequest.amount,
      });
    } else if (status === "rejected") {
      notifyPaymentRejected({
        userId,
        adminId,
        paymentRequestId: requestId,
        type: paymentRequest.type,
        lcoinAmount: paymentRequest.lcoin_amount,
        amountVnd: paymentRequest.amount,
        rejectionReason: rejection_reason,
      });
    }

    logger.info(`[AdminPayment] Admin ${adminId} processed request ${requestId} (${paymentRequest.type}) -> ${status}`);

    return paymentRequest.toJSON();
  },
};

export default adminPaymentRequestService;
