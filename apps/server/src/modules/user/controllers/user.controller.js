/**
 * @file user.controller.js
 * @module Modules_User_Controllers
 * @description Tiếp nhận HTTP Requests và điều phối đến User Service.
 */

import { responseUtil } from "../../../utils/response.util.js";
import { userService } from "../services/user.service.js";

export const userController = {
  // ── Profile ──

  async getMyProfile(req, res, next) {
    try {
      const profile = await userService.getProfile(req.userId, req.userId);
      return responseUtil.success(res, profile, "Lấy thông tin cá nhân thành công");
    } catch (error) {
      next(error);
    }
  },

  async getUserProfile(req, res, next) {
    try {
      const profile = await userService.getProfile(req.params.userId, req.userId);
      return responseUtil.success(res, profile, "Lấy thông tin người dùng thành công");
    } catch (error) {
      next(error);
    }
  },

  async updateMyProfile(req, res, next) {
    try {
      const updated = await userService.updateProfile(req.userId, req.body);
      return responseUtil.success(res, updated, "Cập nhật thông tin cá nhân thành công");
    } catch (error) {
      next(error);
    }
  },

  // ── Preferences ──

  async getPreferences(req, res, next) {
    try {
      const preferences = await userService.getPreferences(req.userId);
      return responseUtil.success(res, preferences, "Lấy cấu hình tài khoản thành công");
    } catch (error) {
      next(error);
    }
  },

  async updatePreferences(req, res, next) {
    try {
      const result = await userService.updatePreferences(req.userId, req.body);
      return responseUtil.success(res, result, "Cập nhật cấu hình thành công");
    } catch (error) {
      next(error);
    }
  },

  async updatePrivacy(req, res, next) {
    try {
      const result = await userService.updatePrivacySettings(req.userId, req.body);
      return responseUtil.success(res, result, "Cập nhật quyền riêng tư thành công");
    } catch (error) {
      next(error);
    }
  },

  async resetPreferences(req, res, next) {
    try {
      const result = await userService.resetPreferences(req.userId);
      return responseUtil.success(res, result, "Đã khôi phục cấu hình mặc định");
    } catch (error) {
      next(error);
    }
  },

  async applyPreset(req, res, next) {
    try {
      const result = await userService.applyPreset(req.userId, req.body.preset);
      return responseUtil.success(res, result, "Đã áp dụng cấu hình quyền riêng tư");
    } catch (error) {
      next(error);
    }
  },

  // ── Account ──

  async getStats(req, res, next) {
    try {
      const stats = await userService.getProfileStats(req.userId);
      return responseUtil.success(res, stats, "Lấy thống kê tài khoản thành công");
    } catch (error) {
      next(error);
    }
  },

  async exportData(req, res, next) {
    try {
      const data = await userService.exportUserData(req.userId);
      return responseUtil.success(res, data, "Trích xuất dữ liệu thành công");
    } catch (error) {
      next(error);
    }
  },

  async deleteAccount(req, res, next) {
    try {
      await userService.deleteAccount(req.userId, req.body.password);
      return responseUtil.success(res, null, "Đã khóa tài khoản theo yêu cầu");
    } catch (error) {
      next(error);
    }
  },

  // ── Social ──

  async follow(req, res, next) {
    try {
      await userService.follow(req.userId, req.params.userId);
      return responseUtil.success(res, null, "Đã theo dõi người dùng");
    } catch (error) {
      next(error);
    }
  },

  async unfollow(req, res, next) {
    try {
      await userService.unfollow(req.userId, req.params.userId);
      return responseUtil.success(res, null, "Đã hủy theo dõi người dùng");
    } catch (error) {
      next(error);
    }
  },

  async getFollowers(req, res, next) {
    try {
      const result = await userService.getFollowers(req.params.userId, req.validatedQuery || req.query);
      return responseUtil.paginated(res, { ...result, message: "Lấy danh sách người theo dõi thành công" });
    } catch (error) {
      next(error);
    }
  },

  async getFollowing(req, res, next) {
    try {
      const result = await userService.getFollowing(req.params.userId, req.validatedQuery || req.query);
      return responseUtil.paginated(res, { ...result, message: "Lấy danh sách đang theo dõi thành công" });
    } catch (error) {
      next(error);
    }
  },
};
