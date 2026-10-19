/**
 * @file ai.worker.js
 * @module AI_Worker
 * @description BullMQ worker dùng canonical job, hủy request thực tế và deadline dùng chung qua retry.
 */

import { registerWorker, QUEUE_NAMES, aiQueue } from '../../../config/queue.config.js';
import { env } from '../../../config/env.config.js';
import { AIAuditLog, sequelize } from '../../../models/index.js';
import { logger } from '../../../utils/logger.js';
import { aiPipeline } from '../services/ai-pipeline.service.js';
import { aiJobService } from '../services/ai-job.service.js';
import { createAiJobProcessor, createAiJobFailureReconciler } from '../services/ai-job-processor.js';

let aiWorkerInstance = null;

/** @service processAiJob @description Chạy đúng job đã lưu, không tạo audit/status giả trong pipeline. */
export const processAiJob = createAiJobProcessor({ jobService: aiJobService, pipeline: aiPipeline, Audit: AIAuditLog, logger });

/** @returns {object} Worker chỉ được khởi tạo một lần cho mỗi process. */
export const initAiWorker = async () => {
  if (aiWorkerInstance) return aiWorkerInstance;
  if (!env.ai.enabled || !env.ai.workerEnabled) return null;
  const [migrations] = await sequelize.query('SELECT name FROM "SequelizeMeta" WHERE name = :name', {
    replacements: { name: '20261019000000-create-ai-jobs.cjs' },
  });
  if (!migrations.length) throw new Error('[AI][Worker] Phải chạy migration ai_jobs trước khi bật worker mới.');
  const reconcile = createAiJobFailureReconciler({ jobService: aiJobService, logger });
  for (const job of await aiQueue.getFailed(0, 99)) await reconcile(job, { code: 'AI_WORKER_FAILED' });
  aiWorkerInstance = registerWorker(QUEUE_NAMES.AI, processAiJob, {
    concurrency: 2,
    limiter: { max: 4, duration: 1000 },
  });
  aiWorkerInstance.on('failed', (job, error) => { void reconcile(job, error); });
  return aiWorkerInstance;
};

/** Đóng worker sau khi các công việc đang chạy hoàn tất. */
export const closeAiWorker = async () => {
  if (aiWorkerInstance) {
    await aiWorkerInstance.close();
    aiWorkerInstance = null;
  }
};

export default { processAiJob, initAiWorker, closeAiWorker };
