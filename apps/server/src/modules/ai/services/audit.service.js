/**
 * @file audit.service.js
 * @module AI_Audit_Service
 * @description Ghi nhận nhật ký kiểm toán, quản lý vết chi phí, thời gian xử lý và bằng chứng snapshot vào PostgreSQL.
 */

import { AIAuditLog } from "../../../models/index.js";
import { logger } from "../../../utils/logger.js";

class AIAuditService {
  /**
   * Khởi tạo bản ghi Audit ban đầu ở trạng thái 'pending'
   *
   * @param {Object} data
   * @returns {Promise<Object>}
   */
  async createInitialAudit(data) {
    try {
      const record = await AIAuditLog.create({
        job_id: data.jobId,
        user_id: data.userId || null,
        query_title: data.title,
        query_year: data.year ? Number(data.year) : null,
        query_type: data.type || "all",
        provider: "gemini",
        model: "pending",
        prompt_version: data.promptVersion || "v1.2.0",
        status: "pending",
      });
      return record;
    } catch (err) {
      logger.error(`[AI Audit] Lỗi tạo bản ghi audit ban đầu: ${err.message}`);
      return null;
    }
  }

  /**
   * Cập nhật bản ghi Audit khi Job hoàn thành thành công
   *
   * @param {string} jobId
   * @param {Object} resultData
   */
  async recordSuccess(jobId, resultData) {
    try {
      await AIAuditLog.update(
        {
          status: "completed",
          provider: resultData.provider || "gemini",
          model: resultData.model || "gemini-2.5-flash",
          prompt_tokens: resultData.usage?.promptTokens || 0,
          completion_tokens: resultData.usage?.completionTokens || 0,
          total_tokens: resultData.usage?.totalTokens || 0,
          estimated_cost_usd: resultData.estimatedCostUsd || 0,
          latency_ms: resultData.latencyMs || 0,
          stage_timings: resultData.stageTimings || {},
          confidence_score: resultData.confidenceScore || 0,
          confidence_breakdown: resultData.confidenceBreakdown || {},
          conflicts: resultData.conflicts || [],
          flags: resultData.flags || [],
          field_provenance: resultData.fieldProvenance || {},
          evidence_snapshot: resultData.evidenceSnapshot || {},
          circuit_breaker_tripped: Boolean(resultData.circuitBreakerTripped),
        },
        { where: { job_id: jobId } }
      );
      logger.info(`[AI Audit] Đã lưu thành công bản ghi kiểm toán cho Job: ${jobId} (Flags: [${(resultData.flags || []).join(", ")}], Conflicts: ${(resultData.conflicts || []).length})`);
    } catch (err) {
      logger.error(`[AI Audit] Lỗi cập nhật audit thành công cho Job ${jobId}: ${err.message}`);
    }
  }

  /**
   * Cập nhật bản ghi Audit khi Job thất bại
   *
   * @param {string} jobId
   * @param {Error} error
   * @param {Object} [extraData]
   */
  async recordFailure(jobId, error, extraData = {}) {
    try {
      await AIAuditLog.update(
        {
          status: extraData.status || "failed",
          error_code: error.name || "AI_ERROR",
          error_message: error.message,
          latency_ms: extraData.latencyMs || 0,
          stage_timings: extraData.stageTimings || {},
          circuit_breaker_tripped: Boolean(extraData.circuitBreakerTripped),
        },
        { where: { job_id: jobId } }
      );
      logger.warn(`[AI Audit] Đã ghi nhận lỗi kiểm toán cho Job: ${jobId}`);
    } catch (err) {
      logger.error(`[AI Audit] Lỗi cập nhật audit thất bại cho Job ${jobId}: ${err.message}`);
    }
  }
}

export const aiAuditService = new AIAuditService();
export default aiAuditService;
