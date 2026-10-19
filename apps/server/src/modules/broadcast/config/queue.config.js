/**
 * @file queue.config.js
 * @module Config_BroadcastQueue
 * @description Cấu hình BullMQ Queues cho Broadcast Module:
 * Sử dụng connection từ global config/queue.config.js để dùng chung Redis connection.
 */

import { Queue } from 'bullmq';
import { queueConnection } from '../../../config/queue.config.js';
import { logger } from '../../../utils/logger.js';

export const QUEUE_NAMES = {
  PUBLISH: 'broadcast-publish-queue',
  NOTIFICATION: 'broadcast-notification-queue',
};

let publishQueueInstance = null;
let notificationQueueInstance = null;

/**
 * Lấy instance của Publish Queue
 * @returns {Queue}
 */
export const getPublishQueue = () => {
  if (!publishQueueInstance) {
    publishQueueInstance = new Queue(QUEUE_NAMES.PUBLISH, {
      connection: queueConnection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
        removeOnComplete: { count: 500 },
        removeOnFail: { count: 1000 },
      },
    });
    logger.info('[BroadcastQueue] Initialized BullMQ Publish Queue');
  }
  return publishQueueInstance;
};

/**
 * Lấy instance của Notification Queue
 * @returns {Queue}
 */
export const getNotificationQueue = () => {
  if (!notificationQueueInstance) {
    notificationQueueInstance = new Queue(QUEUE_NAMES.NOTIFICATION, {
      connection: queueConnection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 2000 },
      },
    });
    logger.info('[BroadcastQueue] Initialized BullMQ Notification Queue');
  }
  return notificationQueueInstance;
};

export default {
  QUEUE_NAMES,
  getPublishQueue,
  getNotificationQueue,
};
