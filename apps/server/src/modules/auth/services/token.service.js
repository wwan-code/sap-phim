/**
 * Token Service
 *
 * Handles refresh-token verification, rotation, and reuse detection.
 */
import { User, Role, Permission } from "../../../models/index.js";
import {
  generateTokenPair,
  generateAccessToken,
  verifyRefreshToken,
} from "../../../utils/jwt.util.js";
import { logger } from "../../../utils/logger.js";
import {
  findSessionByToken,
  rotateSession,
  updateSessionLastUsed,
} from "../helpers/session.helper.js";
import { auditLogger } from "../utils/audit.logger.js";
import { AUDIT_EVENTS, AUTH_ERROR_CODES, TOKEN_CONFIG } from "../../../constants/auth.constant.js";
import { v4 as uuidv4 } from "uuid";
import { createAuthError as createError } from "../utils/auth-error.util.js";
import { clearUserCache } from "../../../middlewares/auth.middleware.js";

const createRefreshJwtError = (error) => {
  if (error.name === "TokenExpiredError") {
    return createError(
      "Refresh token đã hết hạn. Vui lòng đăng nhập lại",
      401,
      AUTH_ERROR_CODES.TOKEN_EXPIRED,
    );
  }

  if (error.name === "JsonWebTokenError" || error.name === "NotBeforeError") {
    return createError(
      "Refresh token không hợp lệ",
      401,
      AUTH_ERROR_CODES.TOKEN_INVALID,
    );
  }

  return null;
};

const normalizeRefreshTokenCandidates = (refreshTokenInput) => {
  const rawCandidates = Array.isArray(refreshTokenInput)
    ? refreshTokenInput
    : [refreshTokenInput];
  const candidates = [];

  for (const token of rawCandidates) {
    if (typeof token !== "string") continue;

    const trimmed = token.trim();
    if (!trimmed || candidates.includes(trimmed)) continue;

    candidates.push(trimmed);
  }

  return candidates;
};

const createRefreshTokenMissingError = () => createError(
  "Refresh token không được cung cấp",
  400,
  AUTH_ERROR_CODES.TOKEN_INVALID,
);

const createRefreshTokenRevokedError = () => createError(
  "Token không hợp lệ hoặc đã bị thu hồi",
  401,
  AUTH_ERROR_CODES.TOKEN_REVOKED,
);

const selectRefreshTokenCandidate = async (refreshTokenInput, deviceInfo = {}) => {
  const candidates = normalizeRefreshTokenCandidates(refreshTokenInput);

  if (!candidates.length) {
    throw createRefreshTokenMissingError();
  }

  let lastJwtError = null;
  let lastSessionError = null;

  for (const [index, candidate] of candidates.entries()) {
    let decoded;

    try {
      decoded = verifyRefreshToken(candidate);
    } catch (error) {
      lastJwtError = error;
      continue;
    }

    if (!decoded.id) {
      lastJwtError = Object.assign(
        new Error("Refresh token không hợp lệ"),
        { name: "JsonWebTokenError" },
      );
      continue;
    }

    const currentSession = await findSessionByToken(candidate);

    if (currentSession && !currentSession.is_revoked) {
      if (index > 0) {
        logger.warn(
          `[AuthService] Recovered refresh token from duplicate cookies at candidate index ${index}`,
        );
      }

      return { decoded, currentSession };
    }

    if (currentSession && candidates.length === 1) {
      return { decoded, currentSession };
    }

    auditLogger.log({
      event: AUDIT_EVENTS.TOKEN_REFRESH,
      userId: decoded.id,
      metadata: {
        status: "failed",
        reason: currentSession ? "session_revoked_duplicate_cookie" : "session_not_found",
        candidateIndex: index,
      },
      ip: deviceInfo.ip,
    });

    lastSessionError = createRefreshTokenRevokedError();
  }

  if (lastSessionError) throw lastSessionError;
  if (lastJwtError) throw lastJwtError;

  throw createRefreshTokenMissingError();
};

const formatAuthPayload = (user, tokens, rememberMe) => ({
  ...tokens,
  user: typeof user.toSafeJSON === "function" ? user.toSafeJSON() : user,
  rememberMe,
  roles: user.role
    ? [{ id: user.role.id, slug: user.role.slug, name: user.role.name }]
    : [],
  permissions: user.role && user.role.permissions
    ? user.role.permissions.map((permission) => permission.slug)
    : [],
});

const formatAccessTokenOnlyPayload = (user, session) => {
  const accessToken = generateAccessToken({
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role?.slug ?? null,
    tokenVersion: user.token_version || 1,
    sessionId: session.id,
  });

  return {
    accessToken,
    expiresAt: Date.now() + TOKEN_CONFIG.ACCESS_TOKEN_EXPIRY_MS,
    expiresIn: TOKEN_CONFIG.ACCESS_TOKEN_EXPIRY_MS,
    skipRefreshCookieUpdate: true,
    user: typeof user.toSafeJSON === "function" ? user.toSafeJSON() : user,
    rememberMe: session.device_info?.rememberMe || false,
    roles: user.role
      ? [{ id: user.role.id, slug: user.role.slug, name: user.role.name }]
      : [],
    permissions: user.role && user.role.permissions
      ? user.role.permissions.map((permission) => permission.slug)
      : [],
  };
};

export const tokenService = {
  /**
   * Refresh an access token using one or more refresh-token candidates.
   *
   * @param {string|string[]} refreshToken Refresh token or candidates
   * @param {Object} deviceInfo Request device information
   * @returns {Promise<Object>} New token pair and auth metadata
   */
  async refreshToken(refreshToken, deviceInfo = {}) {
    try {
      const { decoded, currentSession } = await selectRefreshTokenCandidate(
        refreshToken,
        deviceInfo,
      );

      const user = await User.findByPk(decoded.id, {
        include: [{
          model: Role,
          as: "role",
          include: [{
            model: Permission,
            as: "permissions",
            attributes: ["slug"],
            through: { attributes: [] },
          }],
        }],
      });

      if (!user || user.status === "banned") {
        throw createError(
          "Tài khoản không khả dụng",
          401,
          AUTH_ERROR_CODES.ACCOUNT_BANNED,
        );
      }

      // ════════════════════════════════════════════════════════════════
      // FIX-CRITICAL-01: So sánh bắt buộc, không dùng `&&` lỏng lẻo.
      // Trước đây `decoded.tokenVersion && ...` bị bypass hoàn toàn khi
      // decoded.tokenVersion là 0/undefined/null.
      // ════════════════════════════════════════════════════════════════
      if (
        decoded.tokenVersion === undefined ||
        decoded.tokenVersion === null ||
        decoded.tokenVersion !== user.token_version
      ) {
        auditLogger.log({
          event: AUDIT_EVENTS.TOKEN_REFRESH,
          userId: user.id,
          metadata: {
            status: "failed",
            reason: "token_version_mismatch",
            expected: user.token_version,
            got: decoded.tokenVersion,
          },
          ip: deviceInfo.ip,
        });

        throw createError(
          "Token đã hết hạn. Vui lòng đăng nhập lại",
          401,
          AUTH_ERROR_CODES.TOKEN_VERSION_MISMATCH,
        );
      }

      const newSessionId = uuidv4();
      const rememberMe = currentSession.device_info?.rememberMe || false;
      const tokens = generateTokenPair(user, { sessionId: newSessionId, rememberMe });
      const tokensWithRemember = formatAuthPayload(user, tokens, rememberMe);

      const { session, reuseDetected, isGraceRecovery, recoveredTokens } = await rotateSession(
        currentSession,
        tokens.refreshToken,
        deviceInfo,
        newSessionId,
        tokensWithRemember,
      );

      if (isGraceRecovery) {
        if (recoveredTokens) {
          return recoveredTokens;
        }

        // FIX-CRITICAL-02: KHÔNG sinh refresh token mới ở đây (sẽ "mồ côi"
        // vì không có bản ghi session nào lưu hash của nó). Chỉ cấp lại
        // access token, giữ nguyên cookie refresh token hiện tại của client.
        logger.info(
          `[TokenService] Grace-recovery fallback (cache miss) cho session ${session.id} — chỉ cấp access token, không rotate refresh token`,
        );
        return formatAccessTokenOnlyPayload(user, session);
      }

      if (reuseDetected) {
        auditLogger.log({
          event: AUDIT_EVENTS.TOKEN_REUSE_DETECTED,
          userId: user.id,
          metadata: {
            sessionId: currentSession.id,
            tokenFamily: currentSession.token_family,
          },
          ip: deviceInfo.ip,
          userAgent: deviceInfo.userAgent,
        });

        logger.warn(`[Security] Phát hiện tái sử dụng token cho user ${user.id}`);

        // ════════════════════════════════════════════════════════════════
        // FIX-03: Vô hiệu hóa NGAY LẬP TỨC mọi access token đang tồn tại
        // của user này — trước đây chỉ refresh token family bị thu hồi,
        // access token cũ (kẻ tấn công có thể đang giữ) vẫn sống tới khi
        // hết hạn tự nhiên (mặc định ~1h).
        // ════════════════════════════════════════════════════════════════
        try {
          await User.increment("token_version", { where: { id: user.id } });
          await clearUserCache(user.id);
        } catch (bumpError) {
          logger.error(
            "[TokenService] Bump token_version sau reuse-detection thất bại:",
            bumpError,
          );
        }

        throw createError(
          "Phát hiện bất thường bảo mật. Vui lòng đăng nhập lại",
          403,
          AUTH_ERROR_CODES.TOKEN_REUSED,
        );
      }

      await updateSessionLastUsed(session.id);

      auditLogger.log({
        event: AUDIT_EVENTS.TOKEN_REFRESH,
        userId: user.id,
        metadata: { sessionId: session.id },
        ip: deviceInfo.ip,
      });

      return tokensWithRemember;
    } catch (error) {
      const jwtAuthError = createRefreshJwtError(error);
      if (jwtAuthError) {
        logger.warn(`[AuthService] Refresh token rejected: ${error.name}`);
        throw jwtAuthError;
      }

      if (error.statusCode) throw error;

      logger.error("[AuthService] Lỗi làm mới token:", error);
      throw createError(
        "Làm mới token thất bại",
        500,
        AUTH_ERROR_CODES.INTERNAL_ERROR,
      );
    }
  },
};

export default tokenService;