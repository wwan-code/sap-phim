/**
 * @file socket-client.js
 * @module Shared/Lib/SocketClient
 * @description Trung tâm điều phối kết nối Socket.IO Client toàn cục theo chuẩn Kiến trúc Vòng đời Socket (Socket Lifecycle Architecture).
 * Tích hợp Dual State Machine (Connection + Auth), Connection Mutex tuần tự hóa, giao thức Soft Re-Authentication không gián đoạn transport,
 * Room Reconciliation tự động và hệ thống Telemetry/Diagnostics.
 */

import { io } from "socket.io-client";

import { retainJobRoom, releaseJobRoom } from "@/shared/utils/job-lifecycle.util";
import {
  SOCKET_EVENTS,
  CONNECTION_STATUS,
  CONNECTION_STATES,
  AUTH_STATES,
  SOCKET_ERROR_CODES,
} from "@/shared/constants/socket-events.constants";
import { store } from "@/store";
import { logout as logoutAction } from "@/store/slices/auth.slice";
import { getAccessToken, clearStoredTokens, forceRefresh } from "@/shared/utils/token-manager";
import toast from "react-hot-toast";

/**
 * Mutex xếp hàng bất đồng bộ để tuần tự hóa các chuyển đổi trạng thái kết nối
 */
class AsyncMutex {
  #queue = Promise.resolve();

  run(task) {
    const next = this.#queue.then(async () => {
      return task();
    }).catch((err) => {
      if (import.meta.env.DEV) {
        console.error('[Socket][Mutex] Lỗi thực thi hàng đợi Mutex:', err);
      }
      throw err;
    });

    this.#queue = next.catch(() => {});
    return next;
  }
}

class SocketClient {
  constructor() {
    /** @type {import('socket.io-client').Socket | null} */
    this.socket = null;

    // ── 1. Dual State Machine ──
    this.connectionState = CONNECTION_STATES.DISCONNECTED;
    this.authState = AUTH_STATES.ANONYMOUS;
    this.status = CONNECTION_STATUS.DISCONNECTED; // Legacy compatibility

    // ── 2. Connection Mutex & Serialization ──
    this._mutex = new AsyncMutex();
    this._currentRawToken = null;
    this._lastTraceId = null;

    // ── 3. Telemetry & Metrics ──
    this.latency = 0;
    this._connectedAt = null;
    this._reconnectAttempts = 0;
    this.stateListeners = new Set();
    this.statusListeners = new Set(); // Legacy compatibility

    // ── 4. Subscription & Deduplication Registry ──
    this.activeSubscriptions = new Map(); // key -> { type: 'job'|'episode', id, params }
    this.seenEventIds = new Set();
    this.maxSeenEventIds = 200;

    // ── 5. Latency Telemetry Heartbeat ──
    this.heartbeatInterval = 25000;
    this.heartbeatTimer = null;

    // ── 6. Visibility & Diagnostics Setup ──
    this._boundOnVisibilityChange = this._handleVisibilityChange.bind(this);
    if (typeof window !== "undefined") {
      document.addEventListener("visibilitychange", this._boundOnVisibilityChange);

      if (import.meta.env.DEV) {
        window.__SAP_SOCKET_DIAGNOSTICS__ = () => this.getDiagnostics();
      }
    }
  }

  // ════════════════════════════════════════
  // 1. STATE MACHINE TRANSITIONS
  // ════════════════════════════════════════

  _setConnectionState(newState) {
    if (this.connectionState === newState) return;
    const oldState = this.connectionState;
    this.connectionState = newState;

    // Đồng bộ legacy status
    if (newState === CONNECTION_STATES.CONNECTED) {
      this.status = this.authState === AUTH_STATES.AUTHENTICATED
        ? CONNECTION_STATUS.AUTHENTICATED
        : CONNECTION_STATUS.GUEST;
    } else if (newState === CONNECTION_STATES.CONNECTING) {
      this.status = CONNECTION_STATUS.CONNECTING;
    } else if (newState === CONNECTION_STATES.RECONNECTING) {
      this.status = CONNECTION_STATUS.RECONNECTING;
    } else if (newState === CONNECTION_STATES.ERROR) {
      this.status = CONNECTION_STATUS.ERROR;
    } else if (newState === CONNECTION_STATES.DISCONNECTED) {
      this.status = CONNECTION_STATUS.DISCONNECTED;
    }

    if (import.meta.env.DEV) {
      console.log(`[Socket][Connection] State: ${oldState} -> ${newState}`);
    }

    this._notifyStateChange();
  }

  _setAuthState(newAuthState) {
    if (this.authState === newAuthState) return;
    const oldAuthState = this.authState;
    this.authState = newAuthState;

    // Đồng bộ legacy status khi đang CONNECTED
    if (this.connectionState === CONNECTION_STATES.CONNECTED) {
      this.status = newAuthState === AUTH_STATES.AUTHENTICATED
        ? CONNECTION_STATUS.AUTHENTICATED
        : CONNECTION_STATUS.GUEST;
    }

    if (import.meta.env.DEV) {
      console.log(`[Socket][Auth] State: ${oldAuthState} -> ${newAuthState}`);
    }

    this._notifyStateChange();
  }

  _notifyStateChange() {
    const snapshot = {
      connectionState: this.connectionState,
      authState: this.authState,
      status: this.status,
      latency: this.latency,
      isConnected: this.isConnected(),
      isAuthenticated: this.isAuthenticated(),
      isGuest: this.isGuest(),
    };

    this.stateListeners.forEach((listener) => {
      try {
        listener(snapshot);
      } catch (err) {
        console.error('[Socket][StateListener] Error:', err);
      }
    });

    this.statusListeners.forEach((listener) => {
      try {
        listener(this.status);
      } catch (err) {
        console.error('[Socket][StatusListener] Error:', err);
      }
    });
  }

  // ════════════════════════════════════════
  // 2. CONNECTION MUTEX & LIFECYCLE
  // ════════════════════════════════════════

  /**
   * Khởi tạo kết nối Socket (True Singleton, Thread-Safe qua Mutex)
   * @param {string} [tokenOverride]
   * @returns {Promise<Object>} socket instance
   */
  async connect(tokenOverride) {
    return this._mutex.run(() => this._doConnect(tokenOverride));
  }

  async _doConnect(tokenOverride) {
    const rawToken = tokenOverride !== undefined ? tokenOverride : getAccessToken();
    this._currentRawToken = rawToken;

    const formattedToken = rawToken
      ? rawToken.startsWith("Bearer ")
        ? rawToken
        : `Bearer ${rawToken}`
      : "";

    // 1. Nếu instance socket đã tồn tại
    if (this.socket) {
      if (this.socket.connected) {
        // Socket đã kết nối -> Kiểm tra xem token có cần re-auth không
        if (this.socket.auth?.token !== formattedToken) {
          await this._doUpdateAuth(rawToken);
        }
        return this.socket;
      }

      // Socket đang trong quá trình kết nối hoặc chờ retry
      if (this.socket.active) {
        return this.socket;
      }

      // Socket đang disconnected -> cập nhật auth và kích hoạt kết nối lại
      this._setConnectionState(CONNECTION_STATES.CONNECTING);
      this._setAuthState(rawToken ? AUTH_STATES.AUTHENTICATING : AUTH_STATES.ANONYMOUS);
      this.socket.auth = {
        token: formattedToken,
        traceId: this._generateTraceId(),
      };
      this.socket.connect();
      return this.socket;
    }

    // 2. Khởi tạo instance Socket.IO Server DUY NHẤT (One Socket Instance)
    this._setConnectionState(CONNECTION_STATES.CONNECTING);
    this._setAuthState(rawToken ? AUTH_STATES.AUTHENTICATING : AUTH_STATES.ANONYMOUS);

    const serverUrl = import.meta.env.VITE_WS_URL || window.location.origin;
    const traceId = this._generateTraceId();

    this.socket = io(serverUrl, {
      path: "/socket.io",
      transports: ["polling", "websocket"],
      auth: {
        token: formattedToken,
        traceId,
      },
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
      randomizationFactor: 0.5,
      timeout: 20000,
      withCredentials: true,
    });

    this._registerCoreListeners();
    return this.socket;
  }

  /**
   * Cập nhật xác thực người dùng qua Giao thức Soft Re-Authentication (không ngắt kết nối)
   * @param {string|null} token
   * @returns {Promise<void>}
   */
  async updateAuth(token) {
    return this._mutex.run(() => this._doUpdateAuth(token));
  }

  async _doUpdateAuth(token) {
    const rawToken = token !== undefined ? token : getAccessToken();
    const formattedToken = rawToken
      ? rawToken.startsWith("Bearer ")
        ? rawToken
        : `Bearer ${rawToken}`
      : "";

    // Bỏ qua nếu token không thay đổi và trạng thái xác thực đã ổn định
    if (this._currentRawToken === rawToken && this.socket && this.socket.connected) {
      if (rawToken && this.authState === AUTH_STATES.AUTHENTICATED) return;
      if (!rawToken && this.authState === AUTH_STATES.ANONYMOUS) return;
    }

    this._currentRawToken = rawToken;

    // Nếu chưa khởi tạo socket -> kết nối mới
    if (!this.socket) {
      return this._doConnect(rawToken);
    }

    const traceId = this._generateTraceId();

    // Trường hợp 1: Socket đang CONNECTED -> Thực hiện Soft Re-Authentication qua Socket Event
    if (this.socket.connected) {
      if (rawToken) {
        this._setAuthState(AUTH_STATES.RE_AUTHENTICATING);

        try {
          const res = await this.emitWithAck(
            SOCKET_EVENTS.TOKEN_REFRESH,
            { token: formattedToken, traceId },
            8000
          );

          if (res?.success) {
            this.socket.auth = {
              ...this.socket.auth,
              token: formattedToken,
              traceId,
            };
            this._setAuthState(AUTH_STATES.AUTHENTICATED);
            this._resubscribeAll();

            if (import.meta.env.DEV) {
              console.log(`[Socket][Auth] Soft Re-Auth thành công cho user ${res.userId || 'N/A'}`);
            }
          } else {
            throw new Error(res?.message || 'Soft re-auth thất bại');
          }
        } catch (error) {
          console.warn(`[Socket][Auth] Soft re-auth thất bại (${error.message}). Đang xử lý fallback...`);
          this._setAuthState(AUTH_STATES.EXPIRED);

          // Fallback: Thử refresh token lần cuối hoặc chuyển về Guest
          forceRefresh({ silent: true })
            .then((refreshedToken) => {
              if (refreshedToken && refreshedToken !== rawToken) {
                this.updateAuth(refreshedToken);
              } else {
                this._setAuthState(AUTH_STATES.ANONYMOUS);
              }
            })
            .catch(() => {
              this._setAuthState(AUTH_STATES.ANONYMOUS);
            });
        }
      } else {
        // Chuyển sang tư cách Khách (Guest) khi đăng xuất
        this._setAuthState(AUTH_STATES.ANONYMOUS);
        this.socket.auth = {
          ...this.socket.auth,
          token: "",
          traceId,
        };

        this.emitWithAck(SOCKET_EVENTS.TOKEN_REFRESH, { token: "", traceId }, 5000)
          .catch(() => { /* Ignored */ });
      }
      return;
    }

    // Trường hợp 2: Socket chưa kết nối hoặc đang reconnecting
    this.socket.auth = {
      ...this.socket.auth,
      token: formattedToken,
      traceId,
    };
    this._setAuthState(rawToken ? AUTH_STATES.AUTHENTICATING : AUTH_STATES.ANONYMOUS);

    if (!this.socket.active) {
      this.socket.connect();
    }
  }

  /**
   * Ngắt kết nối Socket hoàn toàn (chủ động)
   */
  async disconnect() {
    return this._mutex.run(() => {
      this._stopHeartbeat();

      if (this.socket) {
        this.socket.removeAllListeners();
        this.socket.disconnect();
        this.socket = null;
      }

      this._currentRawToken = null;
      this._setConnectionState(CONNECTION_STATES.DISCONNECTED);
      this._setAuthState(AUTH_STATES.ANONYMOUS);
    });
  }

  // ════════════════════════════════════════
  // 3. CORE EVENT LISTENERS
  // ════════════════════════════════════════

  _registerCoreListeners() {
    if (!this.socket) return;

    // ── CONNECT ──
    this.socket.on(SOCKET_EVENTS.CONNECT, () => {
      this._connectedAt = Date.now();
      this._reconnectAttempts = 0;
      const isAuth = Boolean(this.socket.auth?.token);

      this._setAuthState(isAuth ? AUTH_STATES.AUTHENTICATED : AUTH_STATES.ANONYMOUS);
      this._setConnectionState(CONNECTION_STATES.CONNECTED);
      this._startHeartbeat();
      this._resubscribeAll();

      if (import.meta.env.DEV) {
        console.log(`[Socket][Client] Đã kết nối (socketId: ${this.socket.id}, Auth: ${isAuth ? "Yes" : "Guest"})`);
      }
    });

    // ── DISCONNECT ──
    this.socket.on(SOCKET_EVENTS.DISCONNECT, (reason) => {
      this._stopHeartbeat();
      this._connectedAt = null;

      if (reason === "io client disconnect") {
        this._setConnectionState(CONNECTION_STATES.DISCONNECTED);
      } else {
        this._setConnectionState(CONNECTION_STATES.RECONNECTING);
      }

      if (import.meta.env.DEV) {
        console.warn(`[Socket][Client] Ngắt kết nối. Lý do: ${reason}`);
      }

      if (reason === "io server disconnect") {
        // Bị server chủ động ngắt -> Thử kết nối lại
        this.socket?.connect();
      }
    });

    // ── CONNECT_ERROR ──
    this.socket.on(SOCKET_EVENTS.CONNECT_ERROR, (error) => {
      this._stopHeartbeat();
      this._reconnectAttempts++;
      this._setConnectionState(CONNECTION_STATES.ERROR);

      const errorCode = error?.data?.code;
      const isTokenError =
        errorCode === SOCKET_ERROR_CODES.TOKEN_EXPIRED ||
        errorCode === SOCKET_ERROR_CODES.TOKEN_INVALID ||
        errorCode === SOCKET_ERROR_CODES.TOKEN_REVOKED ||
        error?.message === "jwt expired" ||
        error?.message === "Invalid token";

      if (import.meta.env.DEV) {
        if (isTokenError) {
          console.warn(`[Socket][Client] Token hết hạn/không hợp lệ (${error.message}). Đang tự động làm mới token...`);
        } else {
          console.error(`[Socket][Client] Lỗi kết nối: ${error.message} (Code: ${errorCode || "N/A"})`);
        }
      }

      // Xử lý tự động làm mới token khi lỗi bắt tay do token
      if (isTokenError) {
        this._setAuthState(AUTH_STATES.EXPIRED);
        if (this.socket.auth?.token) {
          forceRefresh({ silent: true })
            .then((newAccessToken) => {
              if (newAccessToken) {
                this.updateAuth(newAccessToken);
              } else {
                this.updateAuth(null);
              }
            })
            .catch(() => {
              this.updateAuth(null);
            });
        }
      }
    });

    // ── WELCOME ──
    this.socket.on(SOCKET_EVENTS.WELCOME, (data) => {
      if (import.meta.env.DEV) {
        console.log("[Socket][Client] Server Welcome:", data);
      }
    });

    // ── FORCE LOGOUT ──
    this.socket.on(SOCKET_EVENTS.FORCE_LOGOUT, (payload) => {
      console.warn("[Socket][Client] Nhận lệnh Force Logout từ máy chủ:", payload);
      toast.error(payload?.message || "Phiên đăng nhập của bạn đã kết thúc từ thiết bị khác", {
        id: "force-logout-toast",
        duration: 5000,
      });

      clearStoredTokens();
      store.dispatch(logoutAction());
      this.updateAuth(null);
    });

    // ── PERMISSIONS UPDATED ──
    this.socket.on(SOCKET_EVENTS.PERMISSIONS_UPDATED, (payload) => {
      if (import.meta.env.DEV) {
        console.log("[Socket][Client] Quyền hạn người dùng đã thay đổi:", payload);
      }
      toast.success(payload?.message || "Quyền hạn của bạn đã được cập nhật", {
        id: "permissions-updated-toast",
      });
    });

    // ── HEARTBEAT ACK (Latency Telemetry) ──
    this.socket.on(SOCKET_EVENTS.HEARTBEAT_ACK, (payload) => {
      if (payload?.clientTime) {
        this.latency = Math.max(0, Date.now() - payload.clientTime);
        this._notifyStateChange();
      }
    });
  }

  // ════════════════════════════════════════
  // 4. HEARTBEAT & LATENCY TELEMETRY
  // ════════════════════════════════════════

  _startHeartbeat() {
    this._stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (!this.socket || !this.socket.connected) return;
      const clientTime = Date.now();
      this.socket.emit(SOCKET_EVENTS.HEARTBEAT, { clientTime });
    }, this.heartbeatInterval);
  }

  _stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  _handleVisibilityChange() {
    if (typeof document === "undefined") return;

    if (document.visibilityState === "visible") {
      if (this.socket && !this.socket.connected && !this.socket.active) {
        if (import.meta.env.DEV) {
          console.log("[Socket][Client] Tab hoạt động lại -> Kích hoạt kết nối Socket...");
        }
        this.socket.connect();
      }
    }
  }

  // ════════════════════════════════════════
  // 5. ROOM RECONCILIATION ENGINE
  // ════════════════════════════════════════

  _resubscribeAll() {
    if (!this.socket || !this.socket.connected || this.activeSubscriptions.size === 0) {
      return;
    }

    if (import.meta.env.DEV) {
      console.log(`[Socket][Client] Room Reconciliation: Tự động phục hồi ${this.activeSubscriptions.size} subscriptions...`);
    }

    this.activeSubscriptions.forEach((sub) => {
      if (sub.type === "job") {
        this.socket.emit(SOCKET_EVENTS.JOB_SUBSCRIBE, { jobId: sub.id, jobType: sub.params?.jobType || "movie" });
      } else if (sub.type === "episode") {
        this.socket.emit(SOCKET_EVENTS.EPISODE_SUBSCRIBE, { episodeId: sub.id });
      }
    });
  }

  /** @description Retain a job room for each independent consumer. */
  subscribeJob(jobId, jobType = "movie") {
    if (!jobId || !retainJobRoom(this.activeSubscriptions, jobId, jobType)) return;
    if (this.socket && this.socket.connected) this.socket.emit(SOCKET_EVENTS.JOB_SUBSCRIBE, { jobId, jobType });
  }

  /** @description Leave a job room only after its final consumer releases it. */
  unsubscribeJob(jobId, jobType = "movie") {
    if (!jobId || !releaseJobRoom(this.activeSubscriptions, jobId, jobType)) return;
    if (this.socket && this.socket.connected) this.socket.emit(SOCKET_EVENTS.JOB_UNSUBSCRIBE, { jobId, jobType });
  }

  subscribeEpisode(episodeId) {
    const key = `episode:${episodeId}`;
    this.activeSubscriptions.set(key, { type: "episode", id: episodeId });

    if (this.socket && this.socket.connected) {
      this.socket.emit(SOCKET_EVENTS.EPISODE_SUBSCRIBE, { episodeId });
    }
  }

  unsubscribeEpisode(episodeId) {
    const key = `episode:${episodeId}`;
    this.activeSubscriptions.delete(key);

    if (this.socket && this.socket.connected) {
      this.socket.emit(SOCKET_EVENTS.EPISODE_UNSUBSCRIBE, { episodeId });
    }
  }

  // ════════════════════════════════════════
  // 6. EVENT EMISSION & DEDUPLICATION
  // ════════════════════════════════════════

  trackEventId(eventId) {
    if (!eventId) return true;

    if (this.seenEventIds.has(eventId)) {
      return false;
    }

    this.seenEventIds.add(eventId);
    if (this.seenEventIds.size > this.maxSeenEventIds) {
      const firstEntry = this.seenEventIds.values().next().value;
      this.seenEventIds.delete(firstEntry);
    }

    return true;
  }

  on(eventName, handler) {
    if (!this.socket) {
      this.connect();
    }

    this.socket?.on(eventName, handler);
    return () => {
      this.socket?.off(eventName, handler);
    };
  }

  off(eventName, handler) {
    this.socket?.off(eventName, handler);
  }

  emit(eventName, data, callback) {
    if (!this.socket) {
      this.connect();
    }
    this.socket?.emit(eventName, data, callback);
  }

  emitWithAck(eventName, data, timeoutMs = 10000) {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.socket.connected) {
        return reject(new Error("Socket chưa kết nối"));
      }

      let timer = null;

      const ackCallback = (response) => {
        if (timer) clearTimeout(timer);
        if (response?.success === false || response?.ok === false) {
          const err = new Error(response?.message || "Lỗi xử lý Socket Ack");
          err.data = response;
          reject(err);
        } else {
          resolve(response?.data !== undefined ? response.data : response);
        }
      };

      timer = setTimeout(() => {
        reject(new Error(`Quá thời gian phản hồi cho sự kiện: ${eventName}`));
      }, timeoutMs);

      this.socket.emit(eventName, data, ackCallback);
    });
  }

  // ════════════════════════════════════════
  // 7. OBSERVABILITY & DIAGNOSTICS API
  // ════════════════════════════════════════

  getDiagnostics() {
    return {
      connectionState: this.connectionState,
      authState: this.authState,
      status: this.status,
      socketId: this.socket?.id || null,
      connected: Boolean(this.socket?.connected),
      transport: this.socket?.io?.engine?.transport?.name || "unknown",
      latency: this.latency,
      reconnectAttempts: this._reconnectAttempts,
      uptimeMs: this._connectedAt ? Date.now() - this._connectedAt : 0,
      activeSubscriptionsCount: this.activeSubscriptions.size,
      activeSubscriptions: Array.from(this.activeSubscriptions.keys()),
      lastTraceId: this._lastTraceId,
    };
  }

  onStateChange(listener) {
    this.stateListeners.add(listener);
    listener({
      connectionState: this.connectionState,
      authState: this.authState,
      status: this.status,
      latency: this.latency,
      isConnected: this.isConnected(),
      isAuthenticated: this.isAuthenticated(),
      isGuest: this.isGuest(),
    });
    return () => {
      this.stateListeners.delete(listener);
    };
  }

  onStatusChange(listener) {
    this.statusListeners.add(listener);
    listener(this.status);
    return () => {
      this.statusListeners.delete(listener);
    };
  }

  getStatus() {
    return this.status;
  }

  getSocket() {
    return this.socket;
  }

  isConnected() {
    return this.connectionState === CONNECTION_STATES.CONNECTED;
  }

  isAuthenticated() {
    return this.authState === AUTH_STATES.AUTHENTICATED;
  }

  isGuest() {
    return this.authState === AUTH_STATES.ANONYMOUS;
  }

  _generateTraceId() {
    this._lastTraceId = `client-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    return this._lastTraceId;
  }
}

export const socketClient = new SocketClient();
export default socketClient;
