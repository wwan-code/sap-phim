/**
 * @file admin-session.controller.js
 * @module Modules_Security_Controllers
 * @description Controller câm tiếp nhận và phản hồi các yêu cầu quản trị phiên đăng nhập.
 */

import { responseUtil } from "../../../utils/response.util.js";
import { adminSessionService } from "../services/admin-session.service.js";
import { getHighestRoleSlug } from "../../../middlewares/auth.middleware.js";

export const adminSessionController = {
  /**
   * Lấy danh sách các phiên đăng nhập toàn hệ thống
   * @route GET /api/v1/admin/sessions
   */
  async getSessions(req, res, next) {
    try {
      const query = req.validatedQuery || req.query;
      const result = await adminSessionService.getSessionsAdmin(query);

      return responseUtil.paginated(res, {
        items: result.sessions,
        total: result.pagination.total,
        page: result.pagination.page,
        limit: result.pagination.limit,
        message: "Lấy danh sách phiên đăng nhập thành công",
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Lấy thống kê tổng quan về các phiên đăng nhập (KPIs)
   * @route GET /api/v1/admin/sessions/stats
   */
  async getSessionStats(req, res, next) {
    try {
      const stats = await adminSessionService.getSessionStatsAdmin();
      return responseUtil.success(
        res,
        stats,
        "Lấy thống kê phiên đăng nhập thành công"
      );
    } catch (error) {
      next(error);
    }
  },

  /**
   * Thu hồi một phiên đăng nhập cụ thể
   * @route DELETE /api/v1/admin/sessions/:sessionId
   */
  async revokeSession(req, res, next) {
    try {
      const { sessionId } = req.params;
      const actorRoleSlug = getHighestRoleSlug(req.userRoles);
      const actorUserId = req.userId;

      const result = await adminSessionService.revokeSessionAdmin(
        sessionId,
        actorRoleSlug,
        actorUserId
      );

      return responseUtil.success(res, result, result.message);
    } catch (error) {
      next(error);
    }
  },

  /**
   * Cưỡng chế thu hồi tất cả phiên của một người dùng
   * @route POST /api/v1/admin/sessions/users/:userId/revoke-all
   */
  async revokeAllUserSessions(req, res, next) {
    try {
      const { userId } = req.params;
      const { reason } = req.body;
      const actorRoleSlug = getHighestRoleSlug(req.userRoles);
      const actorUserId = req.userId;

      const result = await adminSessionService.revokeAllUserSessionsAdmin(
        userId,
        reason,
        actorRoleSlug,
        actorUserId
      );

      return responseUtil.success(res, result, result.message);
    } catch (error) {
      next(error);
    }
  },
};
