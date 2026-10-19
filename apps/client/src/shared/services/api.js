/**
 * @file api.js
 * @module Services/Api
 * @description Cấu hình trung tâm cho Axios HTTP Client, bao gồm Interceptors, Token Refresh và Error Formatting.
 */

import axios from "axios";
import { API_BASE_URL, DEFAULT_TIMEOUT, UPLOAD_TIMEOUT, SKIP_REFRESH_URLS } from "@/shared/constants/api-endpoints.constants";
import { forceRefresh, getAccessToken } from "@/shared/utils/token-manager";
import { applyPerformanceInterceptor } from "@/shared/utils/interceptors/axios-performance.interceptor";

// ────────────────────────────────────────────────────────────────────────────────────────────────
// STRUCTURED API ERROR
// ────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Lớp lỗi tùy chỉnh cho các phản hồi từ API
 */
export class ApiError extends Error {
    constructor(message, { status, code, data, originalError } = {}) {
        super(message);
        this.name = "ApiError";
        this.status = status ?? 0;
        this.code = code ?? "UNKNOWN";
        this.data = data ?? null;
        this.original = originalError ?? null;
    }

    get isNetworkError() { return this.status === 0; }
    get isAuthError() { return this.status === 401; }
    get isForbidden() { return this.status === 403; }
    get isNotFound() { return this.status === 404; }
    get isServerError() { return this.status >= 500; }
    get isClientError() { return this.status >= 400 && this.status < 500; }

    /**
     * Chuyển đổi từ lỗi Axios sang ApiError chuẩn hóa
     */
    static fromAxiosError(err) {
        const res = err.response;
        const message = res?.data?.message || err.message || "Đã có lỗi xảy ra khi kết nối server";

        return new ApiError(message, {
            status: res?.status,
            code: res?.data?.code || res?.data?.error?.code || err.code,
            data: res?.data,
            originalError: err,
        });
    }
}

// ────────────────────────────────────────────────────────────────────────────────────────────────
// CSRF TOKEN HELPER
// ────────────────────────────────────────────────────────────────────────────────────────────────

const CSRF_COOKIE_NAME = "XSRF-TOKEN";
const CSRF_HEADER_NAME = "X-CSRF-Token";
const CSRF_PROTECTED_METHODS = new Set(["post", "put", "patch", "delete"]);

/**
 * Đọc giá trị 1 cookie theo tên (cookie không-httpOnly nên JS đọc được).
 * @param {string} name
 * @returns {string|null}
 */
function readCookie(name) {
    const match = document.cookie.match(
        new RegExp(`(?:^|; )${name.replace(/([.$?*|{}()[\]\\/+^])/g, "\\$1")}=([^;]*)`),
    );
    return match ? decodeURIComponent(match[1]) : null;
}

// ────────────────────────────────────────────────────────────────────────────────────────────────
// CIRCUIT BREAKER PATTERN
// ────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Ngăn chặn việc gửi yêu cầu liên tục khi server đang gặp sự cố nghiêm trọng
 */
class CircuitBreaker {
    #failures = 0;
    #state = "CLOSED"; // CLOSED | OPEN | HALF_OPEN
    #openAt = null;

    constructor({ threshold = 5, recoveryMs = 30_000 } = {}) {
        this.threshold = threshold;
        this.recoveryMs = recoveryMs;
    }

    get isOpen() {
        if (this.#state === "OPEN") {
            if (Date.now() - this.#openAt >= this.recoveryMs) {
                this.#state = "HALF_OPEN";
                return false;
            }
            return true;
        }
        return false;
    }

    onSuccess() {
        this.#failures = 0;
        this.#state = "CLOSED";
    }

    onFailure() {
        this.#failures++;
        if (this.#failures >= this.threshold) {
            this.#state = "OPEN";
            this.#openAt = Date.now();
            console.warn(`[CircuitBreaker] Mạch đang MỞ sau ${this.#failures} lỗi liên tiếp. Sẽ phục hồi sau ${this.recoveryMs / 1000}s`);
        }
    }
}

const breaker = new CircuitBreaker({ threshold: 5, recoveryMs: 30_000 });

// ────────────────────────────────────────────────────────────────────────────────────────────────
// REQUEST DEDUPLICATION
// ────────────────────────────────────────────────────────────────────────────────────────────────

const inflightMap = new Map();

/**
 * Tạo khóa định danh cho các yêu cầu GET để tránh gọi lặp lại cùng lúc
 */
function dedupKey(config) {
    if (config.method?.toUpperCase() !== "GET") return null;
    // Bỏ qua các yêu cầu có params quá lớn hoặc đặc biệt
    const paramsStr = config.params ? JSON.stringify(config.params) : "";
    return `${config.url}:${paramsStr}`;
}

// ────────────────────────────────────────────────────────────────────────────────────────────────
// OFFLINE QUEUE
// ────────────────────────────────────────────────────────────────────────────────────────────────

const MAX_OFFLINE_QUEUE = 50;
const OFFLINE_ITEM_TIMEOUT = 30_000;
const offlineQueue = [];
let isOnline = navigator.onLine;

window.addEventListener("online", () => {
    isOnline = true;
    flushOfflineQueue();
});
window.addEventListener("offline", () => {
    isOnline = false;
});

/**
 * Thực thi lại các yêu cầu bị tạm hoãn khi có mạng trở lại
 */
function flushOfflineQueue() {
    if (!offlineQueue.length) return;

    console.info(`[API] Đang xử lý ${offlineQueue.length} yêu cầu trong hàng đợi offline...`);

    while (offlineQueue.length) {
        const { resolve, reject, config, queuedAt } = offlineQueue.shift();

        // Kiểm tra xem yêu cầu đã quá hạn chưa
        if (Date.now() - queuedAt > OFFLINE_ITEM_TIMEOUT) {
            reject(new ApiError("Yêu cầu đã quá hạn trong hàng đợi offline", { code: "OFFLINE_TIMEOUT" }));
            continue;
        }

        resolve(api(config));
    }
}

// ────────────────────────────────────────────────────────────────────────────────────────────────
// AXIOS INSTANCE CREATION
// ────────────────────────────────────────────────────────────────────────────────────────────────

const api = axios.create({
    baseURL: API_BASE_URL,
    timeout: DEFAULT_TIMEOUT,
    headers: { "Content-Type": "application/json" },
    withCredentials: true,
});

api.UPLOAD_TIMEOUT = UPLOAD_TIMEOUT;

// Áp dụng interceptor đo hiệu năng
applyPerformanceInterceptor(api);

// Log cho môi trường Development
if (import.meta.env.DEV) {
    api.interceptors.request.use((config) => {
        console.groupCollapsed(
            `%c→ ${config.method?.toUpperCase()} ${config.url}`,
            "color:#6c9fff;font-weight:bold",
        );
        if (config.params) console.log("params", config.params);
        if (config.data) console.log("body", config.data);
        console.groupEnd();
        return config;
    });
}

// ────────────────────────────────────────────────────────────────────────────────────────────────
// REQUEST INTERCEPTOR
// ────────────────────────────────────────────────────────────────────────────────────────────────

api.interceptors.request.use(
    (config) => {
        // 1. Kiểm tra Circuit Breaker
        if (breaker.isOpen) {
            return Promise.reject(
                new ApiError("Hệ thống tạm thời không khả dụng. Vui lòng thử lại sau.", {
                    status: 503,
                    code: "CIRCUIT_OPEN",
                }),
            );
        }

        // 2. Xử lý Offline
        if (!isOnline && config.method?.toUpperCase() !== "GET") {
            if (offlineQueue.length >= MAX_OFFLINE_QUEUE) {
                return Promise.reject(
                    new ApiError("Hàng đợi offline đã đầy. Vui lòng thử lại khi có mạng.", {
                        code: "OFFLINE_QUEUE_FULL"
                    }),
                );
            }
            return new Promise((resolve, reject) => {
                offlineQueue.push({ resolve, reject, config, queuedAt: Date.now() });
                console.info("[API] Mất mạng — Yêu cầu đã được đưa vào hàng đợi:", config.url);
            });
        }

        // 3. Đính kèm Auth Token
        const token = getAccessToken();

        if (token) {
            if (config.headers && typeof config.headers.set === "function") {
                config.headers.set("Authorization", `Bearer ${token}`);
            } else {
                config.headers.Authorization = `Bearer ${token}`;
            }
        }

        // 4. Đính kèm CSRF token cho request state-changing (chống CSRF
        // — nửa phía client của cơ chế Double-Submit Cookie).
        const method = config.method?.toLowerCase();
        if (method && CSRF_PROTECTED_METHODS.has(method)) {
            const csrfToken = readCookie(CSRF_COOKIE_NAME);
            if (csrfToken) {
                if (config.headers && typeof config.headers.set === "function") {
                    config.headers.set(CSRF_HEADER_NAME, csrfToken);
                } else {
                    config.headers[CSRF_HEADER_NAME] = csrfToken;
                }
            }
        }

        // 5. Quản lý AbortController (hủy yêu cầu khi cần)
        if (!config.signal) {
            const controller = new AbortController();
            config.signal = controller.signal;
            config._controller = controller;
            config.cancel = () => controller.abort();
        }

        // 6. Xử lý FormData (Xóa Content-Type cố định để Browser tự sinh boundary chuẩn multipart)
        if (config.data instanceof FormData) {
            if (config.headers) {
                if (typeof config.headers.delete === "function") {
                    config.headers.delete("Content-Type");
                    config.headers.delete("content-type");
                } else {
                    delete config.headers["Content-Type"];
                    delete config.headers["content-type"];
                }
            }
            if (!config.timeout || config.timeout === DEFAULT_TIMEOUT) {
                config.timeout = UPLOAD_TIMEOUT;
            }
        }

        return config;
    },
    (error) => Promise.reject(error),
);

// ────────────────────────────────────────────────────────────────────────────────────────────────
// RESPONSE INTERCEPTOR & TOKEN REFRESH
// ────────────────────────────────────────────────────────────────────────────────────────────────

api.interceptors.response.use(
    (response) => {
        breaker.onSuccess();

        if (import.meta.env.DEV) {
            console.groupCollapsed(
                `%c← ${response.status} ${response.config.url}`,
                "color:#6fcf97;font-weight:bold",
            );
            console.groupEnd();
        }

        // Xóa entry khỏi deduplication map khi thành công
        const key = dedupKey(response.config);
        if (key) inflightMap.delete(key);

        return response;
    },

    async (error) => {
        // Bỏ qua các yêu cầu bị hủy chủ động
        if (axios.isCancel(error) || error.name === "CanceledError") {
            return Promise.reject(error);
        }

        const originalRequest = error.config;
        const status = error.response?.status;

        // Xóa entry khỏi deduplication map khi thất bại
        const key = dedupKey(originalRequest || {});
        if (key) inflightMap.delete(key);

        // Ghi nhận lỗi cho Circuit Breaker (chỉ lỗi server hoặc mạng)
        if (!status || status >= 500) {
            breaker.onFailure();
        }

        // Tự động Refresh Token khi gặp lỗi 401
        const shouldSkipRefresh = SKIP_REFRESH_URLS.some((u) => originalRequest?.url?.includes(u));
        const hasSession =
            localStorage.getItem("sap_phim_has_session") === "true" ||
            localStorage.getItem("sap_anime_has_session") === "true" ||
            Boolean(localStorage.getItem("sap_phim_access_token"));

        if (status === 401 && !originalRequest?._retry && !shouldSkipRefresh && hasSession) {
            originalRequest._retry = true;

            try {
                // Sử dụng mutex của token-manager để piggyback (single-flight)
                const accessToken = await forceRefresh({ bypassCooldown: true });
                if (!accessToken) {
                    return Promise.reject(new ApiError("Phiên đăng nhập đã hết hạn", { status: 401, code: "NOT_AUTHENTICATED" }));
                }

                if (originalRequest.headers && typeof originalRequest.headers.set === "function") {
                    originalRequest.headers.set("Authorization", `Bearer ${accessToken}`);
                } else {
                    originalRequest.headers.Authorization = `Bearer ${accessToken}`;
                }

                return api(originalRequest);
            } catch (refreshError) {
                if (refreshError instanceof ApiError) {
                    return Promise.reject(refreshError);
                }
                return Promise.reject(ApiError.fromAxiosError(refreshError));
            }
        }

        return Promise.reject(ApiError.fromAxiosError(error));
    },
);

// ────────────────────────────────────────────────────────────────────────────────────────────────
// DEDUP WRAPPER (Monkey patch GET)
// ────────────────────────────────────────────────────────────────────────────────────────────────

const originalGet = api.get.bind(api);

api.get = (url, config = {}) => {
    const k = dedupKey({ method: "GET", url, params: config.params });

    if (k && inflightMap.has(k)) {
        if (import.meta.env.DEV) console.info(`[API] Deduplication hit: ${k}`);
        return inflightMap.get(k);
    }

    const promise = originalGet(url, config);

    if (k) {
        inflightMap.set(k, promise);
        // Xóa khỏi map khi kết thúc (dù thành công hay thất bại)
        promise.finally(() => inflightMap.delete(k));
    }

    return promise;
};

export { API_BASE_URL };
export default api;