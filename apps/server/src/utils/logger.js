/**
 * @file logger.js
 * @module Utils
 * @description Trung tâm quản lý nhật ký hệ thống sử dụng Winston với rotation file và log levels.
 */

import winston from "winston";
import DailyRotateFile from "winston-daily-rotate-file";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Thư mục lưu trữ nhật ký tại gốc ứng dụng
const LOG_DIR = path.resolve(__dirname, "../../logs");

const { combine, timestamp, printf, colorize, errors } = winston.format;
const enableFileLogging = process.env.LOG_FILE !== "false";

// ════════════════════════════════════════
// ĐỊNH DẠNG NHẬT KÝ (FORMATTING)
// ════════════════════════════════════════

/**
 * Định dạng cấu trúc dòng nhật ký hiển thị.
 * @private
 */
const logFormat = printf(({ level, message, timestamp, stack, ...meta }) => {
  let log = `${timestamp} [${level}]: ${message}`;
  if (stack) log += `\n${stack}`;
  if (Object.keys(meta).length > 0) {
    try {
      log += ` | ${JSON.stringify(meta)}`;
    } catch (e) {
      // Xử lý an toàn cho các đối tượng có tham chiếu vòng hoặc quá lớn
      log += ` | [Dữ liệu JSON không thể định dạng]`;
    }
  }
  return log;
});

// Filter dành riêng để lọc các nhật ký thuộc phân hệ AI
const aiFilter = winston.format((info) => {
  const msg = typeof info.message === "string" ? info.message : "";
  if (
    msg.includes("[AI ") ||
    msg.includes("[Ctrl][AI]") ||
    msg.includes("[AI Pipeline]") ||
    msg.includes("[AI Evidence]") ||
    msg.includes("[AI Matcher]") ||
    msg.includes("[AI Orchestrator]") ||
    msg.includes("[AI Gemini]") ||
    msg.includes("[AI OpenRouter]") ||
    msg.includes("[AI Audit]") ||
    msg.includes("[AI Worker]")
  ) {
    return info;
  }
  return false;
});

// ════════════════════════════════════════
// KHỞI TẠO LOGGER (INITIALIZATION)
// ════════════════════════════════════════

const transports = [
  // Ghi nhật ký ra Bảng điều khiển (Console) với màu sắc phân biệt
  new winston.transports.Console({
    format: combine(colorize(), logFormat),
    silent: process.env.NODE_ENV === "test",
  }),
];

if (enableFileLogging) {
  transports.push(
    // Lưu nhật ký tổng hợp vào tệp, tự động xoay vòng mỗi ngày
    new DailyRotateFile({
      filename: path.join(LOG_DIR, "combined-%DATE%.log"),
      datePattern: "YYYY-MM-DD",
      maxSize: "20m", // Giới hạn 20MB mỗi tệp
      maxFiles: "14d", // Lưu trữ trong vòng 14 ngày
    }),

    // Lưu riêng biệt nhật ký lỗi (Error) để thuận tiện cho việc truy vết
    new DailyRotateFile({
      filename: path.join(LOG_DIR, "error-%DATE%.log"),
      datePattern: "YYYY-MM-DD",
      level: "error",
      maxSize: "20m",
      maxFiles: "30d", // Lưu trữ lỗi lâu hơn (30 ngày)
    }),

    // Lưu riêng biệt nhật ký chuyên sâu cho toàn bộ quy trình AI Pipeline
    new DailyRotateFile({
      filename: path.join(LOG_DIR, "ai-pipeline-%DATE%.log"),
      datePattern: "YYYY-MM-DD",
      format: combine(aiFilter(), logFormat),
      maxSize: "20m",
      maxFiles: "14d",
    }),
  );
}

/**
 * Đối tượng Logger chính được sử dụng xuyên suốt ứng dụng.
 */
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: combine(
    timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    errors({ stack: true }),
    process.env.NODE_ENV === "production" ? winston.format.json() : logFormat,
  ),
  defaultMeta: { service: "sap-phim-api" },
  transports,
});

export { logger };
export default logger;
