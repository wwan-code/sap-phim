/**
 * @file app-error.js
 * @module Utils
 * @description Lớp lỗi tùy chỉnh kế thừa từ Error, hỗ trợ phân loại lỗi hệ thống và lỗi nghiệp vụ.
 */

class AppError extends Error {
  /**
   * Khởi tạo đối tượng lỗi AppError.
   * @param {string} message - Thông báo lỗi
   * @param {number} statusCode - Mã trạng thái HTTP (e.g. 400, 401, 403, 404, 500)
   */
  constructor(message, statusCode) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    // Lỗi operational (đã đoán trước, do người dùng nhập hoặc logic nghiệp vụ)
    // Phân biệt với lỗi system (lỗi runtime chưa xác định, crash server)
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

class NotFoundError extends AppError {
  constructor(resource = "Resource") {
    super(`${resource} không tồn tại hoặc đã bị xóa.`, 404);
  }
}

class ConflictError extends AppError {
  constructor(message = "Dữ liệu đã tồn tại hoặc xảy ra xung đột.") {
    super(message, 409);
  }
}

class BadRequestError extends AppError {
  constructor(message = "Yêu cầu không hợp lệ.") {
    super(message, 400);
  }
}

export default AppError;
export { AppError, NotFoundError, ConflictError, BadRequestError };
