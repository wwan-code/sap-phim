/**
 * @file user.validator.js
 * @module Modules_User_Validators
 * @description Các schemas xác thực dữ liệu cho User Module.
 */

import Joi from "joi";
import { PRIVACY_ALLOWED_KEYS, PRIVACY_PRESETS } from "../services/preferences.service.js";

// ── Profile Schemas ──

export const updateProfileSchema = Joi.object({
  full_name: Joi.string().max(255).allow(null, ""),
  bio: Joi.string().max(500).allow(null, ""),
  date_of_birth: Joi.date().iso().max("now").allow(null),
  gender: Joi.string().valid("male", "female", "other").allow(null),
  country: Joi.string().max(100).allow(null, ""),
  city: Joi.string().max(100).allow(null, ""),
  location: Joi.alternatives().try(Joi.object(), Joi.string().allow("", null)).allow(null),
  social_links: Joi.object().pattern(Joi.string(), Joi.string().uri().allow("", null)).allow(null),
}).min(1); // Yêu cầu ít nhất 1 trường

export const updateAvatarSchema = Joi.object({
  avatar_url: Joi.string().uri().required().messages({
    "any.required": "Thiếu đường dẫn ảnh đại diện",
    "string.uri": "Đường dẫn ảnh đại diện không hợp lệ",
  }),
});

export const updateCoverSchema = Joi.object({
  cover_url: Joi.string().uri().required().messages({
    "any.required": "Thiếu đường dẫn ảnh bìa",
    "string.uri": "Đường dẫn ảnh bìa không hợp lệ",
  }),
});

// ── Preferences & Privacy Schemas ──

export const updatePreferencesSchema = Joi.object().unknown(true); // Cho phép các key tự do do preferences có thể mở rộng

const privacyValidValues = ["public", "friends_only", "private"];
export const updatePrivacySchema = Joi.object({
  show_email: Joi.string().valid(...privacyValidValues),
  show_dob: Joi.string().valid(...privacyValidValues),
  show_social: Joi.string().valid(...privacyValidValues),
  show_activity: Joi.string().valid(...privacyValidValues),
}).min(1);

export const presetSchema = Joi.object({
  preset: Joi.string().valid(...Object.keys(PRIVACY_PRESETS)).required().messages({
    "any.required": "Vui lòng chỉ định tên preset",
    "any.only": "Preset không hợp lệ",
  }),
});

// ── Account Schemas ──

export const deleteAccountSchema = Joi.object({
  password: Joi.string().min(8).required().messages({
    "any.required": "Vui lòng nhập mật khẩu để xác nhận",
    "string.min": "Mật khẩu không hợp lệ",
  }),
});

// ── Admin User Schemas ──

export const adminCreateUserSchema = Joi.object({
  username: Joi.string()
    .pattern(/^[a-zA-Z0-9_-]{3,50}$/)
    .required()
    .messages({
      "string.pattern.base": "Tên đăng nhập chỉ được chứa chữ cái, chữ số, dấu gạch ngang (-) và dấu gạch dưới (_)",
    }),
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
  role_slug: Joi.string().required(),
  full_name: Joi.string().max(255).allow(null, ""),
});

export const adminUpdateUserSchema = Joi.object({
  status: Joi.string().valid("active", "inactive", "banned"),
  role_slug: Joi.string(),
  is_verified: Joi.boolean(),
  is_premium: Joi.boolean(),
  membership_tier: Joi.string().allow(null, ""),
  full_name: Joi.string().max(255).allow(null, ""),
  password: Joi.string().min(8),
}).min(1);

export const adminLevelSchema = Joi.object({
  level: Joi.number().integer().min(1).max(100),
  exp: Joi.number().integer().min(0),
  point: Joi.number().integer().min(0),
}).min(1);

export const adminListQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  pageSize: Joi.number().integer().min(1).max(100),
  search: Joi.string().allow(""),
  q: Joi.string().allow(""),
  status: Joi.string().valid("active", "inactive", "banned").allow(""),
  role: Joi.string().allow(""),
  membership_tier: Joi.string().valid("free", "plus", "pro", "ultra").allow(""),
  order_by: Joi.string().allow(""),
  sortBy: Joi.string().allow(""),
  sort: Joi.string().valid("ASC", "DESC", "asc", "desc").default("desc"),
  sortOrder: Joi.string().valid("ASC", "DESC", "asc", "desc"),
}).unknown(true);

// ── [NEW] Admin — Session / Wallet / Subscription / Bulk Schemas ──

export const sessionIdParamSchema = Joi.object({
  id: Joi.string().guid({ version: ["uuidv4"] }).required().messages({
    "string.guid": "ID người dùng không hợp lệ (phải là UUID)",
  }),
  sessionId: Joi.string().guid({ version: ["uuidv4"] }).required().messages({
    "string.guid": "ID phiên đăng nhập không hợp lệ (phải là UUID)",
  }),
});

export const walletLockSchema = Joi.object({
  reason: Joi.string().max(500).allow(null, ""),
});

export const adminSubscriptionQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});

export const bulkStatusSchema = Joi.object({
  userIds: Joi.array()
    .items(Joi.string().guid({ version: ["uuidv4"] }))
    .min(1)
    .max(100)
    .required()
    .messages({
      "array.min": "Vui lòng chọn ít nhất 1 người dùng",
      "array.max": "Chỉ được thao tác tối đa 100 người dùng mỗi lần",
    }),
  status: Joi.string().valid("active", "inactive", "banned").required(),
});

// ── Common Params ──

export const userIdParamSchema = Joi.object({
  id: Joi.string().guid({ version: ["uuidv4"] }).required().messages({
    "string.guid": "ID người dùng không hợp lệ (phải là UUID)",
  }),
});

export const userIdRouteParamSchema = Joi.object({
  userId: Joi.string().guid({ version: ["uuidv4"] }).required().messages({
    "string.guid": "ID người dùng không hợp lệ (phải là UUID)",
  }),
});