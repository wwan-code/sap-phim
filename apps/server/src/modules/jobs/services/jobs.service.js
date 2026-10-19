import { createProgressTracker } from "./progress.service.js";
import { logger } from "../../../utils/logger.js";
import { addJob } from "../../../config/queue.config.js";

class JobsService {
  constructor() {
    this.activeJobs = new Map();
  }

  /**
   * Khởi tạo Tracker cho một tác vụ (trước khi enqueue)
   */
  createTracker(jobId, operation, metadata = {}) {
    if (!jobId) return null;
    const jobType = metadata.jobType || "system";

    try {
      const tracker = createProgressTracker(jobId, `${jobType}:${operation}`, {
        jobType,
        operation,
        ...metadata,
      });
      
      this.activeJobs.set(jobId, {
        tracker,
        jobType,
        operation,
        metadata,
        startTime: Date.now(),
      });

      logger.debug(`[JobsService] Đã tạo tracker cho job ${jobId}`, {
        operation,
        jobType,
        metadata,
      });

      return tracker;
    } catch (error) {
      logger.error(`[JobsService] Lỗi tạo tracker cho job ${jobId}`, {
        error: error.message,
        operation,
      });
      return null;
    }
  }

  /**
   * Bắt đầu một tác vụ
   */
  startJob(jobId, startData = {}) {
    const job = this.activeJobs.get(jobId);
    if (!job) return;

    try {
      job.tracker?.start({
        operation: job.operation,
        ...job.metadata,
        ...startData,
      });

      logger.debug(`[JobsService] Đã bắt đầu job ${jobId}`, {
        operation: job.operation,
        startData,
      });
    } catch (error) {
      logger.error(`[JobsService] Lỗi khi bắt đầu job ${jobId}`, {
        error: error.message,
      });
    }
  }

  /**
   * Cập nhật tiến trình một tác vụ
   */
  updateStage(jobId, stage, stageData = {}) {
    const job = this.activeJobs.get(jobId);
    if (!job) return;

    try {
      job.tracker?.stage(stage, stageData);

      logger.debug(`[JobsService] Đã cập nhật giai đoạn cho job ${jobId}`, {
        stage,
        stageData,
      });
    } catch (error) {
      logger.error(`[JobsService] Lỗi khi cập nhật giai đoạn cho job ${jobId}`, {
        error: error.message,
        stage,
      });
    }
  }

  /**
   * Đưa công việc vào BullMQ queue
   */
  async enqueueJob(queueName, jobName, payload, options = {}) {
    return addJob(queueName, jobName, payload, options);
  }

  /**
   * Hoàn thành tác vụ
   */
  completeJob(jobId, completionData = {}) {
    const job = this.activeJobs.get(jobId);
    if (!job) return;

    try {
      const duration = Date.now() - job.startTime;
      job.tracker?.complete({
        operation: job.operation,
        duration,
        ...job.metadata,
        ...completionData,
      });
      this.activeJobs.delete(jobId);
      logger.info(`[JobsService] Hoàn thành job ${jobId} trong ${duration}ms`);
    } catch (error) {
      logger.error(`[JobsService] Lỗi khi hoàn thành job ${jobId}`, { error: error.message });
    }
  }

  /**
   * Kết thúc tác vụ do lỗi
   */
  failJob(jobId, error, errorData = {}) {
    const job = this.activeJobs.get(jobId);
    if (!job) return;

    try {
      job.tracker?.error?.(error);
      this.activeJobs.delete(jobId);
      logger.error(`[JobsService] Job ${jobId} thất bại`, {
        error: error.message,
        errorData,
      });
    } catch (trackingError) {
      logger.error(`[JobsService] Lỗi khi ghi nhận thất bại cho job ${jobId}`, {
        error: trackingError.message,
      });
    }
  }

  releaseJob(jobId) {
    if (!jobId) return;
    this.activeJobs.delete(jobId);
  }

  cleanupStaleJobs() {
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    let cleanedCount = 0;
    for (const [jobId, job] of this.activeJobs.entries()) {
      if (job.startTime < oneHourAgo) {
        this.activeJobs.delete(jobId);
        cleanedCount++;
      }
    }
    if (cleanedCount > 0) {
      logger.info(`[JobsService] Đã dọn dẹp ${cleanedCount} công việc bị treo`);
    }
  }
}

export const jobsService = new JobsService();

const cleanupTimer = setInterval(() => {
  jobsService.cleanupStaleJobs();
}, 30 * 60 * 1000);
cleanupTimer.unref?.();

export default jobsService;
