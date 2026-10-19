/**
 * @file wallet.service.js
 * @module Services/WalletService
 * @description Dịch vụ quản lý Ví & Dòng tiền S-Coin (Member & Admin) kế thừa BaseService, tích hợp Cache Management, Deduplication và Performance Metrics.
 */

import BaseService from "./base.service";
import api from "./api";
import { ENDPOINTS } from "@/shared/constants/api-endpoints.constants";

/**
 * @class WalletService
 * @extends BaseService
 * @description Xử lý toàn bộ logic gọi API cho hệ thống Ví & Dòng Tiền S-Coin
 */
class WalletService extends BaseService {
  constructor() {
    super("WalletService", {
      enableCache: true,
      enableMetrics: true,
      requestTimeout: 15000,
    });
  }

  // ════════════════════════════════════════════════════════════════
  // ADMIN APIS (QUẢN TRỊ VIÊN HỆ THỐNG)
  // ════════════════════════════════════════════════════════════════

  /**
   * Lấy danh sách ví người dùng (phân trang, lọc theo trạng thái khóa, tìm kiếm)
   * @param {Object} [params={}] { page, limit, search, is_locked, sortBy, sortOrder }
   * @returns {Promise<Object>} { items, total, page, limit, meta: { counts } }
   */
  async adminGetWallets(params = {}) {
    return this._measure("adminGetWallets", async () => {
      const cleanParams = this._cleanParams(params);
      const response = await api.get(ENDPOINTS.ADMIN_WALLETS.LIST, { params: cleanParams });
      return this._extractData(response);
    });
  }

  /**
   * Lấy số liệu thống kê tài chính tổng quan (Tổng số dư, Tổng nạp, Chi tiêu, Số ví khóa)
   * @returns {Promise<Object>} Object số liệu KPI
   */
  async adminGetStats() {
    return this._measure("adminGetStats", async () => {
      const response = await api.get(ENDPOINTS.ADMIN_WALLETS.STATS);
      return this._extractData(response);
    });
  }

  /**
   * Lấy lịch sử giao dịch dòng tiền toàn hệ thống (phân trang, lọc theo type, status, search)
   * @param {Object} [params={}] { page, limit, search, type, status, sortBy, sortOrder }
   * @returns {Promise<Object>} { items, total, page, limit, meta: { counts } }
   */
  async adminGetTransactions(params = {}) {
    return this._measure("adminGetTransactions", async () => {
      const cleanParams = this._cleanParams(params);
      const response = await api.get(ENDPOINTS.ADMIN_WALLETS.TRANSACTIONS, { params: cleanParams });
      return this._extractData(response);
    });
  }

  /**
   * Lấy lịch sử giao dịch riêng biệt của 1 ví người dùng
   * @param {string} userId - UUID người dùng
   * @param {Object} [params={}] { page, limit, type, status }
   * @returns {Promise<Object>} { items, total, page, limit }
   */
  async adminGetUserTransactions(userId, params = {}) {
    this._validateId(userId, "người dùng");
    return this._measure("adminGetUserTransactions", async () => {
      const cleanParams = this._cleanParams(params);
      const response = await api.get(ENDPOINTS.ADMIN_WALLETS.USER_TRANSACTIONS(userId), { params: cleanParams });
      return this._extractData(response);
    });
  }

  /**
   * Admin điều chỉnh số dư S-Coin thủ công (Cộng xu, Trừ xu, Tặng thưởng)
   * @param {Object} data { user_id / userId, amount, type, reason }
   * @returns {Promise<Object>} Ví sau khi điều chỉnh
   */
  async adminAdjustBalance(data) {
    return this._measure("adminAdjustBalance", async () => {
      const response = await api.post(ENDPOINTS.ADMIN_WALLETS.ADJUST, data);
      return this._extractData(response);
    });
  }

  /**
   * Admin khóa ví người dùng
   * @param {string} userId - UUID người dùng
   * @param {Object} data { reason: string }
   * @returns {Promise<Object>} Ví sau khi khóa
   */
  async adminLockWallet(userId, data) {
    this._validateId(userId, "người dùng");
    return this._measure("adminLockWallet", async () => {
      const response = await api.post(ENDPOINTS.ADMIN_WALLETS.LOCK(userId), data);
      return this._extractData(response);
    });
  }

  /**
   * Admin mở khóa ví người dùng
   * @param {string} userId - UUID người dùng
   * @returns {Promise<Object>} Ví sau khi mở khóa
   */
  async adminUnlockWallet(userId) {
    this._validateId(userId, "người dùng");
    return this._measure("adminUnlockWallet", async () => {
      const response = await api.post(ENDPOINTS.ADMIN_WALLETS.UNLOCK(userId));
      return this._extractData(response);
    });
  }
}

export const walletService = new WalletService();
export default walletService;
