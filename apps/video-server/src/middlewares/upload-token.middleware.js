/**
 * @file upload-token.middleware.js
 * @module VideoServer_Middlewares
 * @description Xác thực JWT Upload Token từ client gửi lên khi thực hiện TUS upload.
 */

import jwt from "jsonwebtoken";

import { env } from "../config/env.config.js";
import { logger } from "../utils/logger.js";

/**
 * Phân tích và giải mã metadata từ header Upload-Metadata của giao thức TUS
 * Định dạng: key1 value1_base64,key2 value2_base64
 * @param {string} metadataHeader
 * @returns {Object}
 */
export const parseTusMetadata = (metadataHeader) => {
  if (!metadataHeader || typeof metadataHeader !== "string") return {};

  const result = {};
  const pairs = metadataHeader.split(",");

  for (const pair of pairs) {
    const trimmed = pair.trim();
    if (!trimmed) continue;
    const [key, base64Val] = trimmed.split(" ");
    if (key && base64Val) {
      try {
        result[key] = Buffer.from(base64Val, "base64").toString("utf-8");
      } catch {
        result[key] = base64Val;
      }
    } else if (key) {
      result[key] = "";
    }
  }

  return result;
};

/**
 * Xác thực chuỗi JWT Upload Token
 * @param {string} token
 * @returns {Object|null} Payload giải mã được hoặc null nếu không hợp lệ
 */
export const verifyUploadToken = (token) => {
  if (!token) return null;

  try {
    const decoded = jwt.verify(token, env.uploadTokenSecret);
    return decoded;
  } catch (error) {
    logger.warn(`[UploadToken] Token không hợp lệ hoặc đã hết hạn: ${error.message}`);
    return null;
  }
};

/**
 * Middleware kiểm tra JWT Upload Token cho các HTTP request thông thường
 */
export const uploadTokenMiddleware = (req, res, next) => {
  const token =
    req.headers["x-upload-token"] ||
    req.query.token ||
    (req.headers.authorization && req.headers.authorization.startsWith("Bearer ")
      ? req.headers.authorization.slice(7)
      : null);

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized: Thiếu Upload Token",
    });
  }

  const payload = verifyUploadToken(token);
  if (!payload) {
    return res.status(403).json({
      success: false,
      message: "Forbidden: Upload Token không hợp lệ hoặc đã hết hạn",
    });
  }

  req.uploadAuth = payload;
  next();
};

export default { parseTusMetadata, verifyUploadToken, uploadTokenMiddleware };
