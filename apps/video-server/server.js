/**
 * @file server.js
 * @module VideoServer_Core
 * @description Điểm khởi chạy chính của Video Processing Server (TUS Upload, FFmpeg Pipeline Worker, Internal API).
 */

import express from "express";
import cors from "cors";
import helmet from "helmet";

import { env } from "./src/config/env.config.js";
import { initVideoWorker, closeVideoQueue } from "./src/config/queue.config.js";
import { closeRedisClients } from "./src/config/redis.config.js";
import { processVideoTranscodeJob, abortAllPipelines } from "./src/pipeline/pipeline.worker.js";
import uploadRoutes from "./src/upload/upload.routes.js";
import internalRoutes from "./src/routes/internal.routes.js";
import { logger } from "./src/utils/logger.js";

const app = express();

// ════════════════════════════════════════
// 1. MIDDLEWARES BẢO MẬT & CORS
// ════════════════════════════════════════

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);

// Xây dựng hàm kiểm tra CORS động dựa trên cấu hình môi trường
const resolveCorsOrigin = () => {
  if (env.corsOrigins && env.corsOrigins.length > 0) {
    return (origin, callback) => {
      // Cho phép các yêu cầu không có origin (server-to-server, mobile app, curl, healthcheck)
      if (!origin) return callback(null, true);
      if (env.corsOrigins.includes(origin) || env.corsOrigins.includes("*")) {
        return callback(null, true);
      }
      return callback(new Error(`CORS: Origin ${origin} không được cấp phép truy cập`));
    };
  }
  // Môi trường development mặc định mở rộng, production chỉ cho phép nếu cấu hình cụ thể
  return env.isDevelopment ? "*" : false;
};

app.use(
  cors({
    origin: resolveCorsOrigin(),
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"],
    allowedHeaders: [
      "Origin",
      "X-Requested-With",
      "Content-Type",
      "Accept",
      "Authorization",
      "X-Upload-Token",
      "x-upload-token",
      "X-Internal-Key",
      "x-internal-key",
      "Upload-Length",
      "upload-length",
      "Upload-Offset",
      "upload-offset",
      "Upload-Metadata",
      "upload-metadata",
      "Tus-Resumable",
      "tus-resumable",
      "Upload-Defer-Length",
      "upload-defer-length",
      "Upload-Concat",
      "upload-concat",
    ],
    exposedHeaders: [
      "Upload-Offset",
      "Location",
      "Upload-Length",
      "Tus-Version",
      "Tus-Resumable",
      "Tus-Max-Size",
      "Tus-Extension",
      "Upload-Metadata",
      "Upload-Defer-Length",
      "Upload-Concat",
    ],
  }),
);

// Phục vụ tĩnh thư mục media đầu ra cho môi trường local development (khi chưa có Nginx)
app.use("/media", express.static(env.paths.outputDir, {
  setHeaders: (res, filePath) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    if (filePath.endsWith(".m3u8")) {
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    } else if (filePath.endsWith(".m4s") || filePath.endsWith(".mp4")) {
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    }
  },
}));

// TUS Upload Router (phải đặt TRƯỚC express.json() để không làm hỏng multipart/binary stream của TUS)
app.use(uploadRoutes);

// Body parsers cho các route nội bộ (JSON & URL-Encoded)
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Mount các Internal Routes
app.use(internalRoutes);

// ════════════════════════════════════════
// 2. XỬ LÝ LỖI TẬP TRUNG (ERROR HANDLER)
// ════════════════════════════════════════

app.use((err, req, res, next) => {
  logger.error(`[Server] Lỗi ngoại lệ: ${err.message}`, { stack: err.stack });
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Lỗi máy chủ nội bộ",
  });
});

// ════════════════════════════════════════
// 3. KHỞI ĐỘNG SERVER & BULLMQ WORKER
// ════════════════════════════════════════

const worker = initVideoWorker(processVideoTranscodeJob);
logger.info("[Server] Đã khởi tạo BullMQ Worker xử lý video");

const server = app.listen(env.port, () => {
  logger.info(`[Server] Video Processing Server đang chạy tại http://localhost:${env.port}`);
  logger.info(`[Server] TUS Upload Endpoint: http://localhost:${env.port}/upload/tus`);
  logger.info(`[Server] Storage Media: ${env.paths.outputDir}`);
});

// Xử lý dừng server an toàn (Graceful Shutdown với Hard Timeout 15s)
let isShuttingDown = false;
const gracefulShutdown = async (signal) => {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.info(`[Server] Nhận tín hiệu ${signal}. Bắt đầu quy trình Graceful Shutdown...`);

  // 1. Cài đặt hard timeout 15 giây cưỡng bức thoát nếu có kết nối hoặc tiến trình bị kẹt
  const forceExitTimer = setTimeout(() => {
    logger.error("[Server] Graceful Shutdown quá thời hạn 15 giây! Cưỡng chế dừng server.");
    process.exit(1);
  }, 15000);
  forceExitTimer.unref();

  try {
    // 2. Dừng ngay lập tức các tiến trình FFmpeg đang chạy để tránh zombie processes
    abortAllPipelines();

    // 3. Đóng HTTP server để ngừng nhận request mới
    await new Promise((resolve) => {
      server.close((err) => {
        if (err) {
          logger.warn(`[Server] Lỗi khi đóng HTTP server: ${err.message}`);
        } else {
          logger.info("[Server] HTTP server đã đóng thành công");
        }
        resolve();
      });
    });

    // 4. Đóng BullMQ Worker
    try {
      await worker.close();
      logger.info("[Server] BullMQ Worker đã đóng");
    } catch (workerErr) {
      logger.warn(`[Server] Lỗi khi đóng BullMQ Worker: ${workerErr.message}`);
    }

    // 5. Đóng BullMQ Queue
    try {
      await closeVideoQueue();
    } catch (queueErr) {
      logger.warn(`[Server] Lỗi khi đóng BullMQ Queue: ${queueErr.message}`);
    }

    // 6. Đóng các kết nối Redis
    await closeRedisClients();

    logger.info("[Server] Quy trình Graceful Shutdown hoàn tất thành công. Thoát.");
    clearTimeout(forceExitTimer);
    process.exit(0);
  } catch (err) {
    logger.error(`[Server] Lỗi bất thường trong quá trình Graceful Shutdown: ${err.message}`);
    clearTimeout(forceExitTimer);
    process.exit(1);
  }
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

export default app;
