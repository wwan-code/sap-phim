/**
 * Trình xác thực Thông báo (Notification Validator)
 * 
 * @description Định nghĩa các Schema (Joi) để kiểm tra tính hợp lệ của dữ liệu đầu vào cho module Notification.
 * Đảm bảo các yêu cầu về truy vấn, tạo mới và xóa thông báo tuân thủ cấu trúc hệ thống.
 */
import Joi from "joi";
import {
  NOTIFICATION_TYPE_VALUES,
  NOTIFICATION_PRIORITY_VALUES,
  ENTITY_TYPE_VALUES,
} from "../constants/notification.constant.js";

export const notificationValidator = {
  /**
   * Schema xác thực cho truy vấn danh sách thông báo người dùng
   * 
   * [GET] /api/notifications
   */
  getAll: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    type: Joi.string()
      .valid(...NOTIFICATION_TYPE_VALUES)
      .optional(),
    isRead: Joi.boolean().optional(),
    order_by: Joi.string().optional(),
    sort: Joi.string().valid("ASC", "DESC", "asc", "desc").optional(),
  }),

  /**
   * Schema xác thực cho truy vấn danh sách thông báo quản trị (Admin)
   * 
   * [GET] /api/admin/notifications
   */
  adminGetAll: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    type: Joi.string().allow("", null).optional(),
    priority: Joi.string().allow("", null).optional(),
    isRead: Joi.string().allow("", null).optional(),
    search: Joi.string().allow("", null).optional(),
    order_by: Joi.string().allow("", null).optional(),
    sort: Joi.string().valid("ASC", "DESC", "asc", "desc").allow("", null).optional(),
  }),

  /**
   * Schema xác thực cho việc tạo thông báo thủ công
   * 
   * [POST] /api/notifications
   */
  create: Joi.object({
    targetType: Joi.string()
      .valid("all", "role", "user")
      .default("all")
      .optional(),
    targetRole: Joi.string().trim().max(50).allow("", null).optional(),
    userId: Joi.string()
      .uuid()
      .allow("", null)
      .optional()
      .messages({ "string.guid": "userId phải là UUID hợp lệ" }),
    type: Joi.string()
      .valid(...NOTIFICATION_TYPE_VALUES)
      .required()
      .messages({ "any.only": "Loại thông báo không hợp lệ" }),
    title: Joi.string().trim().min(1).max(255).required(),
    message: Joi.string().trim().min(1).max(2000).required(),
    actionUrl: Joi.string()
      .uri({ allowRelative: true })
      .allow("", null)
      .optional(),
    actionData: Joi.object().optional(),
    icon: Joi.string().max(50).allow("", null).optional(),
    entityType: Joi.string()
      .valid(...ENTITY_TYPE_VALUES)
      .allow("", null)
      .optional(),
    entityId: Joi.string()
      .trim()
      .max(255)
      .allow("", null)
      .optional(),
    actorId: Joi.string().uuid().allow(null).optional(),
    priority: Joi.string()
      .valid(...NOTIFICATION_PRIORITY_VALUES)
      .default("normal"),
    groupKey: Joi.string().trim().max(100).allow("", null).optional(),
    expiresAt: Joi.date().iso().min("now").allow(null).optional(),
  }),

  /**
   * Schema xác thực cho thao tác xóa hàng loạt thông báo (Admin)
   * 
   * [POST] /api/admin/notifications/bulk-delete
   */
  adminBulkDelete: Joi.object({
    ids: Joi.array()
      .items(Joi.string().uuid().required())
      .min(1)
      .required()
      .messages({
        "array.min": "Cần chọn ít nhất một thông báo để xóa",
      }),
  }),

  /**
   * Schema xác nhận khi yêu cầu xóa toàn bộ thông báo
   * 
   * [DELETE] /api/notifications
   */
  deleteAll: Joi.object({
    confirm: Joi.boolean()
      .valid(true)
      .required()
      .messages({ "any.only": "Cần xác nhận xóa tất cả thông báo" }),
  }),

  /**
   * Schema xác thực mã định danh (UUID) trong tham số URL
   */
  paramId: Joi.object({
    id: Joi.string()
      .uuid()
      .required()
      .messages({ "string.guid": "ID thông báo phải là UUID hợp lệ" }),
  }),
};

export default notificationValidator;
