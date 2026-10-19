/**
 * @file episode.subscriber.js
 * @module Worker_EpisodeSubscriber
 * @description Lắng nghe các sự kiện Redis Pub/Sub từ Video Server để cập nhật tiến trình xử lý tập phim và phát qua Socket.IO.
 */

import IORedis from "ioredis";
import { env } from "../../../config/env.config.js";
import { logger } from "../../../utils/logger.js";
import { Episode } from "../../../models/index.js";
import { emitToRoom } from "../../../sockets/services/emit.service.js";
import { getRedisClient } from "../../../config/redis.config.js";
import { SOCKET_EVENTS } from "../../../sockets/constants/socket-events.constants.js";
import { SOCKET_ROOMS } from "../../../sockets/constants/socket-rooms.constants.js";
import { PROCESSING_STAGE_LABELS } from "../../../sockets/constants/processing.constants.js";

let subscriberClient = null;

const REDIS_CHANNEL = "video-server:processing:progress";
const UPLOAD_LOCK_PREFIX = "episode:upload:lock";

/** Các trạng thái pipeline được coi là "cuối" — không còn thay đổi tiếp */
const TERMINAL_PIPELINE_STATUSES = new Set(["completed", "ready", "failed"]);

/**
 * Ánh xạ trạng thái pipeline của Video Server sang Episode status
 */
const mapStatus = (pipelineStatus) => {
  switch (pipelineStatus) {
    case "queued":
    case "transcode_pending":
    case "transcoding":
    case "finalizing":
    case "processing":
    case "uploading":
      return "processing";
    case "completed":
    case "ready":
      return "ready";
    case "failed":
      return "failed";
    default:
      return "processing";
  }
};

/**
 * Giải phóng Redis upload lock cho episode, nếu đang tồn tại.
 * @private
 */
async function releaseUploadLockIfHeld(episodeId) {
  try {
    const redis = getRedisClient();
    await redis.del(`${UPLOAD_LOCK_PREFIX}:${episodeId}`);
    logger.debug(`[EpisodeSubscriber] Đã giải phóng upload lock cho Episode ${episodeId}`);
  } catch (e) {
    logger.warn(`[EpisodeSubscriber] Lỗi giải phóng upload lock cho Episode ${episodeId}: ${e.message}`);
  }
}

export const initEpisodeSubscriber = () => {
  if (subscriberClient) return;

  subscriberClient = new IORedis({
    host: env.redis.host,
    port: env.redis.port,
    password: env.redis.password || undefined,
    ...(env.redis.tls && { tls: { rejectUnauthorized: false } }),
    maxRetriesPerRequest: null,
  });

  subscriberClient.on("ready", () => {
    logger.info("[EpisodeSubscriber] Đã kết nối Redis (Subscriber)");
    subscriberClient.subscribe(REDIS_CHANNEL, (err, count) => {
      if (err) {
        logger.error(`[EpisodeSubscriber] Lỗi subscribe: ${err.message}`);
      } else {
        logger.info(`[EpisodeSubscriber] Đã subscribe channel: ${REDIS_CHANNEL} (${count} channels)`);
      }
    });
  });

  subscriberClient.on("message", async (channel, message) => {
    if (channel !== REDIS_CHANNEL) return;

    try {
      const data = JSON.parse(message);
      const { episode_id, job_id, pipeline_status, progress, stage_message, processing_stage, artifacts } = data;

      if (!episode_id) return;

      const mappedStatus = mapStatus(pipeline_status);

      const episode = await Episode.findByPk(episode_id);
      if (!episode) return;

      // ── Guard #1: message trễ từ 1 job cũ đã bị thay thế ─────────────────
      // Chỉ bỏ qua nếu episode hiện tại có job_id MỚI HƠN job_id trong message (tin nhắn trễ của job cũ)
      // và message không phải là tín hiệu khởi động job mới ("queued").
      if (
        job_id &&
        episode.job_id &&
        job_id !== episode.job_id &&
        pipeline_status !== "queued" &&
        Number(job_id) < Number(episode.job_id)
      ) {
        logger.debug(
          `[EpisodeSubscriber] Bỏ qua message lỗi thời: job_id=${job_id} < episode.job_id=${episode.job_id} (Episode ${episode_id})`,
        );
        return;
      }

      // ── Guard #2: idempotency khi cùng 1 job đã ở trạng thái cuối ───────
      // Bỏ qua nếu tập phim đã "ready" từ CHÍNH JOB NÀY và message đến trễ không phải "ready"
      if (episode.status === "ready" && episode.job_id === job_id && mappedStatus !== "ready") {
        return;
      }

      const humanStageLabel = PROCESSING_STAGE_LABELS[processing_stage] || stage_message || "Đang xử lý...";

      const updates = {
        ...(job_id && { job_id }),
        processing_progress: progress,
        processing_stage: humanStageLabel,
        status: mappedStatus,
      };

      if (mappedStatus === "failed") {
        updates.processing_error = stage_message;
      }

      if (mappedStatus === "ready" && artifacts) {
        if (artifacts.duration) updates.duration = artifacts.duration;
        if (artifacts.video_sources?.length) updates.video_sources = artifacts.video_sources;
        if (artifacts.subtitle_sources?.length) updates.subtitle_sources = artifacts.subtitle_sources;
        if (artifacts.thumbnail_url) updates.thumbnail_url = artifacts.thumbnail_url;
        if (artifacts.sprite_url) updates.sprite_url = artifacts.sprite_url;
        if (artifacts.vtt_url) updates.vtt_url = artifacts.vtt_url;
        if (artifacts.audio_tracks?.length) updates.audio_tracks = artifacts.audio_tracks;
      }

      await episode.update(updates);

      const isTerminal = TERMINAL_PIPELINE_STATUSES.has(pipeline_status) || mappedStatus === "ready" || mappedStatus === "failed";

      // Cache Invalidation (Chỉ gọi khi hoàn thành - O(1) thay vì SCAN)
      if (mappedStatus === "ready") {
        try {
          const redis = getRedisClient();
          await redis.del(`movie:${episode.movie_id}:episodes-list`);
          await redis.del(`episode:${episode.id}`);
        } catch (e) {
          logger.warn(`[EpisodeSubscriber] Lỗi xóa cache: ${e.message}`);
        }
      }

      // Giải phóng upload lock ngay khi pipeline vào trạng thái cuối, thay vì
      // chờ TTL tự hết hạn — cho phép re-upload ngay lập tức sau khi xong/lỗi.
      if (isTerminal) {
        await releaseUploadLockIfHeld(episode_id);
      }

      // Bắn Socket Event tới Admin Room và Episode Room
      const progressPayload = {
        episode_id,
        episodeId: episode_id,
        job_id,
        jobId: job_id,
        status: mappedStatus,
        phase: mappedStatus === "ready" ? "done" : mappedStatus === "failed" ? "failed" : "processing",
        progress,
        processing_progress: progress,
        stage: humanStageLabel,
        processing_stage: humanStageLabel,
        stage_message: stage_message || humanStageLabel,
        error: mappedStatus === "failed" ? stage_message : undefined,
        ...(mappedStatus === "ready" && artifacts ? {
          video_sources: artifacts.video_sources,
          subtitle_sources: artifacts.subtitle_sources,
          thumbnail_url: artifacts.thumbnail_url,
          sprite_url: artifacts.sprite_url,
          vtt_url: artifacts.vtt_url,
          duration: artifacts.duration,
        } : {}),
      };

      const adminRoom = SOCKET_ROOMS.adminEpisode(episode_id);
      const epRoom = `episode:${episode_id}`;

      emitToRoom(adminRoom, SOCKET_EVENTS.EPISODE_PROGRESS, progressPayload);
      emitToRoom(epRoom, SOCKET_EVENTS.EPISODE_PROGRESS, progressPayload);

      if (mappedStatus === "ready") {
        emitToRoom(adminRoom, SOCKET_EVENTS.EPISODE_COMPLETED, progressPayload);
        emitToRoom(epRoom, SOCKET_EVENTS.EPISODE_COMPLETED, progressPayload);
      } else if (mappedStatus === "failed") {
        emitToRoom(adminRoom, SOCKET_EVENTS.EPISODE_FAILED, progressPayload);
        emitToRoom(epRoom, SOCKET_EVENTS.EPISODE_FAILED, progressPayload);
      }
    } catch (err) {
      logger.error(`[EpisodeSubscriber] Lỗi khi xử lý message từ Redis: ${err.message}`);
    }
  });

  subscriberClient.on("error", (err) => {
    logger.error(`[EpisodeSubscriber] Lỗi Redis: ${err.message}`);
  });
};

export const closeEpisodeSubscriber = async () => {
  if (subscriberClient) {
    await subscriberClient.quit();
    subscriberClient = null;
    logger.info("[EpisodeSubscriber] Đã đóng Redis Subscriber");
  }
};