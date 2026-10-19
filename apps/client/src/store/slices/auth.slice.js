/**
 * @file auth.slice.js
 * @module Store/Slices/Auth
 * @description Quản lý trạng thái xác thực và phân quyền người dùng (Authentication & Authorization) với State Machine và Cache Factory Selectors.
 */

import { createSlice, createSelector } from '@reduxjs/toolkit';
import {
  REFRESH_BUFFER_MS,
  SELECTOR_CACHE_MAX_SIZE,
} from '@/shared/constants/auth.constants';

// ──────────────────────────────────────────
//  HELPERS
// ──────────────────────────────────────────

/**
 * Đảm bảo state.accounts luôn là một mảng hợp lệ
 * @param {Object} state
 */
const sanitizeAccounts = (state) => {
  if (!Array.isArray(state.accounts)) {
    state.accounts = [];
  }
};

/**
 * Giới hạn kích thước của Map cache để tránh memory leak
 * @template K, V
 * @param {Map<K, V>} map
 * @param {K} key
 * @param {V} value
 */
const cacheWithLimit = (map, key, value) => {
  if (map.size >= SELECTOR_CACHE_MAX_SIZE) {
    // Xóa entry cũ nhất (first inserted key)
    map.delete(map.keys().next().value);
  }
  map.set(key, value);
};

// ──────────────────────────────────────────
//  INITIAL STATE
// ──────────────────────────────────────────

const initialState = {
  user: null,
  accessToken: null,
  refreshToken: null,
  tokenExpiresAt: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
  accounts: [],
  status: 'initializing', // 'initializing' | 'authenticated' | 'refreshing' | 'anonymous' | 'expired' | 'error'
};

// ──────────────────────────────────────────
//  SLICE
// ──────────────────────────────────────────

export const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    /**
     * Lưu thông tin xác thực sau khi đăng nhập hoặc làm mới token thành công.
     */
    setCredentials: (state, action) => {
      const { user, accessToken, refreshToken, expiresAt } = action.payload || {};
      sanitizeAccounts(state);

      if (user !== undefined) state.user = user;
      if (accessToken !== undefined) state.accessToken = accessToken;
      if (refreshToken !== undefined) state.refreshToken = refreshToken;
      if (expiresAt !== undefined) state.tokenExpiresAt = expiresAt;

      state.isAuthenticated = Boolean(state.accessToken || state.user);
      state.status = state.isAuthenticated ? 'authenticated' : 'anonymous';
      state.error = null;

      // Lưu trữ account metadata (chỉ lưu user info, không lưu token nhạy cảm)
      if (state.user?.id) {
        const existingIndex = state.accounts.findIndex(
          (acc) => acc.user?.id === state.user.id
        );
        const entry = { user: state.user };

        if (existingIndex >= 0) {
          state.accounts[existingIndex] = entry;
        } else {
          state.accounts.push(entry);
        }
      }
    },

    /**
     * Cập nhật thông tin user (profile, preferences, wallet...) với deep merge an toàn.
     */
    updateUser: (state, action) => {
      if (!state.user) return;
      sanitizeAccounts(state);

      const { preferences, wallet, ...rest } = action.payload || {};

      // Merge root fields
      state.user = { ...state.user, ...rest };

      // Deep merge preferences
      if (preferences) {
        state.user.preferences = {
          ...(state.user.preferences ?? {}),
          ...preferences,
        };
        // Sync cosmetic fields được flatten từ preferences nếu có
        if (preferences.avatar_frame !== undefined) {
          state.user.avatar_frame = preferences.avatar_frame;
        }
        if (preferences.name_effect !== undefined) {
          state.user.name_effect = preferences.name_effect;
        }
      }

      // Deep merge wallet
      if (wallet) {
        state.user.wallet = {
          ...(state.user.wallet ?? {}),
          ...wallet,
        };
      }

      // Sync lại vào danh sách accounts
      const index = state.accounts.findIndex(
        (acc) => acc.user?.id === state.user.id
      );
      if (index !== -1) {
        state.accounts[index].user = state.user;
      }
    },

    /**
     * Cập nhật access token (sau khi refresh token).
     */
    setAccessToken: (state, action) => {
      state.accessToken = action.payload;
    },

    /**
     * Cập nhật refresh token.
     */
    setRefreshToken: (state, action) => {
      state.refreshToken = action.payload;
    },

    /**
     * Cập nhật thời gian hết hạn token (Unix timestamp ms).
     */
    setTokenExpiresAt: (state, action) => {
      state.tokenExpiresAt = action.payload;
    },

    /**
     * Đăng xuất tài khoản hiện tại.
     */
    logout: (state) => {
      sanitizeAccounts(state);

      if (state.user?.id) {
        state.accounts = state.accounts.filter(
          (acc) => acc.user?.id !== state.user.id
        );
      }

      state.user = null;
      state.accessToken = null;
      state.refreshToken = null;
      state.tokenExpiresAt = null;
      state.isAuthenticated = false;
      state.status = 'anonymous';
      state.error = null;
    },

    /**
     * Đánh dấu phiên làm việc đã hết hạn.
     */
    sessionExpired: (state) => {
      sanitizeAccounts(state);

      if (state.user?.id) {
        state.accounts = state.accounts.filter(
          (acc) => acc.user?.id !== state.user.id
        );
      }

      state.user = null;
      state.accessToken = null;
      state.refreshToken = null;
      state.tokenExpiresAt = null;
      state.isAuthenticated = false;
      state.status = 'expired';
      state.error = null;
    },

    /**
     * Cập nhật auth status trực tiếp trong state machine.
     */
    setAuthStatus: (state, action) => {
      state.status = action.payload;
    },

    /**
     * Chuyển đổi giữa các tài khoản đã đăng nhập.
     */
    switchAccount: () => {
      if (import.meta.env.DEV) {
        console.warn('[AuthSlice] switchAccount yêu cầu hỗ trợ chuyển đổi phiên từ máy chủ backend.');
      }
    },

    /**
     * Xóa một tài khoản khỏi danh sách metadata.
     */
    removeAccount: (state, action) => {
      sanitizeAccounts(state);
      const userId = action.payload;
      state.accounts = state.accounts.filter((acc) => acc.user?.id !== userId);
    },

    /**
     * Cập nhật trạng thái loading.
     */
    setLoading: (state, action) => {
      state.isLoading = action.payload;
    },
    setAuthLoading: (state, action) => {
      state.isLoading = action.payload;
    },

    /**
     * Cập nhật thông báo lỗi.
     */
    setError: (state, action) => {
      state.error = action.payload;
      state.isLoading = false;
      state.status = 'error';
    },
    setAuthError: (state, action) => {
      state.error = action.payload;
      state.isLoading = false;
      state.status = 'error';
    },

    /**
     * Xóa thông báo lỗi.
     */
    clearError: (state) => {
      state.error = null;
    },

    /**
     * Cập nhật trạng thái Online/Offline.
     */
    setOnlineStatus: (state, action) => {
      if (!state.user) return;
      state.user.is_online = action.payload;

      sanitizeAccounts(state);
      const index = state.accounts.findIndex(
        (acc) => acc.user?.id === state.user.id
      );
      if (index !== -1) {
        state.accounts[index].user = {
          ...state.accounts[index].user,
          is_online: action.payload,
        };
      }
    },
  },
});

// ──────────────────────────────────────────
//  ACTIONS
// ──────────────────────────────────────────

export const {
  setCredentials,
  updateUser,
  setAccessToken,
  setRefreshToken,
  setTokenExpiresAt,
  logout,
  sessionExpired,
  setAuthStatus,
  switchAccount,
  removeAccount,
  setLoading,
  setAuthLoading,
  setError,
  setAuthError,
  clearError,
  setOnlineStatus,
} = authSlice.actions;

// ──────────────────────────────────────────
//  BASE SELECTORS
// ──────────────────────────────────────────

export const selectUser = (state) => state?.auth?.user ?? null;
export const selectCurrentUser = (state) => state?.auth?.user ?? null;
export const selectAccessToken = (state) => state?.auth?.accessToken ?? null;
export const selectRefreshToken = (state) => state?.auth?.refreshToken ?? null;
export const selectTokenExpiresAt = (state) => state?.auth?.tokenExpiresAt ?? null;
export const selectIsAuthenticated = (state) => Boolean(state?.auth?.isAuthenticated);
export const selectAuthLoading = (state) => Boolean(state?.auth?.isLoading);
export const selectAuthError = (state) => state?.auth?.error ?? null;
export const selectAccounts = (state) => state?.auth?.accounts ?? [];
export const selectAuthStatus = (state) => state?.auth?.status ?? 'initializing';
export const selectIsSessionExpired = (state) => state?.auth?.status === 'expired';

// ──────────────────────────────────────────
//  DERIVED SELECTORS
// ──────────────────────────────────────────

export const selectUserRoleSlugs = createSelector([selectUser], (user) => {
  if (!user?.roles || !Array.isArray(user.roles)) return [];
  return user.roles.map((r) =>
    typeof r === 'object' && r !== null ? r.slug || r.name || '' : String(r)
  );
});

export const selectUserRoles = selectUserRoleSlugs;

export const selectUserPermissions = createSelector([selectUser], (user) => {
  return user?.permissions ?? [];
});

/**
 * Trả về true nếu token đã hết hạn hoặc sắp hết hạn (trong buffer REFRESH_BUFFER_MS).
 * Không memoize qua createSelector vì cần so sánh thời gian thực với Date.now().
 */
export const selectIsTokenExpired = (state) => {
  const expiresAt = selectTokenExpiresAt(state);
  if (!expiresAt) return true;
  return Date.now() >= expiresAt - REFRESH_BUFFER_MS;
};

/**
 * Trả về true nếu token đã hoàn toàn quá hạn.
 */
export const selectIsTokenFullyExpired = (state) => {
  const expiresAt = selectTokenExpiresAt(state);
  if (!expiresAt) return true;
  return Date.now() >= expiresAt;
};

/**
 * Số mili-giây còn lại đến khi token hết hạn.
 */
export const selectTimeUntilExpiry = (state) => {
  const expiresAt = selectTokenExpiresAt(state);
  if (!expiresAt) return 0;
  return expiresAt - Date.now();
};

export const selectPrimaryRole = createSelector([selectUser], (user) => {
  if (!user?.roles?.length || !Array.isArray(user.roles)) return null;
  const sorted = [...user.roles].sort(
    (a, b) => (b?.priority ?? 0) - (a?.priority ?? 0)
  );
  const first = sorted[0];
  return typeof first === 'object' && first !== null
    ? first.slug || first.name || null
    : String(first);
});

// ──────────────────────────────────────────
//  FACTORY SELECTORS (Map-cached + size-limited)
// ──────────────────────────────────────────

const _hasRoleCache = new Map();

/**
 * Factory Selector: Kiểm tra vai trò người dùng (có cache tránh tạo hàm selector mới liên tục).
 * @param {string} roleSlug
 * @returns {(state: object) => boolean}
 */
export const selectHasRole = (roleSlug) => {
  if (_hasRoleCache.has(roleSlug)) return _hasRoleCache.get(roleSlug);
  const selector = (state) => selectUserRoleSlugs(state).includes(roleSlug);
  cacheWithLimit(_hasRoleCache, roleSlug, selector);
  return selector;
};

const _hasAnyRoleCache = new Map();

/**
 * Factory Selector: Kiểm tra người dùng có ít nhất một trong các vai trò.
 * @param {string[]} roleSlugs
 * @returns {(state: object) => boolean}
 */
export const selectHasAnyRole = (roleSlugs) => {
  const key = [...roleSlugs].sort().join(',');
  if (_hasAnyRoleCache.has(key)) return _hasAnyRoleCache.get(key);
  const selector = (state) => {
    const userRoles = selectUserRoleSlugs(state);
    return roleSlugs.some((role) => userRoles.includes(role));
  };
  cacheWithLimit(_hasAnyRoleCache, key, selector);
  return selector;
};

const _hasPermissionCache = new Map();

/**
 * Factory Selector: Kiểm tra quyền hạn cụ thể của người dùng.
 * @param {string} permissionSlug
 * @returns {(state: object) => boolean}
 */
export const selectHasPermission = (permissionSlug) => {
  if (_hasPermissionCache.has(permissionSlug)) {
    return _hasPermissionCache.get(permissionSlug);
  }
  const selector = (state) =>
    selectUserPermissions(state).includes(permissionSlug);
  cacheWithLimit(_hasPermissionCache, permissionSlug, selector);
  return selector;
};

export default authSlice.reducer;
