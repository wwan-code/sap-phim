/**
 * @file publish.worker.js
 * @module Worker_BroadcastPublish
 * @description BullMQ worker xử lý tự động publish các tập phim đã đến giờ phát sóng và các job định kỳ từ scanner.
 * Idempotent: Kiểm tra calendar.status !== 'released' trước khi xử lý.
 * Side-effects: Cập nhật Episode status, emit Socket event, xóa Cache, đẩy job sang Notification queue.
 */

import { Worker } from 'bullmq';
import { QUEUE_NAMES, getNotificationQueue } from '../config/queue.config.js';
import { queueConnection } from '../../../config/queue.config.js';
import { sequelize, BroadcastCalendar, Episode, BroadcastSchedule, Movie } from '../../../models/index.js';
import { emitToAll, emitToRoom } from '../../../sockets/services/emit.service.js';
import { SOCKET_EVENTS } from '../../../sockets/constants/socket-events.constants.js';
import { SOCKET_ROOMS } from '../../../sockets/constants/socket-rooms.constants.js';
import { invalidateBroadcastCache } from '../utils/broadcast-cache.util.js';
import { logger } from '../../../utils/logger.js';

let workerInstance = null;

/**
 * Xử lý job publish 1 tập phim
 * @param {Object} job - BullMQ job
 */
export const processPublishJob = async (job) => {
  const { calendarId } = job.data;
  logger.info(`[PublishWorker] Processing publish job for calendar ${calendarId}...`);

  const calendar = job.data.calendar || (await BroadcastCalendar.findByPk(calendarId, {
    include: [
      { model: Episode, as: 'episode' },
      {
        model: BroadcastSchedule,
        as: 'schedule',
        include: [{ model: Movie, as: 'movie' }],
      },
    ],
  }));

  if (!calendar) {
    logger.warn(`[PublishWorker] Calendar entry ${calendarId} not found. Skipping.`);
    return;
  }

  // Idempotency check: nếu đã released hoặc cancelled thì không làm lại
  if (calendar.status === 'released') {
    logger.info(`[PublishWorker] Calendar ${calendarId} already released. Skipping.`);
    return;
  }

  if (calendar.status === 'cancelled') {
    logger.info(`[PublishWorker] Calendar ${calendarId} is cancelled. Skipping.`);
    return;
  }

  const episode = calendar.episode;
  const movie = calendar.schedule?.movie;

  if (!episode || !movie) {
    logger.warn(`[PublishWorker] Missing episode or movie for calendar ${calendarId}.`);
    return;
  }

  const transaction = await sequelize.transaction();
  try {
    // 1. Cập nhật DB trong atomic transaction
    await episode.update({ publish_state: 'published', published_at: new Date() }, { transaction });
    await calendar.update({ status: 'released' }, { transaction });
    await transaction.commit();
  } catch (err) {
    await transaction.rollback();
    logger.error(`[PublishWorker] Error updating episode/calendar:`, err);
    throw err;
  }

  logger.info(`[PublishWorker] Successfully published Episode ${episode.episode_number} of Movie ${movie.id}`);

  // Invalidate Redis cache
  await invalidateBroadcastCache();

  const titles = movie.titles || [];
  const movieTitle = titles.find((t) => t.type === 'default')?.title || titles[0]?.title || movie.slug || 'Unknown';

  // 2. Emit socket toàn hệ thống với SOCKET_EVENTS constant
  const eventPayload = {
    movieId: movie.id,
    episodeId: episode.id,
    episodeNumber: episode.episode_number,
    movieTitle,
    message: `Tập ${episode.episode_number} của ${movieTitle} đã lên sóng!`,
  };
  emitToAll(SOCKET_EVENTS.BROADCAST_EPISODE_RELEASED, eventPayload);
  emitToRoom(SOCKET_ROOMS.broadcastMovie(movie.id), SOCKET_EVENTS.BROADCAST_EPISODE_RELEASED, eventPayload);

  // Emit calendar changed event
  emitToAll(SOCKET_EVENTS.BROADCAST_CALENDAR_CHANGED, {
    calendarId: calendar.id,
    movieId: movie.id,
    action: 'published',
  });

  // 3. Đẩy job sang Notification queue để xử lý fan-out ngầm (bất đồng bộ)
  try {
    const notificationQueue = getNotificationQueue();
    await notificationQueue.add(
      'fanout-notifications',
      {
        movieId: movie.id,
        episodeId: episode.id,
        episodeNumber: episode.episode_number,
        movieTitle,
        slug: movie.slug || movie.id,
      },
      {
        jobId: `notify-${calendar.id}`,
      }
    );
    logger.info(`[PublishWorker] Enqueued notification fanout for movie ${movie.id}`);
  } catch (err) {
    logger.error(`[PublishWorker] Failed to enqueue notification job:`, err);
  }
};

/**
 * Khởi tạo BullMQ Worker cho Publish Queue
 */
export const initPublishWorker = () => {
  if (workerInstance) return workerInstance;

  workerInstance = new Worker(
    QUEUE_NAMES.PUBLISH,
    async (job) => {
      // Phân luồng job theo tên
      if (job.name === 'scan-missed-releases') {
        const { broadcastPublisherWorker } = await import('./broadcast-publisher.worker.js');
        await broadcastPublisherWorker.processUpcomingReleases();
        return;
      }

      await processPublishJob(job);
    },
    {
      connection: queueConnection,
      concurrency: 5,
    }
  );

  workerInstance.on('completed', (job) => {
    logger.debug(`[PublishWorker] Job ${job.id} completed successfully`);
  });

  workerInstance.on('failed', (job, err) => {
    logger.error(`[PublishWorker] Job ${job?.id} failed:`, err);
  });

  logger.info('[PublishWorker] Initialized BullMQ Publish Worker');
  return workerInstance;
};

/**
 * Đóng Worker khi shutdown
 */
export const closePublishWorker = async () => {
  if (workerInstance) {
    await workerInstance.close();
    workerInstance = null;
    logger.info('[PublishWorker] Closed Publish Worker');
  }
};

export default {
  initPublishWorker,
  closePublishWorker,
  processPublishJob,
};
