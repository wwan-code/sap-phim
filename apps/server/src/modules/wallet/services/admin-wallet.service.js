/**
 * @file admin-wallet.service.js
 * @module Modules_Wallet_Services
 * @description Xử lý nghiệp vụ quản trị Ví tiền cho Admin Dashboard (Xem danh sách, cộng/trừ xu thủ công, khóa/mở khóa ví).
 */

import { Op } from "sequelize";
import { Wallet, WalletTransaction, User, Role, AuditLog, sequelize } from "../../../models/index.js";
import { AppError } from "../../../utils/app-error.js";
import { walletService } from "./wallet.service.js";
import { emitToUser } from "../../../sockets/services/emit.service.js";
import { SOCKET_EVENTS } from "../../../sockets/constants/socket-events.constants.js";
import { logger } from "../../../utils/logger.js";

export const adminWalletService = {
  /**
   * Lấy danh sách ví người dùng kèm phân trang và tìm kiếm
   * @param {Object} query
   * @returns {Promise<Object>}
   */
  async getWalletsAdmin({ page = 1, limit = 20, search, is_locked }) {
    const offset = (page - 1) * limit;
    const where = {};
    const userWhere = {};

    if (is_locked !== undefined && is_locked !== null && is_locked !== "") {
      where.is_locked = is_locked === "true" || is_locked === true;
    }

    if (search) {
      userWhere[Op.or] = [
        { username: { [Op.iLike]: `%${search}%` } },
        { email: { [Op.iLike]: `%${search}%` } },
        { full_name: { [Op.iLike]: `%${search}%` } },
      ];
    }

    const { count, rows } = await Wallet.findAndCountAll({
      where,
      limit,
      offset,
      order: [["updated_at", "DESC"]],
      include: [
        {
          model: User,
          as: "user",
          where: Object.keys(userWhere).length ? userWhere : undefined,
          attributes: ["id", "username", "email", "full_name", "avatar_url"],
          include: [{ model: Role, as: "role", attributes: ["name", "slug"] }],
        },
      ],
    });

    // Thống kê số lượng theo từng tab trạng thái ví (không phụ thuộc filter is_locked hiện tại)
    const countsGroup = await Wallet.findAll({
      attributes: ["is_locked", [sequelize.fn("COUNT", sequelize.col("Wallet.id")), "count"]],
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
      group: ["is_locked"],
      raw: true,
    });

    let activeCount = 0;
    let lockedCount = 0;
    let totalWallets = 0;

    countsGroup.forEach((row) => {
      const c = parseInt(row.count, 10) || 0;
      totalWallets += c;
      if (row.is_locked === true || row.is_locked === "true" || row.is_locked === 1) {
        lockedCount += c;
      } else {
        activeCount += c;
      }
    });

    const counts = {
      all: totalWallets,
      active: activeCount,
      locked: lockedCount,
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
   * Thống kê số dư tài chính & dòng tiền toàn hệ thống cho Admin Dashboard
   * @returns {Promise<Object>}
   */
  async getWalletStatsAdmin() {
    // 1. Thống kê từ bảng wallets
    const walletAgg = await Wallet.findOne({
      attributes: [
        [sequelize.fn("SUM", sequelize.col("balance")), "total_balance"],
        [sequelize.fn("SUM", sequelize.col("hold_balance")), "total_hold_balance"],
        [sequelize.fn("SUM", sequelize.col("total_deposited")), "total_deposited"],
        [sequelize.fn("SUM", sequelize.col("total_spent")), "total_spent"],
        [sequelize.fn("COUNT", sequelize.col("id")), "total_wallets"],
      ],
      raw: true,
    });

    const totalLockedWallets = await Wallet.count({ where: { is_locked: true } });

    // 2. Thống kê nạp tiền hôm nay từ bảng wallet_transactions
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const todayDeposits = await WalletTransaction.findOne({
      attributes: [
        [sequelize.fn("SUM", sequelize.col("amount")), "today_deposited_amount"],
        [sequelize.fn("COUNT", sequelize.col("id")), "today_deposit_count"],
      ],
      where: {
        type: "deposit",
        status: "completed",
        created_at: { [Op.gte]: startOfToday },
      },
      raw: true,
    });

    const totalBalance = parseInt(walletAgg?.total_balance, 10) || 0;
    const totalHoldBalance = parseInt(walletAgg?.total_hold_balance, 10) || 0;
    const totalDeposited = parseInt(walletAgg?.total_deposited, 10) || 0;
    const totalSpent = parseInt(walletAgg?.total_spent, 10) || 0;
    const totalWallets = parseInt(walletAgg?.total_wallets, 10) || 0;
    const todayDepositedAmount = parseInt(todayDeposits?.today_deposited_amount, 10) || 0;
    const todayDepositCount = parseInt(todayDeposits?.today_deposit_count, 10) || 0;

    return {
      total_balance: totalBalance,
      total_balance_vnd: totalBalance * 1000,
      total_hold_balance: totalHoldBalance,
      total_hold_balance_vnd: totalHoldBalance * 1000,
      total_deposited: totalDeposited,
      total_deposited_vnd: totalDeposited * 1000,
      total_spent: totalSpent,
      total_spent_vnd: totalSpent * 1000,
      total_wallets: totalWallets,
      total_locked_wallets: totalLockedWallets,
      today_deposited_amount: todayDepositedAmount,
      today_deposited_vnd: todayDepositedAmount * 1000,
      today_deposit_count: todayDepositCount,
    };
  },

  /**
   * Lấy lịch sử biến động số dư / dòng tiền toàn hệ thống (Phân trang, Lọc theo type, status, search)
   * @param {Object} query
   * @returns {Promise<Object>}
   */
  async getAllTransactionsAdmin({ page = 1, limit = 20, search, type, status, from_date, to_date }) {
    const offset = (page - 1) * limit;
    const where = {};
    const userWhere = {};

    if (type && type !== "all") where.type = type;
    if (status && status !== "all") where.status = status;

    if (from_date || to_date) {
      where.created_at = {};
      if (from_date) where.created_at[Op.gte] = new Date(from_date);
      if (to_date) where.created_at[Op.lte] = new Date(to_date);
    }

    if (search) {
      const searchClean = search.trim();
      userWhere[Op.or] = [
        { username: { [Op.iLike]: `%${searchClean}%` } },
        { email: { [Op.iLike]: `%${searchClean}%` } },
        { full_name: { [Op.iLike]: `%${searchClean}%` } },
      ];
    }

    const { count, rows } = await WalletTransaction.findAndCountAll({
      where,
      limit: Number(limit),
      offset,
      order: [["created_at", "DESC"]],
      include: [
        {
          model: User,
          as: "user",
          where: Object.keys(userWhere).length ? userWhere : undefined,
          attributes: ["id", "username", "email", "full_name", "avatar_url"],
        },
      ],
    });

    // Thống kê counts theo trạng thái giao dịch
    const countsWhere = {};
    if (type && type !== "all") countsWhere.type = type;

    const countsGroup = await WalletTransaction.findAll({
      attributes: ["status", [sequelize.fn("COUNT", sequelize.col("WalletTransaction.id")), "count"]],
      where: countsWhere,
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

    let completedCount = 0;
    let pendingCount = 0;
    let failedCount = 0;
    let cancelledCount = 0;
    let totalAll = 0;

    countsGroup.forEach((row) => {
      const c = parseInt(row.count, 10) || 0;
      totalAll += c;
      if (row.status === "completed") completedCount += c;
      else if (row.status === "pending") pendingCount += c;
      else if (row.status === "failed") failedCount += c;
      else if (row.status === "cancelled") cancelledCount += c;
    });

    const counts = {
      all: totalAll,
      completed: completedCount,
      pending: pendingCount,
      failed: failedCount,
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
   * Lấy lịch sử giao dịch riêng của 1 người dùng cho Admin
   * @param {string} userId
   * @param {Object} query
   * @returns {Promise<Object>}
   */
  async getUserWalletTransactionsAdmin(userId, { page = 1, limit = 20, type } = {}) {
    const offset = (page - 1) * limit;
    const where = { user_id: userId };

    if (type && type !== "all") where.type = type;

    const { count, rows } = await WalletTransaction.findAndCountAll({
      where,
      limit: Number(limit),
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
   * Admin điều chỉnh số dư ví thủ công (Cộng/Trừ xu hoặc Thưởng)
   * @param {string} adminId
   * @param {Object} data
   * @returns {Promise<Object>}
   */
  async adjustBalanceAdmin(adminId, data) {
    const targetUserId = data.userId || data.user_id;
    const amount = Number(data.amount);
    const type = data.type;
    const description = data.description || data.reason || "Admin điều chỉnh số dư";

    const targetUser = await User.findByPk(targetUserId);
    if (!targetUser) throw new AppError("Người dùng mục tiêu không tồn tại", 404);

    const result = await sequelize.transaction(async (t) => {
      // 1. Thực thi biến động số dư
      const { wallet, walletTx } = await walletService.adjustBalanceTransaction({
        userId: targetUserId,
        amount,
        type,
        description: `[Admin Điều Chỉnh] ${description}`,
        referenceType: "admin_action",
        referenceId: adminId,
        performedBy: adminId,
        transaction: t,
      });

      // 2. Ghi Audit Log cho hành động của Admin
      await AuditLog.create(
        {
          user_id: adminId,
          event_type: `admin.wallet.${type}`,
          event_category: "admin",
          severity: "info",
          status: "success",
          description: `Admin ${adminId} adjusted wallet for user ${targetUserId}: ${type} ${amount}`,
          metadata: {
            target_user_id: targetUserId,
            amount,
            type,
            reason: description,
            balance_after: wallet.balance,
          },
        },
        { transaction: t }
      );

      return { wallet, walletTx };
    });

    // Thông báo cho Client qua Socket
    const currentWallet = await walletService.getWallet(targetUserId);
    emitToUser(targetUserId, SOCKET_EVENTS.WALLET_BALANCE_UPDATED, currentWallet);

    logger.info(`[AdminWallet] Admin ${adminId} adjusted wallet ${targetUserId}: ${type} ${amount} S-Coin`);

    return result.wallet.toJSON();
  },

  /**
   * Khóa ví người dùng
   */
  async lockWalletAdmin(adminId, userId, reason) {
    let wallet = await Wallet.findOne({ where: { user_id: userId } });
    if (!wallet) {
      wallet = await Wallet.create({ user_id: userId, balance: 0, is_locked: false });
    }

    if (wallet.is_locked) {
      throw new AppError("Ví tiền của người dùng này đã bị khóa từ trước", 400);
    }

    await wallet.update({
      is_locked: true,
      locked_reason: reason || "Khóa bởi quản trị viên",
      locked_at: new Date(),
      locked_by: adminId,
    });

    emitToUser(userId, SOCKET_EVENTS.WALLET_LOCKED, {
      is_locked: true,
      reason: wallet.locked_reason,
    });

    return wallet.toJSON();
  },

  /**
   * Mở khóa ví người dùng
   */
  async unlockWalletAdmin(adminId, userId) {
    let wallet = await Wallet.findOne({ where: { user_id: userId } });
    if (!wallet) {
      wallet = await Wallet.create({ user_id: userId, balance: 0, is_locked: false });
    }

    if (!wallet.is_locked) {
      throw new AppError("Ví tiền của người dùng hiện không bị khóa", 400);
    }

    await wallet.update({
      is_locked: false,
      locked_reason: null,
      locked_at: null,
      locked_by: null,
    });

    emitToUser(userId, SOCKET_EVENTS.WALLET_LOCKED, {
      is_locked: false,
    });

    return wallet.toJSON();
  },
};

export default adminWalletService;
