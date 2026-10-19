/**
 * @file payment-request.service.js
 * @module Modules_Payment_Services
 * @description Xử lý khởi tạo, hủy và tự động quét hết hạn Yêu cầu Thanh toán (PaymentRequest).
 */

import { Op } from "sequelize";
import { PaymentRequest, User, MembershipPlan, sequelize } from "../../../models/index.js";
import { AppError } from "../../../utils/app-error.js";
import { vietQRAdapter } from "../adapters/vietqr.adapter.js";
import { moMoAdapter } from "../adapters/momo.adapter.js";
import { vnPayAdapter } from "../adapters/vnpay.adapter.js";
import { walletService, LCOIN_VND_RATE } from "../../wallet/services/wallet.service.js";
import { emitToUser } from "../../../sockets/services/emit.service.js";
import { SOCKET_EVENTS } from "../../../sockets/constants/socket-events.constants.js";
import { notifyPaymentRequestPending } from "../../notification/helpers/notification.helper.js";
import { logger } from "../../../utils/logger.js";

// Thời hạn thanh toán mặc định cho Nạp tiền VietQR: 15 phút
export const TOPUP_EXPIRATION_MINUTES = 15;

export const paymentRequestService = {
  /**
   * Lấy Gateway Adapter tương ứng theo tham số gateway
   */
  getAdapter(gateway = "VietQR") {
    switch (gateway) {
      case "MoMo":
        return moMoAdapter;
      case "VNPay":
        return vnPayAdapter;
      case "VietQR":
      default:
        return vietQRAdapter;
    }
  },

  /**
   * Tạo Yêu cầu Nạp tiền (Top-up Payment Request)
   * @param {string} userId
   * @param {Object} data
   * @returns {Promise<Object>}
   */
  async createTopupRequest(userId, { lcoin_amount, gateway = "VietQR", plan_id = null }) {
    const user = await User.findByPk(userId);
    if (!user) throw new AppError("Người dùng không tồn tại", 404);

    const vndAmount = lcoin_amount * LCOIN_VND_RATE;
    const transactionCode = `TP${Date.now().toString(36).toUpperCase()}${Math.floor(100 + Math.random() * 900)}`;
    const expiresAt = new Date(Date.now() + TOPUP_EXPIRATION_MINUTES * 60 * 1000);

    const adapter = this.getAdapter(gateway);
    const paymentInfo = await adapter.createPaymentUrl({
      amount: vndAmount,
      transactionCode,
    });

    let planInfo = null;
    if (plan_id) {
      const plan = await MembershipPlan.findByPk(plan_id);
      if (plan) planInfo = { id: plan.id, name: plan.name };
    }

    const paymentRequest = await PaymentRequest.create({
      type: "topup",
      user_id: userId,
      plan_id: plan_id || null,
      lcoin_amount,
      amount: vndAmount,
      currency: "VND",
      transaction_code: transactionCode,
      status: "pending",
      bank_id: paymentInfo.bank_id || "MB",
      bank_name: paymentInfo.bank_name || "MBBank",
      account_number: paymentInfo.account_number || "9999999999",
      account_holder: paymentInfo.account_holder || "SAP ANIME",
      qr_code_url: paymentInfo.qr_code_url,
      expires_at: expiresAt,
      metadata: {
        gateway,
        plan_info: planInfo,
        pay_url: paymentInfo.pay_url || null,
      },
    });

    // Gửi thông báo cho toàn bộ Admin & Boss trong hệ thống
    notifyPaymentRequestPending({
      userId,
      userName: user.full_name || user.username,
      userEmail: user.email,
      amountVnd: vndAmount,
      transactionCode,
      type: "topup",
      lcoinAmount: lcoin_amount,
    });

    logger.info(`[PaymentService] Top-up request created for user ${userId}: ${lcoin_amount} S-Coin (${transactionCode})`);

    return paymentRequest.toJSON();
  },

  /**
   * Lấy danh sách Payment Requests của người dùng (Có phân trang & lọc).
   * @param {string} userId
   * @param {Object} query
   * @returns {Promise<Object>}
   */
  async getUserPaymentRequests(userId, { page = 1, limit = 20, type, status }) {
    const offset = (page - 1) * limit;
    const where = { user_id: userId };

    if (type) where.type = type;
    if (status) where.status = status;

    // Kiểm tra và cập nhật các request đã hết hạn khi truy vấn
    await this.checkExpiredRequestsForUser(userId);

    const { count, rows } = await PaymentRequest.findAndCountAll({
      where,
      limit,
      offset,
      order: [["created_at", "DESC"]],
      include: [
        {
          model: MembershipPlan,
          as: "plan",
          attributes: ["id", "name", "price_monthly", "price_yearly"],
        },
      ],
    });

    return {
      items: rows,
      total: count,
      page: Number(page),
      limit: Number(limit),
    };
  },

  /**
   * Hủy một Yêu cầu Thanh toán (Nếu chưa bị duyệt hoặc hết hạn).
   * Nếu là yêu cầu Rút tiền (withdrawal), giải phóng hold_balance lại số dư khả dụng.
   * @param {string} userId
   * @param {string} requestId
   * @returns {Promise<Object>}
   */
  async cancelPaymentRequest(userId, requestId) {
    const paymentRequest = await PaymentRequest.findOne({
      where: { id: requestId, user_id: userId },
    });

    if (!paymentRequest) {
      throw new AppError("Yêu cầu thanh toán không tồn tại", 404);
    }

    if (paymentRequest.status !== "pending" && paymentRequest.status !== "created") {
      throw new AppError("Chỉ có thể hủy các yêu cầu thanh toán đang ở trạng thái chờ", 400);
    }

    await sequelize.transaction(async (t) => {
      // Nếu là yêu cầu Rút tiền, hoàn trả S-Coin từ hold_balance về balance
      if (paymentRequest.type === "withdrawal") {
        await walletService.adjustBalanceTransaction({
          userId,
          amount: paymentRequest.lcoin_amount,
          type: "withdrawal_refund",
          description: `Hủy yêu cầu rút tiền #${paymentRequest.transaction_code}`,
          referenceType: "payment_request",
          referenceId: paymentRequest.id,
          transaction: t,
        });
      }

      await paymentRequest.update(
        {
          status: "rejected",
          rejection_reason: "Người dùng chủ động hủy yêu cầu",
        },
        { transaction: t }
      );
    });

    // Thông báo WebSocket
    const currentWallet = await walletService.getWallet(userId);
    emitToUser(userId, SOCKET_EVENTS.WALLET_BALANCE_UPDATED, currentWallet);
    emitToUser(userId, SOCKET_EVENTS.PAYMENT_STATUS_CHANGED, {
      payment_request_id: requestId,
      status: "rejected",
      reason: "cancelled_by_user",
    });

    return paymentRequest.toJSON();
  },

  /**
   * Quét và tự động chuyển status = 'expired' cho các PaymentRequest nạp tiền quá hạn
   */
  async checkExpiredRequestsForUser(userId) {
    const expiredList = await PaymentRequest.findAll({
      where: {
        user_id: userId,
        status: { [Op.in]: ["created", "pending"] },
        type: "topup",
        expires_at: { [Op.lt]: new Date() },
      },
    });

    for (const pr of expiredList) {
      await pr.update({ status: "expired" });
      emitToUser(userId, SOCKET_EVENTS.PAYMENT_EXPIRED, {
        payment_request_id: pr.id,
        transaction_code: pr.transaction_code,
      });
    }
  },
};

export default paymentRequestService;
