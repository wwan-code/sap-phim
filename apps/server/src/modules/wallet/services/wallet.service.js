/**
 * @file wallet.service.js
 * @module Modules_Wallet_Services
 * @description Xử lý nghiệp vụ lõi về Ví tiền, Số dư, Lịch sử giao dịch và Yêu cầu Rút tiền.
 */

import { Op } from "sequelize";
import { v4 as uuidv4 } from "uuid";
import { Wallet, WalletTransaction, PaymentRequest, User, sequelize } from "../../../models/index.js";
import { AppError } from "../../../utils/app-error.js";
import { emitToUser } from "../../../sockets/services/emit.service.js";
import { SOCKET_EVENTS } from "../../../sockets/constants/socket-events.constants.js";
import { notifyPaymentRequestPending } from "../../notification/helpers/notification.helper.js";
import { logger } from "../../../utils/logger.js";

// Quy đổi cố định: 1 S-Coin = 1,000 VND
export const LCOIN_VND_RATE = 1000;

export const walletService = {
  /**
   * Lấy thông tin ví của người dùng. Tự động khởi tạo ví mới nếu chưa tồn tại.
   * @param {string} userId
   * @returns {Promise<Object>}
   */
  async getWallet(userId) {
    let wallet = await Wallet.findOne({ where: { user_id: userId } });
    if (!wallet) {
      wallet = await Wallet.create({
        user_id: userId,
        balance: 0,
        hold_balance: 0,
        is_locked: false,
      });
    }

    const plain = wallet.toJSON();
    plain.vnd_equivalent = (plain.balance || 0) * LCOIN_VND_RATE;
    plain.vnd_hold_equivalent = (plain.hold_balance || 0) * LCOIN_VND_RATE;
    return plain;
  },

  /**
   * Lấy lịch sử biến động số dư ví (Phân trang, lọc theo type/status/date).
   * @param {string} userId
   * @param {Object} query
   * @returns {Promise<Object>}
   */
  async getTransactionHistory(userId, { page = 1, limit = 20, type, status, from_date, to_date }) {
    const offset = (page - 1) * limit;
    const where = { user_id: userId };

    if (type) where.type = type;
    if (status) where.status = status;

    if (from_date || to_date) {
      where.created_at = {};
      if (from_date) where.created_at[Op.gte] = new Date(from_date);
      if (to_date) where.created_at[Op.lte] = new Date(to_date);
    }

    const { count, rows } = await WalletTransaction.findAndCountAll({
      where,
      limit,
      offset,
      order: [["created_at", "DESC"]],
    });

    return {
      items: rows,
      total: count,
      page: Number(page),
      limit: Number(limit),
    };
  },

  /**
   * [INTERNAL ACID CORE] Thực thi cộng/trừ số dư hoặc hold số dư trong Database Transaction với Pessimistic Locking.
   * @param {Object} params
   * @param {string} params.userId
   * @param {number} params.amount - Số S-Coin biến động (Dương hoặc Âm)
   * @param {string} params.type - Loại giao dịch
   * @param {string} [params.description]
   * @param {string} [params.referenceType]
   * @param {string} [params.referenceId]
   * @param {number} [params.vndAmount]
   * @param {string} [params.performedBy]
   * @param {boolean} [params.affectHoldBalance=false] - Nếu true, số S-Coin được chuyển sang/từ hold_balance
   * @param {Object} params.transaction - Sequelize Transaction (bắt buộc)
   */
  async adjustBalanceTransaction({
    userId,
    amount,
    type,
    description = "",
    referenceType = null,
    referenceId = null,
    vndAmount = null,
    performedBy = null,
    affectHoldBalance = false,
    transaction,
  }) {
    if (!transaction) {
      throw new AppError("Lỗi hệ thống: Transaction là bắt buộc khi biến động số dư", 500);
    }

    // Row-level locking để ngăn chặn Race Condition / Double Spending
    const wallet = await Wallet.findOne({
      where: { user_id: userId },
      lock: transaction.LOCK.UPDATE,
      transaction,
    });

    if (!wallet) {
      throw new AppError("Ví người dùng không tồn tại", 404);
    }

    if (wallet.is_locked) {
      throw new AppError(`Ví hiện đang bị khóa: ${wallet.locked_reason || "Chờ xử lý từ quản trị viên"}`, 400);
    }

    const balanceBefore = wallet.balance;
    const holdBefore = wallet.hold_balance;

    let newBalance = wallet.balance;
    let newHoldBalance = wallet.hold_balance;
    let totalDeposited = wallet.total_deposited;
    let totalSpent = wallet.total_spent;
    let totalReceived = wallet.total_received;
    let totalWithdrawn = wallet.total_withdrawn;

    // Xử lý các loại biến động số dư
    switch (type) {
      case "deposit":
      case "admin_credit":
      case "bonus":
      case "refund":
        newBalance += amount;
        if (type === "deposit") totalDeposited += amount;
        if (type === "bonus" || type === "refund") totalReceived += amount;
        break;

      case "purchase":
      case "admin_debit":
        if (wallet.balance < Math.abs(amount)) {
          throw new AppError("Số dư S-Coin khả dụng không đủ để thực hiện giao dịch", 400);
        }
        newBalance -= Math.abs(amount);
        totalSpent += Math.abs(amount);
        break;

      case "withdrawal_hold":
        // Tạm giữ S-Coin để rút tiền: balance giảm, hold_balance tăng
        if (wallet.balance < Math.abs(amount)) {
          throw new AppError("Số dư S-Coin khả dụng không đủ để tạo yêu cầu rút tiền", 400);
        }
        newBalance -= Math.abs(amount);
        newHoldBalance += Math.abs(amount);
        break;

      case "withdrawal_complete":
        // Hoàn tất rút tiền: hold_balance giảm, cộng vào total_withdrawn
        if (wallet.hold_balance < Math.abs(amount)) {
          throw new AppError("Số dư tạm giữ không đủ để hoàn tất rút tiền", 400);
        }
        newHoldBalance -= Math.abs(amount);
        totalWithdrawn += Math.abs(amount);
        break;

      case "withdrawal_refund":
        // Từ chối rút tiền: hold_balance giảm, balance tăng lại
        if (wallet.hold_balance < Math.abs(amount)) {
          throw new AppError("Số dư tạm giữ không đủ để hoàn trả", 400);
        }
        newHoldBalance -= Math.abs(amount);
        newBalance += Math.abs(amount);
        break;

      default:
        throw new AppError(`Loại giao dịch '${type}' không hợp lệ`, 400);
    }

    if (newBalance < 0 || newHoldBalance < 0) {
      throw new AppError("Giao dịch bị từ chối: Số dư ví không được âm", 400);
    }

    // Cập nhật Wallet Record
    await wallet.update(
      {
        balance: newBalance,
        hold_balance: newHoldBalance,
        total_deposited: totalDeposited,
        total_spent: totalSpent,
        total_received: totalReceived,
        total_withdrawn: totalWithdrawn,
      },
      { transaction }
    );

    // Ghi nhật ký Giao dịch (WalletTransaction)
    const walletTx = await WalletTransaction.create(
      {
        wallet_id: wallet.id,
        user_id: userId,
        type,
        amount,
        balance_before: balanceBefore,
        balance_after: newBalance,
        hold_balance_before: holdBefore,
        hold_balance_after: newHoldBalance,
        status: "completed",
        description,
        reference_type: referenceType,
        reference_id: referenceId,
        vnd_amount: vndAmount || Math.abs(amount) * LCOIN_VND_RATE,
        performed_by: performedBy,
      },
      { transaction }
    );

    return { wallet, walletTx };
  },

  /**
   * Tạo Yêu cầu Rút tiền (Withdrawal Request). Số S-Coin được tạm giữ (hold_balance).
   * @param {string} userId
   * @param {Object} data
   * @returns {Promise<Object>}
   */
  async requestWithdrawal(userId, { lcoin_amount, bank_id, bank_name, account_number, account_holder }) {
    const vndAmount = lcoin_amount * LCOIN_VND_RATE;
    const transactionCode = `WD${Date.now().toString(36).toUpperCase()}${Math.floor(100 + Math.random() * 900)}`;

    const result = await sequelize.transaction(async (t) => {
      // 1. Tạm giữ số dư S-Coin trong Ví
      const { walletTx } = await this.adjustBalanceTransaction({
        userId,
        amount: lcoin_amount,
        type: "withdrawal_hold",
        description: `Tạo yêu cầu rút ${lcoin_amount} S-Coin (${vndAmount.toLocaleString("vi-VN")} VND) về TK ${bank_id} - ${account_number}`,
        referenceType: "payment_request",
        transaction: t,
      });

      // 2. Tạo PaymentRequest loại 'withdrawal'
      const paymentRequest = await PaymentRequest.create(
        {
          type: "withdrawal",
          user_id: userId,
          lcoin_amount,
          amount: vndAmount,
          currency: "VND",
          transaction_code: transactionCode,
          status: "pending",
          bank_id,
          bank_name,
          account_number,
          account_holder,
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Yêu cầu rút chờ duyệt trong 7 ngày
          metadata: { wallet_transaction_id: walletTx.id },
        },
        { transaction: t }
      );

      // Cập nhật reference_id cho walletTx
      await walletTx.update({ reference_id: paymentRequest.id }, { transaction: t });

      return { paymentRequest, walletTx };
    });

    // Thông báo cho Client qua Socket
    const currentWallet = await this.getWallet(userId);
    emitToUser(userId, SOCKET_EVENTS.WALLET_BALANCE_UPDATED, currentWallet);

    // Gửi thông báo cho toàn bộ Admin & Boss trong hệ thống
    const user = await User.findByPk(userId);
    notifyPaymentRequestPending({
      userId,
      userName: user?.full_name || user?.username,
      userEmail: user?.email,
      amountVnd: vndAmount,
      transactionCode,
      type: "withdrawal",
      lcoinAmount: lcoin_amount,
    });

    logger.info(`[WalletService] User ${userId} requested withdrawal ${lcoin_amount} S-Coin (Code: ${transactionCode})`);

    return result.paymentRequest.toJSON();
  },
};

export default walletService;
