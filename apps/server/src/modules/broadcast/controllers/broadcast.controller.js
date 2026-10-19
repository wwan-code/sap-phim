/**
 * @file broadcast.controller.js
 * @module Controllers_Broadcast
 * @description Controllers cho Broadcast Schedule API (Lịch phát sóng, RRULE & Calendar)
 */

import broadcastService from '../services/broadcast.service.js';
import calendarService from '../services/calendar.service.js';
import { responseUtil } from '../../../utils/response.util.js';
import { logger } from '../../../utils/logger.js';

/**
 * Lấy chi tiết lịch phát sóng của một Phim
 * @route GET /api/v1/broadcast-schedules/:movieId
 */
export const getSchedule = async (req, res, next) => {
  try {
    logger.info(`[Ctrl][Broadcast] GET /:movieId`);
    const { movieId } = req.params;
    const schedule = await broadcastService.getScheduleByMovie(movieId);
    return responseUtil.success(res, schedule, 'Lấy lịch phát sóng thành công');
  } catch (error) {
    next(error);
  }
};

/**
 * Tạo mới hoặc cập nhật Lịch phát sóng & Rules cho Phim
 * @route POST /api/v1/broadcast-schedules/:movieId
 */
export const upsertSchedule = async (req, res, next) => {
  try {
    logger.info(`[Ctrl][Broadcast] POST /:movieId`);
    const { movieId } = req.params;
    const data = req.body;
    const schedule = await broadcastService.upsertSchedule(movieId, data);
    return responseUtil.success(res, schedule, 'Cập nhật lịch phát sóng thành công');
  } catch (error) {
    next(error);
  }
};

/**
 * Xóa Lịch phát sóng của một Phim (Cascade delete)
 * @route DELETE /api/v1/broadcast-schedules/:movieId
 */
export const deleteSchedule = async (req, res, next) => {
  try {
    logger.info(`[Ctrl][Broadcast] DELETE /:movieId`);
    const { movieId } = req.params;
    const result = await broadcastService.deleteSchedule(movieId);
    return responseUtil.success(res, result, 'Xóa lịch phát sóng thành công');
  } catch (error) {
    next(error);
  }
};

/**
 * Truy vấn danh sách Calendar của 1 Phim theo khoảng thời gian (Date Range)
 * @route GET /api/v1/broadcast-schedules/:movieId/calendar
 */
export const getCalendarByDateRange = async (req, res, next) => {
  try {
    logger.info(`[Ctrl][Broadcast] GET /:movieId/calendar`);
    const { movieId } = req.params;
    const { from, to } = req.query;
    const schedule = await broadcastService.getScheduleByMovie(movieId);
    if (!schedule) {
      return responseUtil.success(res, [], 'Chưa có lịch phát sóng');
    }
    const calendars = await calendarService.getCalendarByDateRange(schedule.id, from, to);
    return responseUtil.success(res, calendars, 'Lấy danh sách lịch chiếu thành công');
  } catch (error) {
    next(error);
  }
};

/**
 * Lấy lịch chiếu tuần công khai (Public)
 * @route GET /api/v1/broadcast-schedules/public/weekly
 */
export const getWeeklySchedule = async (req, res, next) => {
  try {
    logger.info(`[Ctrl][Broadcast] GET /public/weekly`);
    const weekOffset = req.query.week_offset ? parseInt(req.query.week_offset, 10) : 0;
    const schedules = await broadcastService.getWeeklySchedule(weekOffset);
    return responseUtil.success(res, schedules, 'Lấy lịch chiếu trong tuần thành công');
  } catch (error) {
    next(error);
  }
};

/**
 * Truy vấn lịch chiếu công khai theo khoảng thời gian
 * @route GET /api/v1/broadcast-schedules/public/calendar
 */
export const getPublicCalendar = async (req, res, next) => {
  try {
    logger.info(`[Ctrl][Broadcast] GET /public/calendar`);
    const { from, to } = req.query;
    const calendars = await broadcastService.getPublicCalendar(from, to);
    return responseUtil.success(res, calendars, 'Lấy lịch chiếu công khai thành công');
  } catch (error) {
    next(error);
  }
};

/**
 * Ghi đè thủ công thời gian phát sóng 1 tập
 * @route PATCH /api/v1/broadcast-schedules/calendar/:calendarId/override
 */
export const overrideCalendar = async (req, res, next) => {
  try {
    logger.info(`[Ctrl][Broadcast] PATCH /calendar/:calendarId/override`);
    const { calendarId } = req.params;
    const { release_time } = req.body;
    const updated = await calendarService.overrideCalendarEntry(calendarId, release_time);
    return responseUtil.success(res, updated, 'Ghi đè lịch thành công');
  } catch (error) {
    next(error);
  }
};

/**
 * Khôi phục 1 tập về mốc thời gian quy tắc mặc định
 * @route POST /api/v1/broadcast-schedules/calendar/:calendarId/restore
 */
export const restoreCalendar = async (req, res, next) => {
  try {
    logger.info(`[Ctrl][Broadcast] POST /calendar/:calendarId/restore`);
    const { calendarId } = req.params;
    const restored = await calendarService.restoreCalendarEntry(calendarId);
    return responseUtil.success(res, restored, 'Khôi phục lịch về mặc định thành công');
  } catch (error) {
    next(error);
  }
};

/**
 * Ghi đè hàng loạt danh sách lịch chiếu (Drag-and-Drop batch)
 * @route PATCH /api/v1/broadcast-schedules/calendar/batch
 */
export const batchOverrideCalendars = async (req, res, next) => {
  try {
    logger.info(`[Ctrl][Broadcast] PATCH /calendar/batch`);
    const { overrides } = req.body;
    const results = await calendarService.batchOverrideCalendars(overrides);
    return responseUtil.success(res, results, 'Cập nhật hàng loạt lịch chiếu thành công');
  } catch (error) {
    next(error);
  }
};

/**
 * Cập nhật trạng thái Calendar entry (upcoming / delayed / cancelled) kèm lý do
 * @route PATCH /api/v1/broadcast-schedules/calendar/:calendarId/status
 */
export const updateCalendarStatus = async (req, res, next) => {
  try {
    logger.info(`[Ctrl][Broadcast] PATCH /calendar/:calendarId/status`);
    const { calendarId } = req.params;
    const { status, delay_reason } = req.body;
    const updated = await calendarService.updateCalendarStatus(calendarId, status, delay_reason);
    return responseUtil.success(res, updated, 'Cập nhật trạng thái lịch chiếu thành công');
  } catch (error) {
    next(error);
  }
};

/**
 * Buộc tính toán lại toàn bộ lịch phát sóng cho một phim (Force Regenerate)
 * @route POST /api/v1/broadcast-schedules/:movieId/regenerate
 */
export const regenerateCalendar = async (req, res, next) => {
  try {
    logger.info(`[Ctrl][Broadcast] POST /:movieId/regenerate`);
    const { movieId } = req.params;
    const result = await broadcastService.regenerateCalendar(movieId);
    return responseUtil.success(res, result, 'Tái tạo lịch chiếu thành công');
  } catch (error) {
    next(error);
  }
};
