/**
 * @file queue.config.js
 * @module Config
 * @description Cấu hình BullMQ cho hệ thống hàng đợi.
 */

import { Queue, Worker } from "bullmq";
import IORedis from "ioredis";
import { env } from "./env.config.js";
import { logger } from "../utils/logger.js";

/** Theo dõi trạng thái log để tránh spam */
let _hasLoggedQueueError = false;

const connection = new IORedis({
  host: env.redis.host,
  port: env.redis.port,
  password: env.redis.password || undefined,
  maxRetriesPerRequest: null,
  enableOfflineQueue: true,
  retryStrategy: (times) => Math.min(times * 500, 5000),
});

// Ngăn chặn crash do unhandled "error" event khi Redis không khả dụng
connection.on("error", (err) => {
  if (!_hasLoggedQueueError) {
    logger.warn(`[QueueConfig] Lỗi kết nối Redis cho hàng đợi: ${err.message}`);
    _hasLoggedQueueError = true;
  }
});

connection.on("ready", () => {
  _hasLoggedQueueError = false;
  logger.info("[QueueConfig] Kết nối Redis cho hàng đợi thành công");
});

connection.on("close", () => {
  _hasLoggedQueueError = false;
});

export const queueConnection = connection;


export const QUEUE_NAMES = {
  IMAGE_PROCESSING: "image-processing-queue",
  NOTIFICATION: "notification-queue",
  AI: "ai-queue",
};

/**
 * Đăng ký một worker mới
 * 
 * @param {string} queueName Tên hàng đợi
 * @param {Function} processor Hàm xử lý công việc
 * @param {Object} options Cấu hình thêm cho worker
 * @returns {Worker} 
 */
export const registerWorker = (queueName, processor, options = {}) => {
  const worker = new Worker(queueName, processor, {
    connection,
    ...options,
  });

  worker.on("completed", (job) => {
    logger.debug(`[Queue] Job ${job.id} completed successfully`);
  });

  worker.on("failed", (job, err) => {
    logger.error(`[Queue] Job ${job?.id} failed with error: ${err.message}`);
  });

  return worker;
};

const defaultJobOptions = {
  removeOnComplete: { age: 24 * 60 * 60, count: 1000 },
  removeOnFail: { age: 7 * 24 * 60 * 60, count: 5000 },
};

export const imageQueue = new Queue(QUEUE_NAMES.IMAGE_PROCESSING, {
  connection,
  defaultJobOptions,
});

export const notificationQueue = new Queue(QUEUE_NAMES.NOTIFICATION, {
  connection,
  defaultJobOptions: {
    ...defaultJobOptions,
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 },
  },
});

export const aiQueue = new Queue(QUEUE_NAMES.AI, {
  connection,
  defaultJobOptions: {
    ...defaultJobOptions,
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 },
  },
});

const queues = {
  [QUEUE_NAMES.IMAGE_PROCESSING]: imageQueue,
  [QUEUE_NAMES.NOTIFICATION]: notificationQueue,
  [QUEUE_NAMES.AI]: aiQueue,
};

export const getQueue = (queueName) => {
  const queue = queues[queueName];
  if (!queue) {
    throw new Error(`Unknown queue: ${queueName}`);
  }
  return queue;
};

export const addJob = async (queueName, name, data = {}, options = {}) => {
  const queue = getQueue(queueName);
  return queue.add(name, data, {
    ...defaultJobOptions,
    ...options,
  });
};

export default {
  QUEUE_NAMES,
  registerWorker,
  getQueue,
  addJob,
  imageQueue,
  notificationQueue,
  aiQueue,
};
