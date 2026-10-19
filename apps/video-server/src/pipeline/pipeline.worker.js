/**
 * @file pipeline.worker.js
 * @module VideoServer_Pipeline
 * @description Bộ điều phối trung tâm thực thi chuỗi tác vụ phân tích, chuyển mã ABR, sinh sprites và phát tán tiến trình.
 */

import fs from "fs/promises";
import path from "path";

import { env } from "../config/env.config.js";
import { probeVideo, selectProfiles } from "./probe.service.js";
import { transcodeSingleProfile, generateMasterPlaylist, extractThumbnail } from "./transcode.service.js";
import { generateStoryboards } from "./sprite.service.js";
import { publishProgress, PIPELINE_STAGES } from "./progress.publisher.js";
import { spawnFFmpeg } from "../utils/ffmpeg.util.js";
import { logger } from "../utils/logger.js";

/**
 * Bản đồ theo dõi các episode đang trong tiến trình xử lý
 * @type {Map<string, { jobId: string, abortController: AbortController, startTime: number }>}
 */
export const activePipelines = new Map();

/**
 * Kiểm tra xem một tập phim có đang được chuyển mã hay không
 * @param {string} episodeId
 * @returns {boolean}
 */
export const isEpisodePipelineActive = (episodeId) => {
  return activePipelines.has(episodeId);
};

/**
 * Hủy tiến trình xử lý video của một episode cụ thể
 * @param {string} episodeId
 * @returns {boolean}
 */
export const abortEpisodePipeline = (episodeId) => {
  const pipeline = activePipelines.get(episodeId);
  if (pipeline && pipeline.abortController) {
    logger.warn(`[PipelineWorker] Yêu cầu hủy pipeline cho Episode ${episodeId}`);
    pipeline.abortController.abort();
    return true;
  }
  return false;
};

/**
 * Hủy tất cả các tiến trình FFmpeg đang hoạt động (dùng cho Graceful Shutdown)
 */
export const abortAllPipelines = () => {
  logger.warn(`[PipelineWorker] Đang dừng khẩn cấp toàn bộ ${activePipelines.size} pipeline đang chạy...`);
  for (const [episodeId, pipeline] of activePipelines.entries()) {
    try {
      pipeline.abortController?.abort();
    } catch (e) {
      logger.error(`[PipelineWorker] Lỗi khi abort pipeline của Episode ${episodeId}: ${e.message}`);
    }
  }
  activePipelines.clear();
};

/**
 * Hàm xử lý chính cho BullMQ Worker
 * @param {import("bullmq").Job} job
 */
export const processVideoTranscodeJob = async (job) => {
  const { episode_id, movie_id, file_path, input_path } = job.data;
  const sourceVideoPath = file_path || input_path;
  const jobId = job.id;

  if (!episode_id || !movie_id || !sourceVideoPath) {
    throw new Error(`Dữ liệu Job không hợp lệ: episode_id=${episode_id}, movie_id=${movie_id}, file_path=${sourceVideoPath}`);
  }

  // Khởi tạo AbortController riêng cho job này để quản lý vòng đời tiến trình con FFmpeg
  const abortController = new AbortController();
  const { signal } = abortController;

  logger.info(`[PipelineWorker] Bắt đầu xử lý Job ${jobId} cho Episode ${episode_id}`);
  activePipelines.set(episode_id, { jobId, abortController, startTime: Date.now() });

  try {
    // ── Giai đoạn 1: Phân tích video (analyzing 0-2%) ──
    await publishProgress({
      episode_id,
      job_id: jobId,
      pipeline_status: "processing",
      progress: 1,
      processing_stage: PIPELINE_STAGES.ANALYZING,
      stage_message: "Đang phân tích cấu trúc video...",
    });

    const metadata = await probeVideo(sourceVideoPath, { signal });
    const selectedProfiles = selectProfiles(metadata.height);

    logger.info(`[PipelineWorker] Đã chọn ${selectedProfiles.length} profiles cho Episode ${episode_id} (FPS: ${metadata.fps}): ${selectedProfiles.map((p) => p.name).join(", ")}`);

    const episodeOutputDir = path.join(env.paths.outputDir, movie_id, episode_id);
    await fs.mkdir(episodeOutputDir, { recursive: true });

    await publishProgress({
      episode_id,
      job_id: jobId,
      pipeline_status: "processing",
      progress: 2,
      processing_stage: PIPELINE_STAGES.ANALYZING,
      stage_message: `Đã chọn ${selectedProfiles.length} độ phân giải (${selectedProfiles.map((p) => p.name).join(", ")})`,
    });

    // ── Giai đoạn 2 & 3: Chuyển mã video & âm thanh (transcoding_video 2-75%) ──
    const totalProfiles = selectedProfiles.length;
    const stageStartPercent = 2;
    const stageEndPercent = 75;
    const percentPerProfile = (stageEndPercent - stageStartPercent) / totalProfiles;

    for (let i = 0; i < totalProfiles; i++) {
      if (signal.aborted) {
        throw new Error("Pipeline đã bị hủy");
      }

      const profile = selectedProfiles[i];
      const profileDir = path.join(episodeOutputDir, profile.name);

      await publishProgress({
        episode_id,
        job_id: jobId,
        pipeline_status: "processing",
        progress: Math.round(stageStartPercent + i * percentPerProfile),
        processing_stage: PIPELINE_STAGES.TRANSCODING_VIDEO,
        stage_message: `Đang chuyển mã luồng ${profile.name} (${i + 1}/${totalProfiles})...`,
      });

      await transcodeSingleProfile(
        sourceVideoPath,
        profileDir,
        profile,
        metadata.duration,
        (profilePercent) => {
          const globalProgress = stageStartPercent + i * percentPerProfile + (profilePercent / 100) * percentPerProfile;
          const roundedProgress = Math.round(globalProgress);

          // Cập nhật tiến độ vào BullMQ để refresh lock duration tự động, tránh stalled job
          job.updateProgress(roundedProgress).catch(() => {});

          publishProgress({
            episode_id,
            job_id: jobId,
            pipeline_status: "processing",
            progress: roundedProgress,
            processing_stage: PIPELINE_STAGES.TRANSCODING_VIDEO,
            stage_message: `Đang chuyển mã luồng ${profile.name}: ${profilePercent}%`,
          });
        },
        { signal },
      );
    }

    // ── Giai đoạn 3: Âm thanh (transcoding_audio 75-85%) ──
    await publishProgress({
      episode_id,
      job_id: jobId,
      pipeline_status: "processing",
      progress: 80,
      processing_stage: PIPELINE_STAGES.TRANSCODING_AUDIO,
      stage_message: "Đang đồng bộ hóa luồng âm thanh AAC...",
    });

    // ── Giai đoạn 4: Sinh Thumbnails & Storyboard Sprites (thumbnails_sprites 85-95%) ──
    await publishProgress({
      episode_id,
      job_id: jobId,
      pipeline_status: "processing",
      progress: 86,
      processing_stage: PIPELINE_STAGES.THUMBNAILS_SPRITES,
      stage_message: "Đang trích xuất ảnh bìa và lưới Storyboard Sprites...",
    });

    const spritesDir = path.join(episodeOutputDir, "sprites");
    const webSpritePrefix = `/media/${movie_id}/${episode_id}/sprites`;

    await extractThumbnail(sourceVideoPath, episodeOutputDir, metadata.duration, { signal });
    await generateStoryboards(sourceVideoPath, spritesDir, metadata.duration, webSpritePrefix, { signal });

    await publishProgress({
      episode_id,
      job_id: jobId,
      pipeline_status: "processing",
      progress: 94,
      processing_stage: PIPELINE_STAGES.THUMBNAILS_SPRITES,
      stage_message: "Đã tạo xong Storyboard Sprites",
    });

    // ── Giai đoạn 5: Hoàn tất, xử lý phụ đề và ghi Master Playlist (finalizing 95-100%) ──
    await publishProgress({
      episode_id,
      job_id: jobId,
      pipeline_status: "processing",
      progress: 96,
      processing_stage: PIPELINE_STAGES.FINALIZING,
      stage_message: "Đang kiểm tra phụ đề và khởi tạo Master Playlist...",
    });

    const subsDir = path.join(episodeOutputDir, "subs");
    await fs.mkdir(subsDir, { recursive: true });

    if (metadata.subtitleStreams && metadata.subtitleStreams.length > 0) {
      for (const s of metadata.subtitleStreams) {
        if (signal.aborted) break;
        const subLang = s.language || "vi";
        const subFile = path.join(subsDir, `${subLang}.vtt`);
        try {
          await spawnFFmpeg(
            [
              "-y",
              "-i",
              sourceVideoPath,
              "-map",
              `0:${s.index}`,
              "-c:s",
              "webvtt",
              subFile,
            ],
            { signal },
          );
          logger.info(`[PipelineWorker] Đã trích xuất phụ đề [${subLang}] vào: ${subFile}`);
        } catch (subErr) {
          logger.warn(`[PipelineWorker] Không thể trích xuất phụ đề stream ${s.index}: ${subErr.message}`);
        }
      }
    }

    let subtitleSources = [];
    try {
      const subFiles = await fs.readdir(subsDir);
      subtitleSources = subFiles
        .filter((f) => f.endsWith(".vtt"))
        .map((f) => {
          const lang = path.basename(f, ".vtt");
          const isDefault = lang === "vi";
          return {
            id: lang,
            language: lang,
            label: lang === "vi" ? "Tiếng Việt" : lang === "en" ? "English" : lang.toUpperCase(),
            srclang: lang,
            src: `/media/${movie_id}/${episode_id}/subs/${f}`,
            url: `/media/${movie_id}/${episode_id}/subs/${f}`,
            isDefault,
            default: isDefault,
          };
        });
    } catch (_) {
      /* Thư mục rỗng */
    }

    // Ghi master playlist với frame rate thực tế từ probe metadata
    await generateMasterPlaylist(episodeOutputDir, selectedProfiles, { fps: metadata.fps });

    const videoSources = selectedProfiles.map((p) => ({
      quality: p.name,
      resolution: `${p.width}x${p.height}`,
      codec: p.codec,
      bitrate: p.bitrate,
      src: `/media/${movie_id}/${episode_id}/${p.name}/stream.m3u8`,
    }));

    const artifacts = {
      duration: Math.round(metadata.duration),
      video_sources: videoSources,
      subtitle_sources: subtitleSources,
      thumbnail_url: `/media/${movie_id}/${episode_id}/thumbnail.webp`,
      sprite_url: `/media/${movie_id}/${episode_id}/sprites/storyboard_001.jpg`,
      vtt_url: `/media/${movie_id}/${episode_id}/sprites/storyboard.vtt`,
      master_playlist: `/media/${movie_id}/${episode_id}/master.m3u8`,
    };

    logger.info(`[PipelineWorker] Hoàn tất toàn bộ pipeline cho Episode ${episode_id}`);

    await publishProgress({
      episode_id,
      job_id: jobId,
      pipeline_status: "ready",
      progress: 100,
      processing_stage: PIPELINE_STAGES.FINALIZING,
      stage_message: "Xử lý video hoàn tất thành công",
      artifacts,
    });

    // ── Giai đoạn 6: Dọn dẹp tệp video nguồn tải lên (giải phóng đĩa cứng) ──
    try {
      const resolvedSource = path.resolve(sourceVideoPath);
      const resolvedUploadDir = path.resolve(env.paths.uploadDir);
      if (resolvedSource.startsWith(resolvedUploadDir)) {
        await fs.unlink(resolvedSource).catch(() => {});
        await fs.unlink(`${resolvedSource}.json`).catch(() => {});
        await fs.unlink(`${resolvedSource}.info`).catch(() => {});
        logger.info(`[PipelineWorker] Đã dọn dẹp tệp tải lên sau khi hoàn tất: ${resolvedSource}`);
      }
    } catch (cleanupErr) {
      logger.warn(`[PipelineWorker] Lỗi dọn dẹp tệp nguồn: ${cleanupErr.message}`);
    }

    return artifacts;
  } catch (error) {
    logger.error(`[PipelineWorker] Pipeline thất bại cho Episode ${episode_id}: ${error.message}`);

    await publishProgress({
      episode_id,
      job_id: jobId,
      pipeline_status: "failed",
      progress: 0,
      processing_stage: "failed",
      stage_message: `Lỗi xử lý video: ${error.message}`,
    });

    throw error;
  } finally {
    activePipelines.delete(episode_id);
  }
};

export default {
  processVideoTranscodeJob,
  isEpisodePipelineActive,
  abortEpisodePipeline,
  abortAllPipelines,
  activePipelines,
};

