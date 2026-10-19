/**
 * @file broadcast-publisher.worker.js
 * @module Worker_BroadcastPublisher
 * @description Facade entry point khởi tạo các BullMQ workers cho Broadcast Module (Publish & Notification).
 * Tích hợp Recurring Scanner định kỳ 10 phút với Distributed Lock (Redis SETNX) để xử lý các tập quá hạn.
 */

import { Op } from 'sequelize';
import { initPublishWorker, closePublishWorker, processPublishJob } from './publish.worker.js';
import { initNotificationWorker, closeNotificationWorker } from './notification.worker.js';
import { schedulerService } from '../services/scheduler.service.js';
import { BroadcastCalendar, Episode, BroadcastSchedule, Movie } from '../../../models/index.js';
import { logger } from '../../../utils/logger.js';

class BroadcastPublisherWorkerFacade {
  init() {
    logger.info('[Worker][Broadcast] Initializing BullMQ broadcast workers...');
    initPublishWorker();
    initNotificationWorker();

    // Thiết lập BullMQ Repeatable Job để quét định kỳ mỗi 10 phút
    schedulerService.setupRecurringScanner(10 * 60 * 1000);

    // Quét 1 lần ngay khi khởi động để giải quyết các tập bị nhỡ trong thời gian server offline
    this.processUpcomingReleases();
  }

  async close() {
    logger.info('[Worker][Broadcast] Closing BullMQ broadcast workers...');
    await closePublishWorker();
    await closeNotificationWorker();
  }

  /**
   * Quét và giải quyết các tập đến hạn nhưng chưa phát sóng (dự phòng scanner)
   * Sử dụng Redis SETNX Distributed Lock để tránh xung đột khi chạy multi-instance
   */
  async processUpcomingReleases() {
    const hasLock = await schedulerService.acquireScannerLock(60);
    if (!hasLock) {
      logger.debug('[Worker][Broadcast] Scanner lock already held by another instance. Skipping.');
      return;
    }

    try {
      logger.debug('[Worker][Broadcast] Checking missed upcoming releases...');
      const now = new Date();

      const readyToRelease = await BroadcastCalendar.findAll({
        where: {
          release_time: { [Op.lte]: now },
          status: 'upcoming',
        },
        include: [
          { model: Episode, as: 'episode' },
          {
            model: BroadcastSchedule,
            as: 'schedule',
            include: [{ model: Movie, as: 'movie' }],
          },
        ],
      });

      if (!readyToRelease || readyToRelease.length === 0) {
        logger.debug('[Worker][Broadcast] No missed releases found.');
        return;
      }

      logger.info(`[Worker][Broadcast] Found ${readyToRelease.length} overdue calendar entries. Processing...`);

      for (const cal of readyToRelease) {
        await this.publishEpisode(cal);
      }
    } catch (error) {
      logger.error('[Worker][Broadcast] Error processing missed releases:', error);
    } finally {
      await schedulerService.releaseScannerLock();
    }
  }

  async publishEpisode(calendar) {
    if (!calendar?.id) return;
    return processPublishJob({ data: { calendarId: calendar.id, calendar } });
  }
}

export const broadcastPublisherWorker = new BroadcastPublisherWorkerFacade();

export const initBroadcastWorker = () => broadcastPublisherWorker.init();
export const closeBroadcastWorker = () => broadcastPublisherWorker.close();
export default broadcastPublisherWorker;
