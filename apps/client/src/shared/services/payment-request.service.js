/**
 * @file payment-request.service.js
 * @module Services/PaymentRequestService
 * @description Dịch vụ quản lý Yêu cầu Thanh toán / Nạp rút S-Coin (Member & Admin) kế thừa BaseService, tích hợp Cache Management, Deduplication và Performance Metrics.
 */

import BaseService from "./base.service";
import api from "./api";
import { ENDPOINTS } from "@/shared/constants/api-endpoints.constants";

/**
 * @class PaymentRequestService
 * @extends BaseService
 * @description Xử lý toàn bộ logic gọi API cho hệ thống Hàng đợi Phê duyệt Yêu cầu Thanh toán
 */
class PaymentRequestService extends BaseService {
  constructor() {
    super("PaymentRequestService", {
      enableCache: true,
      enableMetrics: true,
      requestTimeout: 15000,
    });
  }

  // ════════════════════════════════════════════════════════════════
  // ADMIN APIS (QUẢN TRỊ VIÊN HỆ THỐNG)
  // ════════════════════════════════════════════════════════════════

  /**
   * Lấy danh sách yêu cầu thanh toán (phân trang, lọc theo status, type, search)
   * @param {Object} [params={}] { page, limit, search, type, status, sortBy, sortOrder }
   * @returns {Promise<Object>} { items, total, page, limit, meta: { counts } }
   */
  async adminGetPaymentRequests(params = {}) {
    return this._measure("adminGetPaymentRequests", async () => {
      const cleanParams = this._cleanParams(params);
      const response = await api.get(ENDPOINTS.ADMIN_PAYMENT_REQUESTS.LIST, { params: cleanParams });
      return this._extractData(response);
    });
  }

  /**
   * Lấy số liệu thống kê tài chính thời gian thực của yêu cầu thanh toán (Pending count, nạp, rút, hôm nay)
   * @returns {Promise<Object>} Object số liệu KPI
   */
  async adminGetStats() {
    return this._measure("adminGetStats", async () => {
      const response = await api.get(ENDPOINTS.ADMIN_PAYMENT_REQUESTS.STATS);
      return this._extractData(response);
    });
  }

  /**
   * Phê duyệt hoặc Từ chối yêu cầu thanh toán
   * @param {string} id Mã định danh yêu cầu thanh toán
   * @param {Object} payload { status: 'approved' | 'rejected', rejection_reason?: string }
   * @returns {Promise<Object>} Dữ liệu yêu cầu thanh toán sau khi cập nhật
   */
  async adminProcessRequest(id, payload) {
    return this._measure("adminProcessRequest", async () => {
      const response = await api.post(ENDPOINTS.ADMIN_PAYMENT_REQUESTS.PROCESS(id), payload);
      return this._extractData(response);
    });
  }
}

export const paymentRequestService = new PaymentRequestService();
export default paymentRequestService;
