/**
 * @file scheduler.service.js
 * @module Services_BroadcastScheduler
 * @description Service quản lý BullMQ orchestration cho Broadcast module:
 * Lên lịch phát sóng tự động (delayed jobs), hủy lịch, lên lịch hàng loạt và định kỳ quét missed releases.
 */

import { getPublishQueue } from '../config/queue.config.js';
import { cacheHelper } from '../../../config/redis.config.js';
import { logger } from '../../../utils/logger.js';

class BroadcastSchedulerService {
  /**
   * Hủy một job BullMQ cũ nếu tồn tại trong Publish Queue
   * @param {string} calendarId - ID của Calendar entry
   * @returns {Promise<boolean>}
   */
  async cancelBullMQJob(calendarId) {
    try {
      if (!calendarId) return false;
      const publishQueue = getPublishQueue();
      const jobId = `publish-${calendarId}`;
      const existingJob = await publishQueue.getJob(jobId);
      if (existingJob) {
        await existingJob.remove();
        logger.info(`[SchedulerService] Removed existing BullMQ job ${jobId}`);
        return true;
      }
      return false;
    } catch (error) {
      logger.warn(`[SchedulerService] Failed to cancel BullMQ job for calendar ${calendarId}: ${error.message}`);
      return false;
    }
  }

  /**
   * Đẩy delayed job sang BullMQ cho 1 calendar entry (Hủy job cũ trước nếu có)
   * Idempotent: Kiểm tra status === 'upcoming' và dùng deterministic jobId
   * @param {Object} calendar - BroadcastCalendar instance hoặc object
   * @returns {Promise<Object|null>} BullMQ Job hoặc null
   */
  async scheduleBullMQJob(calendar) {
    try {
      if (!calendar || calendar.status !== 'upcoming') return null;

      // Hủy job cũ trước khi lên lịch job mới để tránh duplicate
      await this.cancelBullMQJob(calendar.id);

      const publishQueue = getPublishQueue();
      const releaseTimeMs = new Date(calendar.release_time).getTime();
      const delay = Math.max(0, releaseTimeMs - Date.now());
      const jobId = `publish-${calendar.id}`;

      const job = await publishQueue.add(
        'publish-episode',
        {
          calendarId: calendar.id,
          episodeId: calendar.episode_id,
          scheduleId: calendar.schedule_id,
          episodeNumber: calendar.episode_number,
          releaseTime: calendar.release_time,
        },
        {
          delay,
          jobId,
          removeOnComplete: true,
        }
      );

      if (job?.id && calendar.bullmq_job_id !== job.id && typeof calendar.update === 'function') {
        await calendar.update({ bullmq_job_id: String(job.id) });
      }

      logger.info(`[SchedulerService] Scheduled BullMQ job ${jobId} with delay ${delay}ms`);
      return job;
    } catch (error) {
      logger.warn(`[SchedulerService] BullMQ scheduling skipped for calendar ${calendar?.id}: ${error.message}`);
      return null;
    }
  }

  /**
   * Lên lịch hàng loạt cho danh sách calendar entries sau khi transaction commit
   * @param {Array<Object>} calendars - Danh sách Calendar instances
   * @returns {Promise<number>} Số lượng job đã lên lịch
   */
  async batchScheduleJobs(calendars = []) {
    if (!Array.isArray(calendars) || calendars.length === 0) return 0;

    let scheduledCount = 0;
    for (const cal of calendars) {
      if (cal.status === 'upcoming') {
        await this.scheduleBullMQJob(cal);
        scheduledCount++;
      }
    }
    logger.info(`[SchedulerService] Batch scheduled ${scheduledCount}/${calendars.length} calendar jobs`);
    return scheduledCount;
  }

  /**
   * Thiết lập Repeatable Job trên BullMQ để quét các tập bị nhỡ (quá hạn) định kỳ mỗi 10 phút
   * @param {number} [intervalMs=600000] - 10 phút (600,000 ms)
   * @returns {Promise<void>}
   */
  async setupRecurringScanner(intervalMs = 10 * 60 * 1000) {
    try {
      const publishQueue = getPublishQueue();
      const jobId = 'broadcast-scanner-repeatable';

      await publishQueue.add(
        'scan-missed-releases',
        {},
        {
          repeat: { every: intervalMs },
          jobId,
          removeOnComplete: true,
          removeOnFail: false,
        }
      );

      logger.info(`[SchedulerService] Registered BullMQ repeatable scanner job (every ${intervalMs / 60000} minutes)`);
    } catch (error) {
      logger.error(`[SchedulerService] Failed to register repeatable scanner job: ${error.message}`);
    }
  }

  /**
   * Cố gắng lấy Distributed Lock (Redis SETNX) cho scanner để tránh race condition đa instance
   * @param {number} [ttlSeconds=60] - Thời gian giữ lock
   * @returns {Promise<boolean>} True nếu lấy được lock
   */
  async acquireScannerLock(ttlSeconds = 60) {
    try {
      const lockKey = 'broadcast:scanner:lock';
      const acquired = await cacheHelper.setnx(lockKey, { lockedAt: new Date().toISOString() }, ttlSeconds);
      return Boolean(acquired);
    } catch (error) {
      logger.warn(`[SchedulerService] Error acquiring scanner lock: ${error.message}`);
      return true; // Fallback cho phép chạy nếu redis tạm thời lỗi
    }
  }

  /**
   * Giải phóng Distributed Lock sau khi scanner chạy xong
   * @returns {Promise<void>}
   */
  async releaseScannerLock() {
    try {
      const lockKey = 'broadcast:scanner:lock';
      await cacheHelper.del(lockKey);
    } catch (error) {
      logger.warn(`[SchedulerService] Error releasing scanner lock: ${error.message}`);
    }
  }
}

export const schedulerService = new BroadcastSchedulerService();
export default schedulerService;
