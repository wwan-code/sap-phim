/**
 * @file base.service.js
 * @module Services/BaseService
 * @description Lớp dịch vụ cơ sở (BaseService) tích hợp cache LRU, khử trùng lặp request và đo lường hiệu năng.
 */

import api from "./api";
import { measurePerformance } from "@utils/performance.util";

/**
 * @class BaseService
 * @description Lớp cơ sở tích hợp bộ đệm thông minh, chống trùng lặp request và đo lường hiệu năng.
 */
class BaseService {
  /**
   * Khởi tạo BaseService
   * @param {string} serviceName Tên của dịch vụ (dùng cho logging/metrics)
   * @param {Object} options Cấu hình dịch vụ
   */
  constructor(serviceName = "BaseService", options = {}) {
    this.serviceName = serviceName;
    this.options = {
      enableCache: true,
      enableMetrics: true,
      requestTimeout: 10000, // Đồng bộ với DEFAULT_TIMEOUT (10s)
      maxCacheSize: 100,
      ...options,
    };

    // Quản lý các yêu cầu đang chờ xử lý (Deduplication) và Timeout
    this.pendingRequests = new Map();
    this.requestTimeouts = new Map();

    // Hệ thống cache LRU tối ưu
    this.cache = new Map();
    this.cacheTimestamps = new Map();
    this.cacheTimeouts = new Map();
    this.cacheHitRate = { hits: 0, misses: 0 };

    // Cấu hình TTL mặc định cho các loại dữ liệu (ms)
    this.CACHE_TTL = {
      list: 300000,    // 5 phút
      single: 600000,  // 10 phút
      slug: 600000,    // 10 phút
      admin: 30000,    // 30 giây
      search: 5000,    // 5 giây
      static: 3600000, // 1 giờ
      dynamic: 10000,  // 10 giây
    };

    // Các chỉ số hiệu năng
    this.metrics = {
      requests: 0,
      errors: 0,
      totalResponseTime: 0,
      slowestRequest: 0,
      fastestRequest: Infinity,
    };

    // Quản lý hủy yêu cầu (AbortControllers)
    this.abortControllers = new Map();

    this.startTime = Date.now();
  }

  // ──────────────────────────────────────────────────────────────────────
  // QUẢN LÝ CACHE LRU NÂNG CAO O(1)
  // ──────────────────────────────────────────────────────────────────────

  /**
   * Tạo key cache dựa trên prefix và tham số truyền vào
   * @param {string} prefix - Tiền tố của cache key
   * @param {object} [params={}] - Các tham số lọc/phân trang
   * @returns {string} Cache key đã được băm
   */
  _generateCacheKey(prefix, params = {}) {
    if (!params || Object.keys(params).length === 0) {
      return prefix;
    }

    try {
      const sortedParams = Object.keys(params)
        .sort()
        .reduce((acc, key) => {
          const value = params[key];
          acc[key] = typeof value === "object" && value !== null
            ? JSON.stringify(value)
            : String(value);
          return acc;
        }, {});

      const paramsHash = JSON.stringify(sortedParams);
      return `${prefix}:${this._hashString(paramsHash)}`;
    } catch (error) {
      console.error(`[${this.serviceName}][Cache] Lỗi tạo cache key:`, error);
      return `${prefix}:${Date.now()}`;
    }
  }

  /**
   * Hàm băm chuỗi đơn giản để rút gọn key cache
   */
  _hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Lấy dữ liệu từ cache với cơ chế TTL & LRU
   * @param {string} key - Cache key
   * @param {number} [ttl=this.CACHE_TTL.list] - Thời gian sống của cache (ms)
   * @returns {any|null} Dữ liệu trong cache hoặc null
   */
  _getCache(key, ttl = this.CACHE_TTL.list) {
    if (!this.options.enableCache) return null;

    const timestamp = this.cacheTimestamps.get(key);
    if (!timestamp) {
      this.cacheHitRate.misses++;
      return null;
    }

    const age = Date.now() - timestamp;
    if (age > ttl) {
      this._deleteCacheEntry(key);
      this.cacheHitRate.misses++;
      return null;
    }

    // Refresh insertion order để duy trì tính đúng đắn của LRU
    const cachedValue = this.cache.get(key);
    this.cache.delete(key);
    this.cache.set(key, cachedValue);

    this.cacheHitRate.hits++;
    return cachedValue;
  }

  /**
   * Lưu dữ liệu vào cache với cơ chế quản lý bộ nhớ LRU O(1)
   */
  _setCache(key, value, ttl = this.CACHE_TTL.list) {
    if (!this.options.enableCache) return;

    try {
      if (this.cache.size >= this.options.maxCacheSize) {
        this._evictLRU();
      }

      if (this.cacheTimeouts.has(key)) {
        clearTimeout(this.cacheTimeouts.get(key));
      }

      const cachedValue = this._deepClone(value);

      this.cache.set(key, cachedValue);
      this.cacheTimestamps.set(key, Date.now());

      const timeoutId = setTimeout(() => {
        this._deleteCacheEntry(key);
      }, ttl);

      this.cacheTimeouts.set(key, timeoutId);
    } catch (error) {
      console.error(`[${this.serviceName}] Lỗi lưu cache:`, error);
    }
  }

  /**
   * Loại bỏ mục cache cũ nhất (Least Recently Used) trong O(1)
   */
  _evictLRU() {
    const oldestKey = this.cache.keys().next().value;
    if (oldestKey) {
      this._deleteCacheEntry(oldestKey);
    }
  }

  /**
   * Xóa một mục cache và dọn dẹp các tài nguyên liên quan
   */
  _deleteCacheEntry(key) {
    this.cache.delete(key);
    this.cacheTimestamps.delete(key);

    if (this.cacheTimeouts.has(key)) {
      clearTimeout(this.cacheTimeouts.get(key));
      this.cacheTimeouts.delete(key);
    }
  }

  /**
   * Xóa cache theo pattern hoặc xóa tất cả
   */
  clearCache(pattern = "all") {
    if (pattern === "all") {
      this.cacheTimeouts.forEach((timeoutId) => clearTimeout(timeoutId));
      this.cache.clear();
      this.cacheTimestamps.clear();
      this.cacheTimeouts.clear();
      this.cacheHitRate = { hits: 0, misses: 0 };
    } else {
      const regex = new RegExp(pattern);
      for (const key of this.cache.keys()) {
        if (regex.test(key)) {
          this._deleteCacheEntry(key);
        }
      }
    }
  }

  /**
   * Vô hiệu hóa các mục cache liên quan
   */
  _invalidateRelatedCache(patterns = []) {
    const allPatterns = ["list", "slug", "catalog", ...patterns];
    allPatterns.forEach((pattern) => this.clearCache(pattern));
  }

  /**
   * Tải trước và lưu trữ dữ liệu vào cache
   */
  async prefetch(key, fetchFn, ttl = this.CACHE_TTL.list) {
    const cached = this._getCache(key, ttl);
    if (cached) return cached;

    try {
      const data = await fetchFn();
      this._setCache(key, data, ttl);
      return data;
    } catch (error) {
      console.error(`[${this.serviceName}] Lỗi prefetch:`, error);
      return null;
    }
  }

  // ──────────────────────────────────────────────────────────────────────
  // DEDUPLICATION & REQUEST MANAGEMENT (GET ONLY)
  // ──────────────────────────────────────────────────────────────────────

  /**
   * Khử trùng lặp yêu cầu với xử lý timeout (Chỉ áp dụng cho request GET)
   */
  async _deduplicateRequest(url, config = {}) {
    const method = (config.method || "GET").toUpperCase();

    // Đối với các method chỉnh sửa trạng thái (POST, PUT, DELETE), gửi thẳng không qua bộ khử trùng lặp
    if (method !== "GET") {
      return api.request({ url, ...config });
    }

    const key = this._generateRequestKey(url, config);

    if (this.pendingRequests.has(key)) {
      return this.pendingRequests.get(key);
    }

    const abortController = new AbortController();
    this.abortControllers.set(key, abortController);

    const timeoutId = setTimeout(() => {
      abortController.abort();
      this.pendingRequests.delete(key);
      this.abortControllers.delete(key);
      console.warn(`[${this.serviceName}] Yêu cầu quá thời gian (Timeout): ${url}`);
    }, this.options.requestTimeout);

    this.requestTimeouts.set(key, timeoutId);

    const promise = api
      .get(url, { ...config, signal: abortController.signal })
      .finally(() => {
        clearTimeout(timeoutId);
        this.pendingRequests.delete(key);
        this.requestTimeouts.delete(key);
        this.abortControllers.delete(key);
      });

    this.pendingRequests.set(key, promise);
    return promise;
  }

  _generateRequestKey(url, config) {
    const configStr = JSON.stringify({
      params: config.params || {},
      method: config.method || "GET",
    });
    return `${url}:${this._hashString(configStr)}`;
  }

  /**
   * Hủy một yêu cầu đang chờ xử lý
   */
  cancelRequest(url, config = {}) {
    const key = this._generateRequestKey(url, config);
    const controller = this.abortControllers.get(key);

    if (controller) {
      controller.abort();
      this.pendingRequests.delete(key);
      this.abortControllers.delete(key);

      if (this.requestTimeouts.has(key)) {
        clearTimeout(this.requestTimeouts.get(key));
        this.requestTimeouts.delete(key);
      }
    }
  }

  /**
   * Hủy tất cả các yêu cầu đang chờ xử lý
   */
  cancelAllRequests() {
    this.abortControllers.forEach((controller) => controller.abort());
    this.pendingRequests.clear();
    this.abortControllers.clear();
    this.requestTimeouts.forEach((timeoutId) => clearTimeout(timeoutId));
    this.requestTimeouts.clear();
  }

  // ──────────────────────────────────────────────────────────────────────
  // HIỆU NĂNG & TIỆN ÍCH
  // ──────────────────────────────────────────────────────────────────────

  _sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Đo lường hiệu năng của thao tác API
   */
  async _measure(label, fn) {
    if (!this.options.enableMetrics) {
      return fn();
    }

    const startTime = performance.now();
    this.metrics.requests++;

    try {
      const result = await measurePerformance(
        `[${this.serviceName}] ${label}`,
        fn,
        { showTrace: true }
      );

      const duration = performance.now() - startTime;
      this._updateMetrics(duration);

      return result;
    } catch (error) {
      this.metrics.errors++;
      throw error;
    }
  }

  _updateMetrics(duration) {
    this.metrics.totalResponseTime += duration;
    this.metrics.slowestRequest = Math.max(this.metrics.slowestRequest, duration);
    this.metrics.fastestRequest = Math.min(this.metrics.fastestRequest, duration);
  }

  /**
   * Trích xuất và xác thực dữ liệu từ phản hồi API
   */
  _extractData(response) {
    try {
      if (!response) {
        throw new Error("Phản hồi (response) rỗng hoặc không xác định");
      }

      if (response.data) {
        if (response.data.data !== undefined) {
          return response.data.data;
        }
        return response.data;
      }

      return response;
    } catch (error) {
      console.error(`[${this.serviceName}] Lỗi trích xuất dữ liệu:`, error);
      throw new Error("Không thể trích xuất dữ liệu từ phản hồi");
    }
  }

  _extractPagination(response) {
    return response?.data?.pagination || null;
  }

  _validateId(id, entityName = "thực thể") {
    if (id === undefined || id === null) {
      throw new Error(`ID ${entityName} không được để trống`);
    }
    return id;
  }

  /**
   * Loại bỏ các tham số null/undefined/empty trước khi gửi API
   * @param {object} params
   * @returns {object} Clean params
   */
  _cleanParams(params) {
    if (!params) return {};
    const clean = {};
    Object.keys(params).forEach((key) => {
      const value = params[key];
      if (value !== null && value !== undefined && value !== "") {
        clean[key] = value;
      }
    });
    return clean;
  }

  /**
   * Nhân bản sâu đối tượng, ưu tiên structuredClone với fallback
   */
  _deepClone(obj) {
    if (obj === null || typeof obj !== "object") return obj;

    try {
      return structuredClone(obj);
    } catch (e) {
      if (obj instanceof Date) return new Date(obj.getTime());
      if (obj instanceof Array) return obj.map((item) => this._deepClone(item));
      if (obj instanceof Map) {
        const cloned = new Map();
        obj.forEach((v, k) => cloned.set(k, this._deepClone(v)));
        return cloned;
      }
      if (obj instanceof Set) {
        const cloned = new Set();
        obj.forEach((v) => cloned.add(this._deepClone(v)));
        return cloned;
      }
      const cloned = {};
      Object.keys(obj).forEach((k) => cloned[k] = this._deepClone(obj[k]));
      return cloned;
    }
  }

  // ──────────────────────────────────────────────────────────────────────
  // GIÁM SÁT SỨC KHỎE DỊCH VỤ
  // ──────────────────────────────────────────────────────────────────────

  getHealthStatus() {
    const totalRequests = this.cacheHitRate.hits + this.cacheHitRate.misses;
    const hitRate = totalRequests > 0 ? ((this.cacheHitRate.hits / totalRequests) * 100).toFixed(2) : 0;
    const avgResponseTime = this.metrics.requests > 0 ? (this.metrics.totalResponseTime / this.metrics.requests).toFixed(2) : 0;

    return {
      serviceName: this.serviceName,
      uptime: Date.now() - this.startTime,
      cache: {
        size: this.cache.size,
        hitRate: `${hitRate}%`,
        hits: this.cacheHitRate.hits,
        misses: this.cacheHitRate.misses,
      },
      metrics: {
        ...this.metrics,
        avgResponseTime: `${avgResponseTime}ms`,
        errorRate: this.metrics.requests > 0 ? `${((this.metrics.errors / this.metrics.requests) * 100).toFixed(2)}%` : "0%",
      },
      pendingRequests: this.pendingRequests.size,
    };
  }

  destroy() {
    this.cancelAllRequests();
    this.clearCache();
    this.pendingRequests.clear();
    this.abortControllers.clear();
  }
}

export default BaseService;
