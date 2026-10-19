/**
 * Cấu hình JWT (JSON Web Token)
 *
 * @name jwt.config.js
 * @module Config
 * @description Quản lý thiết lập bảo mật cho quá trình xác thực, bao gồm Access Token,
 * Refresh Token, cơ chế lưu trữ Cookie và danh sách đen (Blacklist).
 */

import { env } from "./env.config.js";

const legacyRefreshSecrets = env.jwt.refreshPreviousSecrets.filter(
  (secret) => secret && secret !== env.jwt.refreshSecret,
);

const JWT_ISSUER = process.env.JWT_ISSUER || "sap-phim-api";
const JWT_AUDIENCE = process.env.JWT_AUDIENCE || "sap-phim-client";

export const jwtConfig = {
  issuer: JWT_ISSUER,
  audience: JWT_AUDIENCE,

  /**
   * Cấu hình Access Token
   *
   * @description Token ngắn hạn sử dụng cho mọi yêu cầu API cần xác thực.
   */
  access: {
    secret: env.jwt.accessSecret,
    expiresIn: env.jwt.accessExpires || "15m",
    algorithm: "HS256",
  },

  /**
   * Cấu hình Refresh Token
   *
   * @description Token dài hạn sử dụng để cấp mới Access Token khi hết hạn.
   */
  refresh: {
    secret: env.jwt.refreshSecret,
    previousSecrets: legacyRefreshSecrets,
    expiresIn: env.jwt.refreshExpires || "7d",
    algorithm: "HS256",
  },

  /**
   * Cấu hình Cookie cho Refresh Token
   *
   * @description Thiết lập các thông số bảo mật khi lưu trữ Refresh Token phía client.
   */
  cookie: {
    name: "refreshToken",
    httpOnly: true, // Chống tấn công XSS
    secure: env.nodeEnv === "production", // Chỉ gửi qua HTTPS khi ở Production
    sameSite: env.nodeEnv === "production" ? "strict" : "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 ngày
    path: "/",
  },

  /**
   * Tùy chọn xác thực Token
   *
   * FIX: bổ sung issuer/audience — jwt.verify() sẽ reject token không khớp.
   */
  verifyOptions: {
    algorithms: ["HS256"],
    ignoreExpiration: false,
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
  },

  /**
   * Tùy chọn ký Token (dùng ở jwt.util.js khi gọi jwt.sign)
   */
  signOptions: {
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
  },

  /**
   * Cấu hình Danh sách đen (JWT Blacklist)
   *
   * @description Sử dụng Redis để vô hiệu hóa Token ngay lập tức khi đăng xuất.
   */
  blacklist: {
    enabled: true,
    prefix: "jwt_blacklist:",
  },
};

/**
 * Lấy tùy chọn ký Token dựa trên loại Token
 *
 * @param {string} type - Loại token ('access' hoặc 'refresh')
 * @returns {Object} Đối tượng chứa expiresIn và algorithm
 */
export const getTokenOptions = (type = "access") => {
  const config = type === "refresh" ? jwtConfig.refresh : jwtConfig.access;
  return {
    expiresIn: config.expiresIn,
    algorithm: config.algorithm,
  };
};

export default jwtConfig;