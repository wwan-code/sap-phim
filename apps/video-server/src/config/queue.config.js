/**
 * @file queue.config.js
 * @module VideoServer_Config
 * @description Thiết lập BullMQ Queue và Worker cho tiến trình xử lý chuyển mã video.
 */

import { Queue, Worker } from "bullmq";

import { env } from "./env.config.js";
import { createRedisClient } from "./redis.config.js";
import { logger } from "../utils/logger.js";

export const QUEUE_NAMES = {
  VIDEO_TRANSCODE: "video-transcode-queue",
};

export const JOB_NAMES = {
  TRANSCODE: "video-transcode",
};

const queueRedisConnection = createRedisClient();

/**
 * Hàng đợi xử lý chuyển mã video
 */
export const videoQueue = new Queue(QUEUE_NAMES.VIDEO_TRANSCODE, {
  connection: queueRedisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 5000,
    },
    removeOnComplete: {
      age: 86400, // 24 giờ
      count: 1000,
    },
    removeOnFail: {
      age: 604800, // 7 ngày
    },
  },
});

/**
 * Khởi tạo Worker xử lý tác vụ từ Queue
 * @param {Function} processor - Hàm xử lý job (async function(job))
 * @returns {Worker}
 */
export const initVideoWorker = (processor) => {
  const workerRedisConnection = createRedisClient();

  const worker = new Worker(QUEUE_NAMES.VIDEO_TRANSCODE, processor, {
    connection: workerRedisConnection,
    concurrency: 1, // Theo quyết định kiến trúc: xử lý tuần tự 1 video tại 1 thời điểm
    lockDuration: 600000, // 10 phút lock duration cho các tác vụ chuyển mã video dài
  });

  worker.on("completed", (job) => {
    logger.info(`[Queue] Job hoàn thành: ID=${job.id}, Episode=${job.data?.episode_id}`);
  });

  worker.on("failed", (job, err) => {
    logger.error(`[Queue] Job thất bại: ID=${job?.id}, Episode=${job?.data?.episode_id}, Error=${err.message}`);
  });

  worker.on("error", (err) => {
    logger.error(`[Queue] Lỗi Worker: ${err.message}`);
  });

  return worker;
};

/**
 * Tìm job đang chờ hoặc đang chạy theo episode_id để chống tạo trùng lặp
 * @param {string} episodeId
 * @returns {Promise<import("bullmq").Job|null>}
 */
export const findExistingJobByEpisode = async (episodeId) => {
  if (!episodeId) return null;
  try {
    const activeJobs = await videoQueue.getJobs(["active", "waiting", "delayed"]);
    return activeJobs.find((job) => job.data?.episode_id === episodeId) || null;
  } catch (error) {
    logger.warn(`[Queue] Lỗi kiểm tra job trùng lặp cho Episode ${episodeId}: ${error.message}`);
    return null;
  }
};

/**
 * Đóng kết nối BullMQ Queue an toàn
 * @returns {Promise<void>}
 */
export const closeVideoQueue = async () => {
  try {
    await videoQueue.close();
    logger.info("[Queue] Đã đóng kết nối BullMQ Queue an toàn");
  } catch (err) {
    logger.warn(`[Queue] Lỗi khi đóng Queue: ${err.message}`);
  }
};

export default {
  videoQueue,
  QUEUE_NAMES,
  JOB_NAMES,
  initVideoWorker,
  findExistingJobByEpisode,
  closeVideoQueue,
};
