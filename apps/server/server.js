/**
 * @file server.js
 * @module Core
 * @description Tệp tin khởi động chính của máy chủ Backend Sạp Phim.
 * Chịu trách nhiệm thiết lập môi trường, kết nối cơ sở dữ liệu, khởi tạo Workers,
 * lắng nghe cổng HTTP và tích hợp hệ thống Socket.IO.
 *
 * @note Đây là tệp thực thi chính, mọi quy trình khởi động và tắt máy (Shutdown) đều được quản lý tại đây.
 */

import dns from "node:dns";
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder("ipv4first");
}

import dotenv from "dotenv";
dotenv.config();

import app from "./src/app.js";
import { sequelize } from "./src/models/index.js";
import { logger } from "./src/utils/logger.js";
import { initializeSocket, closeSocket } from "./src/sockets/index.js";
import { initImageQueueWorker } from "./src/modules/jobs/workers/media.worker.js";
import {
  initNotificationWorker,
  closeNotificationWorker,
} from "./src/modules/notification/workers/notification.worker.js";
import {
  initBroadcastWorker,
  closeBroadcastWorker,
} from "./src/modules/broadcast/workers/broadcast-publisher.worker.js";
import { getRedisClient } from "./src/config/redis.config.js";
import {
  initEpisodeSubscriber,
  closeEpisodeSubscriber,
} from "./src/modules/episode/workers/episode.subscriber.js";
import {
  initSubscriptionSchedulerWorker,
  closeSubscriptionSchedulerWorker,
} from "./src/modules/subscription/workers/subscription-scheduler.worker.js";
import {
  initAiWorker,
  closeAiWorker,
} from "./src/modules/ai/workers/ai.worker.js";
const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || "development";

/** HTTP Server instance — cần giữ reference để graceful shutdown */
let httpServer = null;

// ════════════════════════════════════════
// KHỞI CHẠY HỆ THỐNG (STARTUP SEQUENCE)
// ════════════════════════════════════════

/**
 * Khởi tạo và bắt đầu toàn bộ dịch vụ của hệ thống.
 *
 * @description Thực hiện chuỗi khởi động tuần tự:
 * 1. Xác thực kết nối PostgreSQL.
 * 2. Đồng bộ hóa Schema (nếu ở môi trường phát triển).
 * 3. Lắng nghe yêu cầu HTTP và khởi tạo Socket Server.
 *
 * @throws {Error} Thoát tiến trình nếu gặp lỗi khởi động nghiêm trọng.
 */
const startServer = async () => {
  try {
    // 1. Kiểm tra kết nối Database
    await sequelize.authenticate();
    logger.info("[Server] ✓ Kết nối cơ sở dữ liệu thành công");

    // 2. Đồng bộ Schema (Chỉ thực hiện ở môi trường Development)
    if (NODE_ENV === "development") {
      await sequelize.sync({ alter: false });
      logger.info("[Server] ✓ Đồng bộ hóa các Model thành công");
    }

    // 3. Khởi chạy các Background Workers
    try {
      initImageQueueWorker({ concurrency: 1 });
      logger.info("[Server] ✓ Worker xử lý ảnh đã khởi chạy (concurrency: 1)");
    } catch (workerError) {
      logger.warn(
        "[Server] ⚠ Không thể khởi tạo các Background Workers:",
        workerError.message,
      );
    }

    // 4. Khởi chạy kết nối Redis chủ động
    try {
      getRedisClient();
      logger.info("[Server] ✓ Đang khởi tạo kết nối tới Redis...");
    } catch (redisError) {
      logger.warn("[Server] ⚠ Lỗi khởi tạo Redis client:", redisError.message);
    }

    // 5. Bắt đầu lắng nghe yêu cầu HTTP
    httpServer = app.listen(PORT, () => {
      logger.info(
        `[Server] Hệ thống Sạp Phim đang chạy tại cổng ${PORT} [Chế độ: ${NODE_ENV}]`,
      );
      logger.info(`[Server] API v1: http://localhost:${PORT}/api/v1`);
    });

    // 6. Khởi tạo trung tâm kết nối thời gian thực qua Socket.IO
    initializeSocket(httpServer);

    try {
      initNotificationWorker();
      logger.info("[Server] Worker Notification started");
    } catch (notificationWorkerError) {
      logger.warn(
        "[Server] Unable to initialize Notification worker:",
        notificationWorkerError.message,
      );
    }

    try {
      initBroadcastWorker();
      logger.info("[Server] ✓ Worker Broadcast Publisher đã khởi chạy");
    } catch (broadcastWorkerError) {
      logger.warn(
        "[Server] ⚠ Không thể khởi tạo worker Broadcast:",
        broadcastWorkerError.message,
      );
    }

    try {
      initEpisodeSubscriber();
      logger.info("[Server] ✓ Episode Subscriber đã khởi chạy");
    } catch (episodeSubError) {
      logger.warn(
        "[Server] ⚠ Không thể khởi tạo Episode Subscriber:",
        episodeSubError.message,
      );
    }

    try {
      initSubscriptionSchedulerWorker();
      logger.info("[Server] ✓ Worker Subscription Scheduler đã khởi chạy");
    } catch (subWorkerError) {
      logger.warn(
        "[Server] ⚠ Không thể khởi tạo worker Subscription Scheduler:",
        subWorkerError.message,
      );
    }

    try {
      const aiWorker = await initAiWorker();
      if (aiWorker) logger.info("[Server] ✓ AI DataOps Worker đã khởi chạy");
      else logger.info("[Server] AI Worker đang tạm dừng theo cấu hình.");
    } catch (aiWorkerError) {
      logger.warn(
        "[Server] ⚠ Không thể khởi tạo AI Worker:",
        aiWorkerError.message,
      );
    }
  } catch (error) {
    logger.error(
      "[Server] Hệ thống không thể khởi động do lỗi nghiêm trọng:",
      error,
    );
    process.exit(1);
  }
};

// ════════════════════════════════════════
// QUẢN LÝ TẮT MÁY AN TOÀN (GRACEFUL SHUTDOWN)
// ════════════════════════════════════════

/**
 * Xử lý dọn dẹp và tắt hệ thống một cách an toàn.
 *
 * @description Đảm bảo các kết nối DB và các tác vụ đang thực thi được đóng sạch sẽ trước khi dừng tiến trình Node.js.
 * @param {string} signal - Tín hiệu hệ thống nhận được (SIGTERM, SIGINT).
 */
const handleShutdown = async (signal) => {
  logger.info(
    `[Server] Nhận tín hiệu ${signal}. Đang đóng các kết nối để tắt hệ thống an toàn...`,
  );

  // Thiết lập timer cưỡng bức tắt sau 10 giây nếu các tiến trình đóng kết nối bị treo
  const forcedExitTimeout = setTimeout(() => {
    logger.warn("[Server] ⚠ Shutdown quá lâu (hơn 10s), cưỡng bức tắt tiến trình.");
    process.exit(1);
  }, 10000);
  // Đảm bảo timer này không giữ cho event loop tiếp tục chạy nếu mọi thứ khác đã hoàn tất
  forcedExitTimeout.unref();

  try {
    // 1. Ngừng nhận request HTTP mới
    if (httpServer) {
      await new Promise((resolve) => {
        httpServer.close((err) => {
          if (err) {
            logger.warn("[Server] Lỗi khi đóng HTTP Server:", err.message);
          } else {
            logger.info("[Server] ✓ HTTP Server đã ngừng nhận kết nối mới");
          }
          resolve();
        });
      });
    }

    // 2. Đóng Socket.IO Server và các Redis Adapters
    await closeAiWorker();
    await closeNotificationWorker();
    closeBroadcastWorker();
    await closeEpisodeSubscriber();
    closeSubscriptionSchedulerWorker();
    await closeSocket();

    // 3. Đóng kết nối cơ sở dữ liệu
    await sequelize.close();
    logger.info("[Server] ✓ Đã đóng kết nối cơ sở dữ liệu");

    // 4. Đóng kết nối Redis
    try {
      const redis = getRedisClient();
      if (redis && redis.status === "ready") {
        await redis.quit();
        logger.info("[Server] ✓ Đã đóng kết nối Redis");
      }
    } catch (redisErr) {
      logger.warn("[Server] Lỗi khi đóng Redis:", redisErr.message);
    }

    clearTimeout(forcedExitTimeout);
    process.exit(0);
  } catch (err) {
    logger.error("[Server] Lỗi khi đóng kết nối trong quá trình shutdown:", err);
    clearTimeout(forcedExitTimeout);
    process.exit(1);
  }
};

// Đăng ký các trình xử lý tín hiệu từ hệ điều hành
process.on("SIGTERM", () => handleShutdown("SIGTERM"));
process.on("SIGINT", () => handleShutdown("SIGINT"));

/**
 * Quản lý các lỗi chưa được bắt (Uncaught Exception).
 */
process.on("uncaughtException", (error) => {
  logger.error(
    "[Server] 🔴 PHÁT HIỆN LỖI CHƯA ĐƯỢC BẮT (Uncaught Exception):",
    error,
  );

  // Kiểm tra nếu là các lỗi phổ biến từ nền hoặc mạng không làm hỏng state
  if (error && error.message && (
    error.message.includes("Redis") ||
    error.message.includes("socket") ||
    error.message.includes("stream") ||
    error.message.includes("network") ||
    error.message.includes("ECONNRESET")
  )) {
    logger.warn("[Server] Lỗi Uncaught Exception được xác định là non-critical, bỏ qua shutdown.");
    return;
  }

  // Với các lỗi chưa xác định hoặc nghiêm trọng, tắt máy an toàn
  handleShutdown("UNCAUGHT_EXCEPTION");
});

/**
 * Quản lý các lỗi bất đối xứng không được bắt (Unhandled Rejections).
 * Ngăn chặn việc ứng dụng bị crash đột ngột mà không để lại vết log.
 */
process.on("unhandledRejection", (reason, promise) => {
  logger.error(
    "[Server] Phát hiện Unhandled Rejection tại:",
    promise,
    "Lý do:",
    reason,
  );
});

// Kích hoạt chu trình khởi động
startServer();
