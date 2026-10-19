/**
 * @file openrouter.provider.js
 * @module AI_OpenRouter_Provider
 * @description OpenRouter miễn phí với discovery giá bằng 0, giới hạn giá cứng và HTTP hủy được.
 */

import axios from "axios";

import { BaseAIProvider } from "./base-ai.provider.js";
import {
  AIProviderError, assertExecutionAvailable, extractStructuredJson, isFreeOpenRouterModelId,
  isZeroPriceModel, normalizeExecutionBudget, normalizeProviderError, runBudgetedRequest,
} from "./ai-provider-policy.js";

/** Chỉ route model free đã xác minh; không plugin hoặc fallback trả phí. */
export class OpenRouterProvider extends BaseAIProvider {
  constructor({ apiKey = process.env.OPENROUTER_API_KEY || "", models,
    http = axios, now = Date.now } = {}) {
    super("openrouter");
    this.apiKey = apiKey;
    const configured = models || [process.env.OPENROUTER_MODEL,
      ...(process.env.OPENROUTER_MODELS || "").split(",")];
    this.models = [...new Set([...configured, "openrouter/free"])]
      .map((model) => model?.trim()).filter(isFreeOpenRouterModelId);
    this.http = http;
    this.now = now;
    this.discovery = null;
    this.cooldownUntil = 0;
  }

  /** Kiểm tra local, không gọi mạng hoặc gửi token tới model. */
  async healthCheck() {
    return Boolean(this.apiKey) && this.cooldownUntil <= this.now();
  }

  /** Giá request, input, output và mọi thành phần khác đều phải bằng 0. */
  async discoverModels(options) {
    if (this.discovery?.expiresAt > this.now()) return this.discovery.models;
    const response = await runBudgetedRequest({ ...options, provider: this.name, operation: "models.list" },
      (signal, timeout) => this.http.get("https://openrouter.ai/api/v1/models", { signal, timeout }));
    const available = (response.data?.data || []).filter((model) =>
      isFreeOpenRouterModelId(model.id) && isZeroPriceModel(model)
      && model.supported_parameters?.includes("response_format")
      && (!model.architecture?.output_modalities || model.architecture.output_modalities.includes("text")))
      .map((model) => model.id);
    const models = this.models.filter((model) => available.includes(model));
    this.discovery = { models, expiresAt: this.now() + 300000 };
    return models;
  }

  /** Đúng một request completion; không nhân lượt thử theo số model cấu hình. */
  async generateStructuredOutput({
    systemPrompt, userPrompt, mode = "auto", executionBudget, signal, timeoutMs, onBudgetUpdate,
  }) {
    const budget = normalizeExecutionBudget(executionBudget, mode);
    assertExecutionAvailable(budget, signal);
    if (!this.apiKey) throw new AIProviderError("AI_DISABLED", "Chưa cấu hình OpenRouter API key.", { provider: this.name });
    if (this.cooldownUntil > this.now()) throw new AIProviderError("AI_QUOTA_EXHAUSTED", "OpenRouter đang chờ hạn mức miễn phí.", {
      provider: this.name, retryable: true, retryAfterMs: this.cooldownUntil - this.now(),
    });
    const startedAt = this.now();
    const options = { budget, signal, timeoutMs, onBudgetUpdate };
    try {
      const models = await this.discoverModels(options);
      const model = models[0];
      if (!model) throw new AIProviderError("AI_NO_FREE_MODEL", "Không tìm thấy model OpenRouter miễn phí hỗ trợ JSON.", {
        provider: this.name,
      });
      const response = await runBudgetedRequest({ ...options, provider: this.name, operation: "chat.completions" },
        (requestSignal, timeout) => this.http.post("https://openrouter.ai/api/v1/chat/completions", {
          model, messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
          response_format: { type: "json_object" }, temperature: 0.1, max_tokens: 8192,
          provider: { max_price: { prompt: 0, completion: 0, request: 0, image: 0 },
            allow_fallbacks: false, require_parameters: true },
        }, {
          headers: { Authorization: "Bearer " + this.apiKey, "HTTP-Referer": "https://sap-phim.local",
            "X-OpenRouter-Title": "Sap Phim AI DataOps", "Content-Type": "application/json" },
          signal: requestSignal, timeout,
        }));
      assertExecutionAvailable(budget, signal);
      if (response.data?.error) throw Object.assign(new Error("Provider error response"), { status: response.data.error.code });
      const content = response.data?.choices?.[0]?.message?.content || "";
      const usage = response.data?.usage || {};
      return {
        rawText: content, parsedJson: extractStructuredJson(content),
        groundingMetadata: null, webCitations: [], searchQueries: [],
        usage: { promptTokens: usage.prompt_tokens || 0, completionTokens: usage.completion_tokens || 0,
          totalTokens: usage.total_tokens || 0 },
        provider: this.name, model, latencyMs: this.now() - startedAt,
      };
    } catch (cause) {
      const error = normalizeProviderError(cause, this.name);
      if (error.code === "AI_QUOTA_EXHAUSTED") this.cooldownUntil = this.now() + error.retryAfterMs;
      if (error.code === "AI_PROVIDER_UNAVAILABLE") {
        this.cooldownUntil = this.now() + Math.max(15000, error.retryAfterMs);
        this.discovery = null;
      }
      throw error;
    }
  }
}

export const openRouterProvider = new OpenRouterProvider();
export default openRouterProvider;
