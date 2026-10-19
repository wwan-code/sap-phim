/**
 * @file subscription-plan.service.js
 * @module Modules_Subscription_Services
 * @description Quản lý CRUD Gói thành viên (MembershipPlans) và Cache thông tin gói.
 */

import { Op } from "sequelize";
import { MembershipPlan, sequelize } from "../../../models/index.js";
import { AppError } from "../../../utils/app-error.js";
import { cacheHelper } from "../../../config/redis.config.js";
import { logger } from "../../../utils/logger.js";

const PLANS_CACHE_KEY = "membership_plans:active";
const PLANS_CACHE_TTL = 3600; // 1 giờ

export const subscriptionPlanService = {
  /**
   * Lấy danh sách Gói thành viên đang hoạt động (Public / User Dashboard)
   * @returns {Promise<Array>}
   */
  async getActivePlans() {
    try {
      const cached = await cacheHelper.get(PLANS_CACHE_KEY);
      if (cached) return cached;
    } catch (err) {
      // Redis error fallback
    }

    const plans = await MembershipPlan.findAll({
      where: { is_active: true },
      order: [["display_order", "ASC"], ["price_monthly", "ASC"]],
    });

    const plainPlans = plans.map((p) => p.toJSON());

    try {
      await cacheHelper.set(PLANS_CACHE_KEY, plainPlans, PLANS_CACHE_TTL);
    } catch (err) {
      logger.warn(`[PlanService] Cache write error: ${err.message}`);
    }

    return plainPlans;
  },

  /**
   * Lấy danh sách toàn bộ Gói thành viên cho Admin (Hỗ trợ phân trang, lọc & đếm)
   * @param {Object} filters - is_active, search
   * @param {Object} pagination - page, limit, sortBy, sortOrder
   * @returns {Promise<Object>} { items, pagination, counts }
   */
  async getAllPlansAdmin(filters = {}, pagination = {}) {
    const { is_active, search } = filters;
    const { page = 1, limit = 10, sortBy = "display_order", sortOrder = "ASC" } = pagination;

    const where = {};

    if (is_active !== undefined && is_active !== null && is_active !== "" && is_active !== "all") {
      where.is_active = is_active === "true" || is_active === true;
    }

    if (search && search.trim()) {
      const searchClean = search.trim();
      where[Op.or] = [
        { name: { [Op.iLike]: `%${searchClean}%` } },
        { slug: { [Op.iLike]: `%${searchClean}%` } },
        { tier: { [Op.iLike]: `%${searchClean}%` } },
      ];
    }

    const offset = (page - 1) * limit;

    const { count, rows } = await MembershipPlan.findAndCountAll({
      where,
      order: [[sortBy, sortOrder]],
      limit: parseInt(limit),
      offset: parseInt(offset),
    });

    const activeCount = await MembershipPlan.count({ where: { is_active: true } });
    const inactiveCount = await MembershipPlan.count({ where: { is_active: false } });

    const counts = {
      all: activeCount + inactiveCount,
      active: activeCount,
      inactive: inactiveCount,
    };

    return {
      items: rows.map((p) => p.toJSON()),
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / limit),
      },
      counts,
    };
  },

  /**
   * Lấy chi tiết gói thành viên theo ID hoặc Slug
   * @param {string} identifier - UUID ID hoặc Slug
   * @returns {Promise<Object>}
   */
  async getPlanByIdOrSlug(identifier) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(identifier);
    const where = isUuid ? { id: identifier } : { slug: identifier };

    const plan = await MembershipPlan.findOne({ where });
    if (!plan) {
      throw new AppError("Gói thành viên không tồn tại", 404);
    }

    return plan.toJSON();
  },

  /**
   * [ADMIN] Tạo Gói thành viên mới
   * @param {Object} planData
   * @returns {Promise<Object>}
   */
  async createPlan(planData) {
    const existingTier = await MembershipPlan.findOne({ where: { tier: planData.tier } });
    if (existingTier) {
      throw new AppError(`Gói thuộc cấp bậc (tier) '${planData.tier}' đã tồn tại`, 400);
    }

    const newPlan = await MembershipPlan.create(planData);
    await this.invalidatePlansCache();
    logger.info(`[PlanService] Created new plan ${newPlan.name} (${newPlan.tier})`);
    return newPlan.toJSON();
  },

  /**
   * [ADMIN] Cập nhật Gói thành viên
   * @param {string} planId
   * @param {Object} updateData
   * @returns {Promise<Object>}
   */
  async updatePlan(planId, updateData) {
    const plan = await MembershipPlan.findByPk(planId);
    if (!plan) {
      throw new AppError("Gói thành viên không tồn tại", 404);
    }

    await plan.update(updateData);
    await this.invalidatePlansCache();
    logger.info(`[PlanService] Updated plan ${plan.id} (${plan.name})`);
    return plan.toJSON();
  },

  /**
   * [ADMIN] Xóa hoặc vô hiệu hóa gói thành viên
   * @param {string} planId
   */
  async deletePlan(planId) {
    const plan = await MembershipPlan.findByPk(planId);
    if (!plan) {
      throw new AppError("Gói thành viên không tồn tại", 404);
    }

    // Soft disable
    await plan.update({ is_active: false });
    await this.invalidatePlansCache();
    logger.info(`[PlanService] Deactivated plan ${plan.id}`);
    return { message: "Đã ngưng kinh doanh gói thành viên thành công" };
  },

  /**
   * Xóa cache các gói
   */
  async invalidatePlansCache() {
    try {
      await cacheHelper.del(PLANS_CACHE_KEY);
    } catch (err) {
      // Ignore
    }
  },
};

export default subscriptionPlanService;
