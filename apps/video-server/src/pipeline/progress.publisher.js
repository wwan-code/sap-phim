/**
 * @file progress.publisher.js
 * @module VideoServer_Pipeline
 * @description Công bố tiến trình xử lý video qua kênh Redis Pub/Sub để Main Backend nhận và chuyển tiếp qua Socket.IO.
 */

import { getRedisClient } from "../config/redis.config.js";
import { logger } from "../utils/logger.js";

export const REDIS_PROGRESS_CHANNEL = "video-server:processing:progress";

/**
 * Các giai đoạn xử lý video chuẩn
 */
export const PIPELINE_STAGES = {
  ANALYZING: "analyzing",
  TRANSCODING_VIDEO: "transcoding_video",
  TRANSCODING_AUDIO: "transcoding_audio",
  THUMBNAILS_SPRITES: "thumbnails_sprites",
  FINALIZING: "finalizing",
};

/**
 * Bộ nhớ đệm quản lý throttling tiến độ theo episode_id
 * @type {Map<string, { lastSentTime: number, timer: NodeJS.Timeout|null, latestPayload: Object|null }>}
 */
const progressThrottleMap = new Map();
const THROTTLE_INTERVAL_MS = 1000;

/**
 * Thực thi phát bản tin trực tiếp lên Redis
 * @private
 */
const sendProgressNow = async (payload) => {
  try {
    const redis = getRedisClient();
    const message = JSON.stringify({
      episode_id: payload.episode_id,
      job_id: payload.job_id,
      pipeline_status: payload.pipeline_status,
      progress: Math.min(100, Math.max(0, Math.round(payload.progress || 0))),
      processing_stage: payload.processing_stage || PIPELINE_STAGES.ANALYZING,
      stage_message: payload.stage_message || "",
      artifacts: payload.artifacts || null,
      timestamp: new Date().toISOString(),
    });

    await redis.publish(REDIS_PROGRESS_CHANNEL, message);
    logger.debug(`[ProgressPublisher] Published to ${REDIS_PROGRESS_CHANNEL}: Episode=${payload.episode_id}, Progress=${payload.progress}%`);
  } catch (error) {
    logger.error(`[ProgressPublisher] Lỗi publish tiến trình lên Redis: ${error.message}`);
  }
};

/**
 * Publish thông tin tiến trình lên Redis với cơ chế throttle 1s/episode để chống spam Pub/Sub
 * @param {Object} payload
 * @param {string} payload.episode_id - ID tập phim
 * @param {string} payload.job_id - ID của BullMQ job
 * @param {string} payload.pipeline_status - "queued" | "processing" | "ready" | "failed"
 * @param {number} payload.progress - 0 đến 100
 * @param {string} payload.processing_stage - Giai đoạn xử lý
 * @param {string} [payload.stage_message] - Mô tả trạng thái
 * @param {Object} [payload.artifacts] - Kết quả đầu ra
 */
export const publishProgress = async (payload) => {
  const episodeId = payload.episode_id;
  if (!episodeId) {
    return sendProgressNow(payload);
  }

  // Các trạng thái kết thúc hoặc chuyển giao quan trọng luôn được phát ngay lập tức
  const isCriticalState =
    payload.pipeline_status === "ready" ||
    payload.pipeline_status === "failed" ||
    payload.progress === 100 ||
    payload.progress <= 2;

  let throttleInfo = progressThrottleMap.get(episodeId);
  if (!throttleInfo) {
    throttleInfo = { lastSentTime: 0, timer: null, latestPayload: null };
    progressThrottleMap.set(episodeId, throttleInfo);
  }

  if (isCriticalState) {
    if (throttleInfo.timer) {
      clearTimeout(throttleInfo.timer);
      throttleInfo.timer = null;
    }
    throttleInfo.lastSentTime = Date.now();
    throttleInfo.latestPayload = null;

    if (payload.pipeline_status === "ready" || payload.pipeline_status === "failed") {
      progressThrottleMap.delete(episodeId);
    }

    return sendProgressNow(payload);
  }

  const now = Date.now();
  const timeSinceLastSent = now - throttleInfo.lastSentTime;

  if (timeSinceLastSent >= THROTTLE_INTERVAL_MS) {
    throttleInfo.lastSentTime = now;
    return sendProgressNow(payload);
  }

  // Lưu lại payload mới nhất trong cửa sổ throttle
  throttleInfo.latestPayload = payload;

  if (!throttleInfo.timer) {
    const remainingDelay = THROTTLE_INTERVAL_MS - timeSinceLastSent;
    throttleInfo.timer = setTimeout(async () => {
      const pendingPayload = throttleInfo.latestPayload;
      throttleInfo.timer = null;
      throttleInfo.latestPayload = null;
      throttleInfo.lastSentTime = Date.now();

      if (pendingPayload) {
        await sendProgressNow(pendingPayload);
      }
    }, remainingDelay);
  }
};

export default { publishProgress, PIPELINE_STAGES, REDIS_PROGRESS_CHANNEL };

