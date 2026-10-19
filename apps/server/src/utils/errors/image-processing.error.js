/**
 * @file image-processing.error.js
 * @module Errors
 * @description Cung cấp cấu trúc lỗi thống nhất cho quy trình xử lý ảnh và hỗ trợ fallback/retry.
 */

/**
 * Tạo đối tượng lỗi có cấu trúc cho luồng xử lý ảnh
 *
 * @param {string} code - Mã lỗi định danh (từ IMAGE_ERRORS trong media.config.js)
 * @param {string} message - Thông điệp lỗi chi tiết
 * @param {Error|null} originalError - Lỗi gốc từ các thư viện bên thứ ba (Sharp, ONNX, v.v.)
 * @param {boolean} recoverable - Đánh dấu lỗi có thể xử lý dự phòng (Fallback) được hay không
 * @returns {Error} Đối tượng lỗi đã được gắn thêm các thuộc tính định danh
 */
export function createImageProcessingError(
  code,
  message,
  originalError = null,
  recoverable = false,
) {
  const error = new Error(message);
  error.name = "ImageProcessingError";
  error.code = code;
  error.originalError = originalError;
  error.recoverable = recoverable;
  return error;
}

/**
 * Kiểm tra xem một đối tượng lỗi có phải là lỗi xử lý ảnh hay không
 * 
 * @param {Error} error - Đối tượng cần kiểm tra
 * @returns {boolean}
 */
export function isImageProcessingError(error) {
  return error?.name === "ImageProcessingError";
}

export default createImageProcessingError;
