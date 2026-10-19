/**
 * CSRF Middleware — Double-Submit Cookie Pattern
 *
 * @file csrf.middleware.js
 * @module Middlewares
 * @description Chống tấn công CSRF cho các endpoint dựa vào cookie (đặc biệt
 * /auth/refresh-token và /auth/logout, vốn không đi qua Authorization header
 * nên `sameSite` cookie là lớp phòng thủ DUY NHẤT nếu không có middleware này).
 *
 * CƠ CHẾ:
 *  1. Khi login/refresh thành công, server set thêm 1 cookie KHÔNG httpOnly
 *     tên "XSRF-TOKEN" chứa giá trị random.
 *  2. Frontend đọc cookie này bằng JS, gắn vào header `X-CSRF-Token` cho
 *     mọi request state-changing (POST/PUT/PATCH/DELETE).
 *  3. Middleware này so sánh giá trị cookie và header — chỉ khớp thì mới
 *     cho qua. Same-origin policy đảm bảo site khác không thể ĐỌC được
 *     cookie này để gắn vào header giả mạo (dù cookie vẫn tự động gửi kèm
 *     request cross-site do CSRF, kẻ tấn công không đọc được giá trị để
 *     set header đúng).
 *
 * CÁCH DÙNG:
 *   import { issueCsrfCookie, verifyCsrfToken } from "./middlewares/csrf.middleware.js";
 *
 *   // Trong route login/refresh-token, SAU KHI set refresh-token cookie:
 *   issueCsrfCookie(res);
 *
 *   // Áp middleware verifyCsrfToken cho toàn bộ app (sau cookie-parser),
 *   // hoặc chỉ cho nhóm route auth nhạy cảm:
 *   app.use(verifyCsrfToken);
 *   // hoặc:
 *   router.post("/refresh-token", verifyCsrfToken, controller.refreshToken);
 *   router.post("/logout", verifyCsrfToken, controller.logout);
 */

import crypto from "crypto";
import { env } from "../config/env.config.js";

export const CSRF_COOKIE_NAME = "XSRF-TOKEN";
export const CSRF_HEADER_NAME = "x-csrf-token";

// GET/HEAD/OPTIONS không thay đổi state -> không cần kiểm tra CSRF.
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

// Các route công khai không cần cookie CSRF trước đó (chưa từng có session):
// login, register, forgot-password — không có gì để "giả mạo" vì chưa xác thực,
// và bắt buộc CSRF ở đây sẽ chặn cả các API client hợp lệ (mobile app, Postman...).
const CSRF_EXEMPT_PATHS = new Set([
    "/api/v1/auth/login",
    "/api/v1/auth/register",
    "/api/v1/auth/forgot-password",
    "/api/v1/auth/reset-password",
    "/api/v1/auth/verify-email",
    "/api/v1/auth/resend-verification",
    "/api/v1/auth/mfa/login-verify",
    "/api/v1/auth/mfa/setup",
    "/api/v1/auth/mfa/enable",
]);

/**
 * So sánh 2 chuỗi theo kiểu timing-safe để tránh timing attack dò từng ký tự.
 */
const timingSafeStringCompare = (a, b) => {
    if (typeof a !== "string" || typeof b !== "string") return false;
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
};

/**
 * Sinh và set cookie CSRF token mới.
 * Gọi ngay sau khi set refresh-token cookie (login, refresh-token thành công).
 *
 * @param {Response} res Express response
 * @returns {string} Token vừa sinh (hữu ích nếu muốn trả luôn trong response body)
 */
export const issueCsrfCookie = (res) => {
    const token = crypto.randomBytes(32).toString("hex");

    res.cookie(CSRF_COOKIE_NAME, token, {
        httpOnly: false, // Bắt buộc: frontend JS cần đọc được để gắn vào header
        secure: env.nodeEnv === "production",
        sameSite: env.nodeEnv === "production" ? "strict" : "lax",
        path: "/",
        // Không set maxAge cố ý ngắn hơn refresh token — để cookie sống theo session browser,
        // được refresh lại giá trị mỗi lần refresh-token thành công.
    });

    return token;
};

/**
 * Xoá cookie CSRF (gọi kèm lúc logout / clear refresh-token cookie).
 *
 * @param {Response} res Express response
 */
export const clearCsrfCookie = (res) => {
    res.clearCookie(CSRF_COOKIE_NAME, { path: "/" });
};

/**
 * Middleware kiểm tra CSRF token cho các request state-changing.
 */
export const verifyCsrfToken = (req, res, next) => {
    if (SAFE_METHODS.has(req.method)) return next();
    if (CSRF_EXEMPT_PATHS.has(req.path)) return next();

    const cookieToken = req.cookies?.[CSRF_COOKIE_NAME];
    const headerToken = req.headers[CSRF_HEADER_NAME];

    if (!cookieToken || !headerToken || !timingSafeStringCompare(cookieToken, headerToken)) {
        return res.status(403).json({
            success: false,
            message: "Yêu cầu không hợp lệ (CSRF token thiếu hoặc không khớp)",
            code: "CSRF_TOKEN_INVALID",
        });
    }

    next();
};

export default {
    issueCsrfCookie,
    clearCsrfCookie,
    verifyCsrfToken,
    CSRF_COOKIE_NAME,
    CSRF_HEADER_NAME,
};
