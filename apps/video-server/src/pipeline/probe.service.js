/**
 * @file probe.service.js
 * @module VideoServer_Pipeline
 * @description Trích xuất metadata video bằng FFprobe và chọn lựa ABR profiles thông minh (không upscale).
 */

import crypto from "crypto";
import { spawnFFprobe } from "../utils/ffmpeg.util.js";
import { getRedisClient } from "../config/redis.config.js";
import { logger } from "../utils/logger.js";

/**
 * Danh mục các Profiles chuẩn ABR
 */
export const ABR_PROFILES = [
  {
    name: "2160p",
    height: 2160,
    width: 3840,
    codec: "libx265",
    bitrate: "8000k",
    maxrate: "9000k",
    bufsize: "16000k",
    audioBitrate: "192k",
    bandwidth: 8200000,
  },
  {
    name: "1440p",
    height: 1440,
    width: 2560,
    codec: "libx264",
    bitrate: "6000k",
    maxrate: "7000k",
    bufsize: "12000k",
    audioBitrate: "192k",
    bandwidth: 6200000,
  },
  {
    name: "1080p",
    height: 1080,
    width: 1920,
    codec: "libx264",
    bitrate: "4000k",
    maxrate: "4500k",
    bufsize: "8000k",
    audioBitrate: "128k",
    bandwidth: 4150000,
  },
  {
    name: "720p",
    height: 720,
    width: 1280,
    codec: "libx264",
    bitrate: "2500k",
    maxrate: "2800k",
    bufsize: "5000k",
    audioBitrate: "128k",
    bandwidth: 2650000,
  },
  {
    name: "480p",
    height: 480,
    width: 854,
    codec: "libx264",
    bitrate: "1200k",
    maxrate: "1400k",
    bufsize: "2400k",
    audioBitrate: "96k",
    bandwidth: 1300000,
  },
];

/**
 * Tính số fps từ chuỗi tỉ lệ (ví dụ "24/1" -> 24)
 * @param {string} rFrameRate
 * @returns {number}
 */
const parseFps = (rFrameRate) => {
  if (!rFrameRate) return 24;
  const parts = rFrameRate.split("/");
  if (parts.length === 2) {
    const num = parseFloat(parts[0]);
    const den = parseFloat(parts[1]);
    return den > 0 ? Math.round((num / den) * 100) / 100 : 24;
  }
  return parseFloat(rFrameRate) || 24;
};

/**
 * Đọc toàn diện metadata của video đầu vào (có cache Redis 1h để tối ưu retry)
 * @param {string} filePath - Đường dẫn tệp video
 * @param {Object} [options={}] - Tùy chọn thực thi (signal, bypassCache,...)
 * @returns {Promise<Object>}
 */
export const probeVideo = async (filePath, options = {}) => {
  const cacheKey = `video-server:probe-cache:${crypto.createHash("md5").update(filePath).digest("hex")}`;

  if (!options.bypassCache) {
    try {
      const redis = getRedisClient();
      const cached = await redis.get(cacheKey);
      if (cached) {
        logger.info(`[ProbeService] Sử dụng kết quả metadata từ Redis cache cho: ${filePath}`);
        return JSON.parse(cached);
      }
    } catch (cacheErr) {
      logger.warn(`[ProbeService] Không thể đọc cache Redis: ${cacheErr.message}`);
    }
  }

  logger.info(`[ProbeService] Bắt đầu phân tích metadata video qua FFprobe: ${filePath}`);
  const data = await spawnFFprobe(["-show_format", "-show_streams", filePath], { signal: options.signal });

  const streams = data.streams || [];
  const videoStream = streams.find((s) => s.codec_type === "video");
  const audioStream = streams.find((s) => s.codec_type === "audio");

  if (!videoStream) {
    throw new Error("Không tìm thấy luồng video (video stream) trong tệp tải lên");
  }

  const duration =
    parseFloat(data.format?.duration) ||
    parseFloat(videoStream.duration) ||
    0;

  const width = parseInt(videoStream.width, 10) || 1920;
  const height = parseInt(videoStream.height, 10) || 1080;
  const fps = parseFps(videoStream.r_frame_rate || videoStream.avg_frame_rate);
  const videoCodec = videoStream.codec_name || "unknown";
  const bitrate = parseInt(data.format?.bit_rate || videoStream.bit_rate, 10) || 0;

  const audioCodec = audioStream?.codec_name || null;
  const audioChannels = audioStream?.channels || 2;
  const audioSampleRate = audioStream?.sample_rate || 44100;

  const subtitleStreams = streams
    .filter((s) => s.codec_type === "subtitle")
    .map((s, idx) => ({
      index: s.index,
      streamIndex: idx,
      codec: s.codec_name || "unknown",
      language: (s.tags?.language || s.tags?.LANGUAGE || `sub_${idx + 1}`).toLowerCase(),
      title: s.tags?.title || s.tags?.TITLE || (s.tags?.language?.toLowerCase() === "vi" ? "Tiếng Việt" : s.tags?.language?.toLowerCase() === "en" ? "English" : `Phụ đề ${idx + 1}`),
    }));

  const metadata = {
    width,
    height,
    duration,
    fps,
    videoCodec,
    bitrate,
    audioCodec,
    audioChannels,
    audioSampleRate,
    subtitleStreams,
  };

  logger.info(`[ProbeService] Kết quả phân tích: ${width}x${height}, ${duration}s, ${fps}fps, codec=${videoCodec}, ${subtitleStreams.length} subtitle streams`);

  // Lưu cache Redis 1 giờ (3600 giây)
  try {
    const redis = getRedisClient();
    await redis.setex(cacheKey, 3600, JSON.stringify(metadata));
  } catch (saveCacheErr) {
    logger.warn(`[ProbeService] Không thể ghi cache Redis: ${saveCacheErr.message}`);
  }

  return metadata;
};

/**
 * Lựa chọn các profile chuyển mã phù hợp với độ phân giải nguồn (không upscale)
 * @param {number} sourceHeight - Chiều cao nguồn (ví dụ 1080)
 * @returns {Array<Object>} Danh sách profiles đã chọn
 */
export const selectProfiles = (sourceHeight) => {
  const selected = ABR_PROFILES.filter((p) => p.height <= sourceHeight);

  // Nếu video nguồn có độ phân giải thấp hơn 480p, vẫn giữ profile 480p tối thiểu
  if (selected.length === 0) {
    return [ABR_PROFILES[ABR_PROFILES.length - 1]];
  }

  return selected;
};

export default { probeVideo, selectProfiles, ABR_PROFILES };
