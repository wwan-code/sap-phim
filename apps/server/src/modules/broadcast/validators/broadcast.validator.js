/**
 * @file broadcast.validator.js
 * @module Validator_Broadcast
 * @description Bộ schemas Joi xác thực dữ liệu đầu vào cho module Lịch phát sóng (Broadcast Module).
 */

import Joi from 'joi';

const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$/;

const ruleItemSchema = Joi.object({
  id: Joi.string().uuid().optional(),
  type: Joi.string().valid('weekly', 'daily', 'specific_date').default('weekly'),
  day_of_week: Joi.number().integer().min(0).max(6).allow(null).optional(),
  release_time: Joi.string().pattern(timeRegex).allow('', null).optional()
    .messages({
      'string.pattern.base': 'Khung giờ phát sóng phải có định dạng HH:mm hoặc HH:mm:ss (VD: 20:00)',
    }),
  specific_date: Joi.date().iso().allow(null).optional(),
  rrule_string: Joi.string().trim().max(500).allow('', null).optional(),
  dtstart: Joi.date().iso().allow(null).optional(),
  description: Joi.string().trim().max(255).allow('', null).optional(),
});

export const broadcastValidator = {
  /**
   * Tạo hoặc cập nhật Schedule cho Phim
   */
  upsertSchedule: Joi.object({
    timezone: Joi.string().trim().default('Asia/Ho_Chi_Minh'),
    status: Joi.string().valid('active', 'inactive', 'ended', 'hiatus').default('active'),
    notes: Joi.string().trim().max(1000).allow('', null).optional(),
    anchor_date: Joi.date().iso().allow(null).optional(),
    auto_publish: Joi.boolean().default(true),
    rules: Joi.array().items(ruleItemSchema).default([]),
  }),

  /**
   * Ghi đè thủ công 1 Calendar entry
   */
  overrideCalendar: Joi.object({
    release_time: Joi.date().iso().required().messages({
      'any.required': 'Thời gian phát sóng mới không được để trống',
      'date.base': 'Thời gian phát sóng không hợp lệ',
    }),
  }),

  /**
   * Ghi đè hàng loạt (Batch Override) cho Drag-and-Drop
   */
  batchOverride: Joi.object({
    overrides: Joi.array().items(
      Joi.object({
        calendarId: Joi.string().uuid().required().messages({
          'string.guid': 'Mã lịch chiếu (calendarId) không hợp lệ',
          'any.required': 'Mã lịch chiếu (calendarId) là bắt buộc',
        }),
        release_time: Joi.date().iso().required().messages({
          'any.required': 'Thời gian phát sóng mới là bắt buộc',
          'date.base': 'Thời gian phát sóng không hợp lệ',
        }),
      })
    ).min(1).required().messages({
      'array.min': 'Danh sách ghi đè phải có ít nhất 1 mục',
      'any.required': 'Danh sách ghi đè là bắt buộc',
    }),
  }),

  /**
   * Cập nhật trạng thái Calendar entry (upcoming / delayed / cancelled)
   */
  updateCalendarStatus: Joi.object({
    status: Joi.string().valid('upcoming', 'delayed', 'cancelled').required().messages({
      'any.only': 'Trạng thái phải là upcoming, delayed hoặc cancelled',
      'any.required': 'Trạng thái là bắt buộc',
    }),
    delay_reason: Joi.string().trim().max(500).allow('', null).optional(),
  }),

  /**
   * Validate query params cho date range
   */
  calendarDateRangeQuery: Joi.object({
    from: Joi.date().iso().optional(),
    to: Joi.date().iso().optional(),
  }),

  /**
   * Validate query params cho weekly schedule
   */
  weeklyScheduleQuery: Joi.object({
    week_offset: Joi.number().integer().min(-52).max(52).default(0).optional(),
  }),
};

export default broadcastValidator;
