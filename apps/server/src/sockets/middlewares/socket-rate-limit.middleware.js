/**
 * Per-socket, per-event sliding window rate limiter for Socket.IO commands.
 */

import { logger } from '../../utils/logger.js';
import { SOCKET_ERROR_CODES } from '../constants/socket-events.constants.js';

const DEFAULT_OPTIONS = {
  windowMs: 10_000,
  maxEvents: 30,
  penaltyThreshold: 3,
};

const entryKey = (socketId, eventName = 'unknown') => `${socketId}:${eventName}`;

export const createRateLimiter = (options = {}) => {
  const config = { ...DEFAULT_OPTIONS, ...options };
  const store = new Map();

  const check = (socketId, eventName = 'unknown') => {
    const now = Date.now();
    const windowStart = now - config.windowMs;
    const key = entryKey(socketId, eventName);
    const entry = store.get(key) || { timestamps: [], violations: 0 };

    entry.timestamps = entry.timestamps.filter((ts) => ts > windowStart);
    entry.timestamps.push(now);

    if (entry.timestamps.length > config.maxEvents) {
      entry.violations += 1;
      store.set(key, entry);

      const oldest = entry.timestamps[0] || now;
      return {
        allowed: false,
        remaining: 0,
        violations: entry.violations,
        retryAfterMs: Math.max(0, config.windowMs - (now - oldest)),
      };
    }

    entry.violations = Math.max(0, entry.violations - 1);
    store.set(key, entry);

    return {
      allowed: true,
      remaining: Math.max(0, config.maxEvents - entry.timestamps.length),
      violations: entry.violations,
      retryAfterMs: 0,
    };
  };

  const cleanup = (socketId) => {
    for (const key of store.keys()) {
      if (key.startsWith(`${socketId}:`)) {
        store.delete(key);
      }
    }
  };

  return { check, cleanup, store, config };
};

export const globalRateLimiter = createRateLimiter();

export const withRateLimit = (socket, limiter, handler, eventName = 'unknown') => {
  return async (data, callback) => {
    const result = limiter.check(socket.id, eventName);

    if (!result.allowed) {
      logger.warn(
        `[Socket][RateLimit] socketId=${socket.id} userId=${socket.user?.id || 'guest'} event=${eventName} violations=${result.violations}`,
      );

      if (typeof callback === 'function') {
        callback({
          success: false,
          ok: false,
          error: SOCKET_ERROR_CODES.RATE_LIMITED,
          message: 'Too many realtime requests. Please retry later.',
          retryAfterMs: result.retryAfterMs,
        });
      }

      if (result.violations >= (limiter.config?.penaltyThreshold ?? DEFAULT_OPTIONS.penaltyThreshold)) {
        logger.warn(
          `[Socket][RateLimit] disconnecting socketId=${socket.id} event=${eventName} after repeated violations`,
        );
        socket.disconnect(true);
      }

      return;
    }

    await handler(data, callback);
  };
};
