import { registerWorker, QUEUE_NAMES } from "../../../config/queue.config.js";
import { logger } from "../../../utils/logger.js";
import { notificationService } from "../services/notification.service.js";
import {
  NOTIFICATION_QUEUE_JOBS,
} from "../services/notification-queue.service.js";

let notificationWorker = null;

const notificationJobProcessor = async (job) => {
  switch (job.name) {
    case NOTIFICATION_QUEUE_JOBS.CREATE:
      return notificationService.createNotification(job.data.payload);

    case NOTIFICATION_QUEUE_JOBS.CREATE_FROM_TEMPLATE:
      return notificationService.createFromTemplate(
        job.data.type,
        job.data.templateData,
      );

    case NOTIFICATION_QUEUE_JOBS.BROADCAST:
      return notificationService.broadcastNotification(job.data.payload, {
        batchSize: job.data.batchSize,
      });

    default:
      throw new Error(`Unknown notification job: ${job.name}`);
  }
};

export const initNotificationWorker = (options = {}) => {
  if (notificationWorker) {
    logger.warn("[NotificationWorker] Worker already initialized, skipping.");
    return notificationWorker;
  }

  notificationWorker = registerWorker(
    QUEUE_NAMES.NOTIFICATION,
    notificationJobProcessor,
    {
      concurrency:
        options.concurrency ||
        Number.parseInt(process.env.NOTIFICATION_WORKER_CONCURRENCY, 10) ||
        5,
      limiter: {
        max:
          options.maxPerSecond ||
          Number.parseInt(process.env.NOTIFICATION_WORKER_MAX_PER_SECOND, 10) ||
          50,
        duration: 1000,
      },
    },
  );

  notificationWorker.on("error", (error) => {
    logger.error("[NotificationWorker] Worker error:", error);
  });

  logger.info("[NotificationWorker] Worker initialized");
  return notificationWorker;
};

export const closeNotificationWorker = async () => {
  if (!notificationWorker) return;
  await notificationWorker.close();
  notificationWorker = null;
};

export default {
  initNotificationWorker,
  closeNotificationWorker,
  notificationJobProcessor,
};
