/**
 * @file app.js
 * @module Core
 * @description Điểm cấu hình chính cho ứng dụng Express, bao gồm các middleware bảo mật, logging, và định tuyến.
 */

import express from "express";
import cors from "cors";
import helmet from "helmet";
import path from "path";
import { fileURLToPath } from "url";
import morgan from "morgan";
import compression from "compression";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import RedisStore from "rate-limit-redis";

import { logger } from "./utils/logger.js";
import { responseUtil } from "./utils/response.util.js";
import { monitoringMiddleware, register } from "./middlewares/monitoring.middleware.js";
import { responseTimeLogger } from "./middlewares/response-time.middleware.js";
import { getRedisClient } from "./config/redis.config.js";
import { env } from "./config/env.config.js";
import v1Routes from "./routes/index.js";


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// ════════════════════════════════════════
// 1. GIÁM SÁT HIỆU NĂNG (PROMETHEUS)
// ════════════════════════════════════════

app.use(monitoringMiddleware);

/**
 * [GET] /metrics
 *
 * @description Endpoint xuất dữ liệu metrics cho hệ thống giám sát (Prometheus).
 * @access Private/Internal — Yêu cầu token xác thực qua query param hoặc chỉ cho phép từ mạng nội bộ.
 */
app.get("/metrics", (req, res, next) => {
  const metricsToken = process.env.METRICS_TOKEN;
  if (metricsToken && req.query.token !== metricsToken) {
    return res.status(403).end("Forbidden");
  }
  next();
}, async (req, res) => {
  try {
    res.set("Content-Type", register.contentType);
    res.end(await register.metrics());
  } catch (ex) {
    logger.error("[App] Lỗi khi xuất metrics giám sát:", ex);
    res.status(500).end();
  }
});

// ════════════════════════════════════════
// 2. BẢO MẬT & CHÍNH SÁCH TRUY CẬP (CORS/HELMET)
// ════════════════════════════════════════

/**
 * Kiểm tra một origin có nằm trong whitelist hay không.
 */
const isOriginAllowed = (origin) => {
  if (!origin) return true; // requests không có Origin header (app native, curl,...)

  if (env.allowedOrigins.includes(origin) || origin === env.clientUrl) {
    return true;
  }

  if (env.nodeEnv === "development") {
    const isLocalIp = /^(https?:\/\/)(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|10\.\d+\.\d+\.\d+)(:\d+)?$/.test(origin);
    if (isLocalIp) return true;
  }

  return false;
};

app.use(helmet());
app.use(
  cors({
    origin: (origin, callback) => {
      if (isOriginAllowed(origin)) {
        return callback(null, true);
      }
      callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "content-type",
      "Authorization",
      "authorization",
      "X-CSRF-Token",
      "x-csrf-token",
      "X-Job-Id",
      "x-job-id",
      "X-Upload-Token",
      "x-upload-token",
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
      "upload-concat"
    ],
    exposedHeaders: [
      "Location",
      "Upload-Offset",
      "Upload-Length",
      "Tus-Version",
      "Tus-Resumable",
      "Tus-Max-Size",
      "Tus-Extension",
      "Upload-Metadata",
      "Upload-Defer-Length",
      "Upload-Concat"
    ],
  }),
);

/**
 * Giới hạn tần suất yêu cầu toàn cục (Global Rate Limiting).
 * Sử dụng RedisStore để đồng bộ giữa các instances khi horizontal scaling.
 * Ngăn chặn brute-force và các cuộc tấn công spam API.
 */
const globalStore = new RedisStore({
  sendCommand: (...args) => {
    const redis = getRedisClient();
    if (!redis) {
      throw new Error("Redis client chưa sẵn sàng cho global rate limiter");
    }
    return redis.call(...args);
  },
  prefix: "rl:global:",
});

const limiter = rateLimit({
  store: globalStore,
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 5 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Hệ thống nhận thấy quá nhiều yêu cầu từ bạn. Vui lòng thử lại sau.",
  },
});
app.use("/api", limiter);

// ════════════════════════════════════════
// 3. XỬ LÝ DỮ LIỆU ĐẦU VÀO & TỐI ƯU HÓA
// ════════════════════════════════════════

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());
app.use(compression());

// ════════════════════════════════════════
// 4. LOGGING & HIỆU NĂNG PHẢN HỒI
// ════════════════════════════════════════

app.use(responseTimeLogger);

if (process.env.NODE_ENV !== "test") {
  app.use(
    morgan("combined", {
      stream: {
        write: (message) => logger.info(`[App] ${message.trim()}`),
      },
    }),
  );
}

// ════════════════════════════════════════
// 5. KIỂM TRA TRẠNG THÁI (HEALTH CHECK)
// ════════════════════════════════════════

/**
 * [GET] /health
 *
 * @description Kiểm tra trạng thái hoạt động cơ bản của API.
 * @access Public
 */
app.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Hệ thống API Sạp Phim đang hoạt động bình thường",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
  });
});

// ════════════════════════════════════════
// 6. ĐIỀU PHỐI ĐƯỜNG DẪN API (ROUTING)
// ════════════════════════════════════════

/**
 * API V1 Entry Point.
 * Anti-cache headers chỉ áp dụng cho các mutation/authenticated routes.
 * Các public read-only endpoints (genres, countries, etc.) được phép cache phía client.
 */
app.use(
  "/api/v1",
  (req, res, next) => {
    if (req.method !== "GET" || req.headers.authorization) {
      res.setHeader(
        "Cache-Control",
        "no-store, no-cache, must-revalidate, proxy-revalidate",
      );
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
    }
    next();
  },
  v1Routes,
);

// ════════════════════════════════════════
// 7. QUẢN LÝ TỆP TIN TĨNH (STATIC FILES)
// ════════════════════════════════════════

/**
 * Cấu hình truy cập tài nguyên tĩnh (Uploads).
 * Cho phép hiển thị ảnh trực tiếp và áp dụng chính sách Cross-Origin linh hoạt.
 */
app.use(
  "/uploads",
  (req, res, next) => {
    const origin = req.headers.origin;
    if (isOriginAllowed(origin)) {
      res.header("Access-Control-Allow-Origin", origin || env.clientUrl || "http://localhost:3000");
    }
    res.header("Vary", "Origin");
    res.header("Access-Control-Allow-Methods", "GET");
    res.header("Access-Control-Allow-Headers", "Content-Type");
    res.header("Cross-Origin-Resource-Policy", "cross-origin");
    res.header("Content-Disposition", "inline");
    next();
  },
  express.static(path.join(__dirname, "../uploads"), {
    maxAge: "1d",
    etag: true,
  }),
);

// ════════════════════════════════════════
// 8. XỬ LÝ LỖI KHÔNG TÌM THẤY (404)
// ════════════════════════════════════════

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Đường dẫn ${req.method} ${req.originalUrl} không tồn tại trên hệ thống`,
  });
});

// ════════════════════════════════════════
// 9. XỬ LÝ LỖI TOÀN CỤC (GLOBAL ERROR HANDLER)
// ════════════════════════════════════════

/**
 * Middleware xử lý lỗi tập trung.
 *
 * @description Tự động bắt toàn bộ lỗi phát sinh trong hệ thống.
 * Phân loại lỗi nghiêm trọng (>= 500) để ghi log stack trace và ẩn thông tin kỹ thuật nhạy cảm ở môi trường Production.
 */
app.use((err, req, res, _next) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || "Đã xảy ra lỗi hệ thống. Vui lòng liên hệ quản trị viên.";

  if (!err.isOperational || statusCode >= 500) {
    logger.error("[App] Lỗi nghiêm trọng không thể kiểm soát:", {
      message: err.message,
      stack: err.stack,
      url: req.originalUrl,
      method: req.method,
    });
  }

  return responseUtil.error(res, message, statusCode, err);
});

export default app;