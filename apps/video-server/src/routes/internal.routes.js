/**
 * @file internal.routes.js
 * @module VideoServer_Routes
 * @description API nội bộ tiếp nhận các yêu cầu điều phối công việc, kiểm tra sức khỏe và quản lý phụ đề từ Main Backend.
 */

import fs from "fs/promises";
import path from "path";
import express from "express";
import multer from "multer";

import { env } from "../config/env.config.js";
import { videoQueue, JOB_NAMES, findExistingJobByEpisode } from "../config/queue.config.js";
import { internalAuthMiddleware } from "../middlewares/internal-auth.middleware.js";
import { isEpisodePipelineActive, abortEpisodePipeline } from "../pipeline/pipeline.worker.js";
import { cleanAndNormalizeVtt } from "../utils/subtitle.util.js";
import { assertValidPathSegment } from "../utils/security.util.js";
import { logger } from "../utils/logger.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// ════════════════════════════════════════
// 1. KIỂM TRA SỨC KHỎE (HEALTH CHECKS)
// ════════════════════════════════════════

router.get(["/health/live", "/internal/health"], (req, res) => {
  res.status(200).json({
    alive: true,
    success: true,
    service: "video-server",
    timestamp: new Date().toISOString(),
  });
});

router.get("/health/detailed", async (req, res) => {
  try {
    const queueCounts = await videoQueue.getJobCounts(
      "waiting",
      "active",
      "completed",
      "failed",
      "delayed",
    );

    res.status(200).json({
      success: true,
      status: "healthy",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      queue: queueCounts,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      status: "unhealthy",
      error: error.message,
    });
  }
});

// ════════════════════════════════════════
// 2. ĐIỀU PHỐI TIẾN TRÌNH & HÀNG ĐỢI (JOBS)
// ════════════════════════════════════════

/**
 * Tạo công việc chuyển mã mới trực tiếp
 */
router.post(["/api/jobs", "/internal/jobs"], internalAuthMiddleware, async (req, res, next) => {
  try {
    const { episode_id, movie_id, user_id, input_path, file_path } = req.body;
    const targetPath = file_path || input_path;

    if (!episode_id || !movie_id || !targetPath) {
      return res.status(400).json({
        success: false,
        message: "Thiếu các tham số bắt buộc: episode_id, movie_id, input_path",
      });
    }

    assertValidPathSegment(movie_id, "movie_id");
    assertValidPathSegment(episode_id, "episode_id");

    // Chống tạo trùng lặp: kiểm tra active pipeline hoặc job đang chờ trong queue
    if (isEpisodePipelineActive(episode_id)) {
      logger.warn(`[InternalRoutes] Episode ${episode_id} đang được xử lý trong active pipeline`);
      return res.status(200).json({
        success: true,
        message: "Tập phim hiện đang được xử lý",
        data: {
          episode_id,
          status: "processing",
        },
      });
    }

    const existingJob = await findExistingJobByEpisode(episode_id);
    if (existingJob) {
      const state = await existingJob.getState();
      logger.warn(`[InternalRoutes] Đã có Job ${existingJob.id} cho episode ${episode_id} ở trạng thái: ${state}`);
      return res.status(200).json({
        success: true,
        message: "Job xử lý tập phim đã tồn tại trong hàng đợi",
        data: {
          job_id: existingJob.id,
          episode_id,
          status: state,
        },
      });
    }

    const job = await videoQueue.add(JOB_NAMES.TRANSCODE, {
      episode_id,
      movie_id,
      user_id: user_id || "admin",
      file_path: targetPath,
    });

    logger.info(`[InternalRoutes] Đã tạo Job chuyển mã ${job.id} cho tập ${episode_id}`);

    res.status(201).json({
      success: true,
      data: {
        job_id: job.id,
        episode_id,
        status: "queued",
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Kiểm tra trạng thái chi tiết của một Job theo ID
 */
router.get(["/api/jobs/:jobId/status", "/internal/job/:jobId"], internalAuthMiddleware, async (req, res, next) => {
  try {
    const { jobId } = req.params;
    const job = await videoQueue.getJob(jobId);

    if (!job) {
      return res.status(404).json({
        success: false,
        message: `Không tìm thấy thông tin Job: ${jobId}`,
      });
    }

    const state = await job.getState();
    const progress = job.progress || 0;

    res.status(200).json({
      success: true,
      data: {
        job_id: job.id,
        state,
        progress,
        data: job.data,
        failed_reason: job.failedReason || null,
        return_value: job.returnvalue || null,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Thử lại một Job xử lý đã thất bại
 */
router.post(["/api/jobs/:jobId/retry", "/internal/retry"], internalAuthMiddleware, async (req, res, next) => {
  try {
    const jobId = req.params.jobId || req.body.job_id;
    const { movie_id, episode_id } = req.body;

    let targetJob = null;
    if (jobId) {
      targetJob = await videoQueue.getJob(jobId);
    }

    if (targetJob) {
      await targetJob.retry();
      logger.info(`[InternalRoutes] Đã yêu cầu retry Job ${targetJob.id}`);
      return res.status(200).json({
        success: true,
        message: "Đã yêu cầu thực thi lại Job",
        job_id: targetJob.id,
      });
    }

    // Nếu không tìm thấy job cũ hoặc job đã bị xóa, tạo job mới nếu có đủ thông tin
    if (episode_id && movie_id) {
      // Tìm tệp video gốc nếu có trong thư mục uploads
      const newJob = await videoQueue.add(JOB_NAMES.TRANSCODE, {
        episode_id,
        movie_id,
        user_id: "retry-trigger",
        file_path: req.body.file_path || path.join(env.paths.uploadDir, `${episode_id}.mp4`),
      });

      return res.status(200).json({
        success: true,
        message: "Đã tạo tiến trình xử lý video mới",
        job_id: newJob.id,
      });
    }

    return res.status(404).json({
      success: false,
      message: "Không tìm thấy Job cần thử lại",
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Kiểm tra xem Pipeline có đang chạy cho Episode không
 */
router.get("/internal/pipeline/episode/:id/active", internalAuthMiddleware, (req, res) => {
  const { id } = req.params;
  assertValidPathSegment(id, "episode_id");
  const active = isEpisodePipelineActive(id);

  res.status(200).json({
    success: true,
    data: {
      episode_id: id,
      active,
    },
  });
});

/**
 * Dừng/Hủy một pipeline đang chạy
 */
router.post("/internal/pipeline/episode/:id/abort", internalAuthMiddleware, (req, res) => {
  const { id } = req.params;
  assertValidPathSegment(id, "episode_id");
  const aborted = abortEpisodePipeline(id);

  res.status(200).json({
    success: true,
    message: aborted ? `Đã gửi tín hiệu hủy pipeline cho episode ${id}` : `Không có pipeline nào đang chạy cho episode ${id}`,
    data: {
      episode_id: id,
      aborted,
    },
  });
});

/**
 * Thống kê hàng đợi
 */
router.get(["/api/jobs/queue/stats", "/internal/queue/stats"], internalAuthMiddleware, async (req, res, next) => {
  try {
    const counts = await videoQueue.getJobCounts(
      "waiting",
      "active",
      "completed",
      "failed",
      "delayed",
    );

    res.status(200).json({
      success: true,
      data: counts,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Dọn dẹp tài nguyên video của tập phim
 */
router.delete("/internal/cleanup", internalAuthMiddleware, async (req, res, next) => {
  try {
    const { movie_id, episode_id } = req.body;
    if (!movie_id || !episode_id) {
      return res.status(400).json({
        success: false,
        message: "Cần cung cấp movie_id và episode_id",
      });
    }

    assertValidPathSegment(movie_id, "movie_id");
    assertValidPathSegment(episode_id, "episode_id");

    const targetDir = path.join(env.paths.outputDir, movie_id, episode_id);
    await fs.rm(targetDir, { recursive: true, force: true });

    logger.info(`[InternalRoutes] Đã xóa thư mục output: ${targetDir}`);
    res.status(200).json({
      success: true,
      message: "Đã dọn dẹp tài nguyên video thành công",
    });
  } catch (error) {
    next(error);
  }
});

// ════════════════════════════════════════
// 3. QUẢN LÝ PHỤ ĐỀ (SUBTITLES)
// ════════════════════════════════════════

/**
 * Tải lên tệp phụ đề
 */
router.post(
  ["/api/v1/subtitles/upload", "/internal/subtitles"],
  internalAuthMiddleware,
  upload.single("file"),
  async (req, res, next) => {
    try {
      const file = req.file;
      const { episode_id, movie_id, language, label, is_default } = req.body;

      if (!file || !episode_id || !movie_id || !language) {
        return res.status(400).json({
          success: false,
          message: "Thiếu dữ liệu tệp hoặc tham số: episode_id, movie_id, language",
        });
      }

      assertValidPathSegment(movie_id, "movie_id");
      assertValidPathSegment(episode_id, "episode_id");
      assertValidPathSegment(language, "language");

      const subsDir = path.join(env.paths.outputDir, movie_id, episode_id, "subs");
      await fs.mkdir(subsDir, { recursive: true });

      const fileName = `${language}.vtt`;
      const filePath = path.join(subsDir, fileName);

      // Chuẩn hóa, loại bỏ BOM và convert SRT sang WebVTT chuẩn
      const normalizedContent = cleanAndNormalizeVtt(file.buffer);
      await fs.writeFile(filePath, normalizedContent, "utf-8");
      logger.info(`[Subtitles] Đã chuẩn hóa và lưu tệp phụ đề: ${filePath}`);

      const publicUrl = `/media/${movie_id}/${episode_id}/subs/${fileName}`;
      const isDefault = is_default === true || is_default === "true" || language === "vi";

      res.status(201).json({
        success: true,
        data: {
          id: language,
          language,
          label: label || (language === "vi" ? "Tiếng Việt" : language === "en" ? "English" : language.toUpperCase()),
          srclang: language,
          src: publicUrl,
          url: publicUrl,
          isDefault,
          default: isDefault,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * Lấy danh sách phụ đề của tập phim
 */
router.get(
  ["/api/v1/subtitles/:episodeId", "/internal/subtitles/:episodeId"],
  internalAuthMiddleware,
  async (req, res, next) => {
    try {
      const { episodeId } = req.params;
      const { movieId } = req.query;

      if (!movieId) {
        return res.status(400).json({
          success: false,
          message: "Cần truyền query param movieId",
        });
      }

      assertValidPathSegment(movieId, "movieId");
      assertValidPathSegment(episodeId, "episodeId");

      const subsDir = path.join(env.paths.outputDir, movieId, episodeId, "subs");

      try {
        const files = await fs.readdir(subsDir);
        const subtitles = files
          .filter((f) => f.endsWith(".vtt"))
          .map((f) => {
            const lang = path.basename(f, ".vtt");
            return {
              id: lang,
              language: lang,
              label: lang === "vi" ? "Tiếng Việt" : lang === "en" ? "English" : lang.toUpperCase(),
              srclang: lang,
              src: `/media/${movieId}/${episodeId}/subs/${f}`,
              isDefault: lang === "vi",
            };
          });

        res.status(200).json({
          success: true,
          data: subtitles,
        });
      } catch (err) {
        // Thư mục chưa tồn tại -> chưa có phụ đề nào
        res.status(200).json({
          success: true,
          data: [],
        });
      }
    } catch (error) {
      next(error);
    }
  },
);

/**
 * Xóa một bản phụ đề
 */
router.delete(
  ["/api/v1/subtitles/:episodeId/:language", "/internal/subtitles/:episodeId/:language"],
  internalAuthMiddleware,
  async (req, res, next) => {
    try {
      const { episodeId, language } = req.params;
      const { movieId } = req.query;

      if (!movieId) {
        return res.status(400).json({
          success: false,
          message: "Cần truyền query param movieId",
        });
      }

      assertValidPathSegment(movieId, "movieId");
      assertValidPathSegment(episodeId, "episodeId");
      assertValidPathSegment(language, "language");

      const filePath = path.join(env.paths.outputDir, movieId, episodeId, "subs", `${language}.vtt`);
      await fs.unlink(filePath).catch(() => {});

      logger.info(`[Subtitles] Đã xóa phụ đề: ${filePath}`);

      res.status(200).json({
        success: true,
        message: `Đã xóa phụ đề ngôn ngữ ${language}`,
      });
    } catch (error) {
      next(error);
    }
  },
);

export default router;
