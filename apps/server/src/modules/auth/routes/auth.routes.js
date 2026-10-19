/**
 * Tuyến đường Xác thực (Auth Routes)
 * 
 * @description Hệ thống các điểm cuối (Endpoints) phục vụ xác thực, quản lý phiên và bảo mật tài khoản.
 * Được phân tách rõ ràng thành hai nhóm:
 * 1. Public Routes: Các truy cập công khai (Đăng ký, Đăng nhập, Quên mật khẩu).
 * 2. Protected Routes: Các truy cập yêu cầu quyền hạn (Đổi mật khẩu, Quản lý thiết bị, Logout).
 */
import express from "express";
import { authController } from "../controllers/auth.controller.js";
import { validate } from "../../../middlewares/validator.middleware.js";
import { authValidator } from "../validators/auth.validator.js";
import { verifyToken } from "../../../middlewares/auth.middleware.js";
import {
  loginRateLimit,
  registerRateLimit,
  passwordResetRateLimit,
  strictRateLimit,
} from "../../../middlewares/rate-limit.middleware.js";

const router = express.Router();

// ════════════════════════════════════════
// CÁC ENDPOINT CÔNG KHAI (PUBLIC ROUTES)
// ════════════════════════════════════════

/**
 * @route   POST /api/v1/auth/register
 * @desc    Đăng ký tài khoản mới
 * @access  Public
 */
router.post(
  "/register",
  registerRateLimit,
  validate(authValidator.register),
  authController.register,
);

/**
 * @route   POST /api/v1/auth/login
 * @desc    Đăng nhập
 * @access  Public
 */
router.post(
  "/login",
  loginRateLimit,
  validate(authValidator.login),
  authController.login,
);

/**
 * @route   POST /api/v1/auth/forgot-password
 * @desc    Yêu cầu quên mật khẩu
 * @access  Public
 */
router.post(
  "/forgot-password",
  passwordResetRateLimit,
  validate(authValidator.forgotPassword),
  authController.forgotPassword,
);

/**
 * @route   POST /api/v1/auth/refresh-token
 * @desc    Làm mới Access Token bằng Refresh Token
 * @access  Public
 */
router.post(
  "/refresh-token",
  validate(authValidator.refreshToken),
  authController.refreshToken,
);

/**
 * @route   POST /api/v1/auth/reset-password
 * @desc    Đặt lại mật khẩu bằng token từ email
 * @access  Public
 */
router.post(
  "/reset-password",
  validate(authValidator.resetPassword),
  authController.resetPassword,
);

/**
 * @route   GET /api/v1/auth/verify-email/:token
 * @desc    Xác thực Email
 * @access  Public
 */
router.get("/verify-email/:token", authController.verifyEmail);

/**
 * @route   POST /api/v1/auth/resend-verification
 * @desc    Gửi lại email xác thực (Public route)
 * @access  Public
 */
router.post(
  "/resend-verification",
  strictRateLimit,
  validate(authValidator.resendVerification),
  authController.resendVerificationEmailByEmail,
);

/**
 * @route   POST /api/v1/auth/mfa/login-verify
 * @desc    Xác minh mã 2FA để hoàn tất đăng nhập
 * @access  Public
 */
router.post(
  "/mfa/login-verify",
  strictRateLimit,
  validate(authValidator.mfaLoginVerify),
  authController.verifyMfaLogin,
);

// ════════════════════════════════════════
// CÁC ENDPOINT CẦN XÁC THỰC (PROTECTED ROUTES)
// ════════════════════════════════════════

/**
 * @route   POST /api/v1/auth/logout
 * @desc    Đăng xuất
 * @access  Private
 */
router.post("/logout", verifyToken, authController.logout);

/**
 * @route   POST /api/v1/auth/logout-all
 * @desc    Đăng xuất khỏi tất cả các thiết bị
 * @access  Private
 */
router.post("/logout-all", verifyToken, authController.logoutAll);

/**
 * @route   GET /api/v1/auth/sessions
 * @desc    Lấy danh sách các phiên đăng nhập (thiết bị) đang hoạt động
 * @access  Private
 */
router.get("/sessions", verifyToken, authController.getSessions);

/**
 * @route   DELETE /api/v1/auth/sessions/:id
 * @desc    Thu hồi một phiên đăng nhập cụ thể
 * @access  Private
 */
router.delete("/sessions/:id", verifyToken, authController.revokeSession);

/**
 * @route   GET /api/v1/auth/me
 * @desc    Lấy thông tin tài khoản hiện tại
 * @access  Private
 */
router.get("/me", verifyToken, authController.getMe);

/**
 * @route   PUT /api/v1/auth/change-password
 * @desc    Đổi mật khẩu
 * @access  Private
 */
router.put(
  "/change-password",
  verifyToken,
  validate(authValidator.changePassword),
  authController.changePassword,
);

/**
 * @route   POST /api/v1/auth/send-verification-email
 * @desc    Gửi lại email xác thực (Cho user đã đăng nhập)
 * @access  Private
 */
router.post(
  "/send-verification-email",
  strictRateLimit,
  verifyToken,
  authController.resendVerificationEmail,
);

/**
 * @route   POST /api/v1/auth/mfa/setup
 * @desc    Khởi tạo cấu hình MFA (TOTP Secret)
 * @access  Private
 */
router.post("/mfa/setup", verifyToken, authController.setupMfa);

/**
 * @route   POST /api/v1/auth/mfa/enable
 * @desc    Kích hoạt MFA bằng mã OTP kiểm tra
 * @access  Private
 */
router.post(
  "/mfa/enable",
  verifyToken,
  validate(authValidator.mfaEnable),
  authController.enableMfa,
);

/**
 * @route   POST /api/v1/auth/mfa/disable
 * @desc    Hủy kích hoạt MFA
 * @access  Private
 */
router.post(
  "/mfa/disable",
  verifyToken,
  validate(authValidator.mfaDisable),
  authController.disableMfa,
);

export default router;
