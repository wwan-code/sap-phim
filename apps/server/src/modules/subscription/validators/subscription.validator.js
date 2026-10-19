/**
 * @file subscription.validator.js
 * @module Modules_Subscription_Validators
 * @description Middleware kiểm tra dữ liệu đầu vào (Validation) cho các API Gói thành viên & Đăng ký.
 */

import Joi from "joi";

const uuidSchema = Joi.string().uuid().required();

export const subscriptionValidator = {
  // Đăng ký hoặc Nâng cấp gói
  subscribe: Joi.object({
    plan_id: uuidSchema.messages({
      "string.empty": "ID gói thành viên không được để trống",
      "string.uuid": "ID gói thành viên phải là chuỗi UUID hợp lệ",
    }),
    billing_cycle: Joi.string().valid("monthly", "yearly").default("monthly"),
    auto_renew: Joi.boolean().default(true),
  }),

  // Đổi trạng thái Tự động gia hạn
  toggleAutoRenew: Joi.object({
    auto_renew: Joi.boolean().required().messages({
      "any.required": "Vui lòng truyền trạng thái tự động gia hạn (auto_renew)",
    }),
  }),

  // Hủy gói
  cancel: Joi.object({
    reason: Joi.string().max(500).allow("", null),
  }),

  // Query lọc danh sách Subscriptions (Admin)
  adminQuery: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    search: Joi.string().allow("", null),
    status: Joi.string().valid("active", "expired", "cancelled", "grace_period", "pending").allow("", null),
    tier: Joi.string().valid("free", "plus", "pro", "ultra").allow("", null),
    billing_cycle: Joi.string().valid("monthly", "yearly").allow("", null),
  }),

  // Admin cấp gói VIP cho người dùng
  adminGrant: Joi.object({
    user_id: uuidSchema,
    plan_id: uuidSchema,
    billing_cycle: Joi.string().valid("monthly", "yearly").default("monthly"),
    duration_days: Joi.number().integer().min(1).max(3650).default(30),
    note: Joi.string().max(255).allow("", null),
  }),

  // Admin tạo / cập nhật MembershipPlan
  createPlan: Joi.object({
    tier: Joi.string().valid("free", "plus", "pro", "ultra").required(),
    tier_level: Joi.number().integer().min(0).required(),
    name: Joi.string().max(100).required(),
    slug: Joi.string().max(100).required(),
    description: Joi.string().allow("", null),
    tagline: Joi.string().max(200).allow("", null),
    price_monthly: Joi.number().min(0).required(),
    price_yearly: Joi.number().min(0).allow(null),
    currency: Joi.string().length(3).default("VND"),
    features: Joi.object().default({}),
    display_order: Joi.number().integer().default(0),
    badge_color: Joi.string().max(20).allow("", null),
    icon_name: Joi.string().max(50).allow("", null),
    is_popular: Joi.boolean().default(false),
    is_active: Joi.boolean().default(true),
  }),

  updatePlan: Joi.object({
    name: Joi.string().max(100),
    slug: Joi.string().max(100),
    description: Joi.string().allow("", null),
    tagline: Joi.string().max(200).allow("", null),
    price_monthly: Joi.number().min(0),
    price_yearly: Joi.number().min(0).allow(null),
    currency: Joi.string().length(3),
    features: Joi.object(),
    display_order: Joi.number().integer(),
    badge_color: Joi.string().max(20).allow("", null),
    icon_name: Joi.string().max(50).allow("", null),
    is_popular: Joi.boolean(),
    is_active: Joi.boolean(),
  }),
};

export default subscriptionValidator;
