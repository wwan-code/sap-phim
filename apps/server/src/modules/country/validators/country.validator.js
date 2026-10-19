/**
 * @file country.validator.js
 * @module Validator_Country
 * @description Xác thực dữ liệu đầu vào cho các yêu cầu liên quan đến quốc gia (Country).
 */

import Joi from 'joi';

export const countryValidator = {
  /**
   * Schema tạo mới quốc gia
   */
  create: Joi.object({
    name: Joi.string()
      .trim()
      .min(2)
      .max(150)
      .required()
      .messages({
        'string.empty': 'Tên quốc gia không được để trống',
        'string.min': 'Tên quốc gia phải có ít nhất 2 ký tự',
        'string.max': 'Tên quốc gia không được vượt quá 150 ký tự',
      }),
    code: Joi.string()
      .trim()
      .length(2)
      .required()
      .uppercase()
      .messages({
        'string.empty': 'Mã quốc gia không được để trống',
        'string.length': 'Mã quốc gia phải có đúng 2 ký tự',
      }),
    flag_url: Joi.string()
      .trim()
      .uri()
      .optional()
      .allow('', null)
      .messages({
        'string.uri': 'flag_url phải là một URL hợp lệ',
      }),
    is_active: Joi.boolean()
      .optional()
      .default(true)
      .messages({
        'boolean.base': 'is_active phải là giá trị boolean',
      }),
  }),

  /**
   * Schema cập nhật quốc gia
   */
  update: Joi.object({
    name: Joi.string()
      .trim()
      .min(2)
      .max(150)
      .optional()
      .messages({
        'string.min': 'Tên quốc gia phải có ít nhất 2 ký tự',
        'string.max': 'Tên quốc gia không được vượt quá 150 ký tự',
      }),
    flag_url: Joi.string()
      .trim()
      .uri()
      .optional()
      .allow('', null)
      .messages({
        'string.uri': 'flag_url phải là một URL hợp lệ',
      }),
    is_active: Joi.boolean()
      .optional()
      .messages({
        'boolean.base': 'is_active phải là giá trị boolean',
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
   * Schema xóa hàng loạt quốc gia
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
   * Schema khôi phục hàng loạt quốc gia
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

export default countryValidator;
