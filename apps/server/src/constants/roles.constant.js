/**
 * @file roles.constant.js
 * @module Constants_Roles
 * @description User role definitions and hierarchy helpers for authorization checks.
 */

/**
 * Danh sách các mã Vai trò (Roles)
 */
export const ROLES = {
    BOSS: "boss",
    ADMIN: "admin",
    MODERATOR: "moderator",
    PREMIUM_USER: "premium_user",
    USER: "user",
};

/**
 * Cấp bậc vai trò (Hierarchy)
 *
 * @description Giá trị số càng cao tương ứng với đặc quyền càng lớn.
 */
export const ROLE_HIERARCHY = {
    [ROLES.BOSS]: 5,
    [ROLES.ADMIN]: 4,
    [ROLES.MODERATOR]: 3,
    [ROLES.PREMIUM_USER]: 2,
    [ROLES.USER]: 1,
};

/**
 * Tập hợp các mã vai trò hợp lệ
 *
 * @description Sử dụng Set để tối ưu hóa hiệu suất kiểm tra (O(1)).
 */
export const VALID_ROLE_SLUGS = Object.freeze(new Set(Object.values(ROLES)));

/**
 * Kiểm tra tính hợp lệ của một mã vai trò
 *
 * @param {string} slug - Mã vai trò cần kiểm tra
 * @returns {boolean} Kết quả kiểm tra
 */
export const isValidRole = (slug) => VALID_ROLE_SLUGS.has(slug);
