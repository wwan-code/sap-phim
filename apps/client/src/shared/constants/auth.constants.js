/**
 * @file auth.constants.js
 * @module Constants/AuthConstants
 * @description Single source of truth định nghĩa các hằng số về token timing, auth storage keys và auth state.
 */

// ──────────────────────────────────────────
//  TOKEN TIMING
// ──────────────────────────────────────────

/**
 * Khoảng đệm trước khi token hết hạn để trigger proactive refresh.
 * Token được coi là "sắp hết hạn" nếu còn < 30 giây.
 */
export const REFRESH_BUFFER_MS = 30_000;

/**
 * Khoảng thời gian tối thiểu giữa 2 lần refresh liên tiếp.
 * Ngăn chặn refresh storm khi nhiều nơi cùng trigger.
 */
export const MIN_REFRESH_INTERVAL_MS = 10_000;

/**
 * Delay retry khi gặp lỗi mạng transient (không phải auth error).
 */
export const REFRESH_RETRY_DELAY_MS = 30_000;

/**
 * Số lần retry tối đa trước khi từ bỏ và logout.
 */
export const MAX_REFRESH_RETRIES = 3;

// ──────────────────────────────────────────
//  INACTIVITY / SESSION
// ──────────────────────────────────────────

/**
 * Thời gian không hoạt động tối đa trước khi auto-logout (30 phút).
 */
export const INACTIVITY_TIMEOUT_MS = 30 * 60_000;

/**
 * Thời gian trước khi timeout để hiện warning dialog (5 phút).
 */
export const INACTIVITY_WARNING_MS = 5 * 60_000;

// ──────────────────────────────────────────
//  MULTI-TAB SYNC
// ──────────────────────────────────────────

/**
 * Tên BroadcastChannel dùng để sync auth state giữa các tab.
 */
export const MULTI_TAB_CHANNEL_NAME = 'sap_phim_auth_sync';

// ──────────────────────────────────────────
//  SELECTOR / CACHE
// ──────────────────────────────────────────

/**
 * Số lượng entries tối đa trong selector cache Map.
 * Ngăn memory leak khi role slugs được tạo động.
 */
export const SELECTOR_CACHE_MAX_SIZE = 100;

export default {
  REFRESH_BUFFER_MS,
  MIN_REFRESH_INTERVAL_MS,
  REFRESH_RETRY_DELAY_MS,
  MAX_REFRESH_RETRIES,
  INACTIVITY_TIMEOUT_MS,
  INACTIVITY_WARNING_MS,
  MULTI_TAB_CHANNEL_NAME,
  SELECTOR_CACHE_MAX_SIZE,
};
