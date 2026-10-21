import { createAiJobProcessor, createAiJobFailureReconciler } from '../helpers/worker-core.helper.js';
export { createAiJobProcessor, createAiJobFailureReconciler };
/**
 * @file ai.worker.js
 * @module AI_Worker
 * @description BullMQ worker và processor tích hợp, quản lý vòng đời xử lý background job, reconciliation và deadline.
 */

import { UnrecoverableError } from "bullmq";
import { registerWorker, QUEUE_NAMES, aiQueue } from "../../../config/queue.config.js";
import { env } from "../../../config/env.config.js";
import { AIAuditLog, sequelize } from "../../../models/index.js";
import { logger } from "../../../utils/logger.js";
import { aiJobService } from "../services/ai-job.service.js";
import { aiService } from "../services/ai.service.js";
import { AIProviderError, createExecutionBudget } from "../helpers/ai-providers.helper.js";
import { PROMPT_VERSIONS } from "../helpers/ai-metadata.helper.js";
import { TERMINAL_AI_STATUSES } from "../helpers/ai-job.helper.js";

let aiWorkerInstance = null;

// ============================================================================
// 1. PROCESSOR LOGIC
// ============================================================================

// ============================================================================
// 2. WORKER LIFECYCLE
// ============================================================================

export const processAiJob = createAiJobProcessor({ jobService: aiJobService, pipeline: aiService, Audit: AIAuditLog, logger });

export const initAiWorker = async () => {
  if (aiWorkerInstance) return aiWorkerInstance;
  if (!env.ai.enabled || !env.ai.workerEnabled) return null;
  const [migrations] = await sequelize.query('SELECT name FROM "SequelizeMeta" WHERE name = :name', {
    replacements: { name: "20261019000000-create-ai-jobs.cjs" },
  });
  if (!migrations.length) throw new Error("[AI][Worker] Phải chạy migration ai_jobs trước khi bật worker mới.");
  const reconcile = createAiJobFailureReconciler({ jobService: aiJobService, logger });
  for (const job of await aiQueue.getFailed(0, 99)) await reconcile(job, { code: "AI_WORKER_FAILED" });
  aiWorkerInstance = registerWorker(QUEUE_NAMES.AI, processAiJob, {
    concurrency: 2,
    limiter: { max: 4, duration: 1000 },
  });
  aiWorkerInstance.on("failed", (job, error) => { void reconcile(job, error); });
  return aiWorkerInstance;
};

export const closeAiWorker = async () => {
  if (aiWorkerInstance) {
    await aiWorkerInstance.close();
    aiWorkerInstance = null;
  }
};

export default { processAiJob, initAiWorker, closeAiWorker, createAiJobProcessor, createAiJobFailureReconciler };
