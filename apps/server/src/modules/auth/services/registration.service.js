/**
 * Dịch vụ Đăng ký (Registration Service)
 *
 * @description Xử lý logic đăng ký tài khoản mới và xác thực Email cho người dùng.
 * Đảm bảo tính toàn vẹn dữ liệu thông qua Transaction (User, Role, Wallet, Subscription) và thực hiện các kiểm tra bảo mật nghiêm ngặt.
 */
import { Op } from "sequelize";
import {
  User,
  Role,
  MembershipPlan,
  Subscription,
  Wallet,
  sequelize,
} from "../../../models/index.js";
import { sendEmail, emailTemplates } from "../../../config/email.config.js";
import { logger } from "../../../utils/logger.js";
import { generateTokenPair } from "../../../utils/jwt.util.js";
import {
  createSession,
  generateTokenFamily,
} from "../helpers/session.helper.js";
import {
  hashPassword,
  isCommonPassword,
  isSimilarToUsername,
  generateSecureToken,
  hashToken,
} from "../utils/security.util.js";
import { auditLogger } from "../utils/audit.logger.js";
import {
  EMAIL_VERIFICATION_CONFIG,
  AUDIT_EVENTS,
  AUTH_ERROR_CODES,
} from "../../../constants/auth.constant.js";
import { v4 as uuidv4 } from "uuid";
import { createAuthError as createError } from "../utils/auth-error.util.js";
import events, { EVENTS } from "../../../utils/events.util.js";

export const registrationService = {
  /**
   * Đăng ký tài khoản người dùng mới
   *
   * @description Quy trình đăng ký bao gồm:
   * 1. Kiểm tra trùng lặp (Email/Username).
   * 2. Kiểm tra chính sách mật khẩu (Độ mạnh, phổ biến).
   * 3. Mã hóa mật khẩu và tạo token xác thực.
   * 4. Tạo các bản ghi liên quan (Transaction): User, Role, Wallet, Subscription.
   * 5. Gửi email xác thực cho người dùng.
   *
   * @param {Object} data - Thông tin đăng ký (username, email, password, full_name)
   * @param {Object} deviceInfo - Thông tin thiết bị của người dùng
   * @returns {Promise<Object>} Thông báo trạng thái đăng ký
   */
  async register({ username, email, password, full_name }, deviceInfo = {}) {
    try {
      // 1. Kiểm tra sự tồn tại của Email hoặc Username
      const existing = await User.findOne({
        where: {
          [Op.or]: [{ email }, { username }],
        },
      });

      if (existing) {
        const isEmail = existing.email === email;
        const field = isEmail ? "email" : "username";
        const message = isEmail
          ? "Email này đã được đăng ký"
          : "Tên đăng nhập đã tồn tại";
        const errorCode = isEmail
          ? AUTH_ERROR_CODES.EMAIL_ALREADY_EXISTS
          : AUTH_ERROR_CODES.USERNAME_ALREADY_EXISTS;

        auditLogger.log({
          event: AUDIT_EVENTS.REGISTER_FAILED,
          metadata: {
            reason: "duplicate",
            field: field,
            email,
            username,
          },
          ip: deviceInfo.ip,
          userAgent: deviceInfo.userAgent,
        });

        throw createError(message, 400, errorCode);
      }

      // 2. Kiểm tra độ mạnh mật khẩu
      if (isCommonPassword(password)) {
        auditLogger.log({
          event: AUDIT_EVENTS.REGISTER_FAILED,
          metadata: { reason: "common_password", email, username },
          ip: deviceInfo.ip,
        });

        throw createError(
          "Mật khẩu này quá phổ biến và không an toàn",
          400,
          AUTH_ERROR_CODES.PASSWORD_COMMON,
        );
      }

      if (isSimilarToUsername(password, username)) {
        auditLogger.log({
          event: AUDIT_EVENTS.REGISTER_FAILED,
          metadata: { reason: "password_similar_to_username", username },
          ip: deviceInfo.ip,
        });

        throw createError(
          "Mật khẩu không được giống tên đăng nhập",
          400,
          AUTH_ERROR_CODES.PASSWORD_SIMILAR_TO_USERNAME,
        );
      }

      // 3. Chuẩn bị dữ liệu bảo mật
      const hashedPassword = await hashPassword(password);
      const verificationToken = generateSecureToken(
        EMAIL_VERIFICATION_CONFIG.TOKEN_LENGTH,
      );
      const hashedVerificationToken = hashToken(verificationToken);

      // 4. Thực hiện tạo các bản ghi trong một Transaction
      const result = await sequelize.transaction(async (t) => {
        // Lấy vai trò mặc định (user)
        const userRole = await Role.findOne({
          where: { slug: "user" },
          transaction: t,
        });

        if (!userRole) {
          throw createError("Lỗi hệ thống: Vai trò mặc định không tồn tại", 500, AUTH_ERROR_CODES.INTERNAL_ERROR);
        }

        // Tạo User
        const user = await User.create(
          {
            username,
            email,
            password_hash: hashedPassword,
            full_name: full_name || null,
            verification_token: hashedVerificationToken,
            status: "pending",
            is_verified: false,
            token_version: 1,
            role_id: userRole.id,
          },
          { transaction: t },
        );

        // Tự động gán gói hội viên Miễn phí
        const freePlan = await MembershipPlan.findOne({
          where: { slug: "mien-phi" },
          transaction: t,
        });

        if (freePlan) {
          const startsAt = new Date();
          const expiresAt = new Date(startsAt);
          expiresAt.setDate(
            expiresAt.getDate() + (freePlan.duration_days || 36500),
          );

          await Subscription.create(
            {
              user_id: user.id,
              plan_id: freePlan.id,
              tier: freePlan.tier,
              status: "pending",
              starts_at: startsAt,
              expires_at: expiresAt,
              amount: 0,
              amount_paid: 0,
              currency: freePlan.currency || "VND",
              payment_method: "free",
              auto_renew: true,
            },
            { transaction: t },
          );
        } else {
          logger.warn(
            `[AuthRegistration] Gói 'mien-phi' không tồn tại. Không thể gán cho user ${user.id}`,
          );
        }

        // Khởi tạo ví S-Coin
        await Wallet.create(
          {
            user_id: user.id,
            balance: 0,
            total_deposited: 0,
            total_spent: 0,
            total_received: 0,
            is_locked: false,
          },
          { transaction: t },
        );

        return user;
      });

      const user = result;

      // ════════════════════════════════════════
      // 5. GỬI EMAIL XÁC THỰC (NON-BLOCKING)
      // ════════════════════════════════════════
      const emailData = {
        name: full_name || username,
        verifyUrl: `${process.env.CLIENT_URL || "http://localhost:3000"}/verify-email?token=${verificationToken}`,
      };

      sendEmail({
        to: email,
        ...emailTemplates.verification(emailData),
      })
        .then(() => {
          auditLogger.log({
            event: AUDIT_EVENTS.EMAIL_VERIFICATION_SENT,
            userId: user.id,
            metadata: { email },
          });
        })
        .catch((err) => {
          logger.error("Gửi email xác thực thất bại:", err);
        });

      // ════════════════════════════════════════
      // 6. GHI NHẬT KÝ THÀNH CÔNG (AUDIT LOG)
      // ════════════════════════════════════════
      auditLogger.log({
        event: AUDIT_EVENTS.REGISTER_SUCCESS,
        userId: user.id,
        metadata: { username, email },
        ip: deviceInfo.ip,
        userAgent: deviceInfo.userAgent,
      });

      return {
        status: "pending_verification",
        message:
          "Nếu thông tin hợp lệ, chúng tôi đã gửi email xác thực. Vui lòng kiểm tra hộp thư.",
      };
    } catch (error) {
      if (error.statusCode) throw error;

      logger.error("[AuthService] Lỗi đăng ký:", error);
      auditLogger.log({
        event: AUDIT_EVENTS.REGISTER_FAILED,
        metadata: { error: error.message, username, email },
        ip: deviceInfo.ip,
      });

      throw createError(
        "Đăng ký thất bại",
        500,
        AUTH_ERROR_CODES.INTERNAL_ERROR,
      );
    }
  },

  /**
   * Xác thực Email của người dùng
   *
   * @description Kích hoạt tài khoản, cập nhật trạng thái subscription và tự động đăng nhập người dùng.
   *
   * @param {string} token - Token xác thực nhận được từ email
   * @param {Object} deviceInfo - Thông tin thiết bị hiện tại
   * @returns {Promise<Object>} Thông tin người dùng và bộ Token truy cập
   */
  async verifyEmail(token, deviceInfo = {}) {
    try {
      const hashedToken = hashToken(token);

      const user = await User.findOne({
        where: { verification_token: hashedToken },
      });

      if (!user) {
        auditLogger.log({
          event: AUDIT_EVENTS.EMAIL_VERIFIED,
          metadata: { status: "failed", reason: "invalid_token" },
        });

        throw createError(
          "Token xác thực không hợp lệ",
          400,
          AUTH_ERROR_CODES.TOKEN_INVALID,
        );
      }

      // Cập nhật trạng thái trong Transaction
      await sequelize.transaction(async (t) => {
        await user.update(
          {
            is_verified: true,
            status: "active",
            email_verified_at: new Date(),
            verification_token: null,
          },
          { transaction: t },
        );

        // Kích hoạt gói hội viên đang chờ
        const pendingSub = await Subscription.findOne({
          where: {
            user_id: user.id,
            status: "pending",
          },
          transaction: t,
        });

        if (pendingSub) {
          await pendingSub.update({ status: "active" }, { transaction: t });
        }
      });

      auditLogger.log({
        event: AUDIT_EVENTS.EMAIL_VERIFIED,
        userId: user.id,
        metadata: { email: user.email },
      });

      // Tải lại user kèm theo các thông tin mở rộng
      await user.reload({
        include: [
          {
            model: Role,
            as: "role",
            attributes: ["id", "slug", "name"],
          },
          {
            model: Subscription,
            as: "subscriptions",
            where: { status: "active" },
            required: false,
            include: [
              {
                model: MembershipPlan,
                as: "plan",
                attributes: ["id", "slug", "name", "badge_color", "features"],
              },
            ],
          },
        ],
      });

      // Tự động đăng nhập sau khi xác thực thành công
      const sessionId = uuidv4();
      const tokens = generateTokenPair(user, { sessionId });
      const tokenFamily = generateTokenFamily();

      await createSession(
        user.id,
        tokens.refreshToken,
        tokenFamily,
        deviceInfo,
        false,
        sessionId,
      );

      // Phát sự kiện để thực hiện các nghiệp vụ phụ trợ (Gửi thông báo mừng,...)
      events.emit(EVENTS.AUTH.EMAIL_VERIFIED, {
        userId: user.id,
        username: user.username,
        fullName: user.full_name,
      });

      return {
        user: user.toSafeJSON(),
        ...tokens,
      };
    } catch (error) {
      if (error.statusCode) throw error;

      logger.error("[AuthService] Lỗi xác thực email:", error);
      throw createError(
        "Xác thực email thất bại",
        500,
        AUTH_ERROR_CODES.INTERNAL_ERROR,
      );
    }
  },

  /**
   * Gửi lại Email xác thực (Dành cho người dùng đã đăng nhập)
   *
   * @param {UUID} userId - ID của người dùng
   */
  async resendVerificationEmail(userId) {
    const user = await User.findByPk(userId);
    if (!user) {
      throw createError(
        "Người dùng không tồn tại",
        404,
        AUTH_ERROR_CODES.USER_NOT_FOUND,
      );
    }

    if (user.is_verified) {
      throw createError(
        "Email đã được xác thực trước đó",
        400,
        "EMAIL_ALREADY_VERIFIED",
      );
    }

    // Tạo token mới
    const verificationToken = generateSecureToken(
      EMAIL_VERIFICATION_CONFIG.TOKEN_LENGTH,
    );
    const hashedVerificationToken = hashToken(verificationToken);

    user.verification_token = hashedVerificationToken;
    await user.save();

    const emailData = {
      name: user.full_name || user.username,
      verifyUrl: `${process.env.CLIENT_URL || "http://localhost:3000"}/verify-email?token=${verificationToken}`,
    };

    sendEmail({
      to: user.email,
      ...emailTemplates.verification(emailData),
    }).catch((err) => {
      logger.error(
        `[Auth] Không thể gửi lại email xác thực cho ${user.email}:`,
        err,
      );
    });
  },

  /**
   * Gửi lại Email xác thực bằng địa chỉ Email (Dành cho người dùng chưa đăng nhập)
   *
   * @param {string} email - Địa chỉ email cần gửi lại
   */
  async resendVerificationEmailByEmail(email) {
    const user = await User.findOne({ where: { email } });

    // Không báo lỗi trực tiếp nếu email không tồn tại (tránh bị lộ danh sách email)
    if (!user) {
      logger.info(
        `[Auth] Yêu cầu gửi lại xác thực cho email không tồn tại: ${email}`,
      );
      return;
    }

    if (user.is_verified) {
      throw createError(
        "Email đã được xác thực trước đó",
        400,
        "EMAIL_ALREADY_VERIFIED",
      );
    }

    const verificationToken = generateSecureToken(
      EMAIL_VERIFICATION_CONFIG.TOKEN_LENGTH,
    );
    const hashedVerificationToken = hashToken(verificationToken);

    user.verification_token = hashedVerificationToken;
    await user.save();

    const emailData = {
      name: user.full_name || user.username,
      verifyUrl: `${process.env.CLIENT_URL || "http://localhost:3000"}/verify-email?token=${verificationToken}`,
    };

    sendEmail({
      to: user.email,
      ...emailTemplates.verification(emailData),
    }).catch((err) => {
      logger.error(
        `[Auth] Không thể gửi lại email xác thực bằng email cho ${user.email}:`,
        err,
      );
    });
  },
};

export default registrationService;
