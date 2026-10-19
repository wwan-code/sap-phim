/**
 * @file subscription.controller.js
 * @module Modules_Subscription_Controllers
 * @description Controller xử lý các yêu cầu API Gói thành viên & Đăng ký cho End-User.
 */

import { subscriptionService } from "../services/subscription.service.js";
import { subscriptionPlanService } from "../services/subscription-plan.service.js";
import { entitlementService } from "../services/entitlement.service.js";
import { responseUtil } from "../../../utils/response.util.js";

export const subscriptionController = {
  /**
   * [GET] /membership-plans
   * Lấy danh sách gói hội viên công khai (Miễn phí, Plus, Pro, Ultra)
   */
  async getActivePlans(req, res, next) {
    try {
      const result = await subscriptionPlanService.getActivePlans();
      return responseUtil.success(res, result, "Lấy danh sách gói thành viên thành công");
    } catch (error) {
      next(error);
    }
  },

  /**
   * [GET] /subscriptions/active
   * Lấy thông tin gói hội viên đang hoạt động của người dùng hiện tại
   */
  async getActiveSubscription(req, res, next) {
    try {
      const result = await subscriptionService.getActiveSubscription(req.user.id);
      return responseUtil.success(res, result, "Lấy thông tin gói đăng ký thành công");
    } catch (error) {
      next(error);
    }
  },

  /**
   * [GET] /subscriptions/entitlements
   * Lấy danh sách đặc quyền/tính năng (Dynamic Entitlements) của người dùng hiện tại
   */
  async getMyEntitlements(req, res, next) {
    try {
      const result = await entitlementService.getUserEntitlements(req.user.id);
      return responseUtil.success(res, result, "Lấy đặc quyền gói thành công");
    } catch (error) {
      next(error);
    }
  },

  /**
   * [GET] /subscriptions/history
   * Lấy lịch sử gia hạn/đăng ký gói của người dùng
   */
  async getSubscriptionHistory(req, res, next) {
    try {
      const result = await subscriptionService.getUserSubscriptionHistory(req.user.id, req.query);
      return responseUtil.success(res, result, "Lấy lịch sử gói thành công");
    } catch (error) {
      next(error);
    }
  },

  /**
   * [GET] /subscriptions/proration-preview
   * Xem trước tính toán khấu trừ Proration khi Nâng cấp gói
   */
  async previewProration(req, res, next) {
    try {
      const { plan_id, billing_cycle } = req.query;
      const result = await subscriptionService.calculateProration(req.user.id, plan_id, billing_cycle);
      return responseUtil.success(res, result, "Tính toán khấu trừ thành công");
    } catch (error) {
      next(error);
    }
  },

  /**
   * [POST] /subscriptions/subscribe
   * Đăng ký mới hoặc Nâng cấp gói hội viên bằng Ví S-Coin
   */
  async subscribe(req, res, next) {
    try {
      const result = await subscriptionService.subscribe(req.user.id, req.body);
      return responseUtil.success(res, result, "Đăng ký gói thành viên thành công", 201);
    } catch (error) {
      next(error);
    }
  },

  /**
   * [PATCH] /subscriptions/auto-renew
   * Bật hoặc Tắt tự động gia hạn gói
   */
  async toggleAutoRenew(req, res, next) {
    try {
      const { auto_renew } = req.body;
      const result = await subscriptionService.toggleAutoRenew(req.user.id, auto_renew);
      return responseUtil.success(res, result, `Cập nhật tự động gia hạn thành: ${auto_renew ? "Bật" : "Tắt"}`);
    } catch (error) {
      next(error);
    }
  },

  /**
   * [POST] /subscriptions/cancel
   * Hủy tự động gia hạn gói (Gói vẫn giữ hiệu lực đến hết hạn)
   */
  async cancelSubscription(req, res, next) {
    try {
      const { reason } = req.body;
      const result = await subscriptionService.cancelSubscription(req.user.id, reason);
      return responseUtil.success(res, result, "Hủy đăng ký gói thành công");
    } catch (error) {
      next(error);
    }
  },
};

export default subscriptionController;
