/**
 * Dịch vụ Mật khẩu (Password Service)
 *
 * @description Xử lý các nghiệp vụ liên quan đến quản lý mật khẩu của người dùng.
 * Bao gồm: thay đổi mật khẩu (khi đã đăng nhập), yêu cầu quên mật khẩu (gửi email), và đặt lại mật khẩu bằng token bảo mật.
 */
import { Op } from "sequelize";
import { User } from "../../../models/index.js";
import { generateTokenPair } from "../../../utils/jwt.util.js";
import { sendEmail, emailTemplates } from "../../../config/email.config.js";
import { logger } from "../../../utils/logger.js";
import { clearUserCache } from "../../../middlewares/auth.middleware.js";
import {
  findSessionByToken,
  rotateSession,
  revokeAllUserSessions,
  revokeSession,
  getUserSessions,
} from "../helpers/session.helper.js";
import {
  hashPassword,
  verifyPasswordUniversal,
  isCommonPassword,
  isSimilarToUsername,
  generateSecureToken,
} from "../utils/security.util.js";
import { auditLogger } from "../utils/audit.logger.js";
import {
  PASSWORD_RESET_CONFIG,
  AUDIT_EVENTS,
  AUTH_ERROR_CODES,
} from "../../../constants/auth.constant.js";
import { v4 as uuidv4 } from "uuid";
import { createAuthError as createError } from "../utils/auth-error.util.js";
import events, { EVENTS } from "../../../utils/events.util.js";

export const passwordService = {
  /**
   * Thay đổi mật khẩu tài khoản
   *
   * @description Quy trình bao gồm:
   * 1. Xác thực mật khẩu hiện tại.
   * 2. Kiểm tra chính sách mật khẩu mới (Độ mạnh, trùng lặp).
   * 3. Cập nhật hash mới và tăng token_version (Vô hiệu hóa JWT cũ).
   * 4. Xử lý thu hồi phiên (Đăng xuất tất cả hoặc xoay vòng phiên hiện tại).
   *
   * @param {UUID} userId - ID người dùng
   * @param {string} currentPassword - Mật khẩu hiện tại
   * @param {string} newPassword - Mật khẩu mới
   * @param {Object} options - Tùy chọn (logoutAll, refreshToken, deviceInfo)
   * @returns {Promise<Object|null>} Bộ Token mới nếu giữ lại phiên, ngược lại trả về null
   */
  async changePassword(userId, currentPassword, newPassword, options = {}) {
    try {
      const user = await User.findByPk(userId);

      if (!user) {
        throw createError(
          "Không tìm thấy người dùng",
          404,
          AUTH_ERROR_CODES.INVALID_CREDENTIALS,
        );
      }

      // 1. Xác thực mật khẩu hiện tại
      const { valid } = await verifyPasswordUniversal(
        user.password_hash,
        currentPassword,
      );

      if (!valid) {
        auditLogger.log({
          event: AUDIT_EVENTS.PASSWORD_CHANGE,
          userId,
          metadata: { status: "failed", reason: "invalid_current_password" },
        });

        throw createError(
          "Mật khẩu hiện tại không đúng",
          400,
          AUTH_ERROR_CODES.PASSWORD_INCORRECT,
        );
      }

      // 2. Kiểm tra mật khẩu mới
      if (newPassword === currentPassword) {
        throw createError(
          "Mật khẩu mới phải khác mật khẩu hiện tại",
          400,
          AUTH_ERROR_CODES.PASSWORD_RECENTLY_USED,
        );
      }

      if (isCommonPassword(newPassword)) {
        throw createError(
          "Mật khẩu này quá phổ biến và không an toàn",
          400,
          AUTH_ERROR_CODES.PASSWORD_COMMON,
        );
      }

      if (isSimilarToUsername(newPassword, user.username)) {
        throw createError(
          "Mật khẩu không được giống tên đăng nhập",
          400,
          AUTH_ERROR_CODES.PASSWORD_SIMILAR_TO_USERNAME,
        );
      }

      // 3. Băm mật khẩu mới và cập nhật
      const hashedPassword = await hashPassword(newPassword);

      // Tăng token_version để vô hiệu hóa tất cả JWT cũ ngay lập tức
      await user.update({
        password_hash: hashedPassword,
        password_reset_token: null,
        password_reset_expires: null,
        login_attempts: 0,
        locked_until: null,
        token_version: (user.token_version || 1) + 1,
      });
      await clearUserCache(userId);

      // 4. Xử lý thu hồi phiên đăng nhập dựa trên tùy chọn
      const { logoutAll = true, refreshToken, deviceInfo } = options;

      // TH1: Đăng xuất khỏi TẤT CẢ các thiết bị
      if (logoutAll) {
        await revokeAllUserSessions(userId, "password_change");
        await clearUserCache(userId);

        events.emit(EVENTS.AUTH.PASSWORD_CHANGED, {
          userId,
          action: "logout_all",
        });

        auditLogger.log({
          event: AUDIT_EVENTS.PASSWORD_CHANGE,
          userId,
          metadata: {
            status: "success",
            action: "logout_all",
            newTokenVersion: user.token_version,
          },
        });

        return null;
      }

      // TH2: Giữ lại phiên hiện tại (xoay vòng token) và thu hồi các thiết bị khác
      let newTokens = null;

      if (refreshToken) {
        const currentSession = await findSessionByToken(refreshToken);

        if (
          currentSession &&
          !currentSession.is_revoked &&
          currentSession.user_id === userId
        ) {
          const newSessionId = uuidv4();
          const rememberMe = currentSession.device_info?.rememberMe || false;
          newTokens = {
            ...generateTokenPair(user, { sessionId: newSessionId, rememberMe }),
            rememberMe,
          };

          // Rotate: Thu hồi phiên cũ, tạo phiên mới cho thiết bị hiện tại
          await rotateSession(
            currentSession,
            newTokens.refreshToken,
            deviceInfo,
            newSessionId,
          );

          // Thu hồi tất cả các phiên KHÁC
          const allSessions = await getUserSessions(userId);
          const revokedIds = [];
          const promises = allSessions
            .filter((s) => s.id !== newSessionId)
            .map((s) => {
              revokedIds.push(s.id);
              return revokeSession(s.id, "password_change_other");
            });

          await Promise.all(promises);

          events.emit(EVENTS.AUTH.PASSWORD_CHANGED, {
            userId,
            action: "keep_current_session",
            keepSessionId: newSessionId,
            revokedSessionIds: revokedIds,
          });

          auditLogger.log({
            event: AUDIT_EVENTS.PASSWORD_CHANGE,
            userId,
            metadata: {
              status: "success",
              action: "keep_current_session",
              keptSessionId: newSessionId,
              newTokenVersion: user.token_version,
            },
          });

          return newTokens;
        }
      }

      // Fallback: Nếu không có token hoặc phiên không hợp lệ, đăng xuất tất cả
      await revokeAllUserSessions(userId, "password_change_fallback");
      await clearUserCache(userId);

      events.emit(EVENTS.AUTH.PASSWORD_CHANGED, {
        userId,
        action: "logout_all",
      });

      return null;
    } catch (error) {
      if (error.statusCode) throw error;

      logger.error("[AuthService] Lỗi đổi mật khẩu:", error);
      throw createError(
        "Đổi mật khẩu thất bại",
        500,
        AUTH_ERROR_CODES.INTERNAL_ERROR,
      );
    }
  },

  /**
   * Xử lý yêu cầu quên mật khẩu
   * @description Gửi email chứa liên kết đặt lại mật khẩu kèm theo token bảo mật có thời hạn.
   *
   * @param {string} email - Địa chỉ email của người dùng
   */
  async forgotPassword(email) {
    try {
      const user = await User.findOne({ where: { email } });

      // Luôn trả về thành công vì lý do bảo mật (tránh lộ thông tin email có tồn tại hay không)
      if (!user) {
        logger.info(
          `[Auth] Yêu cầu reset mật khẩu cho email không tồn tại: ${email}`,
        );
        return;
      }

      const resetToken = generateSecureToken(
        PASSWORD_RESET_CONFIG.TOKEN_LENGTH,
      );
      const resetExpires = new Date(
        Date.now() + PASSWORD_RESET_CONFIG.TOKEN_EXPIRY,
      );

      await user.update({
        password_reset_token: resetToken,
        password_reset_expires: resetExpires,
      });

      const emailData = {
        name: user.full_name || user.username,
        resetUrl: `${process.env.CLIENT_URL || "http://localhost:3000"}/reset-password?token=${resetToken}`,
        expiryMinutes: PASSWORD_RESET_CONFIG.TOKEN_EXPIRY / 60000,
      };

      sendEmail({
        to: email,
        ...emailTemplates.passwordReset(emailData),
      })
        .then(() => {
          auditLogger.log({
            event: AUDIT_EVENTS.PASSWORD_RESET_REQUEST,
            userId: user.id,
            metadata: { email },
          });
        })
        .catch((err) => {
          logger.error("Gửi email reset mật khẩu thất bại:", err);
        });
    } catch (error) {
      logger.error("[AuthService] Lỗi yêu cầu quên mật khẩu:", error);
    }
  },

  /**
   * Đặt lại mật khẩu bằng Token bảo mật
   * @description Xác thực token, kiểm tra mật khẩu mới và thu hồi toàn bộ phiên đăng nhập cũ.
   *
   * @param {string} token - Token đặt lại mật khẩu (từ email)
   * @param {string} newPassword - Mật khẩu mới người dùng nhập
   * @returns {Promise<boolean>}
   */
  async resetPassword(token, newPassword) {
    try {
      const user = await User.findOne({
        where: {
          password_reset_token: token,
          password_reset_expires: { [Op.gt]: new Date() },
        },
      });

      if (!user) {
        auditLogger.log({
          event: AUDIT_EVENTS.PASSWORD_RESET_FAILED,
          metadata: { reason: "invalid_token" },
        });

        throw createError(
          "Token không hợp lệ hoặc đã hết hạn",
          400,
          AUTH_ERROR_CODES.TOKEN_INVALID,
        );
      }

      // 1. Kiểm tra độ an toàn của mật khẩu mới
      if (isCommonPassword(newPassword)) {
        throw createError(
          "Mật khẩu này quá phổ biến và không an toàn",
          400,
          AUTH_ERROR_CODES.PASSWORD_COMMON,
        );
      }

      if (isSimilarToUsername(newPassword, user.username)) {
        throw createError(
          "Mật khẩu không được giống tên đăng nhập",
          400,
          AUTH_ERROR_CODES.PASSWORD_SIMILAR_TO_USERNAME,
        );
      }

      // 2. Băm và cập nhật mật khẩu
      const hashedPassword = await hashPassword(newPassword);

      await user.update({
        password_hash: hashedPassword,
        password_reset_token: null,
        password_reset_expires: null,
        login_attempts: 0,
        locked_until: null,
        token_version: (user.token_version || 1) + 1,
      });

      // 3. Thu hồi toàn bộ phiên cũ khi đặt lại mật khẩu thành công
      await revokeAllUserSessions(user.id, "password_reset");
      await clearUserCache(user.id);

      events.emit(EVENTS.AUTH.PASSWORD_CHANGED, {
        userId: user.id,
        action: "logout_all",
      });

      auditLogger.log({
        event: AUDIT_EVENTS.PASSWORD_RESET_COMPLETE,
        userId: user.id,
        metadata: { newTokenVersion: user.token_version },
      });

      return true;
    } catch (error) {
      if (error.statusCode) throw error;

      logger.error("[AuthService] Lỗi đặt lại mật khẩu:", error);
      throw createError(
        "Đặt lại mật khẩu thất bại",
        500,
        AUTH_ERROR_CODES.INTERNAL_ERROR,
      );
    }
  },
};

export default passwordService;
