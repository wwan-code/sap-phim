/**
 * @file studio.validator.js
 * @module Validator_Studio
 * @description Xác thực dữ liệu đầu vào cho các yêu cầu liên quan đến hãng sản xuất (Studio).
 */

import Joi from 'joi';

export const studioValidator = {
  /**
   * Schema tạo mới hãng sản xuất
   */
  create: Joi.object({
    name: Joi.string()
      .trim()
      .min(2)
      .max(255)
      .required()
      .messages({
        'string.empty': 'Tên hãng sản xuất không được để trống',
        'string.min': 'Tên hãng sản xuất phải có ít nhất 2 ký tự',
        'string.max': 'Tên hãng sản xuất không được vượt quá 255 ký tự',
        'any.required': 'Tên hãng sản xuất là bắt buộc',
      }),
    logo_url: Joi.string()
      .trim()
      .uri()
      .optional()
      .allow('', null)
      .messages({
        'string.uri': 'Đường dẫn logo không hợp lệ',
      }),
    country: Joi.string()
      .trim()
      .max(100)
      .optional()
      .allow('', null)
      .messages({
        'string.max': 'Tên quốc gia không được vượt quá 100 ký tự',
      }),
    description: Joi.string()
      .trim()
      .optional()
      .allow('', null),
    metadata: Joi.object()
      .optional()
      .default({}),
    is_active: Joi.boolean()
      .optional()
      .default(true),
  }),

  /**
   * Schema cập nhật hãng sản xuất
   */
  update: Joi.object({
    name: Joi.string()
      .trim()
      .min(2)
      .max(255)
      .optional()
      .messages({
        'string.min': 'Tên hãng sản xuất phải có ít nhất 2 ký tự',
        'string.max': 'Tên hãng sản xuất không được vượt quá 255 ký tự',
      }),
    logo_url: Joi.string()
      .trim()
      .uri()
      .optional()
      .allow('', null)
      .messages({
        'string.uri': 'Đường dẫn logo không hợp lệ',
      }),
    country: Joi.string()
      .trim()
      .max(100)
      .optional()
      .allow('', null)
      .messages({
        'string.max': 'Tên quốc gia không được vượt quá 100 ký tự',
      }),
    description: Joi.string()
      .trim()
      .optional()
      .allow('', null),
    metadata: Joi.object()
      .optional(),
    is_active: Joi.boolean()
      .optional(),
  }),

  /**
   * Schema truy vấn danh sách hãng sản xuất
   */
  getList: Joi.object({
    page: Joi.number()
      .integer()
      .min(1)
      .optional()
      .default(1),
    limit: Joi.number()
      .integer()
      .min(1)
      .max(100)
      .optional()
      .default(20),
    is_active: Joi.boolean()
      .optional(),
    search: Joi.string()
      .trim()
      .optional(),
    country: Joi.string()
      .trim()
      .optional(),
    order_by: Joi.string()
      .valid('id', 'name', 'slug', 'country', 'is_active', 'created_at', 'updated_at', 'movies_count')
      .optional()
      .default('name'),
    sort: Joi.string()
      .valid('ASC', 'DESC', 'asc', 'desc')
      .optional()
      .default('ASC'),
    include_deleted: Joi.boolean()
      .optional(),
    only_deleted: Joi.boolean()
      .optional(),
  }),

  /**
   * Schema xóa hàng loạt hãng sản xuất
   */
  bulkDelete: Joi.object({
    ids: Joi.array()
      .items(Joi.string().uuid().required())
      .min(1)
      .required()
      .messages({
        'array.base': 'ids phải là một mảng',
        'array.min': 'Danh sách ID không được để trống',
      }),
  }),

  /**
   * Schema khôi phục hàng loạt hãng sản xuất
   */
  bulkRestore: Joi.object({
    ids: Joi.array()
      .items(Joi.string().uuid().required())
      .min(1)
      .required()
      .messages({
        'array.base': 'ids phải là một mảng',
        'array.min': 'Danh sách ID không được để trống',
      }),
  }),
};

export default studioValidator;
