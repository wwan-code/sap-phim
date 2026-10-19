/**
 * Dịch vụ Đăng nhập & Phiên (Login Service)
 * 
 * @description Xử lý logic đăng nhập, quản lý phiên làm việc (Session) và bảo mật người dùng.
 * Bao gồm các tính năng bảo mật nâng cao: khóa tài khoản lũy tiến, phát hiện đăng nhập bất thường, giới hạn thiết bị theo gói hội viên và tích hợp Cache.
 */
import { Op } from "sequelize";
import { User, Role, Subscription, MembershipPlan, Wallet, Permission } from "../../../models/index.js";
import { generateTokenPair, generateAccessToken } from "../../../utils/jwt.util.js";
import { logger } from "../../../utils/logger.js";
import {
  blacklistToken,
  clearUserCache,
} from "../../../middlewares/auth.middleware.js";
import {
  createSession,
  generateTokenFamily,
  revokeAllUserSessions,
  revokeSession,
  clearDeviceSessions,
  getUserSessions,
  getRecentSessionsForAnalysis,
  revokeSessionByToken,
  formatSessionName,
} from "../helpers/session.helper.js";
import { resolveLocation } from "../services/location.service.js";
import { deviceTrustService } from "./device-trust.service.js";
import {
  analyzeLoginAttempt,
  getActionMessage,
} from "../services/anomaly-detector.service.js";
import {
  hashPassword,
  verifyPasswordUniversal,
  hashToken,
  generateSecureToken,
} from "../utils/security.util.js";
import { mfaService } from "./mfa.service.js";
import { auditLogger } from "../utils/audit.logger.js";
import {
  ACCOUNT_LOCKOUT,
  AUDIT_EVENTS,
  AUTH_ERROR_CODES,
} from "../../../constants/auth.constant.js";
import { v4 as uuidv4 } from "uuid";
import { createAuthError as createError } from "../utils/auth-error.util.js";
import events, { EVENTS } from "../../../utils/events.util.js";
import { cacheHelper } from "../../../config/redis.config.js";

// ════════════════════════════════════════
// CẤU HÌNH LIÊN KẾT (USER INCLUDE CONFIG)
// ════════════════════════════════════════
/**
 * Cấu hình các quan hệ cần tải kèm theo User để đồng bộ dữ liệu trả về
 */
const USER_PROFILE_INCLUDE = [
  {
    model: Role,
    as: "role",
    attributes: ["id", "slug", "name"],
    include: [
      {
        model: Permission,
        as: "permissions",
        attributes: ["slug", "name"],
        through: { attributes: [] },
      },
    ],
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
  {
    model: Wallet,
    as: "wallet",
    attributes: ["balance", "is_locked", "total_deposited", "total_spent", "total_received", "locked_reason"],
  },
];

// ════════════════════════════════════════
// TIỆN ÍCH KHÓA TÀI KHOẢN (LOCKOUT UTILS)
// ════════════════════════════════════════
/**
 * Tính toán thời gian khóa tài khoản lũy tiến
 * Thời gian khóa sẽ tăng gấp đôi sau mỗi lần bị khóa liên tiếp để chống Brute-force.
 * @param {number} lockCount - Số lần đã bị khóa
 * @returns {number} Thời gian khóa (ms)
 */
const calculateLockoutDuration = (lockCount) => {
  if (!ACCOUNT_LOCKOUT.PROGRESSIVE_DELAY) {
    return ACCOUNT_LOCKOUT.LOCKOUT_DURATION;
  }

  const duration =
    ACCOUNT_LOCKOUT.LOCKOUT_DURATION *
    Math.pow(ACCOUNT_LOCKOUT.PROGRESSIVE_MULTIPLIER, lockCount - 1);

  return Math.min(duration, ACCOUNT_LOCKOUT.MAX_LOCKOUT_DURATION);
};

// ════════════════════════════════════════
// GIAO DIỆN ĐĂNG NHẬP (LOGIN SERVICE API)
// ════════════════════════════════════════
export const loginService = {
  /**
   * Thực hiện đăng nhập vào hệ thống
   * 
   * @description Quy trình: 
   * 1. Kiểm tra tài khoản & trạng thái (Banned, Inactive).
   * 2. Kiểm tra khóa tài khoản tạm thời.
   * 3. Xác thực mật khẩu (Hỗ trợ migration hash).
   * 4. Phân tích bảo mật (Vị trí, thiết bị, tần suất).
   * 5. Quản lý thiết bị (Vượt giới hạn sẽ thu hồi phiên cũ nhất).
   * 6. Tạo Token & Phiên đăng nhập mới.
   * 
   * @param {Object} credentials - Thông tin đăng nhập (identifier, password, rememberMe)
   * @param {Object} deviceInfo - Thông tin thiết bị thực hiện yêu cầu
   * @returns {Promise<Object>} Thông tin người dùng, bộ token và cảnh báo bảo mật
   */
  async login(
    { email, identifier, password, rememberMe = false },
    deviceInfo = {},
  ) {
    try {
      const loginId = identifier || email;

      // 1. Tìm người dùng
      const user = await User.findOne({
        where: {
          [Op.or]: [{ email: loginId }, { username: loginId }],
        },
        include: USER_PROFILE_INCLUDE,
      });

      if (!user) {
        // Tránh timing attack bằng cách giả vờ băm mật khẩu ngay cả khi không tìm thấy user
        await hashPassword(password);

        auditLogger.log({
          event: AUDIT_EVENTS.LOGIN_FAILED,
          metadata: { reason: "user_not_found", identifier: loginId },
          ip: deviceInfo.ip,
          userAgent: deviceInfo.userAgent,
        });

        throw createError(
          "Tài khoản hoặc mật khẩu không đúng",
          401,
          AUTH_ERROR_CODES.INVALID_CREDENTIALS,
        );
      }

      // 2. Kiểm tra trạng thái tài khoản
      if (user.status === "banned") {
        auditLogger.log({
          event: AUDIT_EVENTS.LOGIN_FAILED,
          userId: user.id,
          metadata: { reason: "account_banned" },
          ip: deviceInfo.ip,
        });

        throw createError(
          "Tài khoản đã bị khóa",
          403,
          AUTH_ERROR_CODES.ACCOUNT_BANNED,
        );
      }

      if (user.status === "inactive") {
        auditLogger.log({
          event: AUDIT_EVENTS.LOGIN_FAILED,
          userId: user.id,
          metadata: { reason: "account_inactive" },
          ip: deviceInfo.ip,
        });

        throw createError(
          "Tài khoản của bạn đã bị vô hiệu hóa",
          403,
          AUTH_ERROR_CODES.ACCOUNT_INACTIVE,
        );
      }

      if (user.status === "pending" || !user.is_verified) {
        auditLogger.log({
          event: AUDIT_EVENTS.LOGIN_FAILED,
          userId: user.id,
          metadata: { reason: "account_unverified" },
          ip: deviceInfo.ip,
        });

        throw createError(
          "Tài khoản chưa được xác thực. Vui lòng kiểm tra email.",
          403,
          AUTH_ERROR_CODES.EMAIL_NOT_VERIFIED,
        );
      }

      // 3. Kiểm tra xem tài khoản có đang bị khóa tạm thời không
      if (user.locked_until && user.locked_until > new Date()) {
        const minutesLeft = Math.ceil((user.locked_until - new Date()) / 60000);

        auditLogger.log({
          event: AUDIT_EVENTS.LOGIN_FAILED,
          userId: user.id,
          metadata: { reason: "account_locked", minutesLeft },
          ip: deviceInfo.ip,
        });

        throw createError(
          `Tài khoản tạm khóa do đăng nhập sai quá nhiều lần. Vui lòng thử lại sau ${minutesLeft} phút`,
          423,
          AUTH_ERROR_CODES.ACCOUNT_LOCKED,
        );
      }

      // 4. Xác thực mật khẩu (Hỗ trợ cả Argon2 và Bcrypt migration)
      const { valid, needsRehash } = await verifyPasswordUniversal(
        user.password_hash,
        password,
      );

      if (!valid) {
        const attempts = (user.login_attempts || 0) + 1;
        const lockCount = user.lock_count || 0;
        const updateData = { login_attempts: attempts };

        // Xử lý khóa tài khoản nếu vượt quá số lần thử
        if (attempts >= ACCOUNT_LOCKOUT.MAX_FAILED_ATTEMPTS) {
          const lockoutDuration = calculateLockoutDuration(lockCount + 1);
          updateData.locked_until = new Date(Date.now() + lockoutDuration);
          updateData.login_attempts = 0;
          updateData.lock_count = lockCount + 1;

          auditLogger.log({
            event: AUDIT_EVENTS.ACCOUNT_LOCKED,
            userId: user.id,
            metadata: {
              attempts,
              lockCount: lockCount + 1,
              lockoutDuration: lockoutDuration / 60000,
            },
            ip: deviceInfo.ip,
          });
        }

        await user.update(updateData);

        auditLogger.log({
          event: AUDIT_EVENTS.LOGIN_FAILED,
          userId: user.id,
          metadata: { reason: "invalid_password", attempts },
          ip: deviceInfo.ip,
        });

        throw createError(
          "Tài khoản hoặc mật khẩu không đúng",
          401,
          AUTH_ERROR_CODES.INVALID_CREDENTIALS,
        );
      }

      // Tự động nâng cấp hash mật khẩu lên Argon2 nếu cần
      if (needsRehash) {
        const newHash = await hashPassword(password);
        await user.update({ password_hash: newHash });
        logger.info(`[Auth] Cập nhật hash mật khẩu mới cho user ${user.id}`);
      }

      // Reset số lần thử và cập nhật trạng thái online
      await user.update({
        login_attempts: 0,
        locked_until: null,
        last_login_at: new Date(),
        is_online: true,
        last_online: new Date(),
      });

      // 5. Phân tích bảo mật và phát hiện bất thường
      const locationResult = await resolveLocation(deviceInfo, deviceInfo.ip);
      const recentSessions = await getRecentSessionsForAnalysis(user.id);

      const anomalyResult = await analyzeLoginAttempt({
        userId: user.id,
        deviceInfo,
        currentLocation: locationResult,
        recentSessions,
        user,
      });

      if (anomalyResult.action === "block_and_alert") {
        throw createError(
          "Đăng nhập bị chặn do phát hiện hoạt động bất thường. Vui lòng kiểm tra email.",
          403,
          AUTH_ERROR_CODES.ACCOUNT_LOCKED,
        );
      }
      // 5.5 Kiểm tra yêu cầu xác thực đa yếu tố (MFA / 2FA)
      const isMfaEnabled = user.two_factor_enabled;
      const isUserAdminOrBoss = user.role && (user.role.slug === "admin" || user.role.slug === "boss");
      const isMfaRequired = isMfaEnabled || isUserAdminOrBoss;

      if (isMfaRequired) {
        if (!isMfaEnabled) {
          // Bắt buộc quản trị viên phải thiết lập 2FA. Sinh accessToken tạm thời chỉ cho phép setup/enable.
          const tempToken = generateAccessToken({
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role?.slug || null,
            tokenVersion: user.token_version || 1,
            isMfaSetupPending: true,
          });
          return {
            status: "mfa_setup_required",
            message: "Tài khoản quản trị viên yêu cầu cấu hình MFA để bảo mật. Vui lòng thiết lập.",
            userId: user.id,
            accessToken: tempToken,
          };
        }

        // Tạo mfa ticket để gửi kèm khi verify mã OTP
        const mfaToken = generateSecureToken(32);
        await cacheHelper.set(`mfa_ticket:${mfaToken}`, { userId: user.id, deviceInfo, rememberMe }, 300);

        return {
          status: "mfa_required",
          message: "Tài khoản của bạn đã kích hoạt bảo mật hai yếu tố (2FA). Vui lòng nhập mã xác thực.",
          mfaToken,
        };
      }
      // 6. Tạo Token và Phiên đăng nhập
      const sessionId = uuidv4();
      const tokens = generateTokenPair(user, { rememberMe, sessionId });
      const tokenFamily = generateTokenFamily();

      // Xóa các phiên cũ cùng thiết bị (User Agent) để tránh lãng phí
      if (deviceInfo.userAgent) {
        await clearDeviceSessions(user.id, deviceInfo.userAgent);
      }

      // Đăng ký thiết bị
      await deviceTrustService.registerDevice(user.id, deviceInfo);

      // Lưu phiên đăng nhập mới
      await createSession(
        user.id,
        tokens.refreshToken,
        tokenFamily,
        deviceInfo,
        rememberMe,
        sessionId,
        anomalyResult,
        { locationResult },
      );

      // Thực thi giới hạn số thiết bị tối đa dựa trên gói hội viên
      const maxDevices = deviceTrustService.getDeviceLimit(user);
      await deviceTrustService.enforceDeviceLimit(user.id, maxDevices, sessionId);

      auditLogger.log({
        event: AUDIT_EVENTS.LOGIN_SUCCESS,
        userId: user.id,
        metadata: {
          rememberMe,
          deviceInfo: {
            userAgent: deviceInfo.userAgent,
            ip: deviceInfo.ip,
          },
          riskScore: anomalyResult.riskScore,
          riskLevel: anomalyResult.riskLevel,
        },
        ip: deviceInfo.ip,
        userAgent: deviceInfo.userAgent,
      });

      let warning = null;
      if (anomalyResult.shouldNotify) {
        const actionMsg = getActionMessage(
          anomalyResult.riskLevel,
          anomalyResult.signals,
        );
        if (actionMsg) warning = actionMsg.message;
      }

      return {
        user: user.toSafeJSON(),
        ...tokens,
        rememberMe,
        warning,
      };
    } catch (error) {
      if (error.statusCode) throw error;

      logger.error("[AuthService] Lỗi đăng nhập:", error);
      throw createError(
        "Đăng nhập thất bại",
        500,
        AUTH_ERROR_CODES.INTERNAL_ERROR,
      );
    }
  },

  /**
   * Đăng xuất khỏi phiên hiện tại
   * @description Thu hồi Refresh Token, Blacklist Access Token và cập nhật trạng thái Offline.
   * 
   * @param {UUID} userId - ID người dùng
   * @param {string} refreshToken - Refresh Token hiện tại
   * @param {string} accessToken - Access Token hiện tại
   */
  async logout(userId, refreshToken, accessToken) {
    const metadata = {};
    let hadCriticalFailure = false;

    if (refreshToken) {
      try {
        const revoked = await revokeSessionByToken(refreshToken, "logout");
        metadata.refreshTokenRevoked = revoked;
        if (!revoked) {
          // Không throw — có thể do token đã hết hạn/đã revoke trước đó (bình thường).
          logger.warn(
            `[AuthService] Refresh token không tìm thấy hoặc đã bị thu hồi khi logout (user=${userId})`,
          );
        }
      } catch (error) {
        logger.error("[AuthService] Thu hồi refresh token khi đăng xuất thất bại:", error);
        metadata.refreshTokenRevoked = false;
        hadCriticalFailure = true;
      }
    }

    if (accessToken) {
      try {
        const rawToken = accessToken.startsWith("Bearer ")
          ? accessToken.slice(7)
          : accessToken;
        await blacklistToken(rawToken);
        metadata.accessTokenBlacklisted = true;
      } catch (error) {
        logger.error("[AuthService] Blacklist access token khi đăng xuất thất bại:", error);
        metadata.accessTokenBlacklisted = false;
        hadCriticalFailure = true;
      }
    }

    if (userId) {
      try {
        await User.update(
          { is_online: false, last_online: new Date() },
          { where: { id: userId } },
        );
      } catch (error) {
        // Không critical — trạng thái online/offline không phải yếu tố bảo mật.
        logger.warn("[AuthService] Cập nhật trạng thái offline thất bại:", error);
      }

      auditLogger.log({
        event: AUDIT_EVENTS.LOGOUT,
        userId,
        metadata: { ...metadata, hadCriticalFailure },
      });
    }

    return { success: !hadCriticalFailure, ...metadata };
  },

  /**
   * Đăng xuất khỏi tất cả các thiết bị đang hoạt động
   * @param {UUID} userId - ID người dùng
   * @returns {Promise<Object>} Số lượng phiên đã thu hồi
   */
  async logoutAll(userId) {
    try {
      const revokedCount = await revokeAllUserSessions(userId, "logout_all");

      await User.increment("token_version", { where: { id: userId } });

      await User.update(
        { is_online: false, last_online: new Date() },
        { where: { id: userId } },
      );

      // Bắt buộc: xoá cache Redis của user để verifyToken() đọc token_version
      // mới ngay trong request kế tiếp, không phải đợi TTL cache hết hạn.
      await clearUserCache(userId);

      auditLogger.log({
        event: AUDIT_EVENTS.LOGOUT_ALL,
        userId,
        metadata: { revokedSessions: revokedCount },
      });

      logger.info(
        `[AuthService] Đăng xuất toàn bộ thiết bị cho user ${userId}: ${revokedCount} phiên bị thu hồi`,
      );

      return { revokedSessions: revokedCount };
    } catch (error) {
      logger.error("[AuthService] Đăng xuất toàn bộ thiết bị thất bại:", error);
      throw createError(
        "Đăng xuất toàn bộ thiết bị thất bại",
        500,
        AUTH_ERROR_CODES.INTERNAL_ERROR,
      );
    }
  },

  /**
   * Lấy danh sách tất cả các phiên đăng nhập đang hoạt động của người dùng
   * @param {UUID} userId - ID người dùng
   * @param {string} [currentRefreshToken] - Refresh token hiện tại để đánh dấu 'isCurrent'
   * @returns {Promise<Array>} Danh sách các phiên đăng nhập đã định dạng
   */
  async getSessions(userId, currentRefreshToken = null) {
    try {
      const sessions = await getUserSessions(userId);
      return sessions.map((s) => {
        const requestTokenHash = currentRefreshToken
          ? hashToken(currentRefreshToken)
          : null;
        const isCurrent = currentRefreshToken
          ? s.token_hash === requestTokenHash
          : false;

        return {
          id: s.id,
          device: {
            ...s.device_info,
            location: s.device_info?.location || null,
            formattedName: formatSessionName(s.device_info),
          },
          isCurrent,
          lastUsedAt: s.last_used_at,
          expiresAt: s.expires_at,
        };
      });
    } catch (error) {
      logger.error("[AuthService] Lỗi lấy danh sách phiên:", error);
      throw createError(
        "Lấy danh sách phiên thất bại",
        500,
        AUTH_ERROR_CODES.INTERNAL_ERROR,
      );
    }
  },

  /**
   * Thu hồi một phiên đăng nhập cụ thể theo ID
   * @param {UUID} userId - ID người dùng sở hữu phiên
   * @param {number} sessionId - ID của phiên cần thu hồi
   * @returns {Promise<boolean>}
   */
  async revokeSession(userId, sessionId) {
    try {
      const sessions = await getUserSessions(userId);
      const session = sessions.find((s) => s.id === sessionId);

      if (!session) {
        throw createError(
          "Phiên đăng nhập không tồn tại hoặc không thuộc về bạn",
          404,
          AUTH_ERROR_CODES.SESSION_NOT_FOUND,
        );
      }

      await revokeSession(sessionId, "user_revoked");

      events.emit(EVENTS.AUTH.PASSWORD_CHANGED, {
        userId,
        action: "keep_current_session",
        revokedSessionIds: [sessionId],
      });

      auditLogger.log({
        event: AUDIT_EVENTS.SESSION_REVOKED,
        userId,
        metadata: { sessionId, reason: "user_revoked" },
      });

      return true;
    } catch (error) {
      if (error.statusCode) throw error;

      logger.error("[AuthService] Lỗi thu hồi phiên:", error);
      throw createError(
        "Thu hồi phiên đăng nhập thất bại",
        500,
        AUTH_ERROR_CODES.INTERNAL_ERROR,
      );
    }
  },

  /**
   * Lấy thông tin chi tiết của người dùng hiện tại (Profile)
   * @description Sử dụng chiến lược Cache-aside: Ưu tiên lấy từ Redis, nếu hụt sẽ lấy từ DB và cập nhật lại cache.
   * 
   * @param {UUID} userId - ID người dùng
   * @returns {Promise<Object>} Thông tin người dùng an toàn (đã loại bỏ các trường nhạy cảm)
   */
  async getMe(userId) {
    const cacheKey = `me:${userId}`;
    const CACHE_TTL = 3600; // 1 giờ

    try {
      // 1. Kiểm tra Cache
      const cached = await cacheHelper.get(cacheKey);
      if (cached) {
        logger.debug(`[Auth] getMe cache hit cho user ${userId}`);
        return cached;
      }

      // 2. Lấy từ Database
      const user = await User.findByPk(userId, {
        attributes: {
          exclude: [
            "password_hash",
            "password_reset_token",
            "password_reset_expires",
            "verification_token",
            "token_version",
          ],
        },
        include: USER_PROFILE_INCLUDE,
      });

      if (!user) {
        throw createError(
          "Tài khoản không tồn tại",
          404,
          AUTH_ERROR_CODES.INVALID_CREDENTIALS,
        );
      }

      const safeUser = user.toSafeJSON();

      // 3. Cập nhật lại vào Cache
      cacheHelper
        .set(cacheKey, safeUser, CACHE_TTL)
        .catch((err) =>
          logger.warn(`[Auth] getMe cache write-back thất bại: ${err.message}`),
        );

      return safeUser;
    } catch (error) {
      if (error.statusCode) throw error;

      logger.error("[AuthService] Lỗi lấy thông tin cá nhân:", error);
      throw createError(
        "Lấy thông tin thất bại",
        500,
        AUTH_ERROR_CODES.INTERNAL_ERROR,
      );
    }
  },

  /**
   * Xác minh mã OTP 2FA trong quá trình đăng nhập.
   *
   * @param {string} mfaToken - Ticket đăng nhập hai yếu tố
   * @param {string} code - Mã OTP hoặc mã dự phòng
   * @returns {Promise<Object>} Thông tin đăng nhập hoàn tất
   */
  async verifyMfaLogin(mfaToken, code) {
    try {
      const ticket = await cacheHelper.get(`mfa_ticket:${mfaToken}`);
      if (!ticket) {
        throw createError(
          "Yêu cầu xác minh 2FA đã hết hạn hoặc không hợp lệ",
          400,
          AUTH_ERROR_CODES.TOKEN_INVALID,
        );
      }

      const { userId, deviceInfo, rememberMe } = ticket;

      const isValid = await mfaService.verifyMfaLogin(userId, code);
      if (!isValid) {
        throw createError(
          "Mã xác thực 2FA không chính xác",
          400,
          AUTH_ERROR_CODES.MFA_INVALID,
        );
      }

      // Đăng nhập thành công: xóa ticket
      await cacheHelper.del(`mfa_ticket:${mfaToken}`);

      const user = await User.findByPk(userId, { include: USER_PROFILE_INCLUDE });
      if (!user) {
        throw createError(
          "Người dùng không tồn tại",
          404,
          AUTH_ERROR_CODES.USER_NOT_FOUND,
        );
      }

      await user.update({
        login_attempts: 0,
        locked_until: null,
        last_login_at: new Date(),
        is_online: true,
        last_online: new Date(),
      });

      const sessionId = uuidv4();
      const tokens = generateTokenPair(user, { rememberMe, sessionId });
      const tokenFamily = generateTokenFamily();

      if (deviceInfo.userAgent) {
        await clearDeviceSessions(user.id, deviceInfo.userAgent);
      }

      await deviceTrustService.registerDevice(user.id, deviceInfo);

      await createSession(
        user.id,
        tokens.refreshToken,
        tokenFamily,
        deviceInfo,
        rememberMe,
        sessionId,
      );

      const maxDevices = deviceTrustService.getDeviceLimit(user);
      await deviceTrustService.enforceDeviceLimit(user.id, maxDevices, sessionId);

      auditLogger.log({
        event: AUDIT_EVENTS.LOGIN_SUCCESS,
        userId: user.id,
        metadata: {
          rememberMe,
          deviceInfo: {
            userAgent: deviceInfo.userAgent,
            ip: deviceInfo.ip,
          },
          mfaVerified: true,
        },
        ip: deviceInfo.ip,
        userAgent: deviceInfo.userAgent,
      });

      return {
        user: user.toSafeJSON(),
        ...tokens,
        rememberMe,
      };
    } catch (error) {
      if (error.statusCode) throw error;
      logger.error("[AuthService] Lỗi xác minh đăng nhập MFA:", error);
      throw createError(
        "Xác thực đăng nhập MFA thất bại",
        500,
        AUTH_ERROR_CODES.INTERNAL_ERROR,
      );
    }
  },
};

export default loginService;
