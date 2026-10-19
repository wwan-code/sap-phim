/**
 * @file circuit-breaker.util.js
 * @module Utils
 * @description Triển khai cơ chế circuit breaker để bảo vệ hệ thống khỏi lỗi dây chuyền và fail-fast.
 */

import { logger } from "./logger.js";
import { EventEmitter } from "events";

// ════════════════════════════════════════
// TRẠNG THÁI & CẤU HÌNH (STATES & CONFIG)
// ════════════════════════════════════════

/**
 * Các trạng thái vận hành của Circuit Breaker.
 */
export const CircuitState = {
  CLOSED: "CLOSED",       // Hoạt động bình thường - các yêu cầu được thông qua.
  OPEN: "OPEN",           // Gặp sự cố - các yêu cầu bị từ chối ngay lập tức (fail-fast).
  HALF_OPEN: "HALF_OPEN", // Thử nghiệm - cho phép một lượng nhỏ yêu cầu để kiểm tra phục hồi.
};

/**
 * Cấu hình mặc định cho một mạch bảo vệ.
 */
const DEFAULT_CONFIG = {
  failureThreshold: 5,     // Số lần lỗi liên tiếp tối đa trước khi ngắt mạch (Mở mạch).
  resetTimeoutMs: 30000,   // Thời gian chờ trước khi thử phục hồi (30s).
  halfOpenMaxCalls: 3,     // Số yêu cầu thử nghiệm tối đa trong trạng thái Nửa mở.
  successThreshold: 2,     // Số lần thành công liên tiếp để khôi phục (Đóng mạch).
  monitorIntervalMs: 5000, // Khoảng thời gian phát tín hiệu sức khỏe (Health events).
  name: "default",
};

/**
 * Lỗi chuyên biệt của Circuit Breaker.
 */
export class CircuitBreakerError extends Error {
  /**
   * @param {string} message - Thông điệp lỗi.
   * @param {string} state - Trạng thái mạch tại thời điểm lỗi.
   * @param {Object} stats - Số liệu thống kê của mạch.
   */
  constructor(message, state, stats) {
    super(message);
    this.name = "CircuitBreakerError";
    this.state = state;
    this.stats = stats;
    this.code = "CIRCUIT_OPEN";
  }
}

// ════════════════════════════════════════
// LỚP CIRCUIT BREAKER (MAIN CLASS)
// ════════════════════════════════════════

/**
 * Lớp điều phối cơ chế ngắt mạch tự động.
 *
 * @description Quản lý vòng đời, trạng thái và thống kê hiệu năng của một mạch bảo vệ cụ thể.
 */
export class CircuitBreaker extends EventEmitter {
  /**
   * @param {string} name - Tên mạch bảo vệ.
   * @param {Object} [config] - Cấu hình tùy chỉnh.
   */
  constructor(name, config = {}) {
    super();
    this.name = name;
    this.config = { ...DEFAULT_CONFIG, ...config, name };
    this.state = CircuitState.CLOSED;
    this.stats = {
      failures: 0,
      successes: 0,
      consecutiveSuccesses: 0,
      consecutiveFailures: 0,
      halfOpenCalls: 0,
      totalCalls: 0,
      rejectedCalls: 0,
      lastFailureTime: null,
      lastSuccessTime: null,
      openedAt: null,
      stateChanges: [],
    };
    this.resetTimer = null;
    this.monitorTimer = null;
    this.startMonitoring();
  }

  /**
   * Thực thi một tác vụ (hàm) dưới sự giám sát của mạch.
   *
   * @param {Function} fn - Hàm cần thực thi (async).
   * @param {...any} args - Các tham số của hàm.
   * @returns {Promise<any>} Kết quả của hàm thực thi.
   * @throws {CircuitBreakerError} Nếu mạch đang mở hoặc đạt giới hạn thử nghiệm.
   */
  async execute(fn, ...args) {
    // Kiểm tra nếu mạch đang Mở (OPEN)
    if (this.state === CircuitState.OPEN) {
      this.stats.rejectedCalls++;
      throw new CircuitBreakerError(
        `Mạch bảo vệ '${this.name}' đang MỞ (OPEN)`,
        this.state,
        this.getStats(),
      );
    }

    // Kiểm tra giới hạn trong trạng thái Nửa mở (HALF_OPEN)
    if (this.state === CircuitState.HALF_OPEN) {
      if (this.stats.halfOpenCalls >= this.config.halfOpenMaxCalls) {
        this.stats.rejectedCalls++;
        throw new CircuitBreakerError(
          `Mạch bảo vệ '${this.name}' đang NỬA MỞ (HALF_OPEN) và đã đạt giới hạn thử nghiệm`,
          this.state,
          this.getStats(),
        );
      }
      this.stats.halfOpenCalls++;
    }

    this.stats.totalCalls++;
    const startTime = Date.now();

    try {
      const result = await fn(...args);
      this.onSuccess(Date.now() - startTime);
      return result;
    } catch (error) {
      this.onFailure(Date.now() - startTime, error);
      throw error;
    }
  }

  /**
   * Xử lý khi tác vụ thực thi thành công.
   * @private
   */
  onSuccess(durationMs) {
    this.stats.successes++;
    this.stats.consecutiveSuccesses++;
    this.stats.consecutiveFailures = 0;
    this.stats.lastSuccessTime = Date.now();

    if (this.state === CircuitState.HALF_OPEN) {
      if (this.stats.consecutiveSuccesses >= this.config.successThreshold) {
        this.transitionTo(CircuitState.CLOSED);
      }
    }

    this.emit("success", { name: this.name, durationMs, state: this.state });
  }

  /**
   * Xử lý khi tác vụ thực thi thất bại.
   * @private
   */
  onFailure(durationMs, error) {
    this.stats.failures++;
    this.stats.consecutiveFailures++;
    this.stats.consecutiveSuccesses = 0;
    this.stats.lastFailureTime = Date.now();

    logger.warn(
      `[CircuitBreaker] Mạch '${this.name}' ghi nhận lỗi #${this.stats.consecutiveFailures}: ${error?.message}`,
      { durationMs },
    );

    if (this.state === CircuitState.CLOSED) {
      if (this.stats.consecutiveFailures >= this.config.failureThreshold) {
        this.transitionTo(CircuitState.OPEN);
      }
    } else if (this.state === CircuitState.HALF_OPEN) {
      // Bất kỳ lỗi nào trong trạng thái Nửa mở đều khiến mạch Mở lại ngay lập tức
      this.transitionTo(CircuitState.OPEN);
    }

    this.emit("failure", {
      name: this.name,
      durationMs,
      error,
      state: this.state,
    });
  }

  /**
   * Thực hiện chuyển đổi trạng thái mạch.
   * @private
   */
  transitionTo(newState) {
    const oldState = this.state;
    this.state = newState;
    this.stats.stateChanges.push({
      from: oldState,
      to: newState,
      timestamp: Date.now(),
    });

    // Giới hạn ring buffer để tránh memory leak dần
    if (this.stats.stateChanges.length > 100) {
      this.stats.stateChanges = this.stats.stateChanges.slice(-100);
    }

    if (newState === CircuitState.OPEN) {
      this.stats.openedAt = Date.now();
      this.scheduleReset();
    } else if (newState === CircuitState.CLOSED) {
      this.clearResetTimer();
      this.resetHalfOpenStats();
    } else if (newState === CircuitState.HALF_OPEN) {
      this.resetHalfOpenStats();
    }

    logger.info(
      `[CircuitBreaker] Mạch '${this.name}' chuyển trạng thái: ${oldState} → ${newState}`,
    );
    this.emit("stateChange", { name: this.name, from: oldState, to: newState });
  }

  /**
   * Lên lịch thử nghiệm phục hồi mạch.
   * @private
   */
  scheduleReset() {
    this.clearResetTimer();
    this.resetTimer = setTimeout(() => {
      this.transitionTo(CircuitState.HALF_OPEN);
    }, this.config.resetTimeoutMs);
  }

  /**
   * Xóa bộ đếm thời gian phục hồi.
   * @private
   */
  clearResetTimer() {
    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
      this.resetTimer = null;
    }
  }

  /**
   * Đặt lại các chỉ số tạm thời của trạng thái Nửa mở.
   * @private
   */
  resetHalfOpenStats() {
    this.stats.halfOpenCalls = 0;
    this.stats.consecutiveSuccesses = 0;
  }

  /**
   * Khởi chạy trình theo dõi sức khỏe mạch.
   * @private
   */
  startMonitoring() {
    this.monitorTimer = setInterval(() => {
      this.emit("health", this.getStats());
    }, this.config.monitorIntervalMs);

    if (this.monitorTimer.unref) this.monitorTimer.unref();
  }

  /**
   * Dừng trình theo dõi sức khỏe.
   */
  stopMonitoring() {
    if (this.monitorTimer) {
      clearInterval(this.monitorTimer);
      this.monitorTimer = null;
    }
  }

  /**
   * Xuất các chỉ số thống kê hiện tại của mạch.
   * @returns {Object} Thống kê chi tiết.
   */
  getStats() {
    return {
      name: this.name,
      state: this.state,
      config: this.config,
      stats: { ...this.stats },
      isHealthy: this.state === CircuitState.CLOSED,
      canExecute: this.state !== CircuitState.OPEN,
      openDuration:
        this.state === CircuitState.OPEN && this.stats.openedAt
          ? Date.now() - this.stats.openedAt
          : 0,
    };
  }

  /**
   * Can thiệp thủ công: Ép buộc Mở mạch.
   */
  forceOpen() {
    if (this.state !== CircuitState.OPEN) {
      this.transitionTo(CircuitState.OPEN);
    }
  }

  /**
   * Can thiệp thủ công: Ép buộc Đóng mạch.
   */
  forceClose() {
    if (this.state !== CircuitState.CLOSED) {
      this.clearResetTimer();
      this.transitionTo(CircuitState.CLOSED);
    }
  }

  /**
   * Hủy mạch bảo vệ và giải phóng tài nguyên hệ thống.
   */
  destroy() {
    this.stopMonitoring();
    this.clearResetTimer();
    this.removeAllListeners();
  }
}

// ════════════════════════════════════════
// QUẢN LÝ TẬP TRUNG (REGISTRY)
// ════════════════════════════════════════

/**
 * Quản lý tập trung toàn bộ các mạch bảo vệ trong ứng dụng.
 */
export class CircuitBreakerRegistry {
  constructor() {
    this.breakers = new Map();
  }

  /**
   * Lấy một mạch đã tồn tại hoặc tạo mới.
   * @param {string} name - Tên mạch.
   * @param {Object} [config] - Cấu hình.
   */
  get(name, config = {}) {
    if (!this.breakers.has(name)) {
      this.breakers.set(name, new CircuitBreaker(name, config));
    }
    return this.breakers.get(name);
  }

  /**
   * Loại bỏ và hủy một mạch bảo vệ.
   */
  remove(name) {
    const breaker = this.breakers.get(name);
    if (breaker) {
      breaker.destroy();
      this.breakers.delete(name);
    }
  }

  /**
   * Lấy thống kê của toàn bộ hệ thống mạch.
   */
  getAllStats() {
    const stats = {};
    for (const [name, breaker] of this.breakers) {
      stats[name] = breaker.getStats();
    }
    return stats;
  }

  /**
   * Kiểm tra xem tất cả các mạch có đang ở trạng thái khỏe mạnh không.
   */
  healthCheck() {
    return Array.from(this.breakers.values()).every(
      (b) => b.state === CircuitState.CLOSED,
    );
  }

  /**
   * Hủy toàn bộ các mạch đang quản lý.
   */
  destroyAll() {
    for (const breaker of this.breakers.values()) {
      breaker.destroy();
    }
    this.breakers.clear();
  }
}

/** Singleton Registry cho toàn bộ ứng dụng */
export const circuitBreakerRegistry = new CircuitBreakerRegistry();

/**
 * Helper: Tạo hoặc lấy mạch bảo vệ một cách nhanh chóng.
 */
export const createCircuitBreaker = (name, config) => {
  return circuitBreakerRegistry.get(name, config);
};

/**
 * Danh sách các mạch bảo vệ cấu hình sẵn cho các nghiệp vụ quan trọng.
 */
export const ImageProcessingBreakers = {
  upload: createCircuitBreaker("upload", {
    failureThreshold: 5,
    resetTimeoutMs: 30000,
    halfOpenMaxCalls: 3,
    successThreshold: 2,
  }),

  esrgan: createCircuitBreaker("esrgan", {
    failureThreshold: 3,
    resetTimeoutMs: 60000,
    halfOpenMaxCalls: 2,
    successThreshold: 1,
  }),

  faceDetection: createCircuitBreaker("face-detection", {
    failureThreshold: 5,
    resetTimeoutMs: 30000,
    halfOpenMaxCalls: 3,
    successThreshold: 2,
  }),

  storage: createCircuitBreaker("storage", {
    failureThreshold: 5,
    resetTimeoutMs: 15000,
    halfOpenMaxCalls: 2,
    successThreshold: 2,
  }),
};

export default CircuitBreaker;

