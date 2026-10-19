/**
 * @file color.util.js
 * @module Utils/ColorUtil
 * @description Hàm tiện ích xử lý và chuyển đổi định dạng màu sắc (Hex sang RGB string).
 */

/**
 * Chuyển đổi mã màu Hex sang định dạng RGB string ("r, g, b").
 * Được tối ưu hóa bằng cách tránh sử dụng Regex và kiểm tra charCode.
 * Không throw error, đảm bảo an toàn cho UI.
 *
 * @param {string} hex - Mã màu hex (VD: "#FFFFFF", "FFF", "#FFF").
 * @param {string} [fallback="0, 0, 0"] - Giá trị trả về mặc định nếu hex không hợp lệ.
 * @returns {string} Chuỗi "r, g, b" tương ứng.
 */
export const hexToRgb = (hex, fallback = '0, 0, 0') => {
    if (!hex || typeof hex !== 'string') return fallback;

    // Loại bỏ dấu '#' ở đầu nếu có (mã ASCII của '#' là 35)
    // Cách này chạy nhanh hơn so với dùng .replace(/#/, '') hoặc .startsWith
    const cleanHex = hex.charCodeAt(0) === 35 ? hex.slice(1) : hex;

    // Xử lý chuỗi hex 3 ký tự (VD: FFF -> FFFFFF)
    if (cleanHex.length === 3) {
        const r = parseInt(cleanHex[0] + cleanHex[0], 16);
        const g = parseInt(cleanHex[1] + cleanHex[1], 16);
        const b = parseInt(cleanHex[2] + cleanHex[2], 16);
        return isNaN(r) || isNaN(g) || isNaN(b) ? fallback : `${r}, ${g}, ${b}`;
    }

    // Xử lý chuỗi hex 6 ký tự
    if (cleanHex.length === 6) {
        const r = parseInt(cleanHex.slice(0, 2), 16);
        const g = parseInt(cleanHex.slice(2, 4), 16);
        const b = parseInt(cleanHex.slice(4, 6), 16);
        return isNaN(r) || isNaN(g) || isNaN(b) ? fallback : `${r}, ${g}, ${b}`;
    }

    // Nếu không khớp định dạng 3 hoặc 6 ký tự, trả về fallback
    return fallback;
};

export default {
    hexToRgb,
};
