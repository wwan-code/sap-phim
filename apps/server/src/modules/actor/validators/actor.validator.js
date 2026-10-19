/**
 * @file actor.validator.js
 * @module Validator_Actor
 * @description Xác thực dữ liệu đầu vào cho các yêu cầu liên quan đến diễn viên (Actor).
 */

import Joi from 'joi';

export const actorValidator = {
  /**
   * Schema tạo mới diễn viên
   */
  create: Joi.object({
    name: Joi.string()
      .trim()
      .min(2)
      .max(255)
      .required()
      .messages({
        'string.empty': 'Tên diễn viên không được để trống',
        'string.min': 'Tên diễn viên phải có ít nhất 2 ký tự',
        'string.max': 'Tên diễn viên không được vượt quá 255 ký tự',
        'any.required': 'Tên diễn viên là bắt buộc',
      }),
    image_url: Joi.string()
      .trim()
      .uri()
      .optional()
      .allow('', null)
      .messages({
        'string.uri': 'Đường dẫn ảnh đại diện không hợp lệ',
      }),
    gender: Joi.string()
      .valid('male', 'female', 'other', 'unknown')
      .optional()
      .default('unknown')
      .messages({
        'any.only': 'Giới tính không hợp lệ',
      }),
    birth_date: Joi.date()
      .iso()
      .optional()
      .allow(null)
      .messages({
        'date.format': 'Ngày sinh không hợp lệ, định dạng chuẩn ISO (YYYY-MM-DD)',
      }),
    nationality: Joi.string()
      .trim()
      .max(100)
      .optional()
      .allow('', null)
      .messages({
        'string.max': 'Quốc tịch không được vượt quá 100 ký tự',
      }),
    biography: Joi.string()
      .trim()
      .optional()
      .allow('', null),
    description: Joi.string()
      .trim()
      .optional()
      .allow('', null),
    aliases: Joi.array()
      .items(Joi.string().trim())
      .optional()
      .default([]),
    metadata: Joi.object()
      .optional()
      .default({}),
    popularity_score: Joi.number()
      .integer()
      .min(0)
      .optional()
      .default(0),
    is_active: Joi.boolean()
      .optional()
      .default(true),
  }),

  /**
   * Schema cập nhật diễn viên
   */
  update: Joi.object({
    name: Joi.string()
      .trim()
      .min(2)
      .max(255)
      .optional()
      .messages({
        'string.min': 'Tên diễn viên phải có ít nhất 2 ký tự',
        'string.max': 'Tên diễn viên không được vượt quá 255 ký tự',
      }),
    image_url: Joi.string()
      .trim()
      .uri()
      .optional()
      .allow('', null)
      .messages({
        'string.uri': 'Đường dẫn ảnh đại diện không hợp lệ',
      }),
    gender: Joi.string()
      .valid('male', 'female', 'other', 'unknown')
      .optional()
      .messages({
        'any.only': 'Giới tính không hợp lệ',
      }),
    birth_date: Joi.date()
      .iso()
      .optional()
      .allow(null)
      .messages({
        'date.format': 'Ngày sinh không hợp lệ, định dạng chuẩn ISO (YYYY-MM-DD)',
      }),
    nationality: Joi.string()
      .trim()
      .max(100)
      .optional()
      .allow('', null)
      .messages({
        'string.max': 'Quốc tịch không được vượt quá 100 ký tự',
      }),
    biography: Joi.string()
      .trim()
      .optional()
      .allow('', null),
    description: Joi.string()
      .trim()
      .optional()
      .allow('', null),
    aliases: Joi.array()
      .items(Joi.string().trim())
      .optional(),
    metadata: Joi.object()
      .optional(),
    popularity_score: Joi.number()
      .integer()
      .min(0)
      .optional(),
    is_active: Joi.boolean()
      .optional(),
  }),

  /**
   * Schema truy vấn danh sách diễn viên
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
    gender: Joi.string()
      .valid('male', 'female', 'other', 'unknown')
      .optional(),
    nationality: Joi.string()
      .trim()
      .optional(),
    order_by: Joi.string()
      .valid('id', 'name', 'slug', 'gender', 'nationality', 'popularity_score', 'birth_date', 'movies_count', 'is_active', 'created_at', 'updated_at')
      .optional()
      .default('popularity_score'),
    sort: Joi.string()
      .valid('ASC', 'DESC', 'asc', 'desc')
      .optional()
      .default('DESC'),
    include_deleted: Joi.boolean()
      .optional(),
    only_deleted: Joi.boolean()
      .optional(),
  }),

  /**
   * Schema xóa hàng loạt diễn viên
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
   * Schema khôi phục hàng loạt diễn viên
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

export default actorValidator;
