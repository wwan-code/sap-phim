/**
 * @file admin-subscription.controller.js
 * @module Modules_Subscription_Controllers
 * @description Controller xử lý các yêu cầu Quản trị Gói hội viên & Subscriptions cho Admin Dashboard.
 */

import { adminSubscriptionService } from "../services/admin-subscription.service.js";
import { subscriptionPlanService } from "../services/subscription-plan.service.js";
import { responseUtil } from "../../../utils/response.util.js";

export const adminSubscriptionController = {
  /**
   * [GET] /admin/subscriptions
   * Lấy danh sách Subscriptions toàn hệ thống (Phân trang & Lọc)
   */
  async getSubscriptionsAdmin(req, res, next) {
    try {
      const result = await adminSubscriptionService.getSubscriptionsAdmin(req.query);
      return responseUtil.paginated(res, {
        items: result.items,
        total: result.total,
        page: result.page,
        limit: result.limit,
        message: "Lấy danh sách đăng ký thành công",
        meta: { counts: result.counts },
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * [GET] /admin/subscriptions/stats
   * Lấy thống kê tổng quan Subscriptions cho Admin Dashboard
   */
  async getStatsAdmin(req, res, next) {
    try {
      const result = await adminSubscriptionService.getSubscriptionStatsAdmin();
      return responseUtil.success(res, result, "Lấy thống kê thành công");
    } catch (error) {
      next(error);
    }
  },

  /**
   * [POST] /admin/subscriptions/grant
   * Admin Cấp Gói VIP miễn phí cho người dùng
   */
  async grantVipAdmin(req, res, next) {
    try {
      const result = await adminSubscriptionService.grantVipAdmin(req.user.id, req.body);
      return responseUtil.success(res, result, "Cấp gói VIP cho người dùng thành công", 201);
    } catch (error) {
      next(error);
    }
  },

  /**
   * [POST] /admin/subscriptions/:id/revoke
   * Admin Thu hồi / Hủy gói VIP của người dùng
   */
  async revokeSubscriptionAdmin(req, res, next) {
    try {
      const subscriptionId = req.params.id;
      const { reason } = req.body;
      const result = await adminSubscriptionService.revokeSubscriptionAdmin(req.user.id, subscriptionId, reason);
      return responseUtil.success(res, result, "Thu hồi gói VIP thành công");
    } catch (error) {
      next(error);
    }
  },

  // ── CRUD MEMBERSHIP PLANS (ADMIN) ───────────────────────────────────

  /**
   * [GET] /admin/membership-plans
   * Lấy tất cả gói thành viên (bao gồm các gói tạm ngưng kinh doanh)
   */
  async getAllPlansAdmin(req, res, next) {
    try {
      const { page, limit, sortBy, sortOrder, is_active, search } = req.query;
      const result = await subscriptionPlanService.getAllPlansAdmin(
        { is_active, search },
        { page, limit, sortBy, sortOrder }
      );
      return responseUtil.paginated(res, {
        items: result.items,
        total: result.pagination.total,
        page: result.pagination.page,
        limit: result.pagination.limit,
        message: "Lấy danh sách gói thành viên thành công",
        meta: { counts: result.counts },
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * [POST] /admin/membership-plans
   * Tạo gói thành viên mới
   */
  async createPlanAdmin(req, res, next) {
    try {
      const result = await subscriptionPlanService.createPlan(req.body);
      return responseUtil.success(res, result, "Tạo gói thành viên thành công", 201);
    } catch (error) {
      next(error);
    }
  },

  /**
   * [PUT] /admin/membership-plans/:id
   * Cập nhật thông tin gói thành viên
   */
  async updatePlanAdmin(req, res, next) {
    try {
      const result = await subscriptionPlanService.updatePlan(req.params.id, req.body);
      return responseUtil.success(res, result, "Cập nhật gói thành viên thành công");
    } catch (error) {
      next(error);
    }
  },

  /**
   * [DELETE] /admin/membership-plans/:id
   * Vô hiệu hóa gói thành viên
   */
  async deletePlanAdmin(req, res, next) {
    try {
      const result = await subscriptionPlanService.deletePlan(req.params.id);
      return responseUtil.success(res, result, "Vô hiệu hóa gói thành viên thành công");
    } catch (error) {
      next(error);
    }
  },
};

export default adminSubscriptionController;
