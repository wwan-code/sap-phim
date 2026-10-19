/**
 * @file env.config.js
 * @module Config
 * @description Trung tâm quản lý biến môi trường, thiết lập thông số kết nối Database, Redis, JWT và dịch vụ bên thứ ba.
 */

import dotenv from "dotenv";
import { logger } from "../utils/logger.js";

// Khởi tạo các biến môi trường từ file .env
dotenv.config();

/**
 * Chuyển đổi giá trị sang Số nguyên an toàn với giá trị mặc định
 *
 * @param {string} value - Giá trị cần ép kiểu
 * @param {number} defaultValue - Giá trị trả về nếu ép kiểu thất bại
 * @param {string} varName - Tên biến (để hiển thị log cảnh báo)
 * @returns {number}
 */
const parseIntSafe = (value, defaultValue, varName) => {
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    logger.warn(
      `[EnvConfig] Giá trị không hợp lệ cho ${varName}: "${value}", dùng mặc định: ${defaultValue}`,
    );
    return defaultValue;
  }
  return parsed;
};

/**
 * Chuyển đổi chuỗi danh sách sang Mảng (Array)
 *
 * @param {string} value - Chuỗi các phần tử cách nhau bởi dấu phẩy
 * @param {Array} defaultValue - Giá trị mặc định
 * @returns {Array<string>}
 */
const parseArraySafe = (value, defaultValue) => {
  if (!value) return defaultValue;
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
};

// Kiểm tra các biến môi trường bắt buộc
const requiredEnvVars = [
  "NODE_ENV",
  "PORT",
  "DB_HOST",
  "DB_NAME",
  "DB_USER",
  "JWT_ACCESS_SECRET",
  "JWT_REFRESH_SECRET",
];

const missingEnvVars = requiredEnvVars.filter((envVar) => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  logger.error(
    `[EnvConfig] Thiếu các biến môi trường bắt buộc: ${missingEnvVars.join(", ")}`,
  );
  process.exit(1); // Dừng hệ thống nếu thiếu cấu hình trọng yếu
}

const validNodeEnvs = ["development", "production", "test"];
if (!validNodeEnvs.includes(process.env.NODE_ENV)) {
  logger.error(
    `[EnvConfig] NODE_ENV không hợp lệ: ${process.env.NODE_ENV}. Phải là: ${validNodeEnvs.join(", ")}`,
  );
  process.exit(1);
}

/**
 * Đối tượng Cấu hình Môi trường Toàn cục (Global Environment Config)
 *
 * @description Mọi module nên truy xuất qua đối tượng này thay vì gọi trực tiếp process.env.
 */
export const env = {
  // Cấu hình Core Node.js
  nodeEnv: process.env.NODE_ENV,
  port: parseIntSafe(process.env.PORT, 4000, "PORT"),
  isDevelopment: process.env.NODE_ENV === "development",
  isProduction: process.env.NODE_ENV === "production",
  isTest: process.env.NODE_ENV === "test",
  logoUrl: process.env.LOGO_URL || "https://wwan.vn/logo.png",

  // Cấu hình Client & CORS
  clientUrl: process.env.CLIENT_URL || "http://localhost:5173",
  allowedOrigins: parseArraySafe(process.env.ALLOWED_ORIGINS, [
    "http://localhost:5173",
    "http://localhost:4173",
    "http://localhost:3000",
    "http://localhost:5000",
  ]),

  // Cơ sở dữ liệu PostgreSQL
  db: {
    host: process.env.DB_HOST || "localhost",
    port: parseIntSafe(process.env.DB_PORT, 5432, "DB_PORT"),
    name: process.env.DB_NAME,
    user: process.env.DB_USER,
    timezone: process.env.DB_TIMEZONE || "+07:00",
    password: process.env.DB_PASSWORD || "postgres",
    dialect: process.env.DB_DIALECT || "postgres",
    enableSSL: process.env.DB_SSL === "true",
  },

  // Redis (Caching & Realtime)
  redis: {
    host: process.env.REDIS_HOST || "localhost",
    port: parseIntSafe(process.env.REDIS_PORT, 6379, "REDIS_PORT"),
    password: process.env.REDIS_PASSWORD || null,
    db: parseIntSafe(process.env.REDIS_DB, 0, "REDIS_DB"),
    tls: process.env.REDIS_TLS === "true",
    retryStrategy: {
      maxRetries: process.env.REDIS_MAX_RETRIES
        ? parseIntSafe(process.env.REDIS_MAX_RETRIES, 10, "REDIS_MAX_RETRIES")
        : 10,
      backoffMultiplier: 1.5,
    },
  },

  // Xác thực (JWT)
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    refreshPreviousSecrets: parseArraySafe(
      process.env.JWT_REFRESH_SECRET_PREVIOUS,
      [],
    ),
    accessExpires: process.env.JWT_ACCESS_EXPIRES || "1h",
    refreshExpires: process.env.JWT_REFRESH_EXPIRES || "30d",
  },

  // Firebase
  firebase: {
    serviceAccountKey: process.env.FIREBASE_SERVICE_ACCOUNT_KEY,
    enabled: process.env.FIREBASE_ENABLED !== "false",
  },

  // Google Gemini AI
  gemini: {
    apiKeys: parseArraySafe(
      process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY,
      []
    ),
    model: process.env.GEMINI_MODEL || "gemini-3.5-flash",
    freeTierConfirmed: process.env.GEMINI_FREE_TIER_CONFIRMED === "true",
    freeModels: parseArraySafe(process.env.GEMINI_FREE_MODELS, [
      "gemini-2.5-flash",
      "gemini-2.5-flash-lite",
    ]),
  },

  ai: {
    enabled: process.env.AI_SUGGEST_ENABLED !== "false",
    acceptingJobs: process.env.AI_SUGGEST_ACCEPTING_JOBS !== "false",
    workerEnabled: process.env.AI_SUGGEST_WORKER_ENABLED !== "false",
  },

  // TMDB API
  tmdb: {
    apiKey: process.env.TMDB_API_KEY,
    baseUrl: process.env.TMDB_BASE_URL || "https://api.themoviedb.org/3",
    imageBaseUrl:
      process.env.TMDB_IMAGE_BASE_URL || "https://image.tmdb.org/t/p",
    enabled: Boolean(process.env.TMDB_API_KEY),
  },

  // OMDB API
  omdb: {
    apiKey: process.env.OMDB_API_KEY,
    baseUrl: process.env.OMDB_BASE_URL || "https://www.omdbapi.com",
    enabled: Boolean(process.env.OMDB_API_KEY),
  },

  // Jikan API (MyAnimeList)
  jikan: {
    baseUrl: process.env.JIKAN_BASE_URL || "https://api.jikan.moe/v4",
    enabled: process.env.JIKAN_ENABLED !== "false",
    rateLimit: parseIntSafe(
      process.env.JIKAN_RATE_LIMIT,
      3,
      "JIKAN_RATE_LIMIT",
    ),
  },

  // Supabase
  supabase: {
    url: process.env.SUPABASE_URL,
    anonKey: process.env.SUPABASE_ANON_KEY,
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    bucketName: process.env.SUPABASE_BUCKET_NAME || "sap-phim-storage",
    enabled: process.env.SUPABASE_ENABLED !== "false",
  },

  // Email (SMTP)
  email: {
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: parseIntSafe(process.env.SMTP_PORT, 587, "SMTP_PORT"),
    user: process.env.SMTP_USER,
    password: process.env.SMTP_PASS,
    from: process.env.EMAIL_FROM || "noreply@sap-phim.local",
    enabled: Boolean(process.env.SMTP_USER && process.env.SMTP_PASS),
  },

  // API Rate Limiting
  rateLimit: {
    windowMs: parseIntSafe(
      process.env.RATE_LIMIT_WINDOW_MS,
      15 * 60 * 1000,
      "RATE_LIMIT_WINDOW_MS",
    ),
    maxRequests: parseIntSafe(
      process.env.RATE_LIMIT_MAX_REQUESTS,
      100,
      "RATE_LIMIT_MAX_REQUESTS",
    ),
    skipSuccessfulRequests: process.env.RATE_LIMIT_SKIP_SUCCESS === "true",
  },

  // Upload tệp tin
  upload: {
    maxFileSize: parseIntSafe(
      process.env.MAX_FILE_SIZE,
      50 * 1024 * 1024,
      "MAX_FILE_SIZE",
    ),
    maxFileCount: parseIntSafe(process.env.MAX_FILE_COUNT, 5, "MAX_FILE_COUNT"),
    uploadDir: process.env.UPLOAD_DIR || "public/uploads",
    allowedMimeTypes: parseArraySafe(process.env.ALLOWED_MIME_TYPES, [
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
    ]),
  },

  // Xử lý hình ảnh (Sharp)
  imageProcessing: {
    webpQuality: parseIntSafe(process.env.WEBP_QUALITY, 90, "WEBP_QUALITY"),
    thumbnailSize: parseIntSafe(
      process.env.WEBP_THUMBNAIL_SIZE,
      300,
      "WEBP_THUMBNAIL_SIZE",
    ),
  },

  // Socket.IO
  socket: {
    corsOrigin: process.env.SOCKET_CORS_ORIGIN || "http://localhost:5173",
    reconnectionDelay: parseIntSafe(
      process.env.SOCKET_RECONNECTION_DELAY,
      1000,
      "SOCKET_RECONNECTION_DELAY",
    ),
  },

  // Streaming Video
  videoServer: {
    url: process.env.VIDEO_SERVER_URL || "http://localhost:3002",
    internalKey: process.env.VIDEO_SERVER_API_KEY || "",
    uploadTokenSecret: process.env.UPLOAD_TOKEN_SECRET || "",
    tusPublicUrl: process.env.TUS_PUBLIC_URL || "/upload/tus/",
  },

  // Hệ thống Ghi log
  logging: {
    level: process.env.LOG_LEVEL || "info",
    enableFileLogging: process.env.LOG_FILE === "true",
    logDir: process.env.LOG_DIR || "./logs",
  },

  // Tinh chỉnh hiệu năng
  performance: {
    cacheTTL: parseIntSafe(process.env.CACHE_TTL, 3600),
    cachePrefix: process.env.CACHE_PREFIX || "sap-phim:",
    queryTimeout: parseIntSafe(process.env.QUERY_TIMEOUT, 30000),
    maxQueryResults: parseIntSafe(process.env.MAX_QUERY_RESULTS, 10000),
    maxRequestSize: process.env.MAX_REQUEST_SIZE || "10mb",
    maxJsonSize: process.env.MAX_JSON_SIZE || "10mb",
  },

  // DB Connection Pooling
  dbPool: {
    max: parseIntSafe(process.env.DB_POOL_MAX, 20),
    min: parseIntSafe(process.env.DB_POOL_MIN, 5),
    acquire: parseIntSafe(process.env.DB_POOL_ACQUIRE, 30000),
    idle: parseIntSafe(process.env.DB_POOL_IDLE, 10000),
  },
};

// Log thông báo khởi tạo thành công (Chỉ ở chế độ development)
if (env.isDevelopment) {
  logger.info("[EnvConfig] Cấu hình môi trường đã tải hoàn tất", {
    nodeEnv: env.nodeEnv,
    port: env.port,
    dbName: env.db.name,
    dbPool: env.dbPool,
    redisHost: env.redis.host,
    allowedOrigins: env.allowedOrigins,
  });
}

export default env;
