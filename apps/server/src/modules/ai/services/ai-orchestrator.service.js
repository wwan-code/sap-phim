/**
 * @file ai-orchestrator.service.js
 * @module AI_Orchestrator_Service
 * @description Điều phối provider miễn phí với deadline và ngân sách request chung cho toàn bộ job.
 */

import { logger } from "../../../utils/logger.js";

import { geminiProvider } from "../providers/gemini.provider.js";
import { openRouterProvider } from "../providers/openrouter.provider.js";
import {
  AIProviderError, assertExecutionAvailable, consumeSynthesisPass,
  normalizeExecutionBudget, normalizeProviderError,
} from "../providers/ai-provider-policy.js";

const TERMINAL_CODES = new Set([
  "AI_CANCELLED", "AI_DEADLINE_EXCEEDED", "AI_REQUEST_BUDGET_EXCEEDED",
  "AI_PASS_BUDGET_EXCEEDED", "AI_BUDGET_PERSIST_FAILED",
]);

/** Tối đa một lần thử mỗi provider trong một lượt tổng hợp, không nhân theo khóa. */
export class AIOrchestratorService {
  constructor({ gemini = geminiProvider, openrouter = openRouterProvider, log = logger } = {}) {
    this.providers = [gemini, openrouter];
    this.log = log;
  }

  /** Giữ API cost cũ tương thích; mọi route được phép trong dịch vụ này có giá 0. */
  calculateEstimatedCost() {
    return 0;
  }

  /** Chia sẻ executionBudget và AbortSignal xuyên fallback, refinement và retry job. */
  async execute({
    systemPrompt, userPrompt, mode = "auto", timeoutMs, signal, executionBudget, onBudgetUpdate,
  }) {
    const budget = normalizeExecutionBudget(executionBudget, mode);
    await consumeSynthesisPass(budget, signal, onBudgetUpdate);
    let lastError;
    let fallbackUsed = false;
    for (const provider of this.providers) {
      assertExecutionAvailable(budget, signal);
      try {
        const result = await provider.generateStructuredOutput({
          systemPrompt, userPrompt, mode: budget.mode, timeoutMs, signal,
          executionBudget: budget, onBudgetUpdate,
        });
        return { ...result, estimatedCostUsd: 0, circuitBreakerTripped: fallbackUsed };
      } catch (cause) {
        const error = normalizeProviderError(cause, provider.name);
        if (TERMINAL_CODES.has(error.code)) throw error;
        if (!lastError || error.code !== "AI_DISABLED") lastError = error;
        fallbackUsed = true;
        this.log.warn("[AI Orchestrator] " + provider.name + ": " + error.code);
      }
    }
    throw lastError || new AIProviderError("AI_PROVIDER_UNAVAILABLE", "Không có provider miễn phí khả dụng.", { retryable: true });
  }
}

export const aiOrchestrator = new AIOrchestratorService();
export default aiOrchestrator;
