/**
 * @file admin-audit-log.service.js
 * @module Modules_Security_Services
 * @description Dịch vụ quản trị và tra cứu nhật ký kiểm toán (Audit Log), thống kê sự cố bảo mật và xuất dữ liệu kiểm toán.
 */

import { Op } from "sequelize";
import { AuditLog, User, Role } from "../../../models/index.js";
import { AppError } from "../../../utils/app-error.js";

export const adminAuditLogService = {
  /**
   * Lấy danh sách Audit Logs kèm phân trang và bộ lọc chuyên sâu
   * @param {Object} query - Tham số tìm kiếm & phân trang
   * @returns {Promise<{ audit_logs: Array, pagination: Object }>}
   */
  async getAuditLogsAdmin(query = {}) {
    const {
      page = 1,
      limit = 10,
      search = "",
      severity = "all",
      event_category = "all",
      event_type = "",
      status = "all",
      start_date = null,
      end_date = null,
      sort_by = "created_at",
      sort_order = "DESC",
    } = query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
    const offset = (pageNum - 1) * limitNum;

    const andConditions = [];

    // 1. Mức độ nghiêm trọng (Severity)
    if (severity && severity !== "all") {
      andConditions.push({ severity });
    }

    // 2. Danh mục sự kiện (Category)
    if (event_category && event_category !== "all") {
      andConditions.push({ event_category });
    }

    // 3. Loại sự kiện cụ thể (Event Type)
    if (event_type && event_type.trim() !== "") {
      andConditions.push({
        event_type: { [Op.iLike]: `%${event_type.trim()}%` },
      });
    }

    // 4. Trạng thái thực hiện (Status)
    if (status && status !== "all") {
      andConditions.push({ status });
    }

    // 5. Khoảng thời gian (Date Range)
    if (start_date && end_date) {
      andConditions.push({
        created_at: {
          [Op.between]: [new Date(start_date), new Date(end_date)],
        },
      });
    } else if (start_date) {
      andConditions.push({
        created_at: { [Op.gte]: new Date(start_date) },
      });
    } else if (end_date) {
      andConditions.push({
        created_at: { [Op.lte]: new Date(end_date) },
      });
    }

    const searchVal = (query.search || query.q || "").trim();
    const rawSortBy = query.order_by || query.sortBy || query.sort_by || "created_at";
    const rawSortOrder = (query.sort || query.sortOrder || query.sort_order || "DESC").toUpperCase();
    const effectiveSortOrder = rawSortOrder === "ASC" ? "ASC" : "DESC";

    // 6. Tìm kiếm văn bản (Search across IP, Username, Email, Request ID, Description)
    if (searchVal) {
      const searchPattern = `%${searchVal}%`;
      andConditions.push({
        [Op.or]: [
          { ip_address: { [Op.iLike]: searchPattern } },
          { username: { [Op.iLike]: searchPattern } },
          { email: { [Op.iLike]: searchPattern } },
          { request_id: { [Op.iLike]: searchPattern } },
          { description: { [Op.iLike]: searchPattern } },
          { device_fingerprint: { [Op.iLike]: searchPattern } },
          { "$user.username$": { [Op.iLike]: searchPattern } },
          { "$user.email$": { [Op.iLike]: searchPattern } },
        ],
      });
    }

    const where = andConditions.length > 0 ? { [Op.and]: andConditions } : {};

    // Sắp xếp động & ánh xạ cột hợp lệ (Bảo vệ an toàn SQL)
    let orderClause = [];
    if (rawSortBy === "user" || rawSortBy === "username") {
      orderClause = [
        [{ model: User, as: "user" }, "username", effectiveSortOrder],
        ["created_at", "DESC"],
      ];
    } else {
      const allowedSortFields = [
        "created_at",
        "severity",
        "status",
        "event_type",
        "event_category",
        "ip_address",
        "response_time_ms",
      ];
      const sortField = allowedSortFields.includes(rawSortBy) ? rawSortBy : "created_at";
      orderClause = [[sortField, effectiveSortOrder]];
    }

    const { count, rows } = await AuditLog.findAndCountAll({
      where,
      include: [
        {
          model: User,
          as: "user",
          attributes: ["id", "username", "email", "avatar_url"],
          include: [
            {
              model: Role,
              as: "role",
              attributes: ["id", "name", "slug"],
            },
          ],
          required: false,
        },
      ],
      order: orderClause,
      limit: limitNum,
      offset,
      distinct: true,
    });

    return {
      audit_logs: rows,
      pagination: {
        total: count,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(count / limitNum) || 1,
      },
    };
  },

  /**
   * Lấy số liệu thống kê tổng quát về nhật ký kiểm toán
   * @returns {Promise<Object>}
   */
  async getAuditLogStatsAdmin() {
    const past24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [
      totalEvents,
      successfulEvents,
      failedEvents,
      blockedEvents,
      securityEvents,
      criticalEvents,
      failedLogins24h,
    ] = await Promise.all([
      AuditLog.count(),
      AuditLog.count({ where: { status: "success" } }),
      AuditLog.count({ where: { status: "failure" } }),
      AuditLog.count({ where: { status: "blocked" } }),
      AuditLog.count({ where: { event_category: "security" } }),
      AuditLog.count({ where: { severity: "critical" } }),
      AuditLog.count({
        where: {
          event_type: "auth.login.failed",
          created_at: { [Op.gte]: past24h },
        },
      }),
    ]);

    const successRate =
      totalEvents > 0
        ? Number(((successfulEvents / totalEvents) * 100).toFixed(1))
        : 100;

    return {
      total_events: totalEvents,
      successful_events: successfulEvents,
      failed_events: failedEvents,
      blocked_events: blockedEvents,
      security_events: securityEvents,
      critical_events: criticalEvents,
      failed_logins_24h: failedLogins24h,
      success_rate: successRate,
    };
  },

  /**
   * Lấy thông tin chi tiết một bản ghi Audit Log
   * @param {string} id - ID bản ghi
   * @returns {Promise<Object>}
   */
  async getAuditLogDetailAdmin(id) {
    const log = await AuditLog.findByPk(id, {
      include: [
        {
          model: User,
          as: "user",
          attributes: ["id", "username", "email", "avatar_url"],
          include: [
            {
              model: Role,
              as: "role",
              attributes: ["id", "name", "slug"],
            },
          ],
        },
      ],
    });

    if (!log) {
      throw new AppError("Bản ghi nhật ký kiểm toán không tồn tại", 404);
    }

    return log;
  },

  /**
   * Xuất danh sách Audit Logs theo bộ lọc (Hỗ trợ tối đa 1000 bản ghi mới nhất)
   * @param {Object} query
   * @returns {Promise<Array>}
   */
  async exportAuditLogsAdmin(query = {}) {
    const { audit_logs } = await this.getAuditLogsAdmin({
      ...query,
      page: 1,
      limit: 1000,
    });

    return audit_logs.map((item) => {
      const plain = typeof item.toJSON === "function" ? item.toJSON() : item;
      return {
        id: plain.id,
        created_at: plain.created_at,
        event_type: plain.event_type,
        event_category: plain.event_category,
        severity: plain.severity,
        status: plain.status,
        user: plain.username || plain.email || "Ẩn danh",
        ip_address: plain.ip_address || "N/A",
        description: plain.description || "",
        error_code: plain.error_code || "",
        error_message: plain.error_message || "",
        request_id: plain.request_id || "",
        response_time_ms: plain.response_time_ms || 0,
      };
    });
  },
};
