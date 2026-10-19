/**
 * @file wallet.controller.js
 * @module Modules_Wallet_Controllers
 * @description Controller tiếp nhận request ví cá nhân của người dùng.
 */

import { walletService } from "../services/wallet.service.js";
import { responseUtil } from "../../../utils/response.util.js";

/**
 * Lấy thông tin ví cá nhân
 * @route GET /api/v1/wallets/me
 */
export const getMyWallet = async (req, res, next) => {
  try {
    console.log(`[Ctrl][Wallet] GET /wallets/me - User: ${req.user.id}`);
    const wallet = await walletService.getWallet(req.user.id);
    return responseUtil.success(res, wallet, "Lấy thông tin ví tiền thành công");
  } catch (error) {
    next(error);
  }
};

/**
 * Lấy lịch sử giao dịch ví cá nhân
 * @route GET /api/v1/wallets/me/transactions
 */
export const getMyTransactions = async (req, res, next) => {
  try {
    console.log(`[Ctrl][Wallet] GET /wallets/me/transactions - User: ${req.user.id}`);
    const result = await walletService.getTransactionHistory(req.user.id, req.query);
    return responseUtil.paginated(res, {
      items: result.items,
      total: result.total,
      page: result.page,
      limit: result.limit,
      message: "Lấy lịch sử giao dịch thành công",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Yêu cầu rút tiền từ ví
 * @route POST /api/v1/wallets/me/withdraw
 */
export const requestWithdrawal = async (req, res, next) => {
  try {
    console.log(`[Ctrl][Wallet] POST /wallets/me/withdraw - User: ${req.user.id}`);
    const result = await walletService.requestWithdrawal(req.user.id, req.body);
    return responseUtil.success(res, result, "Gửi yêu cầu rút tiền thành công", 201);
  } catch (error) {
    next(error);
  }
};
