/**
 * @file ffmpeg.util.js
 * @module VideoServer_Utils
 * @description Wrapper thực thi FFmpeg và FFprobe qua child_process.spawn kèm bộ phân tích tiến trình stderr.
 */

import { spawn } from "child_process";

import { env } from "../config/env.config.js";
import { logger } from "./logger.js";

/**
 * Chuyển đổi chuỗi thời gian HH:MM:SS.ms từ FFmpeg sang số giây
 * @param {string} timeString - Ví dụ "00:01:23.45"
 * @returns {number} Số giây
 */
export const parseTimeToSeconds = (timeString) => {
  if (!timeString) return 0;
  const parts = timeString.trim().split(":");
  if (parts.length === 3) {
    const hours = parseFloat(parts[0]) || 0;
    const minutes = parseFloat(parts[1]) || 0;
    const seconds = parseFloat(parts[2]) || 0;
    return hours * 3600 + minutes * 60 + seconds;
  }
  return 0;
};

/**
 * Thực thi lệnh FFmpeg với child_process.spawn và phân tích tiến trình theo thời lượng
 * @param {Array<string>} args - Danh sách tham số FFmpeg
 * @param {Object} options - Tùy chọn thực thi
 * @param {number} [options.totalDuration] - Tổng thời lượng video (giây) để tính phần trăm
 * @param {Function} [options.onProgress] - Callback nhận { currentTime, percent, fps, speed }
 * @param {AbortSignal} [options.signal] - Signal để hủy tiến trình
 * @returns {Promise<{ stdout: string, stderr: string }>}
 */
const MAX_STDERR_BUFFER = 20 * 1024; // 20KB giới hạn tối đa cho buffer stderr để chống phình to RAM

/**
 * Thực thi lệnh FFmpeg với child_process.spawn và phân tích tiến trình theo thời lượng
 * @param {Array<string>} args - Danh sách tham số FFmpeg
 * @param {Object} options - Tùy chọn thực thi
 * @param {number} [options.totalDuration] - Tổng thời lượng video (giây) để tính phần trăm
 * @param {Function} [options.onProgress] - Callback nhận { currentTime, percent, fps, speed }
 * @param {AbortSignal} [options.signal] - Signal để hủy tiến trình
 * @returns {Promise<{ stdout: string, stderr: string }>}
 */
export const spawnFFmpeg = (args, options = {}) => {
  return new Promise((resolve, reject) => {
    const ffmpegBin = env.ffmpeg.ffmpegPath;
    const { totalDuration = 0, onProgress, signal, cwd } = options;

    if (signal?.aborted) {
      return reject(new Error("Tiến trình FFmpeg đã bị hủy trước khi khởi chạy"));
    }

    logger.debug(`[FFmpeg] Bắt đầu lệnh: ${ffmpegBin} ${args.join(" ")}`);

    const child = spawn(ffmpegBin, args, { signal, ...(cwd && { cwd }) });

    let stdoutData = "";
    let stderrTail = "";
    let lastReportedPercent = -1;

    if (child.stdout) {
      child.stdout.on("data", (chunk) => {
        stdoutData += chunk.toString();
      });
    }

    if (child.stderr) {
      child.stderr.on("data", (chunk) => {
        const text = chunk.toString();
        
        // Tích lũy tail buffer có giới hạn dung lượng (tránh memory leak trên video dài)
        stderrTail += text;
        if (stderrTail.length > MAX_STDERR_BUFFER * 2) {
          stderrTail = stderrTail.slice(-MAX_STDERR_BUFFER);
        }

        if (onProgress && totalDuration > 0) {
          // Tìm mẫu time=00:01:23.45 hoặc out_time=...
          const timeMatch = text.match(/time=(\d{2}:\d{2}:\d{2}\.\d+)/);
          if (timeMatch && timeMatch[1]) {
            const currentSeconds = parseTimeToSeconds(timeMatch[1]);
            const percent = Math.min(100, Math.max(0, Math.round((currentSeconds / totalDuration) * 100)));

            const fpsMatch = text.match(/fps=\s*([\d.]+)/);
            const speedMatch = text.match(/speed=\s*([\d.]+)x/);

            if (percent !== lastReportedPercent) {
              lastReportedPercent = percent;
              onProgress({
                currentTime: currentSeconds,
                percent,
                fps: fpsMatch ? parseFloat(fpsMatch[1]) : null,
                speed: speedMatch ? speedMatch[1] : null,
              });
            }
          }
        }
      });
    }

    child.on("error", (err) => {
      if (err.name === "AbortError" || signal?.aborted) {
        logger.warn(`[FFmpeg] Tiến trình đã bị hủy theo AbortSignal`);
        return reject(new Error("Tiến trình FFmpeg đã bị hủy"));
      }
      logger.error(`[FFmpeg] Lỗi spawn: ${err.message}`);
      reject(err);
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout: stdoutData, stderr: stderrTail });
      } else {
        const tailStderr = stderrTail.slice(-2000);
        logger.error(`[FFmpeg] Tiến trình kết thúc với mã lỗi ${code}. Chi tiết: ${tailStderr}`);
        reject(new Error(`FFmpeg thất bại với mã thoát ${code}: ${tailStderr}`));
      }
    });
  });
};

/**
 * Thực thi lệnh FFprobe để đọc thông tin metadata dạng JSON
 * @param {Array<string>} args - Danh sách tham số FFprobe
 * @param {Object} [options={}] - Tùy chọn (signal,...)
 * @returns {Promise<Object>}
 */
export const spawnFFprobe = (args, options = {}) => {
  return new Promise((resolve, reject) => {
    const { signal } = options;
    if (signal?.aborted) {
      return reject(new Error("Tiến trình FFprobe đã bị hủy trước khi chạy"));
    }

    const ffprobeBin = env.ffmpeg.ffprobePath;
    const fullArgs = ["-v", "quiet", "-print_format", "json", ...args];

    const child = spawn(ffprobeBin, fullArgs, { signal });

    let stdoutData = "";
    let stderrData = "";

    child.stdout.on("data", (chunk) => {
      stdoutData += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderrData += chunk.toString();
      if (stderrData.length > MAX_STDERR_BUFFER * 2) {
        stderrData = stderrData.slice(-MAX_STDERR_BUFFER);
      }
    });

    child.on("error", (err) => {
      if (err.name === "AbortError" || signal?.aborted) {
        return reject(new Error("Tiến trình FFprobe đã bị hủy"));
      }
      logger.error(`[FFprobe] Lỗi spawn: ${err.message}`);
      reject(err);
    });

    child.on("close", (code) => {
      if (code === 0) {
        try {
          const parsed = JSON.parse(stdoutData);
          resolve(parsed);
        } catch (e) {
          reject(new Error(`[FFprobe] Lỗi parse JSON output: ${e.message}`));
        }
      } else {
        reject(new Error(`FFprobe thất bại với mã thoát ${code}: ${stderrData.slice(-2000)}`));
      }
    });
  });
};

export default { spawnFFmpeg, spawnFFprobe, parseTimeToSeconds };
