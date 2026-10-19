/**
 * @file performance.util.js
 * @module Utils/PerformanceUtil
 * @description Các hàm tối ưu hiệu năng UI (Debounce, Throttle, Memoization, Task Scheduler).
 */

/**
 * Enhanced Debounce
 */
export function debounce(func, wait = 300, options = {}) {
  let timeoutId = null;
  let lastArgs = null;
  let lastThis = null;
  let lastCallTime = null;
  let result = null;
  let isDestroyed = false;

  const { leading = false, trailing = true, maxWait } = options;

  function invokeFunc(time) {
    const args = lastArgs;
    const thisArg = lastThis;

    lastArgs = lastThis = null;
    lastCallTime = time;
    result = func.apply(thisArg, args);
    return result;
  }

  function shouldInvoke(time) {
    const timeSinceLastCall = time - (lastCallTime || 0);
    return (
      lastCallTime === null ||
      timeSinceLastCall >= wait ||
      timeSinceLastCall < 0 ||
      (maxWait && time - lastCallTime >= maxWait)
    );
  }

  function timerExpired() {
    const time = Date.now();
    if (shouldInvoke(time)) {
      return trailingEdge(time);
    }
    timeoutId = setTimeout(timerExpired, wait);
  }

  function trailingEdge(time) {
    timeoutId = null;
    if (trailing && lastArgs) {
      return invokeFunc(time);
    }
    lastArgs = lastThis = null;
    return result;
  }

  function leadingEdge(time) {
    lastCallTime = time;
    timeoutId = setTimeout(timerExpired, wait);
    return leading ? invokeFunc(time) : result;
  }

  function debounced(...args) {
    if (isDestroyed) {
      console.warn("Debounced function called after destroy");
      return result;
    }

    const time = Date.now();
    const isInvoking = shouldInvoke(time);

    lastArgs = args;
    lastThis = this;

    if (isInvoking) {
      if (timeoutId === null) {
        return leadingEdge(time);
      }
      if (maxWait) {
        timeoutId = setTimeout(timerExpired, wait);
        return invokeFunc(time);
      }
    }

    if (timeoutId === null) {
      timeoutId = setTimeout(timerExpired, wait);
    }
    return result;
  }

  debounced.cancel = function () {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
    lastCallTime = timeoutId = lastArgs = lastThis = null;
  };

  debounced.flush = function () {
    return timeoutId === null ? result : trailingEdge(Date.now());
  };

  debounced.pending = function () {
    return timeoutId !== null;
  };

  debounced.destroy = function () {
    debounced.cancel();
    isDestroyed = true;
    lastArgs = lastThis = null;
  };

  return debounced;
}

/**
 * Enhanced Throttle - safe cleanup
 */
export function throttle(func, wait = 300, options = {}) {
  const { leading = true, trailing = true } = options;
  return debounce(func, wait, {
    leading,
    trailing,
    maxWait: wait,
  });
}

/**
 * Memoize - Cache results with TTL & size limit
 */
export function memoize(func, resolver, options = {}) {
  const { maxSize = 100, ttl = Infinity } = options;
  const cache = new Map();
  const timestamps = new Map();
  let accessCount = 0;

  function memoized(...args) {
    let key;
    if (resolver) {
      key = resolver.apply(this, args);
    } else {
      try {
        key = JSON.stringify(args);
      } catch {
        key = args.map(arg => {
          if (typeof arg === "object" && arg !== null) {
            return `[Object:${Object.keys(arg).slice(0, 3)}]`;
          }
          return String(arg);
        }).join("|");
      }
    }

    // Check TTL
    if (cache.has(key)) {
      const timestamp = timestamps.get(key);
      if (Date.now() - timestamp > ttl) {
        cache.delete(key);
        timestamps.delete(key);
      } else {
        return cache.get(key);
      }
    }

    const result = func.apply(this, args);

    // Enforce size limit (LRU)
    if (cache.size >= maxSize) {
      const firstKey = cache.keys().next().value;
      cache.delete(firstKey);
      timestamps.delete(firstKey);
    }

    cache.set(key, result);
    timestamps.set(key, Date.now());
    accessCount++;

    return result;
  }

  memoized.cache = cache;
  memoized.clear = function () {
    cache.clear();
    timestamps.clear();
  };

  memoized.destroy = function () {
    memoized.clear();
  };

  memoized.stats = function () {
    return {
      size: cache.size,
      accessCount,
      maxSize,
    };
  };

  return memoized;
}

/**
 * Once - Execute function once with result caching
 */
export function once(func) {
  let called = false;
  let result;
  let error = null;

  return function (...args) {
    if (!called) {
      called = true;
      try {
        result = func.apply(this, args);
      } catch (e) {
        error = e;
        throw e;
      }
    }
    if (error) throw error;
    return result;
  };
}

/**
 * Batch updates - Aggregate multiple updates
 */
export function batchUpdates(callback, wait = 100) {
  let batch = [];
  let timeoutId = null;
  let isDestroyed = false;

  function flush() {
    if (batch.length > 0) {
      const updates = [...batch];
      batch = [];
      try {
        callback(updates);
      } catch (error) {
        console.error("Error in batchUpdates callback:", error);
      }
    }
    timeoutId = null;
  }

  return function (update) {
    if (isDestroyed) {
      console.warn("Batch updates called after destroy");
      return;
    }

    batch.push(update);

    if (timeoutId === null) {
      timeoutId = setTimeout(flush, wait);
    }
  };
}

/**
 * Lazy load - Defer expensive operations
 */
export function lazyLoad(loader, options = {}) {
  let promise = null;
  let result = null;
  let error = null;
  const { timeout = 30000 } = options;

  return async function () {
    if (result) return result;
    if (error) throw error;

    if (!promise) {
      let timeoutId;
      const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(
          () => reject(new Error("Lazy load timeout")),
          timeout,
        );
      });

      promise = Promise.race([
        loader().then((res) => {
          clearTimeout(timeoutId);
          result = res;
          return res;
        }),
        timeoutPromise,
      ]).catch((err) => {
        clearTimeout(timeoutId);
        error = err;
        throw err;
      });
    }

    return promise;
  };
}

/**
 * Retry
 */
export async function retry(func, options = {}) {
  const {
    retries = 3,
    delay = 1000,
    backoff = 2,
    maxDelay = 30000,
    onRetry = null,
  } = options;

  let lastError;

  for (let i = 0; i <= retries; i++) {
    try {
      return await func();
    } catch (error) {
      lastError = error;

      if (i < retries) {
        const waitTime = Math.min(delay * Math.pow(backoff, i), maxDelay);

        if (onRetry) {
          onRetry(i + 1, retries, waitTime, error);
        }

        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }
    }
  }

  throw lastError;
}

/**
 * Measure performance
 */
export async function measurePerformance(label, func, options = {}) {
  const { showTrace = false } = options;
  const start = performance.now();

  try {
    const result = await func();
    const duration = performance.now() - start;

    if (showTrace) {
      console.log(`[Performance] ${label}: ${duration.toFixed(2)}ms`);
    }

    return result;
  } catch (error) {
    const duration = performance.now() - start;
    console.error(
      `[Performance] ${label} failed after ${duration.toFixed(2)}ms:`,
      error,
    );
    throw error;
  }
}

/**
 * Async Queue - Process tasks sequentially or in parallel
 */
export class AsyncQueue {
  constructor(concurrency = 1) {
    this.concurrency = concurrency;
    this.running = 0;
    this.queue = [];
    this.stats = {
      processed: 0,
      failed: 0,
      totalTime: 0,
    };
  }

  async push(task, priority = 0) {
    return new Promise((resolve, reject) => {
      this.queue.push({
        task,
        resolve,
        reject,
        priority,
        created_at: Date.now(),
      });
      // Sort by priority (higher first)
      this.queue.sort((a, b) => b.priority - a.priority);
      this.process();
    });
  }

  async process() {
    if (this.running >= this.concurrency || this.queue.length === 0) {
      return;
    }

    this.running++;
    const { task, resolve, reject, created_at: _createdAt } = this.queue.shift();
    const startTime = Date.now();

    try {
      const result = await task();
      this.stats.processed++;
      this.stats.totalTime += Date.now() - startTime;
      resolve(result);
    } catch (error) {
      this.stats.failed++;
      reject(error);
    } finally {
      this.running--;
      this.process();
    }
  }

  clear() {
    this.queue = [];
  }

  get pending() {
    return this.queue.length;
  }

  getStats() {
    return { ...this.stats, pending: this.pending };
  }
}

/**
 * IntersectionObserver helper with advanced cleanup
 */
export class ObserverManager {
  constructor(callback, options) {
    this.callback = callback;
    this.observer = new IntersectionObserver(callback, options);
    this.elements = new Set();
    this.stats = { observed: 0, unobserved: 0 };
  }

  observe(element) {
    if (element && !this.elements.has(element)) {
      try {
        this.observer.observe(element);
        this.elements.add(element);
        this.stats.observed++;
      } catch (error) {
        console.error("Error observing element:", error);
      }
    }
  }

  unobserve(element) {
    if (element && this.elements.has(element)) {
      this.observer.unobserve(element);
      this.elements.delete(element);
      this.stats.unobserved++;
    }
  }

  disconnect() {
    this.observer.disconnect();
    this.elements.clear();
  }

  get observedCount() {
    return this.elements.size;
  }

  getStats() {
    return { ...this.stats, current: this.observedCount };
  }
}

/**
 * Request Scheduler - Schedule work during idle time
 */
export function scheduleWork(callback, options = {}) {
  const { timeout = 1000 } = options;
  let id;

  const promise = new Promise((resolve) => {
    if ("requestIdleCallback" in window) {
      id = requestIdleCallback(
        () => {
          callback();
          resolve();
        },
        { timeout },
      );
    } else {
      // Fallback for browsers without requestIdleCallback
      id = setTimeout(() => {
        callback();
        resolve();
      }, 0);
    }
  });

  promise.cancel = () => {
    if ("requestIdleCallback" in window) {
      cancelIdleCallback(id);
    } else {
      clearTimeout(id);
    }
  };

  return promise;
}

export default {
  debounce,
  throttle,
  memoize,
  once,
  batchUpdates,
  lazyLoad,
  retry,
  measurePerformance,
  AsyncQueue,
  ObserverManager,
  scheduleWork,
};
