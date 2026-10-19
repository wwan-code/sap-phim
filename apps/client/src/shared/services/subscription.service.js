/**
 * @file subscription.service.js
 * @module Services/SubscriptionService
 * @description Dịch vụ quản lý Gói hội viên & Thuê bao VIP (Member & Admin) kế thừa BaseService, tích hợp Cache Management, Deduplication và Performance Metrics.
 */

import BaseService from "./base.service";
import api from "./api";
import { ENDPOINTS } from "@/shared/constants/api-endpoints.constants";

/**
 * @class SubscriptionService
 * @extends BaseService
 * @description Xử lý toàn bộ logic gọi API cho hệ thống Subscriptions và Membership Plans
 */
class SubscriptionService extends BaseService {
  constructor() {
    super("SubscriptionService", {
      enableCache: true,
      enableMetrics: true,
      requestTimeout: 15000,
    });
  }

  // ════════════════════════════════════════════════════════════════
  // 1. MEMBER APIS (DÀNH CHO NGƯỜI DÙNG CÁ NHÂN)
  // ════════════════════════════════════════════════════════════════

  /**
   * Lấy danh sách gói hội viên công khai đang mở bán
   * @returns {Promise<Array>} Danh sách các gói hội viên
   */
  async getActivePlans() {
    return this._measure("getActivePlans", async () => {
      const response = await api.get(ENDPOINTS.MEMBERSHIP_PLANS.LIST);
      return this._extractData(response);
    });
  }

  /**
   * Lấy gói đăng ký VIP đang hoạt động của người dùng hiện tại
   * @returns {Promise<Object|null>} Thông tin gói đang hoạt động hoặc null
   */
  async getActiveSubscription() {
    return this._measure("getActiveSubscription", async () => {
      const response = await api.get(ENDPOINTS.SUBSCRIPTIONS.ACTIVE);
      return this._extractData(response);
    });
  }

  /**
   * Lấy danh sách đặc quyền (Dynamic Entitlements: 4K, Offline, Số thiết bị...) của user
   * @returns {Promise<Object>} Object chứa các quyền lợi
   */
  async getMyEntitlements() {
    return this._measure("getMyEntitlements", async () => {
      const response = await api.get(ENDPOINTS.SUBSCRIPTIONS.ENTITLEMENTS);
      return this._extractData(response);
    });
  }

  /**
   * Lấy lịch sử đăng ký / gia hạn gói của người dùng
   * @param {Object} [params={}] { page, limit, status }
   * @returns {Promise<Object>} { items, total, page, limit }
   */
  async getSubscriptionHistory(params = {}) {
    return this._measure("getSubscriptionHistory", async () => {
      const cleanParams = this._cleanParams(params);
      const response = await api.get(ENDPOINTS.SUBSCRIPTIONS.HISTORY, { params: cleanParams });
      return this._extractData(response);
    });
  }

  /**
   * Xem trước tính toán khấu trừ Proration khi nâng cấp gói
   * @param {Object} params { plan_id: string, billing_cycle: string }
   * @returns {Promise<Object>} Chi tiết khấu trừ và số tiền thực trả
   */
  async previewProration(params = {}) {
    return this._measure("previewProration", async () => {
      const cleanParams = this._cleanParams(params);
      const response = await api.get(ENDPOINTS.SUBSCRIPTIONS.PRORATION_PREVIEW, { params: cleanParams });
      return this._extractData(response);
    });
  }

  /**
   * Đăng ký mới hoặc nâng cấp gói hội viên bằng Ví S-Coin
   * @param {Object} data { plan_id: string, billing_cycle: string, auto_renew?: boolean }
   * @returns {Promise<Object>} Thông tin gói vừa đăng ký
   */
  async subscribe(data) {
    return this._measure("subscribe", async () => {
      const response = await api.post(ENDPOINTS.SUBSCRIPTIONS.SUBSCRIBE, data);
      return this._extractData(response);
    });
  }

  /**
   * Bật hoặc Tắt tự động gia hạn gói VIP
   * @param {Object} data { auto_renew: boolean }
   * @returns {Promise<Object>} Kết quả cập nhật
   */
  async toggleAutoRenew(data) {
    return this._measure("toggleAutoRenew", async () => {
      const response = await api.patch(ENDPOINTS.SUBSCRIPTIONS.AUTO_RENEW, data);
      return this._extractData(response);
    });
  }

  /**
   * Hủy gói hội viên đang hoạt động
   * @param {Object} [data={}] { reason?: string, immediate?: boolean }
   * @returns {Promise<Object>} Kết quả hủy gói
   */
  async cancelSubscription(data = {}) {
    return this._measure("cancelSubscription", async () => {
      const response = await api.post(ENDPOINTS.SUBSCRIPTIONS.CANCEL, data);
      return this._extractData(response);
    });
  }

  // ════════════════════════════════════════════════════════════════
  // 2. ADMIN APIS (QUẢN TRỊ VIÊN HỆ THỐNG)
  // ════════════════════════════════════════════════════════════════

  /**
   * Lấy danh sách thuê bao VIP toàn hệ thống (hỗ trợ lọc theo status, plan_id, user_id, search, sort)
   * @param {Object} [params={}] Query params
   * @returns {Promise<Object>} { items, total, page, limit, meta: { counts } }
   */
  async adminGetSubscriptions(params = {}) {
    return this._measure("adminGetSubscriptions", async () => {
      const cleanParams = this._cleanParams(params);
      const response = await api.get(ENDPOINTS.ADMIN_SUBSCRIPTIONS.LIST, { params: cleanParams });
      return this._extractData(response);
    });
  }

  /**
   * Lấy thống kê tổng quan thuê bao VIP và doanh thu cho Admin Dashboard
   * @returns {Promise<Object>} Thống kê KPI subscriptions
   */
  async adminGetStats() {
    return this._measure("adminGetStats", async () => {
      const response = await api.get(ENDPOINTS.ADMIN_SUBSCRIPTIONS.STATS);
      return this._extractData(response);
    });
  }

  /**
   * Admin cấp gói VIP thủ công / miễn phí cho người dùng
   * @param {Object} data { user_id: string, plan_id: string, duration_days?: number, reason?: string }
   * @returns {Promise<Object>} Gói VIP được tạo
   */
  async adminGrantVip(data) {
    return this._measure("adminGrantVip", async () => {
      const response = await api.post(ENDPOINTS.ADMIN_SUBSCRIPTIONS.GRANT, data);
      return this._extractData(response);
    });
  }

  /**
   * Admin thu hồi / cưỡng chế hủy gói VIP của người dùng
   * @param {string} id - UUID của subscription
   * @param {Object} [data={}] { reason?: string }
   * @returns {Promise<Object>} Kết quả thu hồi
   */
  async adminRevokeSubscription(id, data = {}) {
    this._validateId(id, "gói đăng ký");
    return this._measure("adminRevokeSubscription", async () => {
      const response = await api.post(ENDPOINTS.ADMIN_SUBSCRIPTIONS.REVOKE(id), data);
      return this._extractData(response);
    });
  }

  /**
   * Admin lấy danh sách tất cả các gói thành viên (kể cả gói ẩn / ngưng kinh doanh)
   * @param {Object} [params={}] { is_active, search, page, limit, sortBy, sortOrder }
   * @returns {Promise<Object>} { items, total, page, limit, meta: { counts } }
   */
  async adminGetAllPlans(params = {}) {
    return this._measure("adminGetAllPlans", async () => {
      const cleanParams = this._cleanParams(params);
      const response = await api.get(ENDPOINTS.MEMBERSHIP_PLANS.ADMIN_LIST, { params: cleanParams });
      return this._extractData(response);
    });
  }

  /**
   * Admin tạo mới một gói hội viên
   * @param {Object} data Thông tin gói mới
   * @returns {Promise<Object>} Gói hội viên vừa tạo
   */
  async adminCreatePlan(data) {
    return this._measure("adminCreatePlan", async () => {
      const response = await api.post(ENDPOINTS.MEMBERSHIP_PLANS.ADMIN_CREATE, data);
      return this._extractData(response);
    });
  }

  /**
   * Admin cập nhật thông tin gói hội viên
   * @param {string} id - ID của gói
   * @param {Object} data Thông tin cập nhật
   * @returns {Promise<Object>} Gói sau khi cập nhật
   */
  async adminUpdatePlan(id, data) {
    this._validateId(id, "gói thành viên");
    return this._measure("adminUpdatePlan", async () => {
      const response = await api.put(ENDPOINTS.MEMBERSHIP_PLANS.ADMIN_UPDATE(id), data);
      return this._extractData(response);
    });
  }

  /**
   * Admin vô hiệu hóa / xóa gói hội viên
   * @param {string} id - ID của gói
   * @returns {Promise<Object>} Kết quả xóa
   */
  async adminDeletePlan(id) {
    this._validateId(id, "gói thành viên");
    return this._measure("adminDeletePlan", async () => {
      const response = await api.delete(ENDPOINTS.MEMBERSHIP_PLANS.ADMIN_DELETE(id));
      return this._extractData(response);
    });
  }
}

export const subscriptionService = new SubscriptionService();
export default subscriptionService;
