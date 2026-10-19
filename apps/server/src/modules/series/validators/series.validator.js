/**
 * @file series.validator.js
 * @module Validator_Series
 * @description Xác thực dữ liệu đầu vào cho các yêu cầu liên quan đến thương hiệu phim (Series).
 */

import Joi from 'joi';

export const seriesValidator = {
  /**
   * Schema tạo mới thương hiệu phim
   */
  create: Joi.object({
    name: Joi.string()
      .trim()
      .min(2)
      .max(255)
      .required()
      .messages({
        'string.empty': 'Tên thương hiệu không được để trống',
        'string.min': 'Tên thương hiệu phải có ít nhất 2 ký tự',
        'string.max': 'Tên thương hiệu không được vượt quá 255 ký tự',
        'any.required': 'Tên thương hiệu là bắt buộc',
      }),
    is_active: Joi.boolean()
      .optional()
      .default(true),
  }),

  /**
   * Schema cập nhật thương hiệu phim
   */
  update: Joi.object({
    name: Joi.string()
      .trim()
      .min(2)
      .max(255)
      .optional()
      .messages({
        'string.min': 'Tên thương hiệu phải có ít nhất 2 ký tự',
        'string.max': 'Tên thương hiệu không được vượt quá 255 ký tự',
      }),
    is_active: Joi.boolean()
      .optional(),
  }),

  /**
   * Schema truy vấn danh sách thương hiệu phim
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
    order_by: Joi.string()
      .valid('id', 'name', 'slug', 'total_movies', 'is_active', 'created_at', 'updated_at')
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
   * Schema xóa hàng loạt series
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
   * Schema khôi phục hàng loạt series
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

export default seriesValidator;
