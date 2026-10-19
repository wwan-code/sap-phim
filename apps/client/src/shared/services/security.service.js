/**
 * @file security.service.js
 * @module Services/SecurityService
 * @description Dịch vụ quản trị phiên đăng nhập và nhật ký kiểm toán bảo mật (Security & Audit Logs) cho Admin Portal.
 */

import BaseService from "./base.service";
import api from "./api";
import { ENDPOINTS } from "@/shared/constants/api-endpoints.constants";

class SecurityService extends BaseService {
  constructor() {
    super("SecurityService", {
      enableCache: false,
      enableMetrics: true,
      requestTimeout: 15000,
    });
  }

  /**
   * Chuẩn hóa tham số truy vấn (tự động mapping camelCase từ DataGrid sang snake_case cho backend)
   * @private
   */
  _normalizeQueryParams(params = {}) {
    const normalized = { ...params };
    if (normalized.sortBy && !normalized.sort_by) {
      normalized.sort_by = normalized.sortBy;
    }
    if (normalized.sortOrder && !normalized.sort_order) {
      normalized.sort_order = normalized.sortOrder;
    }
    if (normalized.sort && !normalized.sort_order) {
      normalized.sort_order = normalized.sort;
    }
    if (normalized.order_by && !normalized.sort_by) {
      normalized.sort_by = normalized.order_by;
    }
    if (normalized.q && !normalized.search) {
      normalized.search = normalized.q;
    }
    return normalized;
  }

  // ════════════════════════════════════════════════════════════════
  // QUẢN LÝ PHIÊN ĐĂNG NHẬP (SESSIONS)
  // ════════════════════════════════════════════════════════════════

  /**
   * Lấy danh sách các phiên đăng nhập toàn hệ thống
   * @param {Object} params - Query params (page, limit, search, role, min_risk_score, anomaly, status, sort_by, sort_order)
   * @returns {Promise<{ items: Array, pagination: Object }>}
   */
  async getAdminSessions(params = {}) {
    const queryParams = this._normalizeQueryParams(params);
    return this._measure("getAdminSessions", async () => {
      const response = await api.get(ENDPOINTS.ADMIN_SESSIONS.LIST, { params: queryParams });
      return this._extractData(response);
    });
  }

  /**
   * Lấy số liệu thống kê phiên đăng nhập (KPIs)
   * @returns {Promise<Object>}
   */
  async getAdminSessionStats() {
    return this._measure("getAdminSessionStats", async () => {
      const response = await api.get(ENDPOINTS.ADMIN_SESSIONS.STATS);
      return this._extractData(response);
    });
  }

  /**
   * Thu hồi một phiên đăng nhập cụ thể
   * @param {string} sessionId
   * @returns {Promise<Object>}
   */
  async revokeAdminSession(sessionId) {
    return this._measure("revokeAdminSession", async () => {
      const response = await api.delete(ENDPOINTS.ADMIN_SESSIONS.REVOKE(sessionId));
      return this._extractData(response);
    });
  }

  /**
   * Cưỡng chế đăng xuất tất cả thiết bị của một người dùng
   * @param {string} userId
   * @param {string} reason
   * @returns {Promise<Object>}
   */
  async revokeAdminUserAllSessions(userId, reason) {
    return this._measure("revokeAdminUserAllSessions", async () => {
      const response = await api.post(
        ENDPOINTS.ADMIN_SESSIONS.REVOKE_USER_ALL(userId),
        { reason }
      );
      return this._extractData(response);
    });
  }

  // ════════════════════════════════════════════════════════════════
  // QUẢN LÝ NHẬT KÝ KIỂM TOÁN (AUDIT LOGS)
  // ════════════════════════════════════════════════════════════════

  /**
   * Lấy danh sách nhật ký kiểm toán với phân trang & bộ lọc
   * @param {Object} params - Query params (page, limit, search, severity, event_category, event_type, status, start_date, end_date)
   * @returns {Promise<{ items: Array, pagination: Object }>}
   */
  async getAdminAuditLogs(params = {}) {
    const queryParams = this._normalizeQueryParams(params);
    return this._measure("getAdminAuditLogs", async () => {
      const response = await api.get(ENDPOINTS.ADMIN_AUDIT_LOGS.LIST, { params: queryParams });
      return this._extractData(response);
    });
  }

  /**
   * Lấy các chỉ số thống kê sự cố bảo mật & audit logs
   * @returns {Promise<Object>}
   */
  async getAdminAuditLogStats() {
    return this._measure("getAdminAuditLogStats", async () => {
      const response = await api.get(ENDPOINTS.ADMIN_AUDIT_LOGS.STATS);
      return this._extractData(response);
    });
  }

  /**
   * Lấy chi tiết một bản ghi Audit Log
   * @param {string} id
   * @returns {Promise<Object>}
   */
  async getAdminAuditLogDetail(id) {
    return this._measure("getAdminAuditLogDetail", async () => {
      const response = await api.get(ENDPOINTS.ADMIN_AUDIT_LOGS.DETAIL(id));
      return this._extractData(response);
    });
  }

  /**
   * Xuất danh sách nhật ký kiểm toán phục vụ báo cáo
   * @param {Object} params
   * @returns {Promise<Array>}
   */
  async exportAdminAuditLogs(params = {}) {
    const queryParams = this._normalizeQueryParams(params);
    return this._measure("exportAdminAuditLogs", async () => {
      const response = await api.get(ENDPOINTS.ADMIN_AUDIT_LOGS.EXPORT, { params: queryParams });
      return this._extractData(response);
    });
  }
}

export const securityService = new SecurityService();
export default securityService;
