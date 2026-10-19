/**
 * @file error.util.js
 * @module Utils/ErrorUtil
 * @description Phân tích, định dạng và hiển thị thông báo lỗi tiếng Việt thân thiện với người dùng.
 */

/**
 * Ánh xạ tên các trường dữ liệu từ Backend sang tiếng Việt
 */
const FIELD_MAP = {
    username: "Tên đăng nhập",
    email: "Email",
    password: "Mật khẩu",
    full_name: "Họ và tên",
    identifier: "Email hoặc Tên đăng nhập",
    confirmPassword: "Mật khẩu xác nhận",
    currentPassword: "Mật khẩu hiện tại",
    newPassword: "Mật khẩu mới",
    title: "Tiêu đề",
    content: "Nội dung",
    phone: "Số điện thoại",
};

/**
 * Chuyển đổi lỗi API thành thông báo tiếng Việt dễ hiểu
 * 
 * @param {Error|Object} err - Đối tượng lỗi từ Axios hoặc ApiError
 * @param {string} [fallback="Đã có lỗi xảy ra"] - Thông báo mặc định
 * @returns {string} Thông báo lỗi đã được Việt hóa
 */
export const getFriendlyErrorMessage = (err, fallback = "Đã có lỗi xảy ra") => {
    const data = err?.response?.data || err?.data;
    const msg = data?.message;

    // 1. Xử lý lỗi Validation (thường từ Joi ở Backend)
    if (data?.error?.code === "VALIDATION_ERROR" && Array.isArray(data.error.details)) {
        return data.error.details.map(detail => {
            const fieldName = detail.field;
            const mappedField = FIELD_MAP[fieldName] || fieldName;
            const originalMsg = detail.message;
            
            // Dịch các thông báo lỗi phổ biến của Joi
            if (originalMsg.includes("is required") || originalMsg.includes("is not allowed to be empty")) {
                return `${mappedField} không được để trống.`;
            }
            if (originalMsg.includes("must be a valid email")) {
                return `${mappedField} không hợp lệ.`;
            }
            if (originalMsg.includes("length must be at least")) {
                const match = originalMsg.match(/least (\d+) characters/);
                const chars = match ? match[1] : '8';
                return `${mappedField} phải có ít nhất ${chars} ký tự.`;
            }
            if (originalMsg.includes("fails to match the required pattern")) {
                return `${mappedField} không đúng định dạng yêu cầu.`;
            }
            if (originalMsg.includes("must be one of")) {
                return `${mappedField} giá trị không hợp lệ.`;
            }
            
            // Nếu không khớp pattern nào, trả về thông báo gốc (viết hoa chữ cái đầu)
            return originalMsg.charAt(0).toUpperCase() + originalMsg.slice(1);
        }).join(" ");
    }

    // 2. Xử lý lỗi hệ thống/mạng
    if (err?.code === "ECONNABORTED") return "Kết nối server quá hạn. Vui lòng thử lại.";
    if (err?.message === "Network Error") return "Không thể kết nối mạng. Vui lòng kiểm tra lại.";

    // 3. Mặc định trả về message từ server hoặc fallback
    return msg || err?.message || fallback;
};

export default {
    getFriendlyErrorMessage,
};
