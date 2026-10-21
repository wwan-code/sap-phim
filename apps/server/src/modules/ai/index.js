/**
 * @file index.js
 * @module Module_AI
 * @description Public API entry point for the AI Suggestion and Metadata Enrichment module.
 */

export { default as aiRoutes } from "./routes/ai.routes.js";
export {
  aiService,
  aiPipeline,
  evidenceCollector,
  movieResolutionService,
  entityMatcher,
  conflictDetector,
  confidenceCalculator,
} from "./services/ai.service.js";
export {
  aiJobService,
  aiOrchestrator,
  aiAuditService,
  getAiAuditHistory,
} from "./services/ai-job.service.js";
export { initAiWorker, closeAiWorker, processAiJob } from "./workers/ai.worker.js";
export { assertAiAccess, aiJobError, toAiJobDto, createMovieCatalogLookup } from "./helpers/ai-job.helper.js";
export { aiValidator, aiOutputValidator } from "./validators/ai.validator.js";
