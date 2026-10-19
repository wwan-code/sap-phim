/**
 * @file admin-wallet.controller.js
 * @module Modules_Wallet_Controllers
 * @description Controller quản trị ví tiền cho Admin Dashboard.
 */

import { adminWalletService } from "../services/admin-wallet.service.js";
import { responseUtil } from "../../../utils/response.util.js";

/**
 * Lấy danh sách ví người dùng (Admin)
 * @route GET /api/v1/admin/wallets
 */
export const getWalletsAdmin = async (req, res, next) => {
  try {
    console.log(`[Ctrl][AdminWallet] GET /admin/wallets`);
    const result = await adminWalletService.getWalletsAdmin(req.query);
    return responseUtil.paginated(res, {
      items: result.items,
      total: result.total,
      page: result.page,
      limit: result.limit,
      message: "Lấy danh sách ví người dùng thành công",
      meta: { counts: result.counts },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin nạp/trừ S-Coin ví người dùng thủ công
 * @route POST /api/v1/admin/wallets/adjust
 */
export const adjustBalanceAdmin = async (req, res, next) => {
  try {
    console.log(`[Ctrl][AdminWallet] POST /admin/wallets/adjust - Admin: ${req.user.id}`);
    const wallet = await adminWalletService.adjustBalanceAdmin(req.user.id, req.body);
    return responseUtil.success(res, wallet, "Điều chỉnh số dư ví thành công");
  } catch (error) {
    next(error);
  }
};

/**
 * Khóa ví người dùng
 * @route POST /api/v1/admin/wallets/:userId/lock
 */
export const lockWalletAdmin = async (req, res, next) => {
  try {
    console.log(`[Ctrl][AdminWallet] POST /admin/wallets/${req.params.userId}/lock`);
    const wallet = await adminWalletService.lockWalletAdmin(req.user.id, req.params.userId, req.body.reason);
    return responseUtil.success(res, wallet, "Khóa ví người dùng thành công");
  } catch (error) {
    next(error);
  }
};

/**
 * Mở khóa ví người dùng
 * @route POST /api/v1/admin/wallets/:userId/unlock
 */
export const unlockWalletAdmin = async (req, res, next) => {
  try {
    console.log(`[Ctrl][AdminWallet] POST /admin/wallets/${req.params.userId}/unlock`);
    const wallet = await adminWalletService.unlockWalletAdmin(req.user.id, req.params.userId);
    return responseUtil.success(res, wallet, "Mở khóa ví người dùng thành công");
  } catch (error) {
    next(error);
  }
};

/**
 * Thống kê tổng quan số dư tài chính và ví toàn hệ thống
 * @route GET /api/v1/admin/wallets/stats
 */
export const getWalletStatsAdmin = async (req, res, next) => {
  try {
    console.log(`[Ctrl][AdminWallet] GET /admin/wallets/stats`);
    const stats = await adminWalletService.getWalletStatsAdmin();
    return responseUtil.success(res, stats, "Lấy thống kê ví hệ thống thành công");
  } catch (error) {
    next(error);
  }
};

/**
 * Lấy lịch sử giao dịch dòng tiền toàn hệ thống (Phân trang & Lọc)
 * @route GET /api/v1/admin/wallets/transactions
 */
export const getAllTransactionsAdmin = async (req, res, next) => {
  try {
    console.log(`[Ctrl][AdminWallet] GET /admin/wallets/transactions`);
    const result = await adminWalletService.getAllTransactionsAdmin(req.query);
    return responseUtil.paginated(res, {
      items: result.items,
      total: result.total,
      page: result.page,
      limit: result.limit,
      message: "Lấy lịch sử giao dịch toàn hệ thống thành công",
      meta: { counts: result.counts },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Lấy lịch sử giao dịch riêng của 1 người dùng
 * @route GET /api/v1/admin/wallets/:userId/transactions
 */
export const getUserWalletTransactionsAdmin = async (req, res, next) => {
  try {
    console.log(`[Ctrl][AdminWallet] GET /admin/wallets/${req.params.userId}/transactions`);
    const result = await adminWalletService.getUserWalletTransactionsAdmin(req.params.userId, req.query);
    return responseUtil.paginated(res, {
      items: result.items,
      total: result.total,
      page: result.page,
      limit: result.limit,
      message: "Lấy lịch sử giao dịch người dùng thành công",
    });
  } catch (error) {
    next(error);
  }
};
