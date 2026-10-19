/**
 * @file admin-audit-log.controller.js
 * @module Modules_Security_Controllers
 * @description Controller câm tiếp nhận và phản hồi các yêu cầu quản trị và tra cứu nhật ký kiểm toán.
 */

import { responseUtil } from "../../../utils/response.util.js";
import { adminAuditLogService } from "../services/admin-audit-log.service.js";

export const adminAuditLogController = {
  /**
   * Lấy danh sách nhật ký kiểm toán có phân trang và bộ lọc
   * @route GET /api/v1/admin/audit-logs
   */
  async getAuditLogs(req, res, next) {
    try {
      const query = req.validatedQuery || req.query;
      const result = await adminAuditLogService.getAuditLogsAdmin(query);

      return responseUtil.paginated(res, {
        items: result.audit_logs,
        total: result.pagination.total,
        page: result.pagination.page,
        limit: result.pagination.limit,
        message: "Lấy danh sách nhật ký kiểm toán thành công",
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Lấy các chỉ số thống kê sự cố bảo mật và nhật ký
   * @route GET /api/v1/admin/audit-logs/stats
   */
  async getAuditLogStats(req, res, next) {
    try {
      const stats = await adminAuditLogService.getAuditLogStatsAdmin();
      return responseUtil.success(
        res,
        stats,
        "Lấy thống kê nhật ký kiểm toán thành công"
      );
    } catch (error) {
      next(error);
    }
  },

  /**
   * Lấy chi tiết một bản ghi Audit Log
   * @route GET /api/v1/admin/audit-logs/:id
   */
  async getAuditLogDetail(req, res, next) {
    try {
      const { id } = req.params;
      const log = await adminAuditLogService.getAuditLogDetailAdmin(id);

      return responseUtil.success(
        res,
        log,
        "Lấy chi tiết nhật ký kiểm toán thành công"
      );
    } catch (error) {
      next(error);
    }
  },

  /**
   * Xuất danh sách nhật ký kiểm toán dạng JSON/CSV
   * @route GET /api/v1/admin/audit-logs/export
   */
  async exportAuditLogs(req, res, next) {
    try {
      const query = req.validatedQuery || req.query;
      const data = await adminAuditLogService.exportAuditLogsAdmin(query);

      return responseUtil.success(
        res,
        data,
        "Xuất dữ liệu nhật ký kiểm toán thành công"
      );
    } catch (error) {
      next(error);
    }
  },
};
