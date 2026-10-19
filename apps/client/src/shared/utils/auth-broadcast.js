/**
 * @file auth-broadcast.js
 * @module Shared/Utils/AuthBroadcast
 * @description Đồng bộ trạng thái xác thực đa tab (Multi-tab Authentication Sync) qua BroadcastChannel API.
 */

import { MULTI_TAB_CHANNEL_NAME } from '@/shared/constants/auth.constants';

// ──────────────────────────────────────────
//  BROADCAST EVENT TYPES
// ──────────────────────────────────────────

/**
 * @enum {string}
 */
export const AUTH_BROADCAST_EVENTS = Object.freeze({
  /** User đăng nhập thành công ở một tab */
  LOGIN: 'AUTH_LOGIN',

  /** User đăng xuất ở một tab */
  LOGOUT: 'AUTH_LOGOUT',

  /** Token được refresh thành công ở một tab — các tab khác dùng token mới */
  TOKEN_REFRESHED: 'AUTH_TOKEN_REFRESHED',

  /** Server revoke session — tất cả tab phải logout ngay */
  FORCE_LOGOUT: 'AUTH_FORCE_LOGOUT',

  /** Phiên đăng nhập hết hạn ở một tab — các tab khác cũng chuyển sang trạng thái expired */
  SESSION_EXPIRED: 'AUTH_SESSION_EXPIRED',

  /** Quyền hạn user thay đổi (admin action) — reload roles */
  ROLE_CHANGED: 'AUTH_ROLE_CHANGED',

  /** User switch account ở một tab */
  ACCOUNT_SWITCHED: 'AUTH_ACCOUNT_SWITCHED',
});

// ──────────────────────────────────────────
//  AUTH BROADCAST CLASS
// ──────────────────────────────────────────

class AuthBroadcastService {
  /** @type {BroadcastChannel | null} */
  #channel = null;

  /** @type {Map<string, Set<Function>>} */
  #handlers = new Map();

  /** Unique ID của tab này — dùng để filter out self-messages */
  #tabId =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `tab-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  #isSupported = typeof BroadcastChannel !== 'undefined';

  /**
   * Khởi tạo BroadcastChannel và start listening.
   * @returns {AuthBroadcastService} this (để chaining)
   */
  init() {
    if (!this.#isSupported) {
      if (import.meta.env.DEV) {
        console.warn(
          '[AuthBroadcast] Trình duyệt không hỗ trợ BroadcastChannel. Tính năng sync đa tab bị tắt.'
        );
      }
      return this;
    }

    if (this.#channel) return this; // Already initialized

    this.#channel = new BroadcastChannel(MULTI_TAB_CHANNEL_NAME);

    this.#channel.onmessage = (event) => {
      const message = event.data;
      if (!message) return;

      // Bỏ qua message từ chính tab này hoặc message đã cũ (> 5000ms)
      if (message.tabId === this.#tabId) return;
      if (message.timestamp && Date.now() - message.timestamp > 5000) {
        if (import.meta.env.DEV) {
          console.log(`[AuthBroadcast] Bỏ qua message quá hạn: ${message.type}`);
        }
        return;
      }

      // Dispatch tới tất cả handlers đã đăng ký cho event type này
      const handlers = this.#handlers.get(message.type);
      if (handlers) {
        handlers.forEach((handler) => {
          try {
            handler(message.payload ?? {});
          } catch (err) {
            console.error('[AuthBroadcast] Lỗi xử lý handler:', err);
          }
        });
      }
    };

    this.#channel.onmessageerror = (event) => {
      console.error('[AuthBroadcast] Lỗi nhận message:', event);
    };

    if (import.meta.env.DEV) {
      console.log(`[AuthBroadcast] Đã khởi tạo thành công. Tab ID: ${this.#tabId}`);
    }

    return this;
  }

  /**
   * Broadcast một event tới tất cả các tab khác.
   * @param {string} type - AUTH_BROADCAST_EVENTS value
   * @param {Object} [payload={}]
   */
  emit(type, payload = {}) {
    if (!this.#channel) return;

    const message = {
      type,
      payload,
      tabId: this.#tabId,
      timestamp: Date.now(),
    };

    try {
      this.#channel.postMessage(message);
    } catch (err) {
      console.error('[AuthBroadcast] Lỗi khi gửi broadcast:', err);
    }
  }

  /**
   * Đăng ký handler cho một event type.
   * @param {string} type - AUTH_BROADCAST_EVENTS value
   * @param {Function} handler
   * @returns {() => void} Unsubscribe function
   */
  on(type, handler) {
    if (!this.#handlers.has(type)) {
      this.#handlers.set(type, new Set());
    }
    this.#handlers.get(type).add(handler);

    return () => {
      this.#handlers.get(type)?.delete(handler);
    };
  }

  /**
   * Hủy đăng ký handler.
   * @param {string} type
   * @param {Function} handler
   */
  off(type, handler) {
    this.#handlers.get(type)?.delete(handler);
  }

  /**
   * Lấy Tab ID của tab hiện tại.
   * @returns {string}
   */
  get tabId() {
    return this.#tabId;
  }

  /**
   * Kiểm tra BroadcastChannel có được hỗ trợ không.
   * @returns {boolean}
   */
  get isSupported() {
    return this.#isSupported;
  }

  /**
   * Dọn dẹp resources (đóng channel).
   */
  destroy() {
    this.#channel?.close();
    this.#channel = null;
    this.#handlers.clear();
  }
}

export const authBroadcast = new AuthBroadcastService();
export default authBroadcast;
