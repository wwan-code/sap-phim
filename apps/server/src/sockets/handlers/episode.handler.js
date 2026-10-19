/**
 * @file episode.handler.js
 * @module Sockets_EpisodeHandler
 * @description Xử lý các sự kiện socket liên quan đến theo dõi tiến độ xử lý Episode
 */

import { logger } from "../../utils/logger.js";
import { withAuth } from "../middlewares/socket-guard.middleware.js";
import { globalRateLimiter, withRateLimit } from "../middlewares/socket-rate-limit.middleware.js";
import { SOCKET_ROOMS } from "../constants/socket-rooms.constants.js";
import { SOCKET_EVENTS } from "../constants/socket-events.constants.js";
import { ROLES } from "../../constants/roles.constant.js";
import { Episode } from "../../models/index.js";

const PRIVILEGED_ROLES = [ROLES.ADMIN, ROLES.BOSS];

export const registerEpisodeHandlers = (io, socket) => {
  // Chỉ admin mới có quyền subscribe vào tiến độ Episode
  socket.on(
    "episode:subscribe",
    withRateLimit(
      socket,
      globalRateLimiter,
      withAuth(
        socket,
        PRIVILEGED_ROLES,
        async (data, callback) => {
          try {
            const episodeId = data?.episodeId || data?.episode_id;
            if (!episodeId) {
              if (typeof callback === "function") {
                callback({ success: false, message: "Missing episodeId" });
              }
              return;
            }

            const adminRoom = SOCKET_ROOMS.adminEpisode(episodeId);
            const epRoom = `episode:${episodeId}`;
            await Promise.all([socket.join(adminRoom), socket.join(epRoom)]);

            logger.debug(`[SocketEpisode] socketId=${socket.id} joined ${adminRoom} & ${epRoom}`);

            // Đồng bộ trạng thái hiện tại từ DB cho socket ngay khi subscribe
            try {
              const episode = await Episode.findByPk(episodeId);
              if (episode) {
                const isReady = episode.status === "ready";
                const isFailed = episode.status === "failed";
                const syncPayload = {
                  episode_id: episode.id,
                  episodeId: episode.id,
                  job_id: episode.job_id,
                  jobId: episode.job_id,
                  status: episode.status,
                  phase: isReady ? "done" : isFailed ? "failed" : "processing",
                  progress: episode.processing_progress ?? (isReady ? 100 : 0),
                  processing_progress: episode.processing_progress ?? (isReady ? 100 : 0),
                  stage: episode.processing_stage || (isReady ? "Hoàn tất" : "Đang xử lý..."),
                  processing_stage: episode.processing_stage || (isReady ? "Hoàn tất" : "Đang xử lý..."),
                  stage_message: episode.processing_stage || (isReady ? "Hoàn tất" : "Đang xử lý..."),
                  error: isFailed ? episode.processing_error : undefined,
                  video_sources: episode.video_sources,
                  thumbnail_url: episode.thumbnail_url,
                  sprite_url: episode.sprite_url,
                  vtt_url: episode.vtt_url,
                  duration: episode.duration,
                };

                socket.emit(SOCKET_EVENTS.EPISODE_PROGRESS, syncPayload);
                if (isReady) {
                  socket.emit(SOCKET_EVENTS.EPISODE_COMPLETED, syncPayload);
                } else if (isFailed) {
                  socket.emit(SOCKET_EVENTS.EPISODE_FAILED, syncPayload);
                }
              }
            } catch (dbErr) {
              logger.warn(`[SocketEpisode] Không thể đồng bộ trạng thái Episode ${episodeId}: ${dbErr.message}`);
            }

            if (typeof callback === "function") {
              callback({ success: true, episodeId });
            }
          } catch (error) {
            logger.error(`[SocketEpisode] error subscribe: ${error.message}`);
            if (typeof callback === "function") {
              callback({ success: false, message: error.message });
            }
          }
        },
        "episode:subscribe"
      ),
      "episode:subscribe"
    )
  );

  socket.on(
    "episode:unsubscribe",
    withRateLimit(
      socket,
      globalRateLimiter,
      withAuth(
        socket,
        PRIVILEGED_ROLES,
        async (data, callback) => {
          try {
            const episodeId = data?.episodeId || data?.episode_id;
            if (!episodeId) return;

            const adminRoom = SOCKET_ROOMS.adminEpisode(episodeId);
            const epRoom = `episode:${episodeId}`;
            await Promise.all([socket.leave(adminRoom), socket.leave(epRoom)]);

            logger.debug(`[SocketEpisode] socketId=${socket.id} left ${adminRoom} & ${epRoom}`);

            if (typeof callback === "function") {
              callback({ success: true, episodeId });
            }
          } catch (error) {
            logger.error(`[SocketEpisode] error unsubscribe: ${error.message}`);
          }
        },
        "episode:unsubscribe"
      ),
      "episode:unsubscribe"
    )
  );
};

