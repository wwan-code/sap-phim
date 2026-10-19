/**
 * @file transcode.service.js
 * @module VideoServer_Pipeline
 * @description Thực hiện chuyển mã đa độ phân giải ABR HLS (fMP4 CMAF-ready) và sinh Master Playlist.
 */

import fs from "fs/promises";
import path from "path";

import { spawnFFmpeg } from "../utils/ffmpeg.util.js";
import { logger } from "../utils/logger.js";

/**
 * Tạo Master Playlist (#EXTM3U) liên kết tất cả các profiles
 * @param {string} outputDir - Thư mục gốc chứa các profile
 * @param {Array<Object>} profiles - Danh sách profiles đã chuyển mã thành công
 * @returns {Promise<string>} Đường dẫn tệp master.m3u8
 */
/**
 * Tạo Master Playlist (#EXTM3U) liên kết tất cả các profiles
 * @param {string} outputDir - Thư mục gốc chứa các profile
 * @param {Array<Object>} profiles - Danh sách profiles đã chuyển mã thành công
 * @param {Object} [options={}] - Tùy chọn mở rộng
 * @param {number} [options.fps=24] - Tốc độ khung hình (frame rate) thực tế của video
 * @returns {Promise<string>} Đường dẫn tệp master.m3u8
 */
export const generateMasterPlaylist = async (outputDir, profiles, options = {}) => {
  let content = "#EXTM3U\n#EXT-X-VERSION:7\n#EXT-X-INDEPENDENT-SEGMENTS\n\n";
  const frameRateStr = Number(options.fps || 24).toFixed(3);

  for (const profile of profiles) {
    const codecStr = profile.codec === "libx265" ? "hvc1.1.6.L93.B0,mp4a.40.2" : "avc1.640028,mp4a.40.2";
    content += `#EXT-X-STREAM-INF:BANDWIDTH=${profile.bandwidth},AVERAGE-BANDWIDTH=${Math.round(profile.bandwidth * 0.9)},RESOLUTION=${profile.width}x${profile.height},FRAME-RATE=${frameRateStr},CODECS="${codecStr}"\n`;
    content += `${profile.name}/stream.m3u8\n\n`;
  }

  const masterPath = path.join(outputDir, "master.m3u8");
  await fs.writeFile(masterPath, content, "utf-8");
  logger.info(`[TranscodeService] Đã sinh Master Playlist với FRAME-RATE=${frameRateStr} tại: ${masterPath}`);
  return masterPath;
};

/**
 * Trích xuất ảnh bìa thumbnail đại diện cho tập phim
 * @param {string} inputPath - Tệp video nguồn
 * @param {string} outputDir - Thư mục lưu thumbnail
 * @param {number} duration - Tổng thời lượng video (giây)
 * @param {Object} [options={}] - Tùy chọn thực thi (signal,...)
 * @returns {Promise<string>} Đường dẫn tệp thumbnail
 */
export const extractThumbnail = async (inputPath, outputDir, duration, options = {}) => {
  const seekSeconds = Math.max(1, Math.min(10, Math.floor(duration * 0.1)));
  const thumbPath = path.join(outputDir, "thumbnail.webp");

  const args = [
    "-y",
    "-ss",
    String(seekSeconds),
    "-i",
    inputPath,
    "-vframes",
    "1",
    "-vf",
    "scale=1280:-2",
    "-c:v",
    "libwebp",
    "-quality",
    "85",
    thumbPath,
  ];

  try {
    await spawnFFmpeg(args, { signal: options.signal });
    logger.info(`[TranscodeService] Đã tạo thumbnail tại: ${thumbPath}`);
    return thumbPath;
  } catch (error) {
    logger.warn(`[TranscodeService] Không thể tạo thumbnail: ${error.message}`);
    return null;
  }
};

/**
 * Chuyển mã 1 profile HLS fMP4
 * @param {string} inputPath - Tệp video nguồn
 * @param {string} profileDir - Thư mục lưu trữ của profile
 * @param {Object} profile - Cấu hình profile
 * @param {number} totalDuration - Thời lượng video
 * @param {Function} onProgress - Callback tiến trình (percent)
 * @param {Object} [options={}] - Tùy chọn thực thi (signal,...)
 * @returns {Promise<void>}
 */
export const transcodeSingleProfile = async (
  inputPath,
  profileDir,
  profile,
  totalDuration,
  onProgress,
  options = {},
) => {
  await fs.mkdir(profileDir, { recursive: true });

  const playlistPath = path.join(profileDir, "stream.m3u8");
  const segmentPattern = path.join(profileDir, "segment_%03d.m4s");

  const args = [
    "-y",
    "-i",
    inputPath,
    "-vf",
    `scale=-2:${profile.height}`,
    "-c:v",
    profile.codec,
    "-preset",
    "medium",
    "-crf",
    "23",
    "-b:v",
    profile.bitrate,
    "-maxrate",
    profile.maxrate,
    "-bufsize",
    profile.bufsize,
    "-g",
    "48",
    "-keyint_min",
    "48",
    "-sc_threshold",
    "0",
    "-c:a",
    "aac",
    "-b:a",
    profile.audioBitrate,
    "-ac",
    "2",
    "-f",
    "hls",
    "-hls_time",
    "4",
    "-hls_segment_type",
    "fmp4",
    "-hls_fmp4_init_filename",
    "init.mp4",
    "-hls_segment_filename",
    segmentPattern,
    "-hls_playlist_type",
    "vod",
    playlistPath,
  ];

  logger.info(`[TranscodeService] Bắt đầu chuyển mã profile ${profile.name} (${profile.height}p, ${profile.codec})`);

  await spawnFFmpeg(args, {
    cwd: profileDir,
    totalDuration,
    signal: options.signal,
    onProgress: (p) => {
      if (onProgress) onProgress(p.percent);
    },
  });

  logger.info(`[TranscodeService] Hoàn thành chuyển mã profile ${profile.name}`);
};

export default {
  generateMasterPlaylist,
  extractThumbnail,
  transcodeSingleProfile,
};
