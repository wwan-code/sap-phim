/**
 * @file env.config.js
 * @module VideoServer_Config
 * @description Trung tâm quản lý biến môi trường cho Video Processing Server.
 */

import path from "path";
import dotenv from "dotenv";

dotenv.config();

const parseIntSafe = (value, defaultValue) => {
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
};

export const env = {
  port: parseIntSafe(process.env.PORT, 3002),
  nodeEnv: process.env.NODE_ENV || "development",
  isDevelopment: (process.env.NODE_ENV || "development") === "development",

  redis: {
    host: process.env.REDIS_HOST || "127.0.0.1",
    port: parseIntSafe(process.env.REDIS_PORT, 6379),
    password: process.env.REDIS_PASSWORD || undefined,
  },

  internalKey: process.env.INTERNAL_KEY || "",
  uploadTokenSecret: process.env.UPLOAD_TOKEN_SECRET || "default-upload-secret",

  paths: {
    uploadDir: path.resolve(process.env.UPLOAD_DIR || "./storage/uploads"),
    outputDir: path.resolve(process.env.OUTPUT_DIR || "./storage/media"),
  },

  ffmpeg: {
    ffmpegPath: process.env.FFMPEG_PATH || "ffmpeg",
    ffprobePath: process.env.FFPROBE_PATH || "ffprobe",
  },

  mainBackendUrl: process.env.MAIN_BACKEND_URL || "http://localhost:5000",
  corsOrigins: process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(",").map((origin) => origin.trim()).filter(Boolean)
    : null,
};

export default env;
