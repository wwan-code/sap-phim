/**
 * Nhà máy Lỗi Xác thực (Auth Error Factory)
 * 
 * @description Tiện ích tạo lỗi tập trung cho module Authentication.
 * Giúp chuẩn hóa cấu trúc lỗi trả về cho client, bao gồm mã trạng thái HTTP và mã lỗi nội bộ (Error Code).
 */

/**
 * Tạo một lỗi Operational Error với mã trạng thái HTTP và mã lỗi xác thực.
 * Operational Error là các lỗi có thể dự đoán được (sai mật khẩu, hết hạn token,...)
 * chứ không phải là lỗi lập trình (bug).
 *
 * @param {string} message - Thông báo lỗi thân thiện với người dùng
 * @param {number} statusCode - Mã trạng thái HTTP (400, 401, 403, 500, ...)
 * @param {string} errorCode - Mã lỗi nội bộ (AUTH_001, TOKEN_001, ...) từ auth.constant.js
 * @returns {Error} Đối tượng Error đã được mở rộng
 */
export const createAuthError = (message, statusCode, errorCode) => {
  const error = new Error(message);

  // Gán các thuộc tính mở rộng để middleware xử lý lỗi có thể nhận diện
  error.statusCode = statusCode;
  error.errorCode = errorCode;
  error.isOperational = true; // Đánh dấu đây là lỗi nghiệp vụ (có thể hiển thị cho người dùng)

  return error;
};
