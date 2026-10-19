/**
 * @file security.util.js
 * @module VideoServer_Utils
 * @description Các tiện ích bảo mật: so sánh kháng Timing Attack và kiểm tra an toàn đường dẫn (chống Path Traversal).
 */

import crypto from "crypto";

/**
 * So sánh an toàn hai chuỗi ký tự bằng crypto.timingSafeEqual để chống Timing Attack.
 * Sử dụng SHA-256 băm trước để triệt tiêu chênh lệch độ dài chuỗi.
 *
 * @param {string} a - Chuỗi thứ nhất
 * @param {string} b - Chuỗi thứ hai
 * @returns {boolean} True nếu hai chuỗi giống hệt nhau
 */
export const safeCompare = (a, b) => {
  if (typeof a !== "string" || typeof b !== "string") {
    return false;
  }

  const hashA = crypto.createHash("sha256").update(a).digest();
  const hashB = crypto.createHash("sha256").update(b).digest();

  return crypto.timingSafeEqual(hashA, hashB);
};

/**
 * Kiểm tra xem một đoạn đường dẫn (ví dụ movieId, episodeId) có an toàn không.
 * Ngăn chặn triệt để kỹ thuật Path Traversal (chứa "..", "/", "\", null byte).
 *
 * @param {string} segment - Giá trị id hoặc tên thư mục
 * @returns {boolean} True nếu hợp lệ, False nếu chứa ký tự nguy hiểm
 */
export const isValidPathSegment = (segment) => {
  if (!segment || typeof segment !== "string") {
    return false;
  }

  const trimmed = segment.trim();
  if (trimmed.length === 0 || trimmed.length > 255) {
    return false;
  }

  // Chặn null byte, directory traversal "..", ký tự phân cách "/" và "\"
  if (trimmed.includes("\0") || trimmed.includes("..") || trimmed.includes("/") || trimmed.includes("\\")) {
    return false;
  }

  // Chỉ chấp nhận ký tự an toàn: chữ cái, chữ số, gạch dưới, gạch ngang, dấu chấm (không liên tiếp)
  const safePattern = /^[a-zA-Z0-9_-]+(\.[a-zA-Z0-9_-]+)*$/;
  return safePattern.test(trimmed);
};

/**
 * Xác thực đoạn đường dẫn, ném lỗi HTTP 400 nếu phát hiện dữ liệu độc hại
 *
 * @param {string} segment - Giá trị cần kiểm tra
 * @param {string} [name="Tham số"] - Tên trường báo cáo lỗi
 * @throws {Error}
 */
export const assertValidPathSegment = (segment, name = "Tham số") => {
  if (!isValidPathSegment(segment)) {
    const error = new Error(`${name} không hợp lệ hoặc chứa ký tự đường dẫn không được phép`);
    error.status = 400;
    throw error;
  }
};

export default {
  safeCompare,
  isValidPathSegment,
  assertValidPathSegment,
};
