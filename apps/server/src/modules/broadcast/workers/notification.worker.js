/**
 * @file notification.worker.js
 * @module Worker_BroadcastNotification
 * @description BullMQ worker xử lý fan-out thông báo tới danh sách watchlist users khi tập phim mới phát sóng.
 * Chunked processing: Chia mảng users thành các batch 1000 mục để tránh làm ngẽn DB/Socket.
 */

import { Worker } from 'bullmq';
import { Op } from 'sequelize';
import { QUEUE_NAMES } from '../config/queue.config.js';
import { queueConnection } from '../../../config/queue.config.js';
import { Watchlist, Notification } from '../../../models/index.js';
import { emitToUser } from '../../../sockets/services/emit.service.js';
import { SOCKET_EVENTS } from '../../../sockets/constants/socket-events.constants.js';
import { logger } from '../../../utils/logger.js';

let workerInstance = null;
const BATCH_SIZE = 1000;

/**
 * Xử lý fan-out notification cho 1 job phát sóng
 * @param {Object} job - BullMQ job
 */
export const processNotificationJob = async (job) => {
  const { movieId, episodeId, episodeNumber, movieTitle, slug } = job.data;
  logger.info(`[NotificationWorker] Fan-out notifications for movie ${movieId}, Episode ${episodeNumber}...`);

  // Lấy toàn bộ users theo dõi phim
  const watchlistUsers = await Watchlist.findAll({
    where: {
      movie_id: movieId,
      status: { [Op.in]: ['watching', 'planned', 'favorite'] },
    },
    attributes: ['user_id'],
    raw: true,
  });

  if (watchlistUsers.length === 0) {
    logger.info(`[NotificationWorker] No users in watchlist for movie ${movieId}.`);
    return;
  }

  logger.info(`[NotificationWorker] Found ${watchlistUsers.length} users to notify.`);

  // Chia nhỏ mảng theo batch để bulkCreate và emit socket
  for (let i = 0; i < watchlistUsers.length; i += BATCH_SIZE) {
    const batch = watchlistUsers.slice(i, i + BATCH_SIZE);

    const notifications = batch.map((w) => ({
      user_id: w.user_id,
      type: 'SYSTEM',
      title: 'Tập mới ra mắt',
      message: `Tập ${episodeNumber} của ${movieTitle} đã phát sóng.`,
      action_url: `/movies/${slug || movieId}/episodes/${episodeId}`,
      is_read: false,
    }));

    await Notification.bulkCreate(notifications);

    // Socket notify per user
    batch.forEach((w) => {
      emitToUser(w.user_id, SOCKET_EVENTS.NOTIFICATION_NEW, {
        type: 'info',
        message: `Tập mới: ${movieTitle} Tập ${episodeNumber} đã lên sóng!`,
      });
    });
  }

  logger.info(`[NotificationWorker] Completed notification fan-out for movie ${movieId}`);
};

/**
 * Khởi tạo BullMQ Worker cho Notification Queue
 */
export const initNotificationWorker = () => {
  if (workerInstance) return workerInstance;

  workerInstance = new Worker(
    QUEUE_NAMES.NOTIFICATION,
    async (job) => {
      await processNotificationJob(job);
    },
    {
      connection: queueConnection,
      concurrency: 3,
    }
  );

  workerInstance.on('completed', (job) => {
    logger.debug(`[NotificationWorker] Job ${job.id} completed`);
  });

  workerInstance.on('failed', (job, err) => {
    logger.error(`[NotificationWorker] Job ${job?.id} failed:`, err);
  });

  logger.info('[NotificationWorker] Initialized BullMQ Notification Worker');
  return workerInstance;
};

/**
 * Đóng Worker khi shutdown
 */
export const closeNotificationWorker = async () => {
  if (workerInstance) {
    await workerInstance.close();
    workerInstance = null;
    logger.info('[NotificationWorker] Closed Notification Worker');
  }
};

export default {
  initNotificationWorker,
  closeNotificationWorker,
  processNotificationJob,
};
