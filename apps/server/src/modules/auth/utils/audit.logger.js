/**
 * Nhật ký Audit (Audit Logger)
 * 
 * @description Hệ thống ghi nhật ký sự kiện bảo mật toàn diện cho Sạp Phim.
 * Lưu lại mọi sự kiện quan trọng liên quan đến xác thực, phân quyền và bảo mật để phục vụ giám sát, tuân thủ và điều tra sự cố.
 */
import winston from "winston";
import DailyRotateFile from "winston-daily-rotate-file";
import path from "path";
import fs from "fs";
import { AUDIT_EVENTS } from "../../../constants/auth.constant.js";
import { AuditLog } from "../../../models/index.js";

// ════════════════════════════════════════
// CẤU HÌNH LOGGER (LOGGER CONFIGURATION)
// ════════════════════════════════════════

const { combine, timestamp, json, printf, colorize } = winston.format;

/**
 * Định dạng log dành cho console (Development)
 */
const consoleFormat = printf(({ level, message, timestamp, ...metadata }) => {
  let msg = `${timestamp} [${level}]: ${message}`;

  if (Object.keys(metadata).length > 0) {
    msg += `\n${JSON.stringify(metadata, null, 2)}`;
  }

  return msg;
});

// Tạo thư mục logs nếu chưa tồn tại
const logsDir = path.join(process.cwd(), "logs");
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// ════════════════════════════════════════
// VẬN CHUYỂN LOG (WINSTON TRANSPORTS)
// ════════════════════════════════════════

const transports = [];

// 1. Console transport (Dùng trong môi trường development)
if (process.env.NODE_ENV !== "production") {
  transports.push(
    new winston.transports.Console({
      format: combine(
        colorize(),
        timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
        consoleFormat,
      ),
    }),
  );
}

// 2. File transport - Lưu toàn bộ lịch sử Audit
transports.push(
  new DailyRotateFile({
    filename: "logs/audit-%DATE%.log",
    datePattern: "YYYY-MM-DD",
    maxSize: "20m",
    maxFiles: "30d", // Giữ lại trong 30 ngày
    format: combine(timestamp(), json()),
    level: "info",
  }),
);

// 3. File transport - Chỉ lưu các sự kiện bảo mật quan trọng (Cảnh báo/Lỗi)
transports.push(
  new DailyRotateFile({
    filename: "logs/security-%DATE%.log",
    datePattern: "YYYY-MM-DD",
    maxSize: "20m",
    maxFiles: "90d", // Giữ lại trong 90 ngày cho các sự kiện bảo mật
    format: combine(timestamp(), json()),
    level: "warn",
  }),
);

// ════════════════════════════════════════
// KHỞI TẠO LOGGER (INITIALIZATION)
// ════════════════════════════════════════

const logger = winston.createLogger({
  level: "info",
  transports,
  exceptionHandlers: [
    new winston.transports.File({ filename: "logs/exceptions.log" }),
  ],
  rejectionHandlers: [
    new winston.transports.File({ filename: "logs/rejections.log" }),
  ],
});

// ════════════════════════════════════════
// TIỆN ÍCH NỘI BỘ (INTERNAL UTILS)
// ════════════════════════════════════════

/**
 * Phân loại sự kiện dựa trên mã sự kiện.
 *
 * @param {string} eventType - Loại sự kiện (ví dụ: auth.login.success)
 * @returns {string} Danh mục sự kiện
 */
const getEventCategory = (eventType) => {
  if (!eventType) return "system";

  if (
    eventType.startsWith("auth.login") ||
    eventType.startsWith("auth.logout")
  ) {
    return "authentication";
  }
  if (eventType.startsWith("auth.token")) {
    return "session";
  }
  if (eventType.startsWith("auth.password")) {
    return "password";
  }
  if (
    eventType.startsWith("auth.register") ||
    eventType.startsWith("auth.email")
  ) {
    return "user";
  }
  if (
    eventType.startsWith("auth.account") ||
    eventType.startsWith("security.")
  ) {
    return "security";
  }
  return "system";
};

/**
 * Chuẩn hóa dữ liệu log cho Winston.
 */
const createAuditEntry = ({
  event,
  userId = null,
  username = null,
  ip = null,
  userAgent = null,
  metadata = {},
  severity = "info",
}) => {
  return {
    timestamp: new Date().toISOString(),
    event,
    userId,
    username,
    ip,
    userAgent,
    metadata,
    severity,
    environment: process.env.NODE_ENV || "development",
  };
};

// ════════════════════════════════════════
// GIAO DIỆN AUDIT (AUDIT LOGGER API)
// ════════════════════════════════════════

export const auditLogger = {
  /**
   * Ghi log một sự kiện Audit tổng quát
   * @description Ghi đồng thời ra tệp tin (Winston) và lưu vào cơ sở dữ liệu (không đồng bộ).
   * @param {Object} params - Tham số sự kiện
   */
  log(params) {
    const entry = createAuditEntry(params);

    // Xác định mức độ log dựa trên loại sự kiện và mức độ nghiêm trọng
    const level = this.getLogLevel(params.event, params.severity);

    // 1. Ghi ra File (Winston)
    logger.log(level, `Audit: ${params.event}`, entry);

    // 2. Lưu vào Database (Xử lý ngầm, không chặn luồng chính)
    (async () => {
      try {
        const category = getEventCategory(params.event);

        await AuditLog.logEvent({
          eventType: params.event,
          eventCategory: category,
          severity: params.severity || "info",
          userId: params.userId,
          username: params.username,
          ipAddress: params.ip,
          userAgent: params.userAgent,
          metadata: params.metadata,
          description:
            params.metadata?.reason ||
            params.metadata?.description ||
            `Sự kiện: ${params.event}`,
          status: level === "warn" || level === "error" ? "failure" : "success",
          errorCode: params.metadata?.error?.code,
          errorMessage:
            params.metadata?.error?.message || params.metadata?.reason,
        });
      } catch (error) {
        // Fallback: Ghi lỗi DB vào Winston
        logger.error(`[Audit] Lưu log vào DB thất bại: ${error.message}`, {
          originalEvent: params.event,
          error: error.stack,
        });
      }
    })();
  },

  /**
   * Xác định mức độ log dựa trên loại sự kiện và mức độ nghiêm trọng
   * @param {string} event - Loại sự kiện
   * @param {string} [severity] - Mức độ nghiêm trọng (info, warn, error, critical)
   * @returns {string} Mức độ log cho Winston
   */
  getLogLevel(event, severity) {
    if (severity) return severity;

    // Các sự kiện bảo mật ưu tiên cao
    const securityEvents = [
      AUDIT_EVENTS.TOKEN_REUSE_DETECTED,
      AUDIT_EVENTS.ACCOUNT_LOCKED,
      AUDIT_EVENTS.ACCOUNT_BANNED,
      AUDIT_EVENTS.SUSPICIOUS_ACTIVITY,
      AUDIT_EVENTS.BRUTE_FORCE_ATTEMPT,
      AUDIT_EVENTS.IP_BLOCKED,
      AUDIT_EVENTS.DEVICE_LIMIT_EXCEEDED,
    ];

    if (securityEvents.includes(event)) {
      return "warn";
    }

    // Các sự kiện thất bại
    if (event.includes("failed")) {
      return "warn";
    }

    return "info";
  },

  /**
   * Ghi log đăng nhập thành công
   */
  loginSuccess(userId, username, ip, userAgent, metadata = {}) {
    this.log({
      event: AUDIT_EVENTS.LOGIN_SUCCESS,
      userId,
      username,
      ip,
      userAgent,
      metadata,
      severity: "info",
    });
  },

  /**
   * Ghi log đăng nhập thất bại
   */
  loginFailed(email, reason, ip, userAgent, metadata = {}) {
    this.log({
      event: AUDIT_EVENTS.LOGIN_FAILED,
      metadata: { email, reason, ...metadata },
      ip,
      userAgent,
      severity: "warn",
    });
  },

  /**
   * Ghi log đăng xuất
   */
  logout(userId, username, ip, metadata = {}) {
    this.log({
      event: AUDIT_EVENTS.LOGOUT,
      userId,
      username,
      ip,
      metadata,
      severity: "info",
    });
  },

  /**
   * Ghi log làm mới token (Refresh Token)
   */
  tokenRefresh(userId, ip, metadata = {}) {
    this.log({
      event: AUDIT_EVENTS.TOKEN_REFRESH,
      userId,
      ip,
      metadata,
      severity: "info",
    });
  },

  /**
   * Ghi log phát hiện tái sử dụng token (Cảnh báo bảo mật quan trọng)
   */
  tokenReuseDetected(userId, ip, userAgent, metadata = {}) {
    this.log({
      event: AUDIT_EVENTS.TOKEN_REUSE_DETECTED,
      userId,
      ip,
      userAgent,
      metadata,
      severity: "error",
    });
  },

  /**
   * Ghi log khi người dùng thay đổi mật khẩu
   */
  passwordChange(userId, ip, metadata = {}) {
    this.log({
      event: AUDIT_EVENTS.PASSWORD_CHANGE,
      userId,
      ip,
      metadata,
      severity: "info",
    });
  },

  /**
   * Ghi log yêu cầu đặt lại mật khẩu (Forgot Password)
   */
  passwordResetRequest(email, ip, metadata = {}) {
    this.log({
      event: AUDIT_EVENTS.PASSWORD_RESET_REQUEST,
      metadata: { email, ...metadata },
      ip,
      severity: "info",
    });
  },

  /**
   * Ghi log khi tài khoản bị khóa (Do brute force hoặc lý do bảo mật)
   */
  accountLocked(userId, reason, ip, metadata = {}) {
    this.log({
      event: AUDIT_EVENTS.ACCOUNT_LOCKED,
      userId,
      ip,
      metadata: { reason, ...metadata },
      severity: "warn",
    });
  },

  /**
   * Ghi log các hoạt động khả nghi bị hệ thống phát hiện
   */
  suspiciousActivity(userId, activityType, ip, userAgent, metadata = {}) {
    this.log({
      event: AUDIT_EVENTS.SUSPICIOUS_ACTIVITY,
      userId,
      ip,
      userAgent,
      metadata: { activityType, ...metadata },
      severity: "error",
    });
  },

  /**
   * Ghi log khi một phiên đăng nhập mới được khởi tạo
   */
  sessionCreated(userId, sessionId, ip, userAgent, metadata = {}) {
    this.log({
      event: AUDIT_EVENTS.SESSION_CREATED,
      userId,
      ip,
      userAgent,
      metadata: { sessionId, ...metadata },
      severity: "info",
    });
  },

  /**
   * Ghi log khi một phiên đăng nhập bị thu hồi (Logout hoặc bị ép buộc)
   */
  sessionRevoked(userId, sessionId, reason, metadata = {}) {
    this.log({
      event: AUDIT_EVENTS.SESSION_REVOKED,
      userId,
      metadata: { sessionId, reason, ...metadata },
      severity: "info",
    });
  },
};

export default auditLogger;
