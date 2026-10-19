/**
 * @file token-manager.js
 * @module Shared/Utils/TokenManager
 * @description Quản lý toàn diện vòng đời của Access Token, tự động làm mới (Proactive Refresh) trước khi hết hạn và đồng bộ đa tab.
 */

import axios from 'axios';
import { store } from '@/store';
import queryClient from '@/shared/lib/query-client';
import {
  setCredentials,
  setAccessToken,
  setTokenExpiresAt,
  logout,
  sessionExpired as sessionExpiredAction,
  setAuthStatus,
  updateUser,
  selectUser,
  selectTokenExpiresAt,
  selectAccessToken,
  selectIsAuthenticated,
} from '@/store/slices/auth.slice';
import {
  REFRESH_BUFFER_MS,
  MIN_REFRESH_INTERVAL_MS,
  REFRESH_RETRY_DELAY_MS,
  MAX_REFRESH_RETRIES,
} from '@/shared/constants/auth.constants';
import { authBroadcast, AUTH_BROADCAST_EVENTS } from './auth-broadcast';
import { API_BASE_URL } from '@/shared/constants/api-endpoints.constants';
import socketClient from '@/shared/lib/socket-client';

const CSRF_COOKIE_NAME = 'XSRF-TOKEN';
const CSRF_HEADER_NAME = 'X-CSRF-Token';

const TOKEN_KEY = 'sap_phim_access_token';
const REFRESH_TOKEN_KEY = 'sap_phim_refresh_token';
const HAS_SESSION_KEY = 'sap_phim_has_session';

const readCookie = (name) => {
  if (typeof document === 'undefined') return null;

  const escapedName = name.replace(/([.$?*|{}()[\]\\/+^])/g, '\\$1');
  const match = document.cookie.match(new RegExp(`(?:^|; )${escapedName}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
};

const getRefreshRequestHeaders = () => {
  const csrfToken = readCookie(CSRF_COOKIE_NAME);
  return csrfToken ? { [CSRF_HEADER_NAME]: csrfToken } : undefined;
};

// ──────────────────────────────────────────
//  MODULE STATE
// ──────────────────────────────────────────

/** Timer ID của lần refresh kế tiếp */
let _refreshTimer = null;

/** Timestamp của lần refresh gần nhất (ms) */
let _lastRefreshAttempt = 0;

/** Timestamp của lần refresh THÀNH CÔNG gần nhất (ms) */
let _lastSuccessfulRefresh = 0;

/** Số lần retry liên tiếp (reset về 0 khi thành công) */
let _retryCount = 0;

/**
 * Mutex: Promise đang chạy của performRefresh.
 * Nếu khác null, có nghĩa là đang có một refresh đang diễn ra.
 * Bất kỳ caller nào khác sẽ await promise này thay vì tạo request mới.
 * @type {Promise<string|null> | null}
 */
let _refreshMutex = null;

/** Whether BroadcastChannel handlers have been registered. */
let _multiTabSyncInitialized = false;

/** Avoid hammering /refresh-token on every unauthenticated render. */
let _sessionRestoreAttempted = false;

/**
 * Khoảng cách tối thiểu sau refresh thành công trước khi cho phép forceRefresh mới.
 * Ngăn race condition: 401 interceptor + proactive timer cùng gửi refresh gần như đồng thời.
 */
const FORCE_REFRESH_COOLDOWN_MS = 3000;

const DEFAULT_ACCESS_TOKEN_EXPIRY_MS = 60 * 60_000;

const normalizeExpiresInMs = (expiresIn) => {
  const value = Number(expiresIn);
  if (!Number.isFinite(value) || value <= 0) return DEFAULT_ACCESS_TOKEN_EXPIRY_MS;
  return value < 60_000 ? value * 1000 : value;
};

const extractPayload = (response) => response?.data?.data ?? response?.data ?? {};

const fetchCurrentUser = async (accessToken) => {
  const response = await axios.get(`${API_BASE_URL}/auth/me`, {
    withCredentials: true,
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return extractPayload(response);
};

const mergeAuthMetadata = (user, { permissions, roles }) => ({
  ...user,
  ...(permissions && { permissions }),
  ...(roles && { roles }),
});

const applyRefreshPayload = async (payload) => {
  const { accessToken, expiresIn, permissions, roles } = payload;
  const localExpiresAt = Date.now() + normalizeExpiresInMs(expiresIn);

  let user = payload.user || selectUser(store.getState());
  if (!user) {
    user = await fetchCurrentUser(accessToken);
  }

  // Set flag session hoạt động vào localStorage để tối ưu hóa lần tải trang sau
  localStorage.setItem(HAS_SESSION_KEY, 'true');

  if (user?.id) {
    store.dispatch(
      setCredentials({
        user: mergeAuthMetadata(user, { permissions, roles }),
        accessToken,
        expiresAt: localExpiresAt,
      })
    );
  } else {
    store.dispatch(setAccessToken(accessToken));
    if (permissions || roles) {
      store.dispatch(updateUser({ permissions, roles }));
    }
    store.dispatch(setTokenExpiresAt(localExpiresAt));
  }

  scheduleRefresh(localExpiresAt);

  return {
    accessToken,
    expiresAt: localExpiresAt,
    user: user?.id ? mergeAuthMetadata(user, { permissions, roles }) : null,
  };
};

// ──────────────────────────────────────────
//  BACKWARD-COMPATIBLE STORAGE HELPERS
// ──────────────────────────────────────────

export const getStoredToken = () => {
  try {
    return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};

export const getAccessToken = () => {
  const state = store.getState();
  return selectAccessToken(state) || getStoredToken();
};

export const setStoredTokens = ({ accessToken, refreshToken, remember = true }) => {
  const target = remember ? localStorage : sessionStorage;
  if (accessToken) target.setItem(TOKEN_KEY, accessToken);
  if (refreshToken) target.setItem(REFRESH_TOKEN_KEY, refreshToken);
};

export const clearStoredTokens = () => {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(HAS_SESSION_KEY);
    localStorage.removeItem('sap_anime_has_session');
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(REFRESH_TOKEN_KEY);
  } catch (e) {
    // Ignored
  }
};

// ──────────────────────────────────────────
//  PUBLIC HELPERS — Expiry Management
// ──────────────────────────────────────────

export const getTokenExpiry = () => selectTokenExpiresAt(store.getState());

export const setTokenExpiry = (expiresAt) => {
  if (!expiresAt || isNaN(expiresAt)) return;
  store.dispatch(setTokenExpiresAt(expiresAt));
  scheduleRefresh(expiresAt);
};

export const clearTokenExpiry = () => {
  store.dispatch(setTokenExpiresAt(null));
  _clearTimer();
};

export const isTokenExpired = () => {
  const expiresAt = getTokenExpiry();
  if (!expiresAt) return true;
  return Date.now() >= expiresAt - REFRESH_BUFFER_MS;
};

export const isTokenFullyExpired = () => {
  const expiresAt = getTokenExpiry();
  if (!expiresAt) return true;
  return Date.now() >= expiresAt;
};

export const getTimeUntilExpiry = () => {
  const expiresAt = getTokenExpiry();
  if (!expiresAt) return 0;
  return expiresAt - Date.now();
};

// ──────────────────────────────────────────
//  SCHEDULING
// ──────────────────────────────────────────

const _clearTimer = () => {
  if (_refreshTimer) {
    clearTimeout(_refreshTimer);
    _refreshTimer = null;
  }
};

export const scheduleRefresh = (expiresAt) => {
  _clearTimer();

  const timeUntilRefresh = expiresAt - Date.now() - REFRESH_BUFFER_MS;

  if (timeUntilRefresh <= 0) {
    const timeSinceLast = Date.now() - _lastRefreshAttempt;
    if (timeSinceLast >= MIN_REFRESH_INTERVAL_MS) {
      refreshWithMutex();
    }
    return;
  }

  _refreshTimer = setTimeout(() => refreshWithMutex(), timeUntilRefresh);
};

// ──────────────────────────────────────────
//  MUTEX — Prevent concurrent refresh
// ──────────────────────────────────────────

/**
 * Wrapper với mutex: Nếu đang có refresh chạy, return promise đó.
 * Không tạo request mới khi đã có một request đang pending.
 */
const refreshWithMutex = (options = {}) => {
  if (_refreshMutex) {
    return _refreshMutex;
  }

  _refreshMutex = _performRefresh(options).finally(() => {
    _refreshMutex = null;
  });

  return _refreshMutex;
};

// ──────────────────────────────────────────
//  SESSION EXPIRY CENTRALIZED HANDLER
// ──────────────────────────────────────────

/**
 * Xử lý phiên làm việc đã hết hạn hoặc bị thu hồi (Terminal State).
 * @param {string} reason - Mã lỗi hoặc lý do hết hạn
 */
export const handleSessionExpired = (reason = 'SESSION_EXPIRED') => {
  _clearTimer();
  _refreshMutex = null;
  _lastRefreshAttempt = 0;
  _lastSuccessfulRefresh = 0;
  _retryCount = 0;
  _sessionRestoreAttempted = true;

  queryClient.cancelQueries();

  const wasAuthenticated = selectIsAuthenticated(store.getState());

  clearStoredTokens();

  if (wasAuthenticated) {
    store.dispatch(sessionExpiredAction());
  }
  clearTokenExpiry();

  try {
    socketClient.disconnect();
  } catch (e) {
    // Ignored
  }

  setTimeout(() => queryClient.clear(), 0);

  // Broadcast tới các tab khác
  authBroadcast.emit(AUTH_BROADCAST_EVENTS.SESSION_EXPIRED, { reason });
};

/**
 * Thực hiện quy trình Đăng xuất triệt để (Comprehensive Logout).
 * Hủy toàn bộ token, timers, query cache, socket connection và phát broadcast.
 * @param {Object} [options={}]
 */
export const performLogout = ({ silent = false } = {}) => {
  // 1. Dọn dẹp toàn bộ timers và khóa khôi phục phiên tự động
  _clearTimer();
  _refreshMutex = null;
  _lastRefreshAttempt = 0;
  _lastSuccessfulRefresh = 0;
  _retryCount = 0;
  _sessionRestoreAttempted = true;

  // 2. Hủy các query đang pending và xóa sạch cache TanStack Query
  queryClient.cancelQueries();
  queryClient.clear();

  // 3. Xóa toàn bộ token & cờ phiên trong Storage
  clearStoredTokens();

  // 4. Reset Redux auth state về trạng thái anonymous
  store.dispatch(logout());
  clearTokenExpiry();

  // 5. Ngắt kết nối socket realtime
  try {
    socketClient.disconnect();
  } catch (e) {
    // Ignored
  }

  // 6. Phát tín hiệu logout đồng bộ sang các tab khác qua BroadcastChannel
  authBroadcast.emit(AUTH_BROADCAST_EVENTS.LOGOUT);
};

const getErrorCode = (error) => {
  return (
    error.response?.data?.code ??
    error.response?.data?.error?.code ??
    error.code
  );
};

// ──────────────────────────────────────────
//  CORE REFRESH LOGIC
// ──────────────────────────────────────────

const _performRefresh = async ({ silent = false } = {}) => {
  const timeSinceLast = Date.now() - _lastRefreshAttempt;
  if (timeSinceLast < MIN_REFRESH_INTERVAL_MS) {
    if (import.meta.env.DEV) {
      console.warn(
        `[TokenManager] Refresh rate limited. Last attempt: ${Math.round(timeSinceLast / 1000)}s ago`
      );
    }
    return selectAccessToken(store.getState());
  }

  _lastRefreshAttempt = Date.now();

  const wasAuthenticated = selectIsAuthenticated(store.getState());
  if (wasAuthenticated) {
    store.dispatch(setAuthStatus('refreshing'));
  }

  try {
    const response = await axios.post(
      `${API_BASE_URL}/auth/refresh-token`,
      {},
      {
        withCredentials: true,
        headers: getRefreshRequestHeaders(),
      }
    );

    const payload = extractPayload(response);
    const { accessToken } = payload;

    if (!accessToken) {
      console.warn('[TokenManager] Refresh returned no token → Session Expired');
      handleSessionExpired('TOKEN_INVALID');
      throw new Error('No access token returned');
    }

    _retryCount = 0;
    _lastSuccessfulRefresh = Date.now();

    const { expiresAt, user } = await applyRefreshPayload(payload);

    authBroadcast.emit(AUTH_BROADCAST_EVENTS.TOKEN_REFRESHED, {
      accessToken,
      expiresAt,
      user,
      permissions: payload.permissions,
      roles: payload.roles,
    });

    return accessToken;
  } catch (error) {
    _handleRefreshError(error, { silent });
    throw error;
  }
};

const _handleRefreshError = (error, { silent = false } = {}) => {
  const status = error.response?.status;
  const errorCode = getErrorCode(error);
  const wasAuthenticated = selectIsAuthenticated(store.getState());

  // Terminal error codes từ backend (cả chuỗi định danh và mã enum chuẩn)
  const terminalCodes = [
    'TOKEN_EXPIRED',
    'TOKEN_INVALID',
    'TOKEN_REVOKED',
    'TOKEN_REUSED',
    'TOKEN_VERSION_MISMATCH',
    'ACCOUNT_BANNED',
    'ACCOUNT_INACTIVE',
    'TOKEN_001',
    'TOKEN_002',
    'TOKEN_003',
    'TOKEN_004',
    'TOKEN_005',
    'AUTH_001',
    'AUTH_002',
    'AUTH_003',
    'AUTH_004',
    'AUTH_005',
    'ERR_003',
    'ERR_004',
  ];

  const isTerminal = terminalCodes.includes(errorCode) || status === 400 || status === 401 || status === 403;

  if (isTerminal) {
    if (!silent) {
      console.error(
        `[TokenManager] ❌ Terminal error during refresh (${status} / ${errorCode}) → expiring session`,
        { status, code: errorCode }
      );
    }

    clearStoredTokens();

    if (wasAuthenticated) {
      handleSessionExpired(errorCode || 'TOKEN_INVALID');
    } else {
      store.dispatch(setAuthStatus('anonymous'));
      clearTokenExpiry();
    }
    return;
  }

  // Lỗi tạm thời (Network, timeout, 5xx, 429) -> retry
  if (!wasAuthenticated) {
    store.dispatch(setAuthStatus('anonymous'));
    clearTokenExpiry();
    return;
  }

  _retryCount++;

  if (_retryCount > MAX_REFRESH_RETRIES) {
    console.error(
      `[TokenManager] ❌ Max retries exceeded (${_retryCount}/${MAX_REFRESH_RETRIES}) → expiring session`,
      { code: errorCode }
    );
    handleSessionExpired('max_retries_exceeded');
    return;
  }

  store.dispatch(setAuthStatus('error'));

  const backoffMs = REFRESH_RETRY_DELAY_MS * Math.pow(2, _retryCount - 1);

  console.warn(
    `[TokenManager] ⚠️ Transient error (attempt ${_retryCount}/${MAX_REFRESH_RETRIES}). Retrying in ${Math.round(backoffMs / 1000)}s`,
    { status, code: errorCode, backoffMs }
  );

  _refreshTimer = setTimeout(() => refreshWithMutex(), backoffMs);
};

// ──────────────────────────────────────────
//  MULTI-TAB HANDLER
// ──────────────────────────────────────────

const _handleRemoteTermination = (kind) => {
  _clearTimer();
  _refreshMutex = null;
  _lastRefreshAttempt = 0;
  _lastSuccessfulRefresh = 0;
  _retryCount = 0;
  _sessionRestoreAttempted = true;

  queryClient.cancelQueries();
  clearStoredTokens();

  if (kind === 'session_expired') {
    store.dispatch(sessionExpiredAction());
  } else {
    store.dispatch(logout());
  }

  clearTokenExpiry();

  try {
    socketClient.disconnect();
  } catch (e) {
    // Ignored
  }

  setTimeout(() => queryClient.clear(), 0);
};

const _initMultiTabSync = () => {
  if (_multiTabSyncInitialized) return;
  _multiTabSyncInitialized = true;
  authBroadcast.init();

  authBroadcast.on(
    AUTH_BROADCAST_EVENTS.TOKEN_REFRESHED,
    ({ accessToken, expiresAt, user, permissions, roles } = {}) => {
      if (!accessToken) return;

      const nextExpiresAt = expiresAt || Date.now() + DEFAULT_ACCESS_TOKEN_EXPIRY_MS;
      const currentUser = user || selectUser(store.getState());

      localStorage.setItem(HAS_SESSION_KEY, 'true');

      if (currentUser?.id) {
        store.dispatch(
          setCredentials({
            user: mergeAuthMetadata(currentUser, { permissions, roles }),
            accessToken,
            expiresAt: nextExpiresAt,
          })
        );
      } else {
        store.dispatch(setAccessToken(accessToken));
        if (permissions || roles) {
          store.dispatch(updateUser({ permissions, roles }));
        }
        store.dispatch(setTokenExpiresAt(nextExpiresAt));
      }

      _clearTimer();
      scheduleRefresh(nextExpiresAt);
    }
  );

  authBroadcast.on(AUTH_BROADCAST_EVENTS.ROLE_CHANGED, ({ permissions, roles } = {}) => {
    if (permissions || roles) {
      store.dispatch(updateUser({ permissions, roles }));
    }
  });

  authBroadcast.on(AUTH_BROADCAST_EVENTS.LOGOUT, () => {
    console.warn('[TokenManager] 📡 Received logout from another tab');
    _handleRemoteTermination('logout');
  });

  authBroadcast.on(AUTH_BROADCAST_EVENTS.FORCE_LOGOUT, () => {
    console.warn('[TokenManager] 📡 Received force logout from another tab');
    _handleRemoteTermination('session_expired');
  });

  authBroadcast.on(AUTH_BROADCAST_EVENTS.SESSION_EXPIRED, () => {
    console.warn('[TokenManager] 📡 Received session expired from another tab');
    _handleRemoteTermination('session_expired');
  });
};

// ──────────────────────────────────────────
//  SESSION RESTORATION
// ──────────────────────────────────────────

export const restoreSession = async ({ force = false } = {}) => {
  _initMultiTabSync();

  const state = store.getState();
  if (selectIsAuthenticated(state) && selectAccessToken(state)) {
    return true;
  }

  const hasSession =
    localStorage.getItem(HAS_SESSION_KEY) === 'true' ||
    localStorage.getItem('sap_anime_has_session') === 'true' ||
    Boolean(getStoredToken());

  if (!hasSession) {
    store.dispatch(setAuthStatus('anonymous'));
    return false;
  }

  if (_sessionRestoreAttempted && !force) {
    return selectIsAuthenticated(store.getState());
  }

  _sessionRestoreAttempted = true;

  try {
    await forceRefresh({ silent: true });
    return selectIsAuthenticated(store.getState());
  } catch (error) {
    if (import.meta.env.DEV) {
      console.info('[TokenManager] Không thể khôi phục phiên từ refresh cookie/storage');
    }
    return false;
  }
};

// ──────────────────────────────────────────
//  INITIALIZATION
// ──────────────────────────────────────────

export const initTokenManager = () => {
  if (_refreshTimer) return;

  const state = store.getState();
  const accessToken = selectAccessToken(state);
  const expiresAt = selectTokenExpiresAt(state);

  _initMultiTabSync();

  if (!accessToken) {
    restoreSession();
    return;
  }

  if (!expiresAt) {
    store.dispatch(setAuthStatus('authenticated'));
    return;
  }

  if (isTokenFullyExpired() || isTokenExpired()) {
    refreshWithMutex();
  } else {
    store.dispatch(setAuthStatus('authenticated'));
    scheduleRefresh(expiresAt);
  }
};

// ──────────────────────────────────────────
//  FORCE REFRESH
// ──────────────────────────────────────────

export const forceRefresh = (options = {}) => {
  if (_refreshMutex) {
    return _refreshMutex;
  }

  if (!options.bypassCooldown) {
    const timeSinceSuccess = Date.now() - _lastSuccessfulRefresh;
    if (timeSinceSuccess < FORCE_REFRESH_COOLDOWN_MS) {
      const currentToken = selectAccessToken(store.getState());
      if (currentToken) {
        return Promise.resolve(currentToken);
      }
    }
  }

  _lastRefreshAttempt = 0;
  return refreshWithMutex(options);
};

// ──────────────────────────────────────────
//  CLEANUP
// ──────────────────────────────────────────

export const cleanup = () => {
  _clearTimer();
  _refreshMutex = null;
  _lastRefreshAttempt = 0;
  _lastSuccessfulRefresh = 0;
  _retryCount = 0;
  _sessionRestoreAttempted = false;
};

export default {
  getTokenExpiry,
  setTokenExpiry,
  clearTokenExpiry,
  isTokenExpired,
  isTokenFullyExpired,
  getTimeUntilExpiry,
  getStoredToken,
  getAccessToken,
  setStoredTokens,
  clearStoredTokens,
  scheduleRefresh,
  initTokenManager,
  restoreSession,
  forceRefresh,
  handleSessionExpired,
  performLogout,
  cleanup,
};
