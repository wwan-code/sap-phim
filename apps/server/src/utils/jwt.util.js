/**
 * @file jwt.util.js
 * @module Utils
 * @description Xử lý khởi tạo và xác thực các loại token JWT dùng cho auth và authorization.
 */

import jwt from "jsonwebtoken";
import { randomUUID } from "crypto";
import { jwtConfig } from "../config/jwt.config.js";
import { TOKEN_CONFIG } from "../constants/auth.constant.js";

// ════════════════════════════════════════
// KHỞI TẠO MÃ THÔNG BÁO (GENERATION)
// ════════════════════════════════════════

/**
 * Khởi tạo mã thông báo truy cập (Access Token).
 *
 * @param {Object} payload - Dữ liệu định danh người dùng (id, username, email, role).
 * @returns {string} JWT Token đã được ký.
 */
export const generateAccessToken = (payload) => {
  return jwt.sign(payload, jwtConfig.access.secret, {
    expiresIn: jwtConfig.access.expiresIn,
    algorithm: jwtConfig.access.algorithm,
    issuer: jwtConfig.issuer,
    audience: jwtConfig.audience,
    jwtid: randomUUID(),
  });
};

/**
 * Khởi tạo mã thông báo làm mới (Refresh Token).
 *
 * @param {Object} payload - Dữ liệu cần thiết để làm mới phiên (id, tokenVersion).
 * @param {string|number} [expiresIn] - Thời gian hết hạn của token
 * @returns {string} JWT Token dài hạn.
 */
export const generateRefreshToken = (payload, expiresIn) => {
  return jwt.sign(payload, jwtConfig.refresh.secret, {
    expiresIn: expiresIn || jwtConfig.refresh.expiresIn,
    algorithm: jwtConfig.refresh.algorithm,
    issuer: jwtConfig.issuer,
    audience: jwtConfig.audience,
    jwtid: randomUUID(),
  });
};

const extractRoleSlug = (role) => {
  if (!role) return null;
  if (typeof role === "string") return role;
  return role.slug ?? null;
};

/**
 * Khởi tạo bộ đôi mã thông báo (Access & Refresh) cho một phiên làm việc mới.
 *
 * @description Hàm này tự động tính toán cấu hình thời gian dựa trên tùy chọn "Ghi nhớ đăng nhập".
 * @param {Object} user - Đối tượng người dùng từ cơ sở dữ liệu.
 * @param {Object} [options={}] - Tùy chọn mở rộng (rememberMe, sessionId).
 * @returns {Object} Đối tượng chứa bộ đôi Token và thời điểm hết hạn của Access Token.
 */
export const generateTokenPair = (user, options = {}) => {
  const { rememberMe = false, sessionId } = options;
  const tokenVersion = user.token_version || 1;
  const roleSlug = extractRoleSlug(user.role);

  const accessToken = generateAccessToken({
    id: user.id,
    username: user.username,
    email: user.email,
    role: roleSlug,
    tokenVersion,
    sessionId,
  });

  // Xác định thời lượng phiên dựa trên hành vi người dùng
  const refreshExpiresIn = rememberMe
    ? TOKEN_CONFIG.REMEMBER_ME_EXPIRY
    : TOKEN_CONFIG.REFRESH_TOKEN_EXPIRY;

  const refreshToken = generateRefreshToken(
    {
      id: user.id,
      tokenVersion,
      sessionId,
    },
    refreshExpiresIn,
  );

  // Tính toán thời điểm hết hạn Access Token (ms) để Client chủ động làm mới trước khi hết hạn
  const expiresAt = Date.now() + TOKEN_CONFIG.ACCESS_TOKEN_EXPIRY_MS;
  const expiresIn = TOKEN_CONFIG.ACCESS_TOKEN_EXPIRY_MS;

  return { accessToken, refreshToken, expiresAt, expiresIn };
};

// ════════════════════════════════════════
// XÁC THỰC MÃ THÔNG BÁO (VERIFICATION)
// ════════════════════════════════════════

/**
 * Xác thực tính hợp lệ của Access Token.
 * @param {string} token - Chuỗi JWT cần kiểm tra.
 * @returns {Object} Payload giải mã nếu hợp lệ.
 * @throws {JsonWebTokenError} Nếu mã không hợp lệ hoặc hết hạn.
 */
export const verifyAccessToken = (token) => {
  return jwt.verify(token, jwtConfig.access.secret, jwtConfig.verifyOptions);
};

const verifyWithSecretCandidates = (token, secrets) => {
  let lastError = null;

  for (const secret of secrets) {
    try {
      return jwt.verify(token, secret, jwtConfig.verifyOptions);
    } catch (error) {
      if (error.name === "TokenExpiredError" || error.name === "NotBeforeError") {
        throw error;
      }
      lastError = error;
    }
  }

  throw lastError;
};

/**
 * Xác thực tính hợp lệ của Refresh Token.
 * @param {string} token - Chuỗi JWT cần kiểm tra.
 * @returns {Object} Payload giải mã nếu hợp lệ.
 */
export const verifyRefreshToken = (token) => {
  return verifyWithSecretCandidates(token, [
    jwtConfig.refresh.secret,
    ...(jwtConfig.refresh.previousSecrets || []),
  ]);
};