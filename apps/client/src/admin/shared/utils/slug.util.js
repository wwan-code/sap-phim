/**
 * @file slug.util.js
 * @module Utils/SlugUtil
 * @description Hàm tạo và xử lý chuỗi Slug thân thiện SEO cho Tiếng Việt.
 */

/**
 * Bản đồ chuyển đổi ký tự tiếng Việt có dấu sang ASCII (không dấu)
 */
const VIETNAMESE_MAP = {
    'a': /[áàảãạăắằẳẵặâấầẩẫậ]/g,
    'e': /[éèẻẽẹêếềểễệ]/g,
    'i': /[íìỉĩị]/g,
    'o': /[óòỏõọôốồổỗộơớờởỡợ]/g,
    'u': /[úùủũụưứừửữự]/g,
    'y': /[ýỳỷỹỵ]/g,
    'd': /[đ]/g,
    'A': /[ÁÀẢÃẠĂẮẰẲẴẶÂẤẦẨẪẬ]/g,
    'E': /[ÉÈẺẼẸÊẾỀỂỄỆ]/g,
    'I': /[ÍÌỈĨỊ]/g,
    'O': /[ÓÒỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢ]/g,
    'U': /[ÚÙỦŨỤƯỨỪỬỮỰ]/g,
    'Y': /[ÝỲỶỸỴ]/g,
    'D': /[Đ]/g,
};

/**
 * Thoát các ký tự đặc biệt cho biểu thức chính quy (Regex)
 * 
 * @param {string} string - Chuỗi cần escape
 * @returns {string} Chuỗi an toàn để dùng trong Regex
 */
function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Chuyển đổi chuỗi văn bản bất kỳ thành Slug chuẩn SEO
 * 
 * @param {string} str - Chuỗi đầu vào (VD: "Phim Hành Động Hay")
 * @param {Object} [options={}] - Tùy chọn cấu hình
 * @param {boolean} [options.lower=true] - Chuyển về chữ thường
 * @param {boolean} [options.strict=true] - Loại bỏ toàn bộ ký tự đặc biệt
 * @param {string} [options.separator="-"] - Ký tự phân cách
 * @param {number} [options.maxLen=255] - Độ dài tối đa
 * @param {boolean} [options.unique=false] - Thêm hậu tố ngẫu nhiên để đảm bảo duy nhất
 * @returns {string} Chuỗi slug (VD: "phim-hanh-dong-hay")
 */
export const slugify = (str, options = {}) => {
    const {
        lower = true,
        strict = true,
        separator = '-',
        maxLen = 255,
        unique = false
    } = options;

    if (!str || typeof str !== 'string') return '';

    let result = str;

    // 1. Chuyển đổi ký tự tiếng Việt (Tối ưu hóa bằng Regex map)
    Object.keys(VIETNAMESE_MAP).forEach(key => {
        result = result.replace(VIETNAMESE_MAP[key], key);
    });

    // 2. Loại bỏ HTML tags nếu có
    result = result.replace(/<[^>]*>/g, '');

    // 3. Xử lý ký tự đặc biệt và khoảng trắng
    if (strict) {
        // Chỉ giữ lại chữ cái, số và dấu gạch ngang
        result = result.replace(/[^a-zA-Z0-9\s-]/g, '');
    } else {
        // Giữ lại nhiều ký tự hơn nhưng chuẩn hóa
        result = result.replace(/[^\w\s-.,!?']/g, '');
    }

    // 4. Chuẩn hóa khoảng trắng và dấu phân cách
    result = result
        .replace(/\s+/g, ' ')               // Nhiều khoảng trắng -> 1
        .trim()                             // Cắt 2 đầu
        .replace(/\s+/g, separator);        // Khoảng trắng -> separator

    // 5. Chuyển chữ thường
    if (lower) result = result.toLowerCase();

    // 6. Dọn dẹp dấu phân cách dư thừa
    const escapedSep = escapeRegExp(separator);
    result = result
        .replace(new RegExp(`${escapedSep}{2,}`, 'g'), separator) // -- -> -
        .replace(new RegExp(`^${escapedSep}+|${escapedSep}+$`, 'g'), ''); // -abc- -> abc

    // 7. Giới hạn độ dài (tránh cắt giữa chừng một từ)
    if (maxLen > 0 && result.length > maxLen) {
        result = result.substring(0, maxLen);
        const lastIndex = result.lastIndexOf(separator);
        if (lastIndex > 0) result = result.substring(0, lastIndex);
    }

    // 8. Hậu tố duy nhất (nếu yêu cầu)
    if (unique) {
        const salt = Math.random().toString(36).substring(2, 6);
        result += `${separator}${salt}`;
    }

    return result;
};

/**
 * Tạo slug duy nhất bằng cách kiểm tra danh sách đã tồn tại
 * 
 * @param {string} baseStr - Chuỗi gốc
 * @param {string[]} existingSlugs - Danh sách slug đã có
 * @param {Object} [options={}] - Cấu hình
 * @returns {string} Slug không trùng lặp
 */
export const uniqueSlug = (baseStr, existingSlugs = [], options = {}) => {
    let slug = slugify(baseStr, options);
    if (!existingSlugs.includes(slug)) return slug;

    const sep = options.separator || '-';
    let counter = 1;
    const originalSlug = slug;

    while (existingSlugs.includes(slug)) {
        slug = `${originalSlug}${sep}${counter}`;
        counter++;
    }

    return slug;
};

/**
 * Kiểm tra xem một chuỗi có đúng định dạng slug không
 * 
 * @param {string} slug 
 * @returns {boolean}
 */
export const validateSlug = (slug) => {
    if (!slug) return false;
    return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
};

export default {
    slugify,
    uniqueSlug,
    validateSlug
};
