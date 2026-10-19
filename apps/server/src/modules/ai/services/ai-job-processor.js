/**
 * @file ai-job-processor.js
 * @module AI_Job_Processor
 * @description Thực thi job với deadline và ngân sách bền vững; chỉ phát terminal sau khi lưu kết quả.
 */

import { UnrecoverableError } from 'bullmq';

import { AIProviderError, createExecutionBudget } from '../providers/ai-provider-policy.js';
import { TERMINAL_AI_STATUSES } from './ai-job-policy.js';

/**
 * @service createAiJobProcessor
 * @param {object} dependencies - Cổng job, pipeline và audit được inject cho kiểm thử cô lập.
 * @returns {Function} BullMQ processor.
 */
export const createAiJobProcessor = ({ jobService, pipeline, Audit, logger }) => async (queueJob) => {
  const jobId = queueJob.data.jobId;
  const attempt = (queueJob.attemptsMade || 0) + 1;
  let audit;
  let budget;
  let deadline;
  let cancellation;
  let polling = false;
  try {
    let record = await jobService.getRecord(jobId);
    if (TERMINAL_AI_STATUSES.includes(record.status)) return record.result;
    const request = record.request_payload;
    if (!record.user_id || !request?.title) throw new AIProviderError('AI_INVALID_JOB', 'Job thiếu thông tin chủ sở hữu hoặc yêu cầu.');
    await jobService.update(jobId, { status: 'processing', stage: 'STARTED', attempt, started_at: record.started_at || new Date() });
    record = await jobService.getRecord(jobId);
    if (TERMINAL_AI_STATUSES.includes(record.status)) return record.result;
    const controller = new AbortController();
    const persistBudget = async ({ requestCount, passCount }) => {
      const snapshot = await jobService.update(jobId, {
        provider_request_count: requestCount, provider_pass_count: passCount,
      });
      if (snapshot.status !== 'processing') throw new AIProviderError('AI_CANCELLED', 'Yêu cầu không còn hoạt động.');
    };
    budget = createExecutionBudget({
      mode: request.mode, startedAt: record.started_at,
      requestCount: record.provider_request_count, passCount: record.provider_pass_count,
      onRequest: persistBudget, onPass: persistBudget,
    });
    const remaining = Math.max(1, budget.startedAt + budget.deadlineMs - Date.now());
    deadline = setTimeout(() => controller.abort(new AIProviderError('AI_DEADLINE_EXCEEDED', 'Đã hết thời gian xử lý AI.')), remaining);
    deadline.unref?.();
    cancellation = setInterval(async () => {
      if (polling) return;
      polling = true;
      try {
        const current = await jobService.getRecord(jobId);
        if (TERMINAL_AI_STATUSES.includes(current.status) && current.status !== 'completed') {
          controller.abort(new AIProviderError('AI_CANCELLED', 'Yêu cầu đã bị hủy.'));
        }
      } catch { /* Các lần ghi tiến trình/ngân sách vẫn bắt lỗi persistence. */ }
      finally { polling = false; }
    }, 500);
    cancellation.unref?.();

    audit = await Audit.create({
      job_id: jobId, user_id: record.user_id, query_title: request.title,
      query_year: request.year, query_type: request.type, model: 'pending', provider: 'pending',
      prompt_version: 'v2.0.0', status: 'pending', stage_timings: { attempt },
    });
    const result = await pipeline.executePipeline({
      jobId, userId: record.user_id, title: request.title, year: request.year,
      type: request.type, mode: request.mode, forceRefresh: true, enableWebSearch: false,
      formContext: request.context, selectedCandidate: request.selectedCandidate,
      signal: controller.signal, executionBudget: budget, auditHandledExternally: true,
      onProgress: async (stage, _data, message) => {
        const snapshot = await jobService.update(jobId, {
          status: 'processing', stage: stage.stage, progress: stage.progress,
        });
        if (snapshot.status === 'cancelled') throw new AIProviderError('AI_CANCELLED', 'Yêu cầu đã bị hủy.');
        logger?.debug?.(`[AI Worker] ${jobId} ${stage.stage}: ${message || stage.message || ''}`);
      },
    });
    const { _execution = {}, ...publicResult } = result;
    const final = await jobService.complete(jobId, publicResult);
    try {
      await audit.update({
        status: final.status === 'completed' ? 'completed' : 'failed',
        provider: _execution.provider || 'evidence', model: _execution.model || 'verified-sources',
        prompt_tokens: _execution.usage?.promptTokens || 0,
        completion_tokens: _execution.usage?.completionTokens || 0,
        total_tokens: _execution.usage?.totalTokens || 0, estimated_cost_usd: 0,
        latency_ms: Date.now() - budget.startedAt,
        stage_timings: { ..._execution.stageTimings, attempt, requests: budget.requestCount, passes: budget.passCount },
        confidence_score: publicResult.confidence_score ?? 0,
        confidence_breakdown: publicResult.confidence_breakdown || {}, conflicts: publicResult.conflicts || [],
        flags: publicResult.flags || [], field_provenance: publicResult.field_provenance || {},
        evidence_snapshot: _execution.evidenceSnapshot || {},
      });
    } catch (error) { logger?.error?.(`[AI Worker] Không thể ghi audit cuối cho ${jobId}: ${error.name}`); }
    return final.result;
  } catch (error) {
    let current;
    try { current = await jobService.getRecord(jobId); }
    catch {
      // BullMQ giữ lỗi gốc để retry; listener failed sẽ đối soát lại khi DB phục hồi.
      if (error.code === 'AI_JOB_NOT_FOUND') throw new UnrecoverableError(error.code);
      throw error;
    }
    if (current.status === 'completed') return current.result;
    if (audit) {
      try { await audit.update({ status: 'failed', error_code: error.code || 'AI_JOB_FAILED', error_message: 'Lượt xử lý AI chưa hoàn tất.', stage_timings: { attempt } }); } catch { /* Không che lỗi gốc. */ }
    }
    if (current.status === 'cancelled' || error.code === 'AI_CANCELLED') {
      if (current.status !== 'cancelled') await jobService.update(jobId, { status: 'cancelled', stage: 'CANCELLED', completed_at: new Date(), error: { code: 'AI_CANCELLED', message: 'Đã hủy yêu cầu AI.' } });
      return null;
    }
    const transient = error.retryable === true || /SequelizeConnection|SequelizeTimeout|ETIMEDOUT|ECONNRESET/.test(`${error.name || ''} ${error.code || ''}`);
    const budgetAvailable = !budget || (Date.now() < budget.startedAt + budget.deadlineMs
      && budget.requestCount < budget.maxRequests && budget.passCount < budget.maxPasses);
    const canRetry = transient && attempt < (queueJob.opts?.attempts || 1) && budgetAvailable;
    const snapshot = await jobService.update(jobId, {
      status: canRetry ? 'queued' : 'failed', stage: canRetry ? 'RETRYING' : 'FAILED',
      ...(canRetry ? {} : { completed_at: new Date() }),
      error: { code: error.code || 'AI_JOB_FAILED', message: canRetry ? 'Đang thử lại yêu cầu AI.' : 'Không thể hoàn tất yêu cầu AI. Vui lòng thử lại sau.' },
    });
    if (snapshot.status === 'completed') return snapshot.result;
    if (snapshot.status === 'cancelled') return null;
    if (canRetry) throw error;
    throw new UnrecoverableError(error.code || 'AI_JOB_FAILED');
  } finally {
    clearTimeout(deadline);
    clearInterval(cancellation);
  }
};

/**
 * @service createAiJobFailureReconciler
 * @description Đối soát terminal BullMQ khi lỗi xảy ra trước STARTED hoặc worker bị stalled.
 * @param {object} dependencies - Cổng canonical và wait inject để retry DB hữu hạn.
 * @returns {Function} Listener async dùng được cho failed event và replay bounded lúc worker khởi động.
 */
export const createAiJobFailureReconciler = ({
  jobService, logger, maxAttempts = 3, wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
}) => async (queueJob, error) => {
  const jobId = queueJob?.data?.jobId;
  if (!jobId) return false;
  const attempts = Math.max(1, Math.min(5, Number(maxAttempts) || 3));
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      // failed cũng có thể được phát giữa các retry; Redis là nguồn chuẩn về retry còn lại.
      if (await queueJob.getState() !== 'failed') return false;
      const record = await jobService.getRecord(jobId);
      if (TERMINAL_AI_STATUSES.includes(record.status)) return false;
      const code = /^AI_[A-Z_]+$/.test(error?.code || '') ? error.code
        : error?.name === 'UnrecoverableError' && /^AI_[A-Z_]+$/.test(error.message) ? error.message : 'AI_WORKER_FAILED';
      const snapshot = await jobService.update(jobId, {
        status: 'failed', stage: 'FAILED', completed_at: new Date(),
        error: { code, message: 'Không thể hoàn tất yêu cầu AI. Vui lòng thử lại sau.' },
      });
      return snapshot.status === 'failed';
    } catch (failure) {
      if (failure.code === 'AI_JOB_NOT_FOUND') return false;
      if (attempt + 1 < attempts) await wait(250 * (2 ** attempt));
      else logger?.error?.('[AI Worker] Không thể đối soát trạng thái cuối: ' + jobId);
    }
  }
  return false;
};

