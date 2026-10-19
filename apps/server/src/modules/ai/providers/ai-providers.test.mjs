/**
 * @file ai-providers.test.mjs
 * @module AI_Provider_Tests
 * @description Kiểm thử cô lập chính sách miễn phí, request budget, quota và hủy HTTP; không gọi API thật.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import {
  AIProviderError, createExecutionBudget, getRetryAfterMs, isZeroPriceModel,
  isFreeOpenRouterModelId, runBudgetedRequest,
} from "./ai-provider-policy.js";

// Singleton mặc định chỉ đọc cấu hình thử nghiệm, không chạm DB/Redis/khóa thật.
Object.assign(process.env, {
  NODE_ENV: "test", PORT: "4000", DB_HOST: "unused", DB_NAME: "unused", DB_USER: "unused",
  JWT_ACCESS_SECRET: "ai-offline-test", JWT_REFRESH_SECRET: "ai-offline-test",
  LOG_FILE: "false", GEMINI_API_KEY: "", GEMINI_API_KEYS: "", OPENROUTER_API_KEY: "",
});
const { GeminiProvider } = await import("./gemini.provider.js");
const { OpenRouterProvider } = await import("./openrouter.provider.js");
const { AIOrchestratorService } = await import("../services/ai-orchestrator.service.js");

const prompts = { systemPrompt: "metadata", userPrompt: "example" };
const log = { warn() {} };
const freeModel = (id = "test/model:free", pricing = {}) => ({
  id, pricing: { prompt: "0", completion: "0", request: "0", ...pricing },
  supported_parameters: ["response_format"], architecture: { output_modalities: ["text"] },
});
const completion = { data: { choices: [{ message: { content: '{"title":"Example"}' } }],
  usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 } } };
const disabled = { name: "disabled", async generateStructuredOutput() {
  throw new AIProviderError("AI_DISABLED", "disabled");
} };

test("zero price fails closed on missing request, paid hidden fees, unknown price and paid model IDs", () => {
  assert.equal(isZeroPriceModel(freeModel()), true);
  for (const pricing of [{ prompt: "0", completion: "0" },
    { prompt: "0", completion: "0", request: "0.01" },
    { prompt: "0", completion: "0", request: "0", web_search: "1" },
    { prompt: "0", completion: "0", request: false }]) {
    assert.equal(isZeroPriceModel({ pricing }), false);
  }
  assert.equal(isFreeOpenRouterModelId("openrouter/auto"), false);
  assert.equal(isFreeOpenRouterModelId("google/gemini-paid"), false);
  assert.equal(isFreeOpenRouterModelId("openrouter/free"), true);
});

test("OpenRouter filters paid config/catalog injection and sends hard zero ceilings without tools/plugins", async () => {
  let submitted;
  const provider = new OpenRouterProvider({ apiKey: "test", models: ["vendor/paid", "test/model:free"], http: {
    async get() { return { data: { data: [freeModel("vendor/paid"), freeModel()] } }; },
    async post(url, body, options) { submitted = { url, body, options }; return completion; },
  } });
  const persisted = [];
  const budget = createExecutionBudget({ mode: "fast", onRequest: async (state) => persisted.push(state.requestCount) });
  const result = await provider.generateStructuredOutput({ ...prompts, executionBudget: budget });
  assert.equal(result.model, "test/model:free");
  assert.deepEqual(submitted.body.provider.max_price, { prompt: 0, completion: 0, request: 0, image: 0 });
  assert.equal(submitted.body.provider.allow_fallbacks, false);
  assert.equal(submitted.body.provider.require_parameters, true);
  assert.equal(submitted.body.plugins, undefined);
  assert.equal(submitted.body.tools, undefined);
  assert.equal(submitted.body.models, undefined);
  assert.ok(submitted.options.signal instanceof AbortSignal);
  assert.deepEqual(persisted, [1, 2]);
  assert.equal(budget.requestCount, 2);
});

test("OpenRouter does not submit missing, incapable, or per-request-paid models", async () => {
  for (const catalog of [[], [freeModel("test/model:free", { request: "0.1" })],
    [{ ...freeModel(), supported_parameters: [] }]]) {
    let sent = false;
    const provider = new OpenRouterProvider({ apiKey: "test", models: ["test/model:free"], http: {
      async get() { return { data: { data: catalog } }; }, async post() { sent = true; return completion; },
    } });
    await assert.rejects(provider.generateStructuredOutput(prompts), { code: "AI_NO_FREE_MODEL" });
    assert.equal(sent, false);
  }
});

test("Gemini requires explicit boolean Free Tier confirmation and rejects paid allowlist injection", async () => {
  for (const config of [
    { apiKeys: ["test"], freeTierConfirmed: false, freeModels: ["gemini-2.5-flash"] },
    { apiKeys: ["test"], freeTierConfirmed: "true", freeModels: ["gemini-2.5-flash"] },
    { apiKeys: ["test"], freeTierConfirmed: true, model: "gemini-4-argon", freeModels: ["gemini-4-argon"] },
  ]) {
    const provider = new GeminiProvider({ config, clientFactory() { assert.fail("Must not initialize network client"); } });
    await assert.rejects(provider.generateStructuredOutput(prompts), (error) =>
      ["AI_DISABLED", "AI_NO_FREE_MODEL"].includes(error.code));
  }
});

test("Gemini intersects available capable models with vetted allowlist and disables SDK retries/continuation", async () => {
  let generated;
  const provider = new GeminiProvider({ config: {
    apiKeys: ["test"], freeTierConfirmed: true, freeModels: ["gemini-2.5-flash", "gemini-4-argon"],
  }, clientFactory: () => ({ models: {
    async list(options) {
      assert.equal(options.config.httpOptions.retryOptions.attempts, 1);
      return { page: [{ name: "models/gemini-4-argon", supportedActions: ["generateContent"] },
        { name: "models/gemini-2.5-flash", supportedActions: ["generateContent"] }] };
    },
    async generateContent(options) { generated = options; return { text: '{"title":"Example"}' }; },
  } }) });
  const result = await provider.generateStructuredOutput(prompts);
  assert.equal(result.model, "gemini-2.5-flash");
  assert.equal(generated.config.tools, undefined);
  assert.equal(generated.config.automaticContinuation, false);
  assert.equal(generated.config.httpOptions.retryOptions.attempts, 1);
  assert.ok(generated.config.abortSignal instanceof AbortSignal);
  assert.equal(result.groundingMetadata, null);
  assert.deepEqual(result.webCitations, []);
});

test("Gemini excludes free but missing/unsupported model from generation", async () => {
  for (const page of [[], [{ name: "models/gemini-2.5-flash", supportedActions: ["embedContent"] }]]) {
    const provider = new GeminiProvider({ config: {
      apiKeys: ["test"], freeTierConfirmed: true, freeModels: ["gemini-2.5-flash"],
    }, clientFactory: () => ({ models: {
      async list() { return { page }; }, async generateContent() { assert.fail("Unsupported model requested"); },
    } }) });
    await assert.rejects(provider.generateStructuredOutput(prompts), { code: "AI_NO_FREE_MODEL" });
  }
});

test("Gemini quota cooldown applies to entire key project and never rotates/bypasses keys", async () => {
  let calls = 0;
  const provider = new GeminiProvider({ config: {
    apiKeys: ["test-one", "test-two"], freeTierConfirmed: true, freeModels: ["gemini-2.5-flash"],
  }, clientFactory: (key) => {
    assert.equal(key, "test-one");
    return { models: { async list() {
      calls += 1;
      throw Object.assign(new Error("quota exhausted"), { status: 429, headers: { "retry-after": "180" } });
    } } };
  } });
  await assert.rejects(provider.generateStructuredOutput(prompts), { code: "AI_QUOTA_EXHAUSTED", retryAfterMs: 180000 });
  await assert.rejects(provider.generateStructuredOutput(prompts), { code: "AI_QUOTA_EXHAUSTED" });
  assert.equal(calls, 1);
});

test("OpenRouter quota Retry-After respects cooldown with no repeated HTTP request", async () => {
  let calls = 0;
  const provider = new OpenRouterProvider({ apiKey: "test", http: { async get() {
    calls += 1;
    throw Object.assign(new Error("quota"), { response: { status: 429, headers: { "retry-after": "120" } } });
  } } });
  await assert.rejects(provider.generateStructuredOutput(prompts), { code: "AI_QUOTA_EXHAUSTED", retryAfterMs: 120000 });
  await assert.rejects(provider.generateStructuredOutput(prompts), { code: "AI_QUOTA_EXHAUSTED" });
  assert.equal(calls, 1);
  assert.equal(getRetryAfterMs({ headers: { "retry-after": "Mon, 19 Oct 2026 00:01:00 GMT" } },
    Date.parse("2026-10-19T00:00:00Z")), 60000);
});

test("request budget persists BEFORE network and enforces remaining capacity across retry", async () => {
  const persisted = [];
  const budget = createExecutionBudget({ mode: "fast", requestCount: 1,
    onRequest: async (state) => persisted.push(state.requestCount) });
  let calls = 0;
  const invoke = () => runBudgetedRequest({ budget, provider: "test", operation: "generate" }, async () => {
    assert.deepEqual(persisted, [2]); calls += 1; return true;
  });
  await invoke();
  await assert.rejects(invoke(), { code: "AI_REQUEST_BUDGET_EXCEEDED" });
  assert.equal(calls, 1);
  const noPersistence = createExecutionBudget({ onRequest: async () => { throw new Error("DB unavailable"); } });
  await assert.rejects(runBudgetedRequest({ budget: noPersistence }, async () => assert.fail("Must not send")),
    { code: "AI_BUDGET_PERSIST_FAILED" });
});

test("deadline and cancellation abort the actual transport signal and stop fallback", async () => {
  for (const cancel of [false, true]) {
    const controller = new AbortController();
    const budget = createExecutionBudget();
    let aborted = false;
    let markStarted;
    const started = new Promise((resolve) => { markStarted = resolve; });
    const promise = runBudgetedRequest({ budget, signal: controller.signal, timeoutMs: 15 }, (signal) => {
      markStarted();
      return new Promise((resolve, reject) => signal.addEventListener("abort", () => {
        aborted = true; reject(signal.reason);
      }, { once: true }));
    });
    if (cancel) { await started; controller.abort(); }
    await assert.rejects(promise, { code: cancel ? "AI_CANCELLED" : "AI_DEADLINE_EXCEEDED" });
    assert.equal(aborted, true);
  }
  const expired = createExecutionBudget({ startedAt: Date.now() - 130000, mode: "deep" });
  await assert.rejects(runBudgetedRequest({ budget: expired }, async () => assert.fail("Deadline reset")),
    { code: "AI_DEADLINE_EXCEEDED" });
});

test("orchestrator shares request/pass limits through fallback and subsequent passes", async () => {
  const budget = createExecutionBudget({ mode: "auto" });
  const provider = { name: "test", async generateStructuredOutput({ executionBudget }) {
    await runBudgetedRequest({ budget: executionBudget }, async () => true);
    return { parsedJson: {}, provider: "test", model: "test/model:free", usage: {} };
  } };
  const orchestrator = new AIOrchestratorService({ gemini: disabled, openrouter: provider, log });
  assert.equal((await orchestrator.execute({ ...prompts, executionBudget: budget })).estimatedCostUsd, 0);
  await orchestrator.execute({ ...prompts, executionBudget: budget });
  assert.equal(budget.requestCount, 2);
  assert.equal(budget.passCount, 2);
  await assert.rejects(orchestrator.execute({ ...prompts, executionBudget: budget }), { code: "AI_PASS_BUDGET_EXCEEDED" });
  const fast = createExecutionBudget({ mode: "fast" });
  await orchestrator.execute({ ...prompts, executionBudget: fast });
  await assert.rejects(orchestrator.execute({ ...prompts, executionBudget: fast }), { code: "AI_PASS_BUDGET_EXCEEDED" });
});
