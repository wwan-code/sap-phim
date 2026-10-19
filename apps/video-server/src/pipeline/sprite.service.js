/**
 * @file sprite.service.js
 * @module VideoServer_Pipeline
 * @description Sinh Sprite Sheet đa tầng và tệp WebVTT hỗ trợ thumbnail preview khi seek trên thanh thời gian của player.
 */

import fs from "fs/promises";
import path from "path";

import { spawnFFmpeg } from "../utils/ffmpeg.util.js";
import { logger } from "../utils/logger.js";

/**
 * Định dạng số giây sang định dạng thời gian WebVTT: HH:MM:SS.mmm
 * @param {number} totalSeconds
 * @returns {string}
 */
export const formatVTTTime = (totalSeconds) => {
  const sec = Math.max(0, totalSeconds);
  const hours = Math.floor(sec / 3600);
  const minutes = Math.floor((sec % 3600) / 60);
  const seconds = Math.floor(sec % 60);
  const milliseconds = Math.floor((sec % 1) * 1000);

  const hh = String(hours).padStart(2, "0");
  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");
  const mmm = String(milliseconds).padStart(3, "0");

  return `${hh}:${mm}:${ss}.${mmm}`;
};

/**
 * Tính toán cấu hình lưới sprite tối ưu dựa trên thời lượng video
 * @param {number} duration - Thời lượng video tính bằng giây
 * @returns {Object}
 */
export const calculateSpriteConfig = (duration) => {
  const THUMB_WIDTH = 160;
  const THUMB_HEIGHT = 90;
  const MAX_GRID = 10; // Lưới 10x10 = 100 thumbnail mỗi sheet

  let interval = 5;
  if (duration <= 60) {
    interval = 2; // Dưới 1 phút: lấy mỗi 2s
  } else if (duration <= 600) {
    interval = 5; // Dưới 10 phút: lấy mỗi 5s
  } else if (duration <= 3600) {
    interval = Math.max(5, Math.ceil(duration / 100)); // Dưới 1h: ~100 frames
  } else {
    interval = Math.max(10, Math.ceil(duration / 150)); // Phim dài: ~150 frames
  }

  const totalFrames = Math.max(1, Math.ceil(duration / interval));
  const framesPerSheet = MAX_GRID * MAX_GRID;
  const totalSheets = Math.ceil(totalFrames / framesPerSheet);

  return {
    interval,
    totalFrames,
    framesPerSheet,
    totalSheets,
    gridCols: MAX_GRID,
    gridRows: MAX_GRID,
    thumbWidth: THUMB_WIDTH,
    thumbHeight: THUMB_HEIGHT,
  };
};

/**
 * Sinh nội dung file WebVTT liên kết tới các ảnh sprite theo cú pháp xywh
 * @param {Object} config - Cấu hình sprite từ calculateSpriteConfig
 * @param {number} duration - Tổng thời lượng
 * @param {string} [baseUrl=""] - Tiền tố đường dẫn URL nếu có
 * @returns {string} Nội dung WebVTT
 */
export const generateWebVTTContent = (config, duration, baseUrl = "") => {
  let vtt = "WEBVTT\n\n";
  let frameIndex = 0;

  for (let sheet = 0; sheet < config.totalSheets; sheet++) {
    const sheetFile = `storyboard_${String(sheet + 1).padStart(3, "0")}.jpg`;
    const fullSheetUrl = baseUrl ? `${baseUrl.replace(/\/$/, "")}/${sheetFile}` : sheetFile;

    for (let row = 0; row < config.gridRows; row++) {
      for (let col = 0; col < config.gridCols; col++) {
        if (frameIndex >= config.totalFrames) break;

        const startTime = frameIndex * config.interval;
        const endTime = Math.min((frameIndex + 1) * config.interval, duration);

        const x = col * config.thumbWidth;
        const y = row * config.thumbHeight;

        vtt += `${formatVTTTime(startTime)} --> ${formatVTTTime(endTime)}\n`;
        vtt += `${fullSheetUrl}#xywh=${x},${y},${config.thumbWidth},${config.thumbHeight}\n\n`;

        frameIndex++;
      }
    }
  }

  return vtt;
};

/**
 * Tạo bộ ảnh storyboard sprites và file WebVTT
 * @param {string} inputPath - Video đầu vào
 * @param {string} spritesDir - Thư mục lưu kết quả sprites
 * @param {number} duration - Thời lượng video
 * @param {string} [webUrlPrefix=""] - Tiền tố URL web cho WebVTT
 * @param {Object} [options={}] - Tùy chọn thực thi (signal,...)
 * @returns {Promise<{ spriteUrl: string, vttUrl: string }>}
 */
export const generateStoryboards = async (inputPath, spritesDir, duration, webUrlPrefix = "", options = {}) => {
  await fs.mkdir(spritesDir, { recursive: true });

  const config = calculateSpriteConfig(duration);
  const sheetPattern = path.join(spritesDir, "storyboard_%03d.jpg");

  logger.info(`[SpriteService] Bắt đầu sinh ${config.totalSheets} sheet(s) (${config.totalFrames} frames, interval=${config.interval}s)`);

  const ffmpegArgs = [
    "-y",
    "-i",
    inputPath,
    "-vf",
    `fps=1/${config.interval},scale=${config.thumbWidth}:${config.thumbHeight},tile=${config.gridCols}x${config.gridRows}`,
    "-frames:v",
    String(config.totalSheets),
    "-q:v",
    "4",
    "-an",
    sheetPattern,
  ];

  await spawnFFmpeg(ffmpegArgs, { signal: options.signal });

  const vttContent = generateWebVTTContent(config, duration, webUrlPrefix);
  const vttPath = path.join(spritesDir, "storyboard.vtt");
  await fs.writeFile(vttPath, vttContent, "utf-8");

  logger.info(`[SpriteService] Hoàn thành sinh Sprites và WebVTT tại: ${vttPath}`);

  return {
    spritePattern: sheetPattern,
    firstSpriteFile: "storyboard_001.jpg",
    vttFile: "storyboard.vtt",
  };
};

export default {
  formatVTTTime,
  calculateSpriteConfig,
  generateWebVTTContent,
  generateStoryboards,
};
