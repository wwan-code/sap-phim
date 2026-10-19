/**
 * @file broadcast.service.js
 * @module Services_Broadcast
 * @description Service điều phối (Orchestrator) quản lý Lịch phát sóng (BroadcastSchedule) & Quy tắc RRULE (RFC 5545).
 * Tích hợp Redis Caching cho Public APIs và ủy quyền Calendar CRUD sang CalendarService.
 */

import { Op } from 'sequelize';
import moment from 'moment-timezone';
import {
  sequelize,
  BroadcastSchedule,
  ReleaseRule,
  BroadcastCalendar,
  Episode,
  Movie,
  Genre,
} from '../../../models/index.js';
import { legacyToRRule, resolveRuleToRRule, validateRRule } from '../utils/rrule-engine.util.js';
import { calendarService } from './calendar.service.js';
import { schedulerService } from './scheduler.service.js';
import {
  getCachedWeeklySchedule,
  setCachedWeeklySchedule,
  getCachedPublicCalendar,
  setCachedPublicCalendar,
  invalidateBroadcastCache,
} from '../utils/broadcast-cache.util.js';
import { emitToAll, emitToRoom } from '../../../sockets/services/emit.service.js';
import { SOCKET_EVENTS } from '../../../sockets/constants/socket-events.constants.js';
import { SOCKET_ROOMS } from '../../../sockets/constants/socket-rooms.constants.js';
import { logger } from '../../../utils/logger.js';
import { NotFoundError, BadRequestError } from '../../../utils/app-error.js';

class BroadcastService {
  /**
   * Tạo hoặc cập nhật Broadcast Schedule & Release Rules cho Movie
   * @param {string} movieId - ID của phim
   * @param {Object} data - Dữ liệu { timezone, status, notes, anchor_date, auto_publish, rules }
   * @returns {Promise<Object>} Schedule hoàn chỉnh
   */
  async upsertSchedule(movieId, data) {
    const transaction = await sequelize.transaction();
    try {
      const movie = await Movie.findByPk(movieId, { transaction });
      if (!movie) {
        throw new NotFoundError('Không tìm thấy phim');
      }

      let schedule = await BroadcastSchedule.findOne({ where: { movie_id: movieId }, transaction });

      if (!schedule) {
        schedule = await BroadcastSchedule.create(
          {
            movie_id: movieId,
            timezone: data.timezone || 'Asia/Ho_Chi_Minh',
            status: data.status || 'active',
            notes: data.notes || null,
            anchor_date: data.anchor_date || null,
            auto_publish: data.auto_publish !== undefined ? data.auto_publish : true,
          },
          { transaction }
        );
      } else {
        await schedule.update(
          {
            timezone: data.timezone || schedule.timezone,
            status: data.status || schedule.status,
            notes: data.notes !== undefined ? data.notes : schedule.notes,
            anchor_date: data.anchor_date !== undefined ? data.anchor_date : schedule.anchor_date,
            auto_publish: data.auto_publish !== undefined ? data.auto_publish : schedule.auto_publish,
          },
          { transaction }
        );
      }

      // Xử lý Release Rules (RRULE RFC 5545)
      if (data.rules && Array.isArray(data.rules)) {
        await ReleaseRule.destroy({ where: { schedule_id: schedule.id }, transaction });

        const dtstart = data.anchor_date ? new Date(data.anchor_date) : new Date();

        const newRules = data.rules.map((rule) => {
          const rruleString = resolveRuleToRRule(rule, dtstart, 52, schedule.timezone);

          if (!validateRRule(rruleString)) {
            throw new BadRequestError(`Cấu hình rule không hợp lệ: ${rruleString}`);
          }

          return {
            schedule_id: schedule.id,
            type: rule.type || 'weekly',
            day_of_week: rule.day_of_week !== undefined ? rule.day_of_week : null,
            release_time: rule.release_time || null,
            specific_date: rule.specific_date || null,
            rrule_string: rruleString,
            dtstart: rule.dtstart || dtstart,
            description: rule.description || null,
          };
        });

        await ReleaseRule.bulkCreate(newRules, { transaction });
      }

      await transaction.commit();

      // Tự động tính toán lại Calendar nếu status đang active
      if (schedule.status === 'active') {
        await calendarService.generateCalendar(schedule.id);
      }

      // Invalidate Cache
      await invalidateBroadcastCache();

      // Emit socket cập nhật schedule
      const eventPayload = {
        scheduleId: schedule.id,
        movieId,
        status: schedule.status,
        updatedAt: new Date().toISOString(),
      };
      emitToAll(SOCKET_EVENTS.BROADCAST_SCHEDULE_UPDATED, eventPayload);
      emitToRoom(SOCKET_ROOMS.broadcastMovie(movieId), SOCKET_EVENTS.BROADCAST_SCHEDULE_UPDATED, eventPayload);

      logger.info(`[BroadcastService] Upserted schedule for movie ${movieId}`);
      return await this.getScheduleByMovie(movieId);
    } catch (error) {
      if (transaction && !transaction.finished) {
        await transaction.rollback();
      }
      logger.error(`[BroadcastService] Error upserting schedule for movie ${movieId}:`, error);
      throw error;
    }
  }

  /**
   * Lấy thông tin Schedule đầy đủ theo Movie ID
   * @param {string} movieId 
   * @returns {Promise<Object>}
   */
  async getScheduleByMovie(movieId) {
    const schedule = await BroadcastSchedule.findOne({
      where: { movie_id: movieId },
      include: [
        { model: ReleaseRule, as: 'rules' },
        {
          model: BroadcastCalendar,
          as: 'calendars',
          include: [{ model: Episode, as: 'episode', attributes: ['id', 'title', 'publish_state', 'episode_number'] }],
        },
      ],
      order: [
        [{ model: BroadcastCalendar, as: 'calendars' }, 'episode_number', 'ASC'],
      ],
    });

    return schedule || null;
  }

  /**
   * Xóa toàn bộ Schedule và Calendar của một Phim (Cascade Delete)
   * @param {string} movieId 
   * @returns {Promise<Object>}
   */
  async deleteSchedule(movieId) {
    const schedule = await BroadcastSchedule.findOne({
      where: { movie_id: movieId },
      include: [{ model: BroadcastCalendar, as: 'calendars', attributes: ['id'] }],
    });

    if (!schedule) {
      throw new NotFoundError('Lịch phát sóng không tồn tại');
    }

    // Hủy toàn bộ delayed jobs trong BullMQ
    if (schedule.calendars && schedule.calendars.length > 0) {
      for (const cal of schedule.calendars) {
        await schedulerService.cancelBullMQJob(cal.id);
      }
    }

    await schedule.destroy(); // Cascade will delete rules & calendars automatically

    // Invalidate Cache
    await invalidateBroadcastCache();

    // Socket notify
    emitToAll(SOCKET_EVENTS.BROADCAST_SCHEDULE_UPDATED, {
      movieId,
      deleted: true,
      timestamp: new Date().toISOString(),
    });

    logger.info(`[BroadcastService] Deleted broadcast schedule for movie ${movieId}`);
    return { success: true, message: 'Đã xóa lịch phát sóng' };
  }

  /**
   * Lấy lịch chiếu tuần công khai (Public API) kèm Redis Caching
   * @param {number} [weekOffset=0] - Offset số tuần (0 = tuần hiện tại, 1 = tuần sau, -1 = tuần trước)
   * @returns {Promise<Array<Object>>}
   */
  async getWeeklySchedule(weekOffset = 0) {
    // 1. Kiểm tra cache
    const cached = await getCachedWeeklySchedule(weekOffset);
    if (cached) {
      logger.debug(`[BroadcastService] Cache hit for weekly schedule (offset: ${weekOffset})`);
      return cached;
    }

    // 2. Query DB nếu cache miss
    const startOfWeek = moment().add(weekOffset, 'weeks').startOf('isoWeek').toDate();
    const endOfWeek = moment().add(weekOffset, 'weeks').endOf('isoWeek').toDate();

    const schedules = await BroadcastCalendar.findAll({
      where: {
        release_time: {
          [Op.between]: [startOfWeek, endOfWeek],
        },
        status: {
          [Op.ne]: 'cancelled',
        },
      },
      include: [
        {
          model: Episode,
          as: 'episode',
          attributes: ['id', 'title', 'episode_number', 'publish_state'],
        },
        {
          model: BroadcastSchedule,
          as: 'schedule',
          include: [
            {
              model: Movie,
              as: 'movie',
              attributes: ['id', 'titles', 'slug', 'images', 'imdb_rating', 'type'],
              include: [
                {
                  model: Genre,
                  as: 'genres',
                  attributes: ['name'],
                  through: { attributes: [] },
                },
              ],
            },
          ],
        },
      ],
      order: [['release_time', 'ASC']],
    });

    // 3. Lưu vào Cache
    await setCachedWeeklySchedule(weekOffset, schedules);

    return schedules;
  }

  /**
   * Lấy danh sách Calendar công khai theo khoảng thời gian kèm Redis Caching
   * @param {string|Date} [from] 
   * @param {string|Date} [to] 
   * @returns {Promise<Array<Object>>}
   */
  async getPublicCalendar(from, to) {
    const cached = await getCachedPublicCalendar(from, to);
    if (cached) {
      logger.debug(`[BroadcastService] Cache hit for public calendar (from: ${from}, to: ${to})`);
      return cached;
    }

    const calendars = await calendarService.getCalendarByDateRange(null, from, to);
    await setCachedPublicCalendar(from, to, calendars);
    return calendars;
  }

  /**
   * Tái tạo lịch chiếu (Regenerate Calendar) cưỡng chế bởi Admin
   * @param {string} movieId 
   * @returns {Promise<Object>}
   */
  async regenerateCalendar(movieId) {
    const schedule = await BroadcastSchedule.findOne({ where: { movie_id: movieId } });
    if (!schedule) {
      throw new NotFoundError('Chưa có lịch phát sóng cho phim này để tái tạo');
    }

    const generated = await calendarService.generateCalendar(schedule.id);
    logger.info(`[BroadcastService] Force regenerated calendar for movie ${movieId}`);
    return {
      success: true,
      message: 'Tái tạo lịch chiếu thành công',
      count: generated.length,
      schedule: await this.getScheduleByMovie(movieId),
    };
  }

  // ════════════════════════════════════════════════════════════════
  // DELEGATION METHODS TO CALENDAR SERVICE (Tương thích hoàn toàn)
  // ════════════════════════════════════════════════════════════════

  async generateCalendar(scheduleId, externalTransaction = null) {
    return calendarService.generateCalendar(scheduleId, externalTransaction);
  }

  async overrideCalendarEntry(calendarId, newReleaseTime) {
    return calendarService.overrideCalendarEntry(calendarId, newReleaseTime);
  }

  async restoreCalendarEntry(calendarId) {
    return calendarService.restoreCalendarEntry(calendarId);
  }

  async batchOverrideCalendars(overrides) {
    return calendarService.batchOverrideCalendars(overrides);
  }

  async updateCalendarStatus(calendarId, status, delayReason = null) {
    return calendarService.updateCalendarStatus(calendarId, status, delayReason);
  }

  async getCalendarByDateRange(scheduleId, from, to) {
    return calendarService.getCalendarByDateRange(scheduleId, from, to);
  }

  async scheduleBullMQJob(calendar) {
    return schedulerService.scheduleBullMQJob(calendar);
  }

  async cancelBullMQJob(calendarId) {
    return schedulerService.cancelBullMQJob(calendarId);
  }
}

export const broadcastService = new BroadcastService();
export default broadcastService;
