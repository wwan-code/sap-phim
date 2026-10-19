/**
 * @file notification.service.js
 * @module Services/NotificationService
 * @description Dịch vụ quản lý thông báo (Member & Admin) kế thừa BaseService, tích hợp Cache Management, Deduplication và Performance Metrics.
 */

import BaseService from "./base.service";
import api from "./api";
import { ENDPOINTS } from "@/shared/constants/api-endpoints.constants";

/**
 * @class NotificationService
 * @extends BaseService
 * @description Xử lý toàn bộ logic gọi API cho hệ thống thông báo người dùng và quản trị viên
 */
class NotificationService extends BaseService {
  constructor() {
    super("NotificationService", {
      enableCache: true,
      enableMetrics: true,
      requestTimeout: 15000,
    });
  }

  // ════════════════════════════════════════════════════════════════
  // MEMBER APIS (DÀNH CHO NGƯỜI DÙNG CÁ NHÂN)
  // ════════════════════════════════════════════════════════════════

  /**
   * Lấy danh sách thông báo của người dùng hiện tại (hỗ trợ phân trang, lọc và sắp xếp)
   * @param {Object} [params={}] { page, limit, type, isRead, order_by, sort }
   * @returns {Promise<Object>} { items, total, page, limit, totalPages, hasNextPage, hasPrevPage }
   */
  async getNotifications(params = {}) {
    return this._measure("getNotifications", async () => {
      const cleanParams = this._cleanParams(params);
      const response = await api.get(ENDPOINTS.NOTIFICATIONS.LIST, { params: cleanParams });
      return this._extractData(response);
    });
  }

  /**
   * Lấy số lượng thông báo chưa đọc của người dùng
   * @returns {Promise<Object>} { unread: number }
   */
  async getUnreadCount() {
    return this._measure("getUnreadCount", async () => {
      const response = await api.get(ENDPOINTS.NOTIFICATIONS.UNREAD_COUNT);
      return this._extractData(response);
    });
  }

  /**
   * Lấy thống kê tổng quan thông báo (tổng số, đã đọc, chưa đọc)
   * @returns {Promise<Object>} { total: number, unread: number, read: number }
   */
  async getStats() {
    return this._measure("getStats", async () => {
      const response = await api.get(ENDPOINTS.NOTIFICATIONS.STATS);
      return this._extractData(response);
    });
  }

  /**
   * Đánh dấu một thông báo là đã đọc
   * @param {string} id - UUID của thông báo
   * @returns {Promise<Object>} Thông báo sau khi cập nhật
   */
  async markAsRead(id) {
    this._validateId(id, "thông báo");
    return this._measure("markAsRead", async () => {
      const response = await api.patch(ENDPOINTS.NOTIFICATIONS.READ(id));
      return this._extractData(response);
    });
  }

  /**
   * Đánh dấu một thông báo là chưa đọc
   * @param {string} id - UUID của thông báo
   * @returns {Promise<Object>} Thông báo sau khi cập nhật
   */
  async markAsUnread(id) {
    this._validateId(id, "thông báo");
    return this._measure("markAsUnread", async () => {
      const response = await api.patch(ENDPOINTS.NOTIFICATIONS.UNREAD(id));
      return this._extractData(response);
    });
  }

  /**
   * Đánh dấu toàn bộ thông báo của người dùng là đã đọc
   * @returns {Promise<Object>} { affected: number }
   */
  async markAllAsRead() {
    return this._measure("markAllAsRead", async () => {
      const response = await api.patch(ENDPOINTS.NOTIFICATIONS.READ_ALL);
      return this._extractData(response);
    });
  }

  /**
   * Xóa một thông báo theo ID
   * @param {string} id - UUID của thông báo
   * @returns {Promise<Object>} { deleted: number }
   */
  async deleteNotification(id) {
    this._validateId(id, "thông báo");
    return this._measure("deleteNotification", async () => {
      const response = await api.delete(ENDPOINTS.NOTIFICATIONS.DELETE(id));
      return this._extractData(response);
    });
  }

  /**
   * Xóa toàn bộ thông báo của người dùng
   * @returns {Promise<Object>} { deleted: number }
   */
  async deleteAllNotifications() {
    return this._measure("deleteAllNotifications", async () => {
      const response = await api.delete(ENDPOINTS.NOTIFICATIONS.DELETE_ALL, {
        data: { confirm: true },
      });
      return this._extractData(response);
    });
  }

  /**
   * Tạo thông báo mới thủ công hoặc phát sóng thông báo broadcast (yêu cầu quyền)
   * @param {Object} payload { userId?, type, title, message, actionUrl?, actionData?, icon?, entityType?, entityId?, actorId?, priority?, groupKey?, expiresAt? }
   * @returns {Promise<Object>}
   */
  async createNotification(payload) {
    return this._measure("createNotification", async () => {
      const response = await api.post(ENDPOINTS.NOTIFICATIONS.CREATE, payload);
      return this._extractData(response);
    });
  }

  // ════════════════════════════════════════════════════════════════
  // ADMIN APIS (DÀNH CHO QUẢN TRỊ VIÊN)
  // ════════════════════════════════════════════════════════════════

  /**
   * Lấy danh sách thông báo toàn hệ thống (Admin)
   * @param {Object} [params={}] { page, limit, type, priority, isRead, search, order_by, sort }
   * @returns {Promise<Object>} { items, total, pagination }
   */
  async listAdminNotifications(params = {}) {
    return this._measure("admin.listNotifications", async () => {
      const cleanParams = this._cleanParams(params);
      const response = await api.get(ENDPOINTS.ADMIN_NOTIFICATIONS.LIST, { params: cleanParams });
      return this._extractData(response);
    });
  }

  /**
   * Lấy thống kê tổng quan thông báo dành cho Quản trị viên
   * @returns {Promise<Object>} { total, read, unread, readRate, critical, last24h }
   */
  async getAdminStats() {
    return this._measure("admin.getStats", async () => {
      const response = await api.get(ENDPOINTS.ADMIN_NOTIFICATIONS.STATS);
      return this._extractData(response);
    });
  }

  /**
   * Xóa thông báo toàn hệ thống theo ID (Admin)
   * @param {string} id - UUID của thông báo
   * @returns {Promise<Object>} { deleted: number }
   */
  async deleteAdminNotification(id) {
    this._validateId(id, "thông báo");
    return this._measure("admin.deleteNotification", async () => {
      const response = await api.delete(ENDPOINTS.ADMIN_NOTIFICATIONS.DELETE(id));
      return this._extractData(response);
    });
  }

  /**
   * Xóa hàng loạt thông báo toàn hệ thống theo danh sách ID (Admin)
   * @param {string[]} ids - Danh sách UUID thông báo
   * @returns {Promise<Object>} { deleted: number }
   */
  async bulkDeleteAdminNotifications(ids) {
    return this._measure("admin.bulkDeleteNotifications", async () => {
      const response = await api.post(ENDPOINTS.ADMIN_NOTIFICATIONS.BULK_DELETE, { ids });
      return this._extractData(response);
    });
  }
}

export const notificationService = new NotificationService();
export { NotificationService };
export default notificationService;
