/**
 * @file gemini.provider.js
 * @module AI_Gemini_Provider
 * @description Gemini SDK duy trì, chỉ bật cho project Free Tier và model văn bản miễn phí đã xác nhận.
 */

import { GoogleGenAI } from "@google/genai";

import { env } from "../../../config/env.config.js";

import { BaseAIProvider } from "./base-ai.provider.js";
import {
  AIProviderError, GEMINI_FREE_TEXT_MODELS, assertExecutionAvailable,
  extractStructuredJson, normalizeExecutionBudget, normalizeProviderError, runBudgetedRequest,
} from "./ai-provider-policy.js";

/** Provider không xoay khóa để vượt quota: mọi khóa cấu hình được coi cùng một project. */
export class GeminiProvider extends BaseAIProvider {
  constructor({ config = env.gemini || {}, clientFactory = (apiKey) => new GoogleGenAI({
    apiKey, vertexai: false,
    httpOptions: { baseUrl: 'https://generativelanguage.googleapis.com', retryOptions: { attempts: 1 } },
  }), now = Date.now } = {}) {
    super("gemini");
    this.enabled = config.freeTierConfirmed === true;
    this.apiKey = config.apiKeys?.[0] || "";
    const configured = Array.isArray(config.freeModels) ? config.freeModels : [];
    this.models = [...new Set([config.model, ...configured])]
      .filter((model) => configured.includes(model) && GEMINI_FREE_TEXT_MODELS.includes(model));
    this.clientFactory = clientFactory;
    this.now = now;
    this.client = null;
    this.discovery = null;
    this.cooldownUntil = 0;
  }

  /** Trạng thái cấu hình không gọi mạng hoặc làm lộ khóa. */
  async healthCheck() {
    return this.enabled && Boolean(this.apiKey) && this.models.length > 0 && this.cooldownUntil <= this.now();
  }

  /** Đối chiếu allowlist với capability thực tế; không tự phân trang ngoài ngân sách. */
  async discoverModels(options) {
    if (this.discovery?.expiresAt > this.now()) return this.discovery.models;
    const pager = await runBudgetedRequest({ ...options, provider: this.name, operation: "models.list" },
      (abortSignal, timeout) => this.client.models.list({ config: {
        pageSize: 1000, queryBase: true, abortSignal,
        httpOptions: { timeout, retryOptions: { attempts: 1 } },
      } }));
    const available = (pager.page || []).filter((model) =>
      (model.supportedActions || []).includes("generateContent"))
      .map((model) => model.name?.replace(/^models\//, ""));
    const models = this.models.filter((model) => available.includes(model));
    this.discovery = { models, expiresAt: this.now() + 300000 };
    return models;
  }

  /** Một lượt synth tối đa một request generate; fallback do orchestrator quản lý. */
  async generateStructuredOutput({
    systemPrompt, userPrompt, mode = "auto", executionBudget, signal, timeoutMs, onBudgetUpdate,
  }) {
    const budget = normalizeExecutionBudget(executionBudget, mode);
    assertExecutionAvailable(budget, signal);
    if (!this.enabled || !this.apiKey) {
      throw new AIProviderError("AI_DISABLED", "Gemini chỉ bật sau khi xác nhận project Free Tier.", { provider: this.name });
    }
    if (this.models.length === 0) {
      throw new AIProviderError("AI_NO_FREE_MODEL", "Chưa cấu hình model Gemini miễn phí hợp lệ.", { provider: this.name });
    }
    if (this.cooldownUntil > this.now()) {
      throw new AIProviderError("AI_QUOTA_EXHAUSTED", "Project Gemini đang chờ hạn mức miễn phí.", {
        provider: this.name, retryable: true, retryAfterMs: this.cooldownUntil - this.now(),
      });
    }
    const startedAt = this.now();
    this.client ||= this.clientFactory(this.apiKey);
    const options = { budget, signal, timeoutMs, onBudgetUpdate };
    try {
      const models = await this.discoverModels(options);
      const model = models[0];
      if (!model) throw new AIProviderError("AI_NO_FREE_MODEL", "Không tìm thấy model Gemini miễn phí có capability generateContent.", {
        provider: this.name,
      });
      const response = await runBudgetedRequest({ ...options, provider: this.name, operation: "generateContent" },
        (abortSignal, timeout) => this.client.models.generateContent({
          model, contents: userPrompt,
          config: {
            systemInstruction: systemPrompt, responseMimeType: "application/json",
            temperature: mode === "deep" ? 0.2 : 0.1, maxOutputTokens: 8192,
            abortSignal, automaticFunctionCalling: { disable: true }, automaticContinuation: false,
            httpOptions: { timeout, retryOptions: { attempts: 1 } },
          },
        }));
      assertExecutionAvailable(budget, signal);
      const text = response.text || "";
      const usage = response.usageMetadata || {};
      return {
        rawText: text, parsedJson: extractStructuredJson(text),
        groundingMetadata: null, webCitations: [], searchQueries: [],
        usage: {
          promptTokens: usage.promptTokenCount || 0,
          completionTokens: usage.candidatesTokenCount || 0, totalTokens: usage.totalTokenCount || 0,
        },
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

export const geminiProvider = new GeminiProvider();
export default geminiProvider;
