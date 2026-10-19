/**
 * @file tus-server.js
 * @module VideoServer_Upload
 * @description Cấu hình máy chủ TUS Server (@tus/server) xử lý tải tệp lớn ngắt quãng/tiếp tục và hook kích hoạt pipeline.
 */

import fs from "fs";
import path from "path";
import { Server } from "@tus/server";
import { FileStore } from "@tus/file-store";

import { env } from "../config/env.config.js";
import { videoQueue, JOB_NAMES, findExistingJobByEpisode } from "../config/queue.config.js";
import { isEpisodePipelineActive } from "../pipeline/pipeline.worker.js";
import { verifyUploadToken } from "../middlewares/upload-token.middleware.js";
import { publishProgress, PIPELINE_STAGES } from "../pipeline/progress.publisher.js";
import { logger } from "../utils/logger.js";

// Đảm bảo thư mục lưu trữ uploads tạm thời luôn sẵn sàng
if (!fs.existsSync(env.paths.uploadDir)) {
  fs.mkdirSync(env.paths.uploadDir, { recursive: true });
}

export const tusServer = new Server({
  path: "/upload/tus",
  datastore: new FileStore({
    directory: env.paths.uploadDir,
  }),
  maxSize: 20 * 1024 * 1024 * 1024, // Hỗ trợ tệp phim lên tới 20GB
  respectForwardedHeaders: true,

  onUploadCreate: async (req, upload) => {
    logger.info(`[TUS] Khởi tạo phiên upload mới: ID=${upload.id}, Size=${upload.size} bytes`);
    return {};
  },

  onUploadFinish: async (req, upload) => {
    try {
      const token =
        req.headers["x-upload-token"] ||
        upload.metadata?.token ||
        upload.metadata?.upload_token;

      const decoded = verifyUploadToken(token);
      const episodeId = decoded?.episodeId || upload.metadata?.episode_id;
      const movieId = decoded?.movieId || upload.metadata?.movie_id;
      const userId = decoded?.userId || upload.metadata?.user_id || "system";

      if (!episodeId || !movieId) {
        logger.error(`[TUS] Thiếu thông tin episodeId (${episodeId}) hoặc movieId (${movieId}) sau khi upload hoàn thành`);
        return {};
      }

      const uploadFilePath = path.join(env.paths.uploadDir, upload.id);
      logger.info(`[TUS] Upload hoàn thành thành công: Episode=${episodeId}, Movie=${movieId}, File=${uploadFilePath}`);

      // Chống tạo trùng lặp (Deduplication)
      if (isEpisodePipelineActive(episodeId)) {
        logger.warn(`[TUS] Episode ${episodeId} đang được xử lý trong pipeline, bỏ qua thêm job trùng lặp`);
        return {};
      }

      const existingJob = await findExistingJobByEpisode(episodeId);
      if (existingJob) {
        logger.warn(`[TUS] Đã tồn tại Job ${existingJob.id} cho Episode ${episodeId} trong hàng đợi, bỏ qua thêm job trùng lặp`);
        return {};
      }

      // Thêm tác vụ vào hàng đợi BullMQ
      const job = await videoQueue.add(JOB_NAMES.TRANSCODE, {
        episode_id: episodeId,
        movie_id: movieId,
        user_id: userId,
        file_path: uploadFilePath,
      });

      logger.info(`[TUS] Đã thêm Job transcode vào hàng đợi: JobID=${job.id}, Episode=${episodeId}`);

      // Phát tín hiệu trạng thái hàng đợi lên Redis
      await publishProgress({
        episode_id: episodeId,
        job_id: job.id,
        pipeline_status: "queued",
        progress: 0,
        processing_stage: PIPELINE_STAGES.ANALYZING,
        stage_message: "Tệp video đã tải lên hoàn tất, đang chờ xử lý...",
      });
    } catch (error) {
      logger.error(`[TUS] Lỗi trong hook onUploadFinish: ${error.message}`);
    }

    return {};
  },
});

export default tusServer;
