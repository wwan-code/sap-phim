/**
 * @file calendar.service.js
 * @module Services_BroadcastCalendar
 * @description Service quản lý chi tiết Lịch phát sóng từng tập (BroadcastCalendar):
 * Sinh tự động từ RRULE (RFC 5545), ghi đè ngoại lệ (Override), khôi phục, cập nhật trạng thái và truy vấn mốc chiếu.
 */

import { Op } from 'sequelize';
import {
  sequelize,
  BroadcastSchedule,
  ReleaseRule,
  BroadcastCalendar,
  Episode,
  Movie,
  Genre,
} from '../../../models/index.js';
import { legacyToRRule, expandRRule, resolveRuleToRRule } from '../utils/rrule-engine.util.js';
import { schedulerService } from './scheduler.service.js';
import { invalidateBroadcastCache } from '../utils/broadcast-cache.util.js';
import { emitToAll, emitToRoom } from '../../../sockets/services/emit.service.js';
import { SOCKET_EVENTS } from '../../../sockets/constants/socket-events.constants.js';
import { SOCKET_ROOMS } from '../../../sockets/constants/socket-rooms.constants.js';
import { logger } from '../../../utils/logger.js';
import { NotFoundError, BadRequestError } from '../../../utils/app-error.js';

class BroadcastCalendarService {
  /**
   * Sinh tự động Calendar từ các quy tắc RRULE trong Sequelize Transaction
   * @param {string} scheduleId - ID của BroadcastSchedule
   * @param {Object} [externalTransaction=null] - Transaction bên ngoài nếu có
   * @returns {Promise<Array<Object>>} Danh sách calendar entries đã sinh
   */
  async generateCalendar(scheduleId, externalTransaction = null) {
    const isManaged = !externalTransaction;
    const transaction = externalTransaction || (await sequelize.transaction());

    try {
      const schedule = await BroadcastSchedule.findByPk(scheduleId, {
        include: [
          { model: ReleaseRule, as: 'rules' },
          { model: Movie, as: 'movie' },
        ],
        transaction,
      });

      if (!schedule || !schedule.rules || schedule.rules.length === 0) {
        if (isManaged) await transaction.commit();
        return [];
      }

      const timezone = schedule.timezone || 'Asia/Ho_Chi_Minh';

      // Lấy danh sách tập phim thuộc movie này
      const episodes = await Episode.findAll({
        where: { movie_id: schedule.movie_id },
        order: [['episode_number', 'ASC']],
        transaction,
      });

      if (episodes.length === 0) {
        if (isManaged) await transaction.commit();
        return [];
      }

      // Lấy calendar hiện tại
      const currentCalendars = await BroadcastCalendar.findAll({
        where: { schedule_id: scheduleId },
        transaction,
      });

      const currentMap = new Map(currentCalendars.map((c) => [c.episode_number, c]));
      const dtstart = schedule.anchor_date ? new Date(schedule.anchor_date) : new Date();

      // Sinh mốc thời gian từ toàn bộ RRULEs của schedule
      const rawDates = [];
      const maxLimitPerRule = Math.max(episodes.length, 52);

      for (const rule of schedule.rules) {
        const rruleStr = resolveRuleToRRule(rule, dtstart, 52, timezone);
        const ruleDates = expandRRule(rruleStr, rule.dtstart || dtstart, maxLimitPerRule);
        for (const d of ruleDates) {
          if (d && !isNaN(new Date(d).getTime())) {
            rawDates.push({ date: new Date(d), ruleId: rule.id });
          }
        }
      }

      // Sắp xếp tăng dần theo thời gian
      rawDates.sort((a, b) => a.date.getTime() - b.date.getTime());

      // Deduplicate mốc thời gian trùng lặp
      const seenTimestamps = new Set();
      const allDates = [];
      for (const item of rawDates) {
        const ts = item.date.getTime();
        if (!seenTimestamps.has(ts)) {
          seenTimestamps.add(ts);
          allDates.push(item);
        }
      }

      const newCalendars = [];
      const updatedCalendars = [];

      for (let i = 0; i < episodes.length; i++) {
        const ep = episodes[i];
        const existing = currentMap.get(ep.episode_number);

        // Nếu đã bị override bằng drag&drop hoặc đã released/cancelled thì giữ nguyên
        if (
          existing &&
          (existing.is_exception || existing.status === 'released' || existing.status === 'cancelled')
        ) {
          continue;
        }

        // Lấy mốc ngày giờ tương ứng với số thứ tự tập
        const dateInfo = allDates[i] || (allDates.length > 0 ? allDates[allDates.length - 1] : null);
        if (!dateInfo) continue;

        const releaseTimeUtc = dateInfo.date;

        if (existing) {
          await existing.update(
            {
              release_time: releaseTimeUtc,
              episode_id: ep.id,
              rule_id: dateInfo.ruleId,
            },
            { transaction }
          );
          updatedCalendars.push(existing);
        } else {
          newCalendars.push({
            schedule_id: scheduleId,
            rule_id: dateInfo.ruleId,
            episode_id: ep.id,
            episode_number: ep.episode_number,
            release_time: releaseTimeUtc,
            status: 'upcoming',
            is_exception: false,
          });
        }
      }

      let createdEntries = [];
      if (newCalendars.length > 0) {
        createdEntries = await BroadcastCalendar.bulkCreate(newCalendars, {
          transaction,
          returning: true,
        });
      }

      if (isManaged) {
        await transaction.commit();
      }

      // BATCH BULLMQ SCHEDULING (chỉ chạy sau khi transaction đã commit an toàn)
      const allToSchedule = [...updatedCalendars, ...createdEntries];
      await schedulerService.batchScheduleJobs(allToSchedule);

      // Invalidate Cache
      await invalidateBroadcastCache();

      // Emit Socket event thông báo lịch chiếu đã cập nhật
      const eventPayload = {
        scheduleId,
        movieId: schedule.movie_id,
        count: allToSchedule.length,
        timestamp: new Date().toISOString(),
      };
      emitToAll(SOCKET_EVENTS.BROADCAST_CALENDAR_CHANGED, eventPayload);
      if (schedule.movie_id) {
        emitToRoom(SOCKET_ROOMS.broadcastMovie(schedule.movie_id), SOCKET_EVENTS.BROADCAST_CALENDAR_CHANGED, eventPayload);
      }

      logger.info(`[CalendarService] Generated ${allToSchedule.length} calendar entries for schedule ${scheduleId}`);
      return allToSchedule;
    } catch (error) {
      if (isManaged && transaction && !transaction.finished) {
        await transaction.rollback();
      }
      logger.error(`[CalendarService] Error generating calendar for schedule ${scheduleId}:`, error);
      throw error;
    }
  }

  /**
   * Ghi đè thủ công một Calendar entry (khi Admin kéo-thả hoặc đổi mốc chiếu)
   * @param {string} calendarId - ID của Calendar entry
   * @param {string|Date} newReleaseTime - Thời gian chiếu mới
   * @returns {Promise<Object>} Entry đã cập nhật
   */
  async overrideCalendarEntry(calendarId, newReleaseTime) {
    const transaction = await sequelize.transaction();
    try {
      const calendar = await BroadcastCalendar.findByPk(calendarId, {
        include: [{ model: BroadcastSchedule, as: 'schedule' }],
        transaction,
      });

      if (!calendar) {
        throw new NotFoundError('Không tìm thấy lịch chiếu');
      }

      if (calendar.status === 'released') {
        throw new BadRequestError('Không thể sửa đổi lịch chiếu đã phát sóng');
      }

      const releaseDate = new Date(newReleaseTime);
      if (isNaN(releaseDate.getTime())) {
        throw new BadRequestError('Thời gian phát sóng không hợp lệ');
      }

      await calendar.update(
        {
          release_time: releaseDate,
          is_exception: true,
          status: 'upcoming',
        },
        { transaction }
      );

      await transaction.commit();

      // Re-schedule BullMQ job
      await schedulerService.scheduleBullMQJob(calendar);

      // Invalidate Cache
      await invalidateBroadcastCache();

      // Socket notify
      const movieId = calendar.schedule?.movie_id;
      emitToAll(SOCKET_EVENTS.BROADCAST_CALENDAR_CHANGED, {
        calendarId,
        movieId,
        action: 'override',
        releaseTime: releaseDate.toISOString(),
      });

      logger.info(`[CalendarService] Overrode calendar ${calendarId} to ${releaseDate.toISOString()}`);
      return calendar;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * Khôi phục lại trạng thái mặc định của Calendar entry (Xóa ngoại lệ & tính lại theo rule)
   * @param {string} calendarId - ID của Calendar entry
   * @returns {Promise<Object>} Entry đã khôi phục
   */
  async restoreCalendarEntry(calendarId) {
    const transaction = await sequelize.transaction();
    let scheduleId = null;
    try {
      const calendar = await BroadcastCalendar.findByPk(calendarId, { transaction });
      if (!calendar) {
        throw new NotFoundError('Không tìm thấy lịch chiếu');
      }

      if (calendar.status === 'released') {
        throw new BadRequestError('Không thể khôi phục lịch chiếu đã phát sóng');
      }

      scheduleId = calendar.schedule_id;
      await calendar.update({ is_exception: false }, { transaction });
      await transaction.commit();

      // Hủy job cũ và tính toán lại mốc giờ đúng theo rule gốc
      await schedulerService.cancelBullMQJob(calendarId);
      await this.generateCalendar(scheduleId);

      // Invalidate Cache
      await invalidateBroadcastCache();

      const restored = await BroadcastCalendar.findByPk(calendarId);
      emitToAll(SOCKET_EVENTS.BROADCAST_CALENDAR_CHANGED, {
        calendarId,
        scheduleId,
        action: 'restore',
      });

      logger.info(`[CalendarService] Restored calendar ${calendarId} to default rule`);
      return restored;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * Thực hiện ghi đè hàng loạt (Batch Override) cho Drag-and-Drop nhiều mục
   * @param {Array<{ calendarId: string, release_time: string }>} overrides
   * @returns {Promise<Array<Object>>}
   */
  async batchOverrideCalendars(overrides) {
    if (!Array.isArray(overrides) || overrides.length === 0) {
      throw new BadRequestError('Danh sách ghi đè không được để trống');
    }

    const transaction = await sequelize.transaction();
    try {
      const results = [];
      for (const item of overrides) {
        const { calendarId, release_time } = item;
        const calendar = await BroadcastCalendar.findByPk(calendarId, { transaction });
        if (calendar && calendar.status !== 'released') {
          await calendar.update(
            {
              release_time: new Date(release_time),
              is_exception: true,
              status: 'upcoming',
            },
            { transaction }
          );
          results.push(calendar);
        }
      }

      await transaction.commit();

      // Schedule all modified entries
      await schedulerService.batchScheduleJobs(results);

      // Invalidate Cache
      await invalidateBroadcastCache();

      emitToAll(SOCKET_EVENTS.BROADCAST_CALENDAR_CHANGED, {
        count: results.length,
        action: 'batch_override',
      });

      logger.info(`[CalendarService] Batch overrode ${results.length} calendar entries`);
      return results;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * Cập nhật trạng thái Calendar entry (upcoming / delayed / cancelled) kèm lý do hoãn
   * @param {string} calendarId - ID của Calendar entry
   * @param {string} status - Trạng thái mới ('upcoming', 'delayed', 'cancelled')
   * @param {string} [delayReason=null] - Lý do hoãn hoặc hủy
   * @returns {Promise<Object>} Entry đã cập nhật
   */
  async updateCalendarStatus(calendarId, status, delayReason = null) {
    const validStatuses = ['upcoming', 'delayed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      throw new BadRequestError(`Trạng thái không hợp lệ: ${status}. Chấp nhận: ${validStatuses.join(', ')}`);
    }

    const transaction = await sequelize.transaction();
    try {
      const calendar = await BroadcastCalendar.findByPk(calendarId, {
        include: [{ model: BroadcastSchedule, as: 'schedule' }],
        transaction,
      });

      if (!calendar) {
        throw new NotFoundError('Không tìm thấy lịch chiếu');
      }

      if (calendar.status === 'released') {
        throw new BadRequestError('Không thể đổi trạng thái của tập phim đã phát sóng');
      }

      await calendar.update(
        {
          status,
          delay_reason: delayReason || null,
        },
        { transaction }
      );

      await transaction.commit();

      // Quản lý BullMQ job tương ứng trạng thái
      if (status === 'cancelled' || status === 'delayed') {
        await schedulerService.cancelBullMQJob(calendarId);
      } else if (status === 'upcoming') {
        await schedulerService.scheduleBullMQJob(calendar);
      }

      // Invalidate Cache
      await invalidateBroadcastCache();

      // Emit Socket event
      const movieId = calendar.schedule?.movie_id;
      const eventPayload = {
        calendarId,
        movieId,
        status,
        delayReason,
        action: 'status_update',
      };
      emitToAll(SOCKET_EVENTS.BROADCAST_CALENDAR_CHANGED, eventPayload);
      if (movieId) {
        emitToRoom(SOCKET_ROOMS.broadcastMovie(movieId), SOCKET_EVENTS.BROADCAST_CALENDAR_CHANGED, eventPayload);
      }

      logger.info(`[CalendarService] Updated calendar ${calendarId} status to '${status}' (Reason: ${delayReason || 'N/A'})`);
      return calendar;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * Lấy danh sách Calendar theo khoảng thời gian (Date Range)
   * @param {string|null} scheduleId - ID của Schedule hoặc null nếu query công khai
   * @param {string|Date} [from] - Mốc bắt đầu
   * @param {string|Date} [to] - Mốc kết thúc
   * @returns {Promise<Array<Object>>}
   */
  async getCalendarByDateRange(scheduleId = null, from = null, to = null) {
    const where = {};
    if (scheduleId) {
      where.schedule_id = scheduleId;
    }

    if (from || to) {
      where.release_time = {};
      if (from) where.release_time[Op.gte] = new Date(from);
      if (to) where.release_time[Op.lte] = new Date(to);
    }

    const include = [
      {
        model: Episode,
        as: 'episode',
        attributes: ['id', 'title', 'episode_number', 'publish_state'],
      },
    ];

    // Nếu là public query (scheduleId = null), include thêm Movie và Genres
    if (!scheduleId) {
      include.push({
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
      });
    }

    return BroadcastCalendar.findAll({
      where,
      include,
      order: [['release_time', 'ASC']],
    });
  }
}

export const calendarService = new BroadcastCalendarService();
export default calendarService;
