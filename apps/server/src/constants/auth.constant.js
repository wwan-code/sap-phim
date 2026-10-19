/**
 * @file auth.constant.js
 * @module Constants_Auth
 * @description Centralized authentication constants and configuration for the backend.
 */

// ════════════════════════════════════════
// CHÍNH SÁCH MẬT KHẨU (PASSWORD POLICY)
// ════════════════════════════════════════
export const PASSWORD_POLICY = {
    MIN_LENGTH: parseInt(process.env.PASSWORD_MIN_LENGTH) || 8,
    MAX_LENGTH: 128,
    REQUIRE_UPPERCASE: process.env.PASSWORD_REQUIRE_UPPERCASE !== "false",
    REQUIRE_LOWERCASE: process.env.PASSWORD_REQUIRE_LOWERCASE !== "false",
    REQUIRE_NUMBER: process.env.PASSWORD_REQUIRE_NUMBER !== "false",
    REQUIRE_SPECIAL: process.env.PASSWORD_REQUIRE_SPECIAL !== "false",

    // Các cấp độ sức mạnh mật khẩu
    STRENGTH_LEVELS: {
        WEAK: 1,
        FAIR: 2,
        GOOD: 3,
        STRONG: 4,
        VERY_STRONG: 5,
    },

    // Danh sách các mật khẩu phổ biến cần chặn (Top 100)
    COMMON_PASSWORDS: [
        "password", "123456", "12345678", "qwerty", "abc123", "monkey",
        "1234567", "letmein", "trustno1", "dragon", "baseball", "111111",
        "iloveyou", "master", "sunshine", "ashley", "bailey", "passw0rd",
        "shadow", "123123", "654321", "superman", "qazwsx", "michael", "Football",
    ],
};

// ════════════════════════════════════════
// GIỚI HẠN TẦN SUẤT (RATE LIMITING)
// ════════════════════════════════════════
export const RATE_LIMITS = {
    LOGIN: {
        windowMs: 15 * 60 * 1000, // 15 phút
        max: 5, // Tối đa 5 lần thử
        message: "Quá nhiều lần đăng nhập. Vui lòng thử lại sau 15 phút",
        skipSuccessfulRequests: true,
    },

    REGISTER: {
        windowMs: 60 * 60 * 1000, // 1 giờ
        max: 3, // Tối đa 3 lần thử
        message: "Quá nhiều lần đăng ký. Vui lòng thử lại sau 1 giờ",
    },

    PASSWORD_RESET: {
        windowMs: 60 * 60 * 1000, // 1 giờ
        max: 3, // Tối đa 3 yêu cầu trên mỗi email
        message: "Quá nhiều yêu cầu đặt lại mật khẩu. Vui lòng thử lại sau 1 giờ",
    },

    REFRESH_TOKEN: {
        windowMs: 60 * 1000, // 1 phút
        max: 20, // Tối đa 20 yêu cầu
        message: "Quá nhiều yêu cầu làm mới token",
    },

    EMAIL_VERIFICATION: {
        windowMs: 60 * 60 * 1000, // 1 giờ
        max: 5, // Tối đa 5 lần gửi lại
        message: "Quá nhiều yêu cầu gửi lại email xác thực",
    },
};

// ════════════════════════════════════════
// KHÓA TÀI KHOẢN (ACCOUNT LOCKOUT)
// ════════════════════════════════════════
export const ACCOUNT_LOCKOUT = {
    MAX_FAILED_ATTEMPTS: 5,
    LOCKOUT_DURATION: 15 * 60 * 1000, // 15 phút
    PROGRESSIVE_DELAY: true, // Tăng thời gian khóa sau mỗi lần bị khóa
    PROGRESSIVE_MULTIPLIER: 2,
    MAX_LOCKOUT_DURATION: 24 * 60 * 60 * 1000, // 24 giờ
};

// ════════════════════════════════════════
// QUẢN LÝ PHIÊN (SESSION MANAGEMENT)
// ════════════════════════════════════════
export const SESSION_CONFIG = {
    MAX_CONCURRENT_SESSIONS: 5, // Tối đa số thiết bị mỗi người dùng
    MAX_SESSIONS_PER_DEVICE: 1, // Một phiên trên mỗi thiết bị
    SESSION_INACTIVITY_TIMEOUT: 30 * 60 * 1000, // 30 phút không hoạt động
    REMEMBER_ME_DURATION: 30 * 24 * 60 * 60 * 1000, // 30 ngày cho Remember Me

    // Dọn dẹp phiên
    CLEANUP_INTERVAL: 60 * 60 * 1000, // Chạy dọn dẹp mỗi giờ
    EXPIRED_SESSION_RETENTION: 30 * 24 * 60 * 60 * 1000, // Lưu giữ phiên đã hết hạn trong 30 ngày
};

// ════════════════════════════════════════
// CẤU HÌNH TOKEN (TOKEN CONFIGURATION)
// ════════════════════════════════════════
export const TOKEN_CONFIG = {
    // Access token
    ACCESS_TOKEN_EXPIRY: "60m",
    ACCESS_TOKEN_EXPIRY_MS: 60 * 60 * 1000,

    // Refresh token
    REFRESH_TOKEN_EXPIRY: "7d",
    REFRESH_TOKEN_EXPIRY_MS: 7 * 24 * 60 * 60 * 1000,

    // Remember me (kéo dài refresh token)
    REMEMBER_ME_EXPIRY: "30d",
    REMEMBER_ME_EXPIRY_MS: 30 * 24 * 60 * 60 * 1000,

    // Phiên bản token
    ENABLE_TOKEN_VERSION: process.env.TOKEN_VERSION_ENABLED !== "false",

    // Xoay vòng token (Rotation)
    ROTATION_DETECTION_WINDOW: 60 * 1000, // Cửa sổ 1 phút để phát hiện tái sử dụng token
};

// ════════════════════════════════════════
// ĐẶT LẠI MẬT KHẨU (PASSWORD RESET)
// ════════════════════════════════════════
export const PASSWORD_RESET_CONFIG = {
    TOKEN_EXPIRY: 60 * 60 * 1000, // 1 giờ
    TOKEN_LENGTH: 32, // bytes
    MAX_RESET_ATTEMPTS_PER_DAY: 3,
};

// ════════════════════════════════════════
// XÁC THỰC EMAIL (EMAIL VERIFICATION)
// ════════════════════════════════════════
export const EMAIL_VERIFICATION_CONFIG = {
    TOKEN_EXPIRY: 24 * 60 * 60 * 1000, // 24 giờ
    TOKEN_LENGTH: 32, // bytes
    AUTO_VERIFY_DOMAINS: [], // Tự động xác thực các domain doanh nghiệp
    REQUIRE_VERIFICATION_FOR_LOGIN: false, // Cho phép đăng nhập trước khi xác thực
};

// ════════════════════════════════════════
// MÃ HÓA & BĂM (CRYPTO & HASHING)
// ════════════════════════════════════════
export const CRYPTO_CONFIG = {
    // Cấu hình Argon2 (Khuyên dùng thay cho bcrypt)
    ARGON2: {
        type: 2, // argon2id (hybrid)
        memoryCost: 32768, // 32 MB (Resource friendly)
        timeCost: 2, // 2 iterations
        parallelism: 1, // 1 threads
        hashLength: 32, // 32 bytes output
    },

    // Bcrypt fallback (dành cho quá trình chuyển đổi dữ liệu cũ)
    BCRYPT: {
        SALT_ROUNDS: 12,
    },

    // Băm Token (SHA-256)
    TOKEN_HASH_ALGORITHM: "sha256",
};

// ════════════════════════════════════════
// SỰ KIỆN AUDIT (AUDIT EVENTS)
// ════════════════════════════════════════
export const AUDIT_EVENTS = {
    // Xác thực
    LOGIN_SUCCESS: "auth.login.success",
    LOGIN_FAILED: "auth.login.failed",
    LOGOUT: "auth.logout",
    LOGOUT_ALL: "auth.logout.all",

    // Đăng ký
    REGISTER_SUCCESS: "auth.register.success",
    REGISTER_FAILED: "auth.register.failed",

    // Thao tác Token
    TOKEN_REFRESH: "auth.token.refresh",
    TOKEN_REUSE_DETECTED: "auth.token.reuse",
    TOKEN_ROTATION: "auth.token.rotation",
    TOKEN_BLACKLISTED: "auth.token.blacklisted",

    // Thao tác Mật khẩu
    PASSWORD_CHANGE: "auth.password.change",
    PASSWORD_RESET_REQUEST: "auth.password.reset.request",
    PASSWORD_RESET_COMPLETE: "auth.password.reset.complete",
    PASSWORD_RESET_FAILED: "auth.password.reset.failed",

    // Bảo mật tài khoản
    ACCOUNT_LOCKED: "auth.account.locked",
    ACCOUNT_UNLOCKED: "auth.account.unlocked",
    ACCOUNT_BANNED: "auth.account.banned",

    // Xác thực Email
    EMAIL_VERIFICATION_SENT: "auth.email.verification.sent",
    EMAIL_VERIFIED: "auth.email.verified",

    // Quản lý Phiên
    SESSION_CREATED: "auth.session.created",
    SESSION_REVOKED: "auth.session.revoked",
    SESSION_EXPIRED: "auth.session.expired",

    // Cảnh báo bảo mật
    SUSPICIOUS_ACTIVITY: "security.suspicious.activity",
    BRUTE_FORCE_ATTEMPT: "security.brute.force",
    IP_BLOCKED: "security.ip.blocked",
    DEVICE_LIMIT_EXCEEDED: "security.device.limit",
    RATE_LIMIT_EXCEEDED: "security.rate.limit.exceeded",
};

// ════════════════════════════════════════
// MÃ LỖI (ERROR CODES)
// ════════════════════════════════════════
export const AUTH_ERROR_CODES = {
    // Lỗi xác thực
    INVALID_CREDENTIALS: "AUTH_001",
    ACCOUNT_LOCKED: "AUTH_002",
    ACCOUNT_BANNED: "AUTH_003",
    EMAIL_NOT_VERIFIED: "AUTH_004",
    ACCOUNT_INACTIVE: "AUTH_005",

    // Lỗi Token
    TOKEN_EXPIRED: "TOKEN_001",
    TOKEN_INVALID: "TOKEN_002",
    TOKEN_REVOKED: "TOKEN_003",
    TOKEN_REUSED: "TOKEN_004",
    TOKEN_VERSION_MISMATCH: "TOKEN_005",

    // Lỗi Mật khẩu
    PASSWORD_TOO_WEAK: "PWD_001",
    PASSWORD_COMMON: "PWD_002",
    PASSWORD_SIMILAR_TO_USERNAME: "PWD_003",
    PASSWORD_RECENTLY_USED: "PWD_004",
    PASSWORD_INCORRECT: "PWD_005",

    // Lỗi Đăng ký
    EMAIL_ALREADY_EXISTS: "REG_001",
    USERNAME_ALREADY_EXISTS: "REG_002",
    INVALID_EMAIL: "REG_003",
    INVALID_USERNAME: "REG_004",

    // Lỗi Phiên đăng nhập
    SESSION_EXPIRED: "SESSION_001",
    SESSION_NOT_FOUND: "SESSION_002",
    MAX_SESSIONS_EXCEEDED: "SESSION_003",
    DEVICE_LIMIT_EXCEEDED: "SESSION_004",

    // Giới hạn tần suất
    RATE_LIMIT_EXCEEDED: "RATE_001",
    TOO_MANY_REQUESTS: "RATE_002",

    // Lỗi MFA
    MFA_REQUIRED: "MFA_001",
    MFA_INVALID: "MFA_002",
    MFA_NOT_ENABLED: "MFA_003",
    MFA_ALREADY_ENABLED: "MFA_004",
    MFA_SETUP_REQUIRED: "MFA_005",

    // Lỗi chung
    INTERNAL_ERROR: "ERR_001",
    VALIDATION_ERROR: "ERR_002",
    UNAUTHORIZED: "ERR_003",
    FORBIDDEN: "ERR_004",
};

// ════════════════════════════════════════
// TIÊU ĐỀ BẢO MẬT (SECURITY HEADERS)
// ════════════════════════════════════════
export const SECURITY_HEADERS = {
    // Content Security Policy
    CSP: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'"],
            fontSrc: ["'self'"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'none'"],
        },
    },

    // HTTP Strict Transport Security
    HSTS: {
        maxAge: 31536000, // 1 năm
        includeSubDomains: true,
        preload: true,
    },

    // Các headers khác
    X_FRAME_OPTIONS: "DENY",
    X_CONTENT_TYPE_OPTIONS: "nosniff",
    X_XSS_PROTECTION: "1; mode=block",
    REFERRER_POLICY: "strict-origin-when-cross-origin",
};

// ════════════════════════════════════════
// BẢO VỆ CSRF (CSRF PROTECTION)
// ════════════════════════════════════════
export const CSRF_CONFIG = {
    ENABLED: process.env.CSRF_PROTECTION_ENABLED !== "false",
    TOKEN_LENGTH: 32,
    COOKIE_NAME: "csrf-token",
    HEADER_NAME: "X-CSRF-Token",
    METHODS_TO_PROTECT: ["POST", "PUT", "DELETE", "PATCH"],
    EXCLUDED_PATHS: ["/api/v1/auth/refresh-token"],
};

// ════════════════════════════════════════
// THEO DÕI IP & THIẾT BỊ (TRACKING)
// ════════════════════════════════════════
export const TRACKING_CONFIG = {
    TRACK_IP: true,
    TRACK_USER_AGENT: true,
    TRACK_DEVICE_FINGERPRINT: true,
    DETECT_LOCATION: false,
    ALERT_NEW_DEVICE: true,
    ALERT_NEW_LOCATION: true,
};

// ════════════════════════════════════════
// CẤU HÌNH THÔNG BÁO (NOTIFICATIONS)
// ════════════════════════════════════════
export const NOTIFICATION_CONFIG = {
    // Thông báo Email
    EMAIL_ON_LOGIN: false,
    EMAIL_ON_PASSWORD_CHANGE: true,
    EMAIL_ON_NEW_DEVICE: true,
    EMAIL_ON_SUSPICIOUS_ACTIVITY: true,

    // Thông báo trong ứng dụng
    NOTIFY_ON_LOGIN: false,
    NOTIFY_ON_PASSWORD_CHANGE: true,
    NOTIFY_ON_NEW_DEVICE: true,
};

// ════════════════════════════════════════
// BIỂU THỨC CHÍNH QUY (REGEX)
// ════════════════════════════════════════
export const VALIDATION_REGEX = {
    EMAIL: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
    USERNAME: /^[a-zA-Z0-9_-]{3,50}$/,
    PASSWORD_UPPERCASE: /[A-Z]/,
    PASSWORD_LOWERCASE: /[a-z]/,
    PASSWORD_NUMBER: /[0-9]/,
    PASSWORD_SPECIAL: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/,
    URL: /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)$/,
};

// ════════════════════════════════════════
// CẤU HÌNH THIẾT BỊ VÀ MFA (DEVICE & MFA CONFIG)
// ════════════════════════════════════════
export const MEMBERSHIP_DEVICE_LIMITS = {
    free: 1,
    plus: 2,
    pro: 4,
    ultra: 6,
};

export const MFA_CONFIG = {
    ISSUER: "SapPhim",
    TOKEN_EXPIRY_MS: 5 * 60 * 1000, // 5 minutes validity
    BACKUP_CODES_COUNT: 10,
    BACKUP_CODE_LENGTH: 8,
};

// ════════════════════════════════════════
// XUẤT BẢN CẤU HÌNH (EXPORT)
// ════════════════════════════════════════
export default {
    PASSWORD_POLICY,
    RATE_LIMITS,
    ACCOUNT_LOCKOUT,
    SESSION_CONFIG,
    TOKEN_CONFIG,
    PASSWORD_RESET_CONFIG,
    EMAIL_VERIFICATION_CONFIG,
    CRYPTO_CONFIG,
    AUDIT_EVENTS,
    AUTH_ERROR_CODES,
    SECURITY_HEADERS,
    CSRF_CONFIG,
    TRACKING_CONFIG,
    NOTIFICATION_CONFIG,
    VALIDATION_REGEX,
    MEMBERSHIP_DEVICE_LIMITS,
    MFA_CONFIG,
};
