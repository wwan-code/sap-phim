/**
 * @file security.validator.js
 * @module Modules_Security_Validators
 * @description Schema kiểm định dữ liệu cho module Quản lý Phiên và Nhật ký Bảo mật (Security & Audit).
 */

import Joi from "joi";

// ── Session Schemas ──

export const sessionListQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  pageSize: Joi.number().integer().min(1).max(100),
  search: Joi.string().trim().max(100).allow(""),
  q: Joi.string().trim().max(100).allow(""),
  role: Joi.string().valid("all", "boss", "admin", "moderator", "user").default("all"),
  min_risk_score: Joi.number().integer().min(0).max(100).allow(null, ""),
  anomaly: Joi.string().trim().max(50).allow(""),
  status: Joi.string().valid("all", "active", "revoked").default("active"),
  sort_by: Joi.string().valid("last_used_at", "created_at", "risk_score", "expires_at", "ip_address", "user", "username").default("last_used_at"),
  sortBy: Joi.string().valid("last_used_at", "created_at", "risk_score", "expires_at", "ip_address", "user", "username").allow(""),
  order_by: Joi.string().valid("last_used_at", "created_at", "risk_score", "expires_at", "ip_address", "user", "username").allow(""),
  sort_order: Joi.string().valid("ASC", "DESC", "asc", "desc").default("DESC"),
  sortOrder: Joi.string().valid("ASC", "DESC", "asc", "desc").allow(""),
  sort: Joi.string().valid("ASC", "DESC", "asc", "desc").allow(""),
}).unknown(true);

export const sessionIdParamSchema = Joi.object({
  sessionId: Joi.string().guid({ version: ["uuidv4"] }).required().messages({
    "string.guid": "Mã định danh phiên không hợp lệ (yêu cầu UUIDv4)",
    "any.required": "Thiếu mã phiên đăng nhập",
  }),
});

export const userIdParamSchema = Joi.object({
  userId: Joi.string().guid({ version: ["uuidv4"] }).required().messages({
    "string.guid": "Mã định danh người dùng không hợp lệ (yêu cầu UUIDv4)",
    "any.required": "Thiếu mã người dùng",
  }),
});

export const revokeAllUserSessionsSchema = Joi.object({
  reason: Joi.string().trim().min(3).max(255).required().messages({
    "string.empty": "Vui lòng nhập lý do cưỡng chế thu hồi phiên",
    "string.min": "Lý do thu hồi phải có ít nhất 3 ký tự",
    "string.max": "Lý do thu hồi không được vượt quá 255 ký tự",
    "any.required": "Bắt buộc nhập lý do thu hồi",
  }),
});

// ── Audit Log Schemas ──

export const auditLogQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  pageSize: Joi.number().integer().min(1).max(100),
  search: Joi.string().trim().max(100).allow(""),
  q: Joi.string().trim().max(100).allow(""),
  severity: Joi.string().valid("all", "info", "warn", "error", "critical").default("all"),
  event_category: Joi.string().valid(
    "all",
    "authentication",
    "authorization",
    "security",
    "password",
    "session",
    "user",
    "admin",
    "system"
  ).default("all"),
  event_type: Joi.string().trim().max(50).allow(""),
  status: Joi.string().valid("all", "success", "failure", "pending", "blocked").default("all"),
  start_date: Joi.date().iso().allow(null, ""),
  end_date: Joi.date().iso().allow(null, ""),
  sort_by: Joi.string().valid("created_at", "severity", "status", "event_type", "event_category", "ip_address", "response_time_ms", "user", "username").default("created_at"),
  sortBy: Joi.string().valid("created_at", "severity", "status", "event_type", "event_category", "ip_address", "response_time_ms", "user", "username").allow(""),
  order_by: Joi.string().valid("created_at", "severity", "status", "event_type", "event_category", "ip_address", "response_time_ms", "user", "username").allow(""),
  sort_order: Joi.string().valid("ASC", "DESC", "asc", "desc").default("DESC"),
  sortOrder: Joi.string().valid("ASC", "DESC", "asc", "desc").allow(""),
  sort: Joi.string().valid("ASC", "DESC", "asc", "desc").allow(""),
}).unknown(true);

export const auditLogIdParamSchema = Joi.object({
  id: Joi.string().guid({ version: ["uuidv4"] }).required().messages({
    "string.guid": "Mã nhật ký không hợp lệ (yêu cầu UUIDv4)",
    "any.required": "Thiếu mã nhật ký kiểm toán",
  }),
});
