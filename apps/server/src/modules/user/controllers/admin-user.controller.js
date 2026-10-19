/**
 * @file admin-user.controller.js
 * @module Modules_User_Controllers
 * @description Tiếp nhận HTTP Requests từ admin và điều phối đến User Service.
 */

import { responseUtil } from "../../../utils/response.util.js";
import { userService } from "../services/user.service.js";
import { getHighestRoleSlug } from "../../../middlewares/auth.middleware.js";

export const adminUserController = {
  async listUsers(req, res, next) {
    try {
      const result = await userService.getUsersAdmin(req.validatedQuery || req.query);
      return responseUtil.paginated(res, {
        items: result.items,
        total: result.total,
        page: result.page,
        limit: result.limit,
        message: "Lấy danh sách người dùng thành công",
        meta: { counts: result.counts },
      });
    } catch (error) {
      next(error);
    }
  },

  async getUser(req, res, next) {
    try {
      const user = await userService.getUserAdmin(req.params.id);
      return responseUtil.success(res, user, "Lấy chi tiết người dùng thành công");
    } catch (error) {
      next(error);
    }
  },

  async createUser(req, res, next) {
    try {
      const actorRoleSlug = getHighestRoleSlug(req.userRoles);
      const user = await userService.createUserAdmin(req.body, actorRoleSlug, req.userId);
      return responseUtil.success(res, user, "Tạo người dùng thành công", 201);
    } catch (error) {
      next(error);
    }
  },

  async updateUser(req, res, next) {
    try {
      const actorRoleSlug = getHighestRoleSlug(req.userRoles);
      const user = await userService.updateUserAdmin(req.params.id, req.body, actorRoleSlug, req.userId);
      return responseUtil.success(res, user, "Cập nhật người dùng thành công");
    } catch (error) {
      next(error);
    }
  },

  async updateLevel(req, res, next) {
    try {
      const actorRoleSlug = getHighestRoleSlug(req.userRoles);
      const user = await userService.updateUserLevelStats(req.params.id, req.body, actorRoleSlug, req.userId);
      return responseUtil.success(res, user, "Cập nhật cấp độ thành công");
    } catch (error) {
      next(error);
    }
  },

  async deleteUser(req, res, next) {
    try {
      const actorRoleSlug = getHighestRoleSlug(req.userRoles);
      await userService.deleteUserAdmin(req.params.id, actorRoleSlug, req.userId);
      return responseUtil.success(res, null, "Xóa người dùng thành công");
    } catch (error) {
      next(error);
    }
  },

  async restoreUser(req, res, next) {
    try {
      const user = await userService.restoreUserAdmin(req.params.id);
      return responseUtil.success(res, user, "Khôi phục người dùng thành công");
    } catch (error) {
      next(error);
    }
  },

  // ── [NEW] Session Management ─────────────────────────────────────────

  async listSessions(req, res, next) {
    try {
      const sessions = await userService.getUserSessionsAdmin(req.params.id);
      return responseUtil.success(res, sessions, "Lấy danh sách phiên đăng nhập thành công");
    } catch (error) {
      next(error);
    }
  },

  async revokeSession(req, res, next) {
    try {
      const result = await userService.revokeUserSessionAdmin(req.params.id, req.params.sessionId);
      return responseUtil.success(res, result, "Đã thu hồi phiên đăng nhập");
    } catch (error) {
      next(error);
    }
  },

  // ── [NEW] Wallet Oversight ───────────────────────────────────────────

  async getWallet(req, res, next) {
    try {
      const wallet = await userService.getUserWalletAdmin(req.params.id);
      return responseUtil.success(res, wallet, "Lấy thông tin ví thành công");
    } catch (error) {
      next(error);
    }
  },

  async lockWallet(req, res, next) {
    try {
      const wallet = await userService.lockUserWalletAdmin(req.params.id, req.body.reason, req.userId);
      return responseUtil.success(res, wallet, "Đã khoá ví người dùng");
    } catch (error) {
      next(error);
    }
  },

  async unlockWallet(req, res, next) {
    try {
      const wallet = await userService.unlockUserWalletAdmin(req.params.id);
      return responseUtil.success(res, wallet, "Đã mở khoá ví người dùng");
    } catch (error) {
      next(error);
    }
  },

  // ── [NEW] Subscription History ───────────────────────────────────────

  async listSubscriptions(req, res, next) {
    try {
      const result = await userService.getUserSubscriptionsAdmin(req.params.id, req.validatedQuery || req.query);
      return responseUtil.paginated(res, { ...result, message: "Lấy lịch sử gói hội viên thành công" });
    } catch (error) {
      next(error);
    }
  },

  // ── [NEW] Bulk Actions ───────────────────────────────────────────────

  async bulkUpdateStatus(req, res, next) {
    try {
      const actorRoleSlug = getHighestRoleSlug(req.userRoles);
      const result = await userService.bulkUpdateStatusAdmin(req.body.userIds, req.body.status, actorRoleSlug, req.userId);
      return responseUtil.success(res, result, "Đã cập nhật trạng thái hàng loạt");
    } catch (error) {
      next(error);
    }
  },
};