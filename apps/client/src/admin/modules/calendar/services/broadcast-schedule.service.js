/**
 * @file broadcast-schedule.service.js
 * @module Admin/Modules/Calendar/Services/BroadcastScheduleService
 * @description Service kết nối HTTP API cho Broadcast Calendar (Lịch phát sóng) ở Admin & Client.
 */

import api from '@/shared/services/api';
import { ENDPOINTS } from '@/shared/constants/api-endpoints.constants';

class BroadcastScheduleService {
  /**
   * Lấy danh sách lịch phát sóng tuần
   * @param {number} [weekOffset=0]
   * @returns {Promise<Array<Object>>}
   */
  async getWeeklySchedule(weekOffset = 0) {
    const response = await api.get(ENDPOINTS.BROADCAST_SCHEDULES.PUBLIC_WEEKLY, {
      params: { week_offset: weekOffset },
    });
    return response.data?.data || [];
  }

  /**
   * Lấy lịch chiếu theo khoảng thời gian công khai
   * @param {Object} [params={}]
   * @returns {Promise<Array<Object>>}
   */
  async getPublicCalendar(params = {}) {
    const response = await api.get(ENDPOINTS.BROADCAST_SCHEDULES.PUBLIC_CALENDAR, { params });
    return response.data?.data || [];
  }

  /**
   * Lấy toàn bộ cấu hình schedule và rules của một phim
   * @param {string} movieId
   * @returns {Promise<Object|null>}
   */
  async getScheduleByMovie(movieId) {
    if (!movieId) return null;
    const response = await api.get(ENDPOINTS.BROADCAST_SCHEDULES.BY_MOVIE(movieId));
    return response.data?.data || null;
  }

  /**
   * Tạo hoặc cập nhật lịch phát sóng & rules cho phim
   * @param {string} movieId
   * @param {Object} data
   * @returns {Promise<Object>}
   */
  async upsertSchedule(movieId, data) {
    const response = await api.post(ENDPOINTS.BROADCAST_SCHEDULES.UPSERT(movieId), data);
    return response.data?.data;
  }

  /**
   * Xóa lịch phát sóng của một phim
   * @param {string} movieId
   * @returns {Promise<Object>}
   */
  async deleteSchedule(movieId) {
    const response = await api.delete(ENDPOINTS.BROADCAST_SCHEDULES.DELETE(movieId));
    return response.data;
  }

  /**
   * Lấy danh sách calendar của 1 phim theo date range
   * @param {string} movieId
   * @param {Object} [params={}]
   * @returns {Promise<Array<Object>>}
   */
  async getCalendarByDateRange(movieId, params = {}) {
    const response = await api.get(ENDPOINTS.BROADCAST_SCHEDULES.CALENDAR_BY_DATE(movieId), { params });
    return response.data?.data || [];
  }

  /**
   * Ghi đè thời gian phát sóng 1 tập
   * @param {string} calendarId
   * @param {string|Date} releaseTime
   * @returns {Promise<Object>}
   */
  async overrideCalendar(calendarId, releaseTime) {
    const response = await api.patch(ENDPOINTS.BROADCAST_SCHEDULES.OVERRIDE(calendarId), {
      release_time: releaseTime,
    });
    return response.data?.data;
  }

  /**
   * Khôi phục 1 tập về mốc giờ quy tắc mặc định
   * @param {string} calendarId
   * @returns {Promise<Object>}
   */
  async restoreCalendar(calendarId) {
    const response = await api.post(ENDPOINTS.BROADCAST_SCHEDULES.RESTORE(calendarId));
    return response.data?.data;
  }

  /**
   * Ghi đè hàng loạt danh sách lịch chiếu
   * @param {Array<{ calendarId: string, release_time: string }>} overrides
   * @returns {Promise<Array<Object>>}
   */
  async batchOverride(overrides) {
    const response = await api.patch(ENDPOINTS.BROADCAST_SCHEDULES.BATCH_OVERRIDE, { overrides });
    return response.data?.data || [];
  }

  /**
   * Cập nhật trạng thái tập phim (upcoming / delayed / cancelled)
   * @param {string} calendarId
   * @param {string} status
   * @param {string} [delayReason=null]
   * @returns {Promise<Object>}
   */
  async updateCalendarStatus(calendarId, status, delayReason = null) {
    const response = await api.patch(ENDPOINTS.BROADCAST_SCHEDULES.UPDATE_STATUS(calendarId), {
      status,
      delay_reason: delayReason,
    });
    return response.data?.data;
  }

  /**
   * Buộc tái tạo lại calendar cho phim (Force regenerate)
   * @param {string} movieId
   * @returns {Promise<Object>}
   */
  async regenerateCalendar(movieId) {
    const response = await api.post(ENDPOINTS.BROADCAST_SCHEDULES.REGENERATE(movieId));
    return response.data?.data;
  }
}

export const broadcastScheduleService = new BroadcastScheduleService();
export default broadcastScheduleService;
