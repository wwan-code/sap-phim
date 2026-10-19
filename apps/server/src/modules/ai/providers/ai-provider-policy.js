/**
 * @file ai-provider-policy.js
 * @module AI_Provider_Policy
 * @description Chính sách miễn phí, ngân sách bền vững và hủy HTTP dùng chung cho các provider AI.
 */

export const AI_EXECUTION_LIMITS = Object.freeze({
  fast: Object.freeze({ deadlineMs: 30000, maxRequests: 2, maxPasses: 1 }),
  auto: Object.freeze({ deadlineMs: 90000, maxRequests: 4, maxPasses: 2 }),
  deep: Object.freeze({ deadlineMs: 120000, maxRequests: 4, maxPasses: 2 }),
});

// Text models reviewed against https://ai.google.dev/gemini-api/docs/pricing.
export const GEMINI_FREE_TEXT_MODELS = Object.freeze([
  "gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-3.5-flash-lite",
  "gemini-3.6-flash", "gemini-3.8-flash",
]);

/** Lỗi an toàn để pipeline trả lại bằng chứng xác minh khi AI không khả dụng. */
export class AIProviderError extends Error {
  constructor(code, message, { retryable = false, retryAfterMs = 0, provider, cause } = {}) {
    super(message, { cause });
    this.name = "AIProviderError";
    this.code = code;
    this.retryable = retryable;
    this.retryAfterMs = retryAfterMs;
    this.provider = provider;
  }
}

/** Tạo ngân sách dùng chung cho mọi lượt tổng hợp, fallback và retry của cùng job. */
export const createExecutionBudget = ({
  mode = "auto", startedAt = Date.now(), requestCount = 0, passCount = 0,
  onRequest, onPass, now = Date.now,
} = {}) => {
  const safeMode = Object.hasOwn(AI_EXECUTION_LIMITS, mode) ? mode : "auto";
  const parsedStart = typeof startedAt === "number" ? startedAt : new Date(startedAt).getTime();
  return {
    mode: safeMode,
    startedAt: Number.isFinite(parsedStart) ? parsedStart : now(),
    requestCount: Number.isSafeInteger(requestCount) && requestCount >= 0 ? requestCount : 0,
    passCount: Number.isSafeInteger(passCount) && passCount >= 0 ? passCount : 0,
    ...AI_EXECUTION_LIMITS[safeMode], onRequest, onPass, now,
  };
};

/** Chuẩn hóa một object đã khôi phục từ DB mà vẫn giữ tham chiếu ngân sách chung. */
export const normalizeExecutionBudget = (budget, mode = "auto") => {
  const target = budget || {};
  Object.assign(target, createExecutionBudget({ ...target, mode: target.mode || mode }));
  return target;
};

/** Không cho cấu hình của request nới lỏng giới hạn tài nguyên hệ thống. */
export const assertExecutionAvailable = (budget, signal) => {
  if (signal?.aborted) {
    if (signal.reason?.code === "AI_DEADLINE_EXCEEDED") throw signal.reason;
    throw new AIProviderError("AI_CANCELLED", "Yêu cầu AI đã bị hủy.");
  }
  const limits = AI_EXECUTION_LIMITS[budget.mode] || AI_EXECUTION_LIMITS.auto;
  const remainingMs = budget.startedAt + limits.deadlineMs - budget.now();
  if (remainingMs <= 0) {
    throw new AIProviderError("AI_DEADLINE_EXCEEDED", "Đã hết thời gian xử lý AI.", { retryable: true });
  }
  return remainingMs;
};

/** Ghi nhận lượt tổng hợp trước khi gọi provider; bộ đếm không reset khi retry. */
export const consumeSynthesisPass = async (budget, signal, onBudgetUpdate) => {
  assertExecutionAvailable(budget, signal);
  const { maxPasses } = AI_EXECUTION_LIMITS[budget.mode];
  if (budget.passCount >= maxPasses) {
    throw new AIProviderError("AI_PASS_BUDGET_EXCEEDED", "Đã đạt giới hạn lượt tổng hợp AI.");
  }
  budget.passCount += 1;
  try {
    await (budget.onPass || onBudgetUpdate)?.(budgetSnapshot(budget));
  } catch (cause) {
    throw new AIProviderError("AI_BUDGET_PERSIST_FAILED", "Không thể ghi nhận ngân sách AI.", { cause });
  }
};

/** Chỉ chia sẻ số liệu ngân sách với nơi lưu trữ, không chia sẻ khóa hoặc prompt. */
const budgetSnapshot = (budget, metadata = {}) => ({
  startedAt: budget.startedAt, requestCount: budget.requestCount,
  passCount: budget.passCount, mode: budget.mode, ...metadata,
});

/**
 * Thực hiện đúng một HTTP request với AbortSignal và lưu ngân sách trước khi gửi.
 * Discovery cũng tính vào giới hạn; SDK/HTTP client không được tự retry bên trong.
 */
export const runBudgetedRequest = async ({
  budget, signal, provider, operation, timeoutMs, onBudgetUpdate,
}, request) => {
  assertExecutionAvailable(budget, signal);
  if (budget.requestCount >= AI_EXECUTION_LIMITS[budget.mode].maxRequests) {
    throw new AIProviderError("AI_REQUEST_BUDGET_EXCEEDED", "Đã đạt giới hạn request AI.");
  }
  budget.requestCount += 1;
  try {
    await (budget.onRequest || onBudgetUpdate)?.(budgetSnapshot(budget, { provider, operation }));
  } catch (cause) {
    throw new AIProviderError("AI_BUDGET_PERSIST_FAILED", "Không thể ghi nhận ngân sách AI.", { cause });
  }
  const remainingMs = assertExecutionAvailable(budget, signal);
  const requestMs = Math.max(1, Math.min(remainingMs, Number.isFinite(timeoutMs) ? timeoutMs : remainingMs));
  const controller = new AbortController();
  const abortFromParent = () => controller.abort(
    signal.reason?.code === "AI_DEADLINE_EXCEEDED" ? signal.reason
      : new AIProviderError("AI_CANCELLED", "Yêu cầu AI đã bị hủy."),
  );
  signal?.addEventListener("abort", abortFromParent, { once: true });
  const timeout = setTimeout(() => controller.abort(new AIProviderError(
    "AI_DEADLINE_EXCEEDED", "Đã hết thời gian xử lý AI.", { retryable: true },
  )), requestMs);
  let onAbort;
  const aborted = new Promise((_, reject) => {
    onAbort = () => reject(controller.signal.reason);
    controller.signal.addEventListener("abort", onAbort, { once: true });
  });
  try {
    if (signal?.aborted) abortFromParent();
    if (controller.signal.aborted) throw controller.signal.reason;
    return await Promise.race([request(controller.signal, requestMs), aborted]);
  } catch (error) {
    if (controller.signal.aborted) throw controller.signal.reason;
    throw error;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", abortFromParent);
    controller.signal.removeEventListener("abort", onAbort);
  }
};

/** Chỉ chấp nhận định danh free, kể cả khi biến môi trường chứa model trả phí. */
export const isFreeOpenRouterModelId = (id) => typeof id === "string"
  && (id === "openrouter/free" || /^[a-z0-9._-]+\/[a-z0-9._-]+:free$/i.test(id));

/** Fail closed nếu thiếu giá hoặc bất kỳ loại phí nào khác không bằng 0. */
export const isZeroPriceModel = (model) => {
  const pricing = model?.pricing;
  if (!pricing || !["prompt", "completion", "request"].every((key) => Object.hasOwn(pricing, key))) return false;
  return Object.values(pricing).every((price) => ["number", "string"].includes(typeof price)
    && String(price).trim() !== ""
    && Number.isFinite(Number(price)) && Number(price) === 0);
};

/** Chuẩn hóa Retry-After dạng giây hoặc ngày HTTP, và Gemini RetryInfo. */
export const getRetryAfterMs = (error, now = Date.now()) => {
  const headers = error?.response?.headers || error?.headers;
  const raw = headers?.get?.("retry-after") ?? headers?.["retry-after"];
  if (raw !== undefined && raw !== null) {
    const seconds = Number(raw);
    if (Number.isFinite(seconds) && seconds >= 0) return Math.ceil(seconds * 1000);
    const until = Date.parse(raw);
    if (Number.isFinite(until)) return Math.max(0, until - now);
  }
  const details = error?.error?.details || error?.details || [];
  for (const item of details) {
    const delay = /^([\d.]+)s$/.exec(item?.retryDelay || "");
    if (delay) return Math.ceil(Number(delay[1]) * 1000);
  }
  return 0;
};

/** Không lộ thông báo SDK thô có thể chứa URL xác thực hoặc khóa bí mật. */
export const normalizeProviderError = (error, provider) => {
  if (error instanceof AIProviderError) return error;
  const status = Number(error?.response?.status || error?.status || error?.code);
  const quota = status === 429 || /quota|resource.?exhausted/i.test(error?.message || "");
  if (quota) return new AIProviderError("AI_QUOTA_EXHAUSTED", "Nhà cung cấp đã hết hạn mức miễn phí.", {
    provider, retryable: true, retryAfterMs: Math.max(60000, getRetryAfterMs(error)), cause: error,
  });
  return new AIProviderError("AI_PROVIDER_UNAVAILABLE", "Nhà cung cấp AI tạm thời không khả dụng.", {
    provider, retryable: ![400, 401, 403, 404].includes(status),
    retryAfterMs: getRetryAfterMs(error), cause: error,
  });
};

/** Parse JSON có code fence; dữ liệu nội dung được kiểm định lại trong pipeline. */
export const extractStructuredJson = (text = "") => {
  const clean = String(text).trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    const parsed = JSON.parse(clean);
    if (parsed && !Array.isArray(parsed) && typeof parsed === "object") return parsed;
  } catch {
    // Không tự sửa output lỗi: sửa dấu phẩy/comment có thể làm thay đổi giá trị nguồn.
  }
  throw new AIProviderError("AI_INVALID_OUTPUT", "AI chưa trả về một object JSON hợp lệ.", { retryable: true });
};
