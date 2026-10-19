/**
 * Socket.IO authentication middleware.
 *
 * Rules:
 * - No token in handshake.auth -> guest socket.
 * - Any supplied but invalid token -> reject, never downgrade to guest.
 * - Authenticated sockets must pass token blacklist, tokenVersion, session,
 *   user status, and device-limit checks before joining private rooms.
 */

import { verifyAccessToken } from '../../utils/jwt.util.js';
import { Role, User, UserSession } from '../../models/index.js';
import { cacheHelper } from '../../config/redis.config.js';
import { checkDeviceLimit } from '../services/session.service.js';
import { logger } from '../../utils/logger.js';
import { SOCKET_ERROR_CODES } from '../constants/socket-events.constants.js';
import jwtConfig from '../../config/jwt.config.js';

const AUTH_TOKEN_PREFIX = /^Bearer\s+/i;

const createAuthError = (message, code) => {
  const error = new Error(message);
  error.data = { code };
  return error;
};

const normalizeToken = (token) => {
  if (typeof token !== 'string') return null;
  const trimmed = token.trim();
  return trimmed ? trimmed.replace(AUTH_TOKEN_PREFIX, '') : null;
};

const getTokenErrorCode = (error) => {
  if (error?.name === 'TokenExpiredError' || error?.message === 'TOKEN_EXPIRED') {
    return SOCKET_ERROR_CODES.TOKEN_EXPIRED;
  }

  return SOCKET_ERROR_CODES.TOKEN_INVALID;
};

const validateSession = async (decoded) => {
  if (!decoded?.id || !decoded?.sessionId) {
    return false;
  }

  const session = await UserSession.findOne({
    where: {
      id: decoded.sessionId,
      user_id: decoded.id,
      is_revoked: false,
    },
    raw: true,
  });

  if (!session) return false;
  if (session.expires_at && new Date(session.expires_at).getTime() <= Date.now()) {
    return false;
  }

  return true;
};

/**
 * Xác thực chuỗi JWT Token của Socket và nạp thông tin người dùng từ cơ sở dữ liệu.
 * Dùng chung cho cả Socket Auth Middleware (Handshake) và Soft Re-Authentication Event.
 *
 * @param {string} rawToken - Token dạng Bearer hoặc JWT thô
 * @param {import('socket.io').Server} io - Socket.IO Server Instance
 * @param {Object} [options={}] - Tùy chọn kiểm tra (checkLimit = true)
 * @returns {Promise<{ user: Object, decoded: Object }>} Thông tin user và decoded JWT
 */
export const authenticateSocketToken = async (rawToken, io, options = {}) => {
  const { checkLimit = true } = options;
  const token = normalizeToken(rawToken);

  if (!token) {
    throw createAuthError('Token is missing', SOCKET_ERROR_CODES.TOKEN_INVALID);
  }

  if (jwtConfig.blacklist.enabled) {
    const isBlacklisted = await cacheHelper.exists(
      `${jwtConfig.blacklist.prefix}${token}`,
    );

    if (isBlacklisted) {
      throw createAuthError(
        'Token has been revoked',
        SOCKET_ERROR_CODES.TOKEN_REVOKED,
      );
    }
  }

  let decoded;
  try {
    decoded = verifyAccessToken(token);
  } catch (tokenError) {
    throw createAuthError(
      tokenError.message || 'Invalid token',
      getTokenErrorCode(tokenError),
    );
  }

  const user = await User.findByPk(decoded.id, {
    attributes: {
      exclude: [
        'password_hash',
        'password_reset_token',
        'password_reset_expires',
        'verification_token',
      ],
    },
    include: [
      {
        model: Role,
        as: 'role',
        attributes: ['id', 'slug', 'name'],
      },
    ],
  });

  if (!user) {
    throw createAuthError(
      'User not found',
      SOCKET_ERROR_CODES.USER_NOT_FOUND,
    );
  }

  if (user.status !== 'active') {
    throw createAuthError(
      'User is inactive',
      SOCKET_ERROR_CODES.USER_INACTIVE,
    );
  }

  if (
    decoded.tokenVersion === undefined ||
    decoded.tokenVersion === null ||
    decoded.tokenVersion !== user.token_version
  ) {
    throw createAuthError(
      'Token version is no longer valid',
      SOCKET_ERROR_CODES.TOKEN_REVOKED,
    );
  }

  const sessionIsValid = await validateSession(decoded);
  if (!sessionIsValid) {
    throw createAuthError(
      'Session is no longer valid',
      SOCKET_ERROR_CODES.TOKEN_REVOKED,
    );
  }

  if (checkLimit && io) {
    const canConnect = await checkDeviceLimit(user.id, io);
    if (!canConnect) {
      throw createAuthError(
        'Device connection limit exceeded',
        SOCKET_ERROR_CODES.DEVICE_LIMIT,
      );
    }
  }

  const roleSlug = user.role?.slug || decoded.role || 'user';

  const socketUser = {
    id: user.id,
    username: user.username,
    email: user.email,
    avatar_url: user.avatar_url,
    roles: [roleSlug],
    role: roleSlug,
    sessionId: decoded.sessionId,
    tokenVersion: decoded.tokenVersion,
  };

  return { user: socketUser, decoded };
};

export const socketAuthMiddleware = (io) => async (socket, next) => {
  const startTime = Date.now();
  const traceId = socket.handshake.auth?.traceId || socket.handshake.headers?.['x-request-id'] || socket.id;
  socket.traceId = traceId;

  try {
    const token = normalizeToken(socket.handshake.auth?.token);

    if (!token) {
      socket.isGuest = true;
      socket.user = null;
      logger.debug(`[SocketAuth] guest socketId=${socket.id} traceId=${traceId}`);
      return next();
    }

    const { user, decoded } = await authenticateSocketToken(token, io, { checkLimit: true });

    socket.user = user;
    socket.isGuest = false;

    logger.debug(
      `[SocketAuth] authenticated socketId=${socket.id} userId=${user.id} sessionId=${decoded.sessionId} traceId=${traceId} elapsedMs=${Date.now() - startTime}`,
    );

    return next();
  } catch (error) {
    if (error.data?.code) {
      return next(error);
    }

    logger.error(
      `[SocketAuth] internal error socketId=${socket.id} traceId=${traceId}: ${error.message}`,
    );
    return next(createAuthError(
      'Internal socket authentication error',
      SOCKET_ERROR_CODES.AUTH_INTERNAL_ERROR,
    ));
  }
};
