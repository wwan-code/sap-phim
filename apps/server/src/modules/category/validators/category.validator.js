/**
 * @file category.validator.js
 * @module Validator_Category
 * @description Xác thực dữ liệu đầu vào cho các yêu cầu liên quan đến danh mục (Category).
 */

import Joi from 'joi';

export const categoryValidator = {
  /**
   * Schema tạo mới danh mục
   */
  create: Joi.object({
    name: Joi.string()
      .trim()
      .min(2)
      .max(150)
      .required()
      .messages({
        'string.empty': 'Tên danh mục không được để trống',
        'string.min': 'Tên danh mục phải có ít nhất 2 ký tự',
        'string.max': 'Tên danh mục không được vượt quá 150 ký tự',
      }),
    description: Joi.string()
      .trim()
      .max(1000)
      .optional()
      .allow('', null)
      .messages({
        'string.max': 'Mô tả không được vượt quá 1000 ký tự',
      }),
    is_active: Joi.boolean()
      .optional()
      .default(true)
      .messages({
        'boolean.base': 'is_active phải là giá trị boolean',
      }),
    order_num: Joi.number()
      .integer()
      .min(0)
      .optional()
      .default(0)
      .messages({
        'number.base': 'order_num phải là một số nguyên',
        'number.min': 'order_num phải lớn hơn hoặc bằng 0',
      }),
  }),

  /**
   * Schema cập nhật danh mục
   */
  update: Joi.object({
    name: Joi.string()
      .trim()
      .min(2)
      .max(150)
      .optional()
      .messages({
        'string.min': 'Tên danh mục phải có ít nhất 2 ký tự',
        'string.max': 'Tên danh mục không được vượt quá 150 ký tự',
      }),
    description: Joi.string()
      .trim()
      .max(1000)
      .optional()
      .allow('', null)
      .messages({
        'string.max': 'Mô tả không được vượt quá 1000 ký tự',
      }),
    is_active: Joi.boolean()
      .optional()
      .messages({
        'boolean.base': 'is_active phải là giá trị boolean',
      }),
    order_num: Joi.number()
      .integer()
      .min(0)
      .optional()
      .messages({
        'number.base': 'order_num phải là một số nguyên',
        'number.min': 'order_num phải lớn hơn hoặc bằng 0',
      }),
  }),

  /**
   * Schema truy vấn danh sách
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
      .optional()
      .default('order_num'),
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
   * Schema xóa hàng loạt danh mục
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
   * Schema khôi phục hàng loạt danh mục
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

export default categoryValidator;
