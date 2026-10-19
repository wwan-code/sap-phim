/**
 * @file broadcast.service.js
 * @module Services/BroadcastService
 * @description Dịch vụ quản lý lịch phát sóng (Broadcast Calendar & Schedules) cho Client & Admin, kế thừa BaseService.
 */

import BaseService from './base.service';
import api from './api';
import { ENDPOINTS } from '@/shared/constants/api-endpoints.constants';

/**
 * @class BroadcastService
 * @extends BaseService
 * @description Quản lý toàn bộ API tương tác với hệ thống lịch phát sóng, rules và calendar overrides.
 */
class BroadcastService extends BaseService {
  constructor() {
    super('BroadcastService', {
      enableCache: true,
      enableMetrics: true,
      requestTimeout: 15000,
    });
  }

  // ════════════════════════════════════════
  // PUBLIC APIS
  // ════════════════════════════════════════

  /**
   * Lấy danh sách lịch phát sóng theo tuần
   * @param {number} [weekOffset=0]
   * @returns {Promise<Array<Object>>}
   */
  async listWeekly(weekOffset = 0) {
    return this._measure('listWeekly', async () => {
      const response = await api.get(ENDPOINTS.BROADCAST_SCHEDULES.PUBLIC_WEEKLY, {
        params: { week_offset: weekOffset },
      });
      return this._extractData(response);
    });
  }

  /**
   * Lấy danh sách lịch chiếu công khai theo khoảng thời gian
   * @param {Object} [params={}] { start_date, end_date }
   * @returns {Promise<Array<Object>>}
   */
  async getPublicCalendar(params = {}) {
    return this._measure('getPublicCalendar', async () => {
      const cleanParams = this._cleanParams(params);
      const response = await api.get(ENDPOINTS.BROADCAST_SCHEDULES.PUBLIC_CALENDAR, {
        params: cleanParams,
      });
      return this._extractData(response);
    });
  }

  // ════════════════════════════════════════
  // ADMIN & MODERATOR APIS
  // ════════════════════════════════════════

  /**
   * Lấy cấu hình lịch phát sóng & danh sách rules của một phim
   * @param {string} movieId - UUID của phim
   * @returns {Promise<Object|null>}
   */
  async getByMovieId(movieId) {
    this._validateId(movieId, 'phim');
    return this._measure('admin.getByMovieId', async () => {
      const response = await api.get(ENDPOINTS.BROADCAST_SCHEDULES.BY_MOVIE(movieId));
      return this._extractData(response);
    });
  }

  /**
   * Tạo hoặc cập nhật cấu hình lịch phát sóng & rules cho phim
   * @param {string} movieId - UUID của phim
   * @param {Object} payload - { anchor_date, anchor_episode, is_active, is_auto_publish, rules }
   * @returns {Promise<Object>}
   */
  async upsert(movieId, payload) {
    this._validateId(movieId, 'phim');
    return this._measure('admin.upsert', async () => {
      const response = await api.post(ENDPOINTS.BROADCAST_SCHEDULES.UPSERT(movieId), payload);
      return this._extractData(response);
    });
  }

  /**
   * Xóa cấu hình lịch phát sóng của một phim
   * @param {string} movieId - UUID của phim
   * @returns {Promise<Object>}
   */
  async delete(movieId) {
    this._validateId(movieId, 'phim');
    return this._measure('admin.delete', async () => {
      const response = await api.delete(ENDPOINTS.BROADCAST_SCHEDULES.DELETE(movieId));
      return this._extractData(response);
    });
  }

  /**
   * Lấy danh sách lịch chiếu chi tiết của 1 phim theo khoảng ngày
   * @param {string} movieId - UUID của phim
   * @param {Object} [params={}] { start_date, end_date }
   * @returns {Promise<Array<Object>>}
   */
  async getCalendarByDateRange(movieId, params = {}) {
    this._validateId(movieId, 'phim');
    return this._measure('admin.getCalendarByDateRange', async () => {
      const cleanParams = this._cleanParams(params);
      const response = await api.get(ENDPOINTS.BROADCAST_SCHEDULES.CALENDAR_BY_DATE(movieId), {
        params: cleanParams,
      });
      return this._extractData(response);
    });
  }

  /**
   * Ghi đè thời gian phát sóng của một tập cụ thể
   * @param {string} calendarId - UUID của calendar entry
   * @param {string|Date} releaseTime - Thời điểm phát sóng mới (ISO string)
   * @returns {Promise<Object>}
   */
  async overrideCalendar(calendarId, releaseTime) {
    this._validateId(calendarId, 'lịch chiếu');
    return this._measure('admin.overrideCalendar', async () => {
      const response = await api.patch(ENDPOINTS.BROADCAST_SCHEDULES.OVERRIDE(calendarId), {
        release_time: releaseTime,
      });
      return this._extractData(response);
    });
  }

  /**
   * Khôi phục tập bị ghi đè về mốc giờ tính toán mặc định theo rule
   * @param {string} calendarId - UUID của calendar entry
   * @returns {Promise<Object>}
   */
  async restoreCalendar(calendarId) {
    this._validateId(calendarId, 'lịch chiếu');
    return this._measure('admin.restoreCalendar', async () => {
      const response = await api.post(ENDPOINTS.BROADCAST_SCHEDULES.RESTORE(calendarId));
      return this._extractData(response);
    });
  }

  /**
   * Ghi đè hàng loạt danh sách lịch chiếu
   * @param {Array<{ calendarId: string, release_time: string }>} overrides
   * @returns {Promise<Array<Object>>}
   */
  async batchOverride(overrides) {
    return this._measure('admin.batchOverride', async () => {
      const response = await api.patch(ENDPOINTS.BROADCAST_SCHEDULES.BATCH_OVERRIDE, { overrides });
      return this._extractData(response);
    });
  }

  /**
   * Cập nhật trạng thái tập phim (upcoming / delayed / cancelled / released)
   * @param {string} calendarId - UUID của calendar entry
   * @param {string} status - 'upcoming' | 'delayed' | 'cancelled' | 'released'
   * @param {string|null} [delayReason=null] - Lý do hoãn (nếu delayed)
   * @returns {Promise<Object>}
   */
  async updateStatus(calendarId, status, delayReason = null) {
    this._validateId(calendarId, 'lịch chiếu');
    return this._measure('admin.updateStatus', async () => {
      const response = await api.patch(ENDPOINTS.BROADCAST_SCHEDULES.UPDATE_STATUS(calendarId), {
        status,
        delay_reason: delayReason,
      });
      return this._extractData(response);
    });
  }

  /**
   * Buộc tính toán và tái tạo lại toàn bộ calendar tương lai cho phim
   * @param {string} movieId - UUID của phim
   * @returns {Promise<Object>}
   */
  async regenerate(movieId) {
    this._validateId(movieId, 'phim');
    return this._measure('admin.regenerate', async () => {
      const response = await api.post(ENDPOINTS.BROADCAST_SCHEDULES.REGENERATE(movieId));
      return this._extractData(response);
    });
  }
}

export const broadcastService = new BroadcastService();
export { BroadcastService };
export default broadcastService;
