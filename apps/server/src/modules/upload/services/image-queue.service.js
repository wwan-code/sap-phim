/**
 * Dịch vụ Hàng đợi Xử lý Ảnh (Image Queue Service)
 * 
 * @description Quản lý hàng đợi xử lý hình ảnh dựa trên mức độ ưu tiên bằng BullMQ.
 * Hỗ trợ các tác vụ nâng cấp ảnh bằng AI, cắt ảnh thông minh và tối ưu hóa định dạng.
 */

import { Queue, Job } from "bullmq";
import { queueConnection, QUEUE_NAMES } from "../../../config/queue.config.js";
import { cacheHelper } from "../../../config/redis.config.js";
import { logger } from "../../../utils/logger.js";

// ════════════════════════════════════════
// CẤU HÌNH & CONSTANTS (CONFIG & CONSTANTS)
// ════════════════════════════════════════

/**
 * Mức độ ưu tiên của công việc (Giá trị càng thấp, ưu tiên càng cao)
 */
export const JOB_PRIORITY = {
  CRITICAL: 1,   // Các tác vụ chặn UI (User Interface)
  HIGH: 2,       // Các tác vụ do người dùng kích hoạt trực tiếp
  NORMAL: 3,     // Upload thông thường
  LOW: 4,        // Các tác vụ xử lý hàng loạt chạy ngầm
  BACKGROUND: 5, // Bảo trì định kỳ
};

/**
 * Các loại công việc (Job Types)
 */
export const JOB_TYPES = {
  PROCESS_IMAGE: "process-image",   // Xử lý ảnh cơ bản
  UPSCALE_IMAGE: "upscale-image",   // Nâng cấp độ phân giải
  CONVERT_FORMAT: "convert-format", // Chuyển đổi định dạng
  BATCH_PROCESS: "batch-process",   // Xử lý hàng loạt
  SMART_CROP: "smart-crop",         // Cắt ảnh thông minh (face detection)
  ENHANCE_QUALITY: "enhance-quality", // Tăng cường chất lượng
};

/**
 * Các giai đoạn tiến độ của công việc
 */
export const JOB_STAGES = {
  QUEUED: { name: "QUEUED", progress: [0, 5] },               // Đã vào hàng đợi
  ANALYZING: { name: "ANALYZING", progress: [5, 15] },         // Đang phân tích
  PREPROCESSING: { name: "PREPROCESSING", progress: [15, 25] }, // Đang tiền xử lý
  CROPPING: { name: "CROPPING", progress: [25, 40] },           // Đang cắt ảnh
  UPSCALING: { name: "UPSCALING", progress: [40, 70] },         // Đang nâng cấp AI
  ENHANCING: { name: "ENHANCING", progress: [70, 85] },         // Đang tăng cường
  OPTIMIZING: { name: "OPTIMIZING", progress: [85, 95] },       // Đang tối ưu hóa
  STORING: { name: "STORING", progress: [95, 100] },           // Đang lưu trữ
  COMPLETED: { name: "COMPLETED", progress: [100, 100] },       // Hoàn thành
};

/**
 * Tùy chọn mặc định cho công việc
 */
const DEFAULT_JOB_OPTIONS = {
  attempts: 3, // Thử lại tối đa 3 lần nếu lỗi
  backoff: {
    type: "exponential",
    delay: 2000,
  },
  removeOnComplete: {
    count: 100,
    age: 24 * 60 * 60, // Giữ các công việc hoàn thành trong 24 giờ
  },
  removeOnFail: {
    count: 50,
    age: 7 * 24 * 60 * 60, // Giữ các công việc thất bại trong 7 ngày
  },
};

// ════════════════════════════════════════
// SERVICE IMPLEMENTATION
// ════════════════════════════════════════

export class ImageQueueService {
  constructor() {
    this.queue = new Queue(QUEUE_NAMES.IMAGE_PROCESSING, {
      connection: queueConnection,
      defaultJobOptions: DEFAULT_JOB_OPTIONS,
    });

    this.setupEventHandlers();
    this.dedupCache = new Map(); // Bộ nhớ đệm khử trùng lặp (in-memory)
    this._dedupEntries = new Map(); // Theo dõi timestamp để dọn dẹp TTL

    // MEM-03 FIX: Dọn dẹp định kỳ các bản ghi khử trùng lặp cũ (mỗi 5 phút)
    const DEDUP_TTL_MS = 10 * 60 * 1000; // 10 phút
    this._dedupCleanupTimer = setInterval(
      () => {
        const now = Date.now();
        for (const [key, addedAt] of this._dedupEntries) {
          if (now - addedAt > DEDUP_TTL_MS) {
            this.dedupCache.delete(key);
            this._dedupEntries.delete(key);
          }
        }
      },
      5 * 60 * 1000,
    );
    
    if (this._dedupCleanupTimer.unref) this._dedupCleanupTimer.unref();
  }

  /**
   * Cấu hình các trình xử lý sự kiện cho hàng đợi
   */
  setupEventHandlers() {
    this.queue.on("waiting", (jobId) => {
      logger.debug(`Công việc xử lý ảnh ${jobId} đang chờ`);
    });

    this.queue.on("active", (job) => {
      logger.info(`Công việc ${job.id} (${job.name}) bắt đầu được xử lý`);
    });

    this.queue.on("completed", (job, result) => {
      logger.info(`Công việc ${job.id} hoàn thành`, { result });
      this.clearDedup(job.data?.dedupKey);
    });

    this.queue.on("failed", (job, err) => {
      logger.error(`Công việc ${job.id} thất bại`, { error: err.message });
      this.clearDedup(job.data?.dedupKey);
    });

    this.queue.on("stalled", (jobId) => {
      logger.warn(`Công việc ${jobId} bị treo (stalled)`);
    });

    this.queue.on("error", (error) => {
      logger.error("Lỗi hàng đợi xử lý ảnh", { error: error.message });
    });
  }

  /**
   * Thêm công việc vào hàng đợi với mức độ ưu tiên
   * 
   * @param {String} type - Loại công việc (từ JOB_TYPES)
   * @param {Object} data - Dữ liệu payload
   * @param {Object} [options] - Tùy chọn hàng đợi
   * @returns {Promise<Job>}
   */
  async addJob(type, data, options = {}) {
    const {
      priority = JOB_PRIORITY.NORMAL,
      delay = 0,
      jobId,
      deduplication = false,
    } = options;

    // Kiểm tra khử trùng lặp
    if (deduplication && data.dedupKey) {
      const existing = await this.checkDedup(data.dedupKey);
      if (existing) {
        logger.info(
          `Deduplication: bỏ qua công việc trùng lặp với key ${data.dedupKey}`,
        );
        return existing;
      }
    }

    const jobOptions = {
      ...DEFAULT_JOB_OPTIONS,
      priority,
      delay,
      ...(jobId && { jobId }),
    };

    const job = await this.queue.add(
      type,
      {
        ...data,
        priority,
        enqueuedAt: Date.now(),
      },
      jobOptions,
    );

    // Lưu cache để khử trùng lặp
    if (deduplication && data.dedupKey) {
      this.setDedup(data.dedupKey, job.id);
    }

    logger.info(
      `Đã thêm công việc ${job.id} (${type}) với mức ưu tiên ${priority}`,
    );
    return job;
  }

  /**
   * Xử lý một hình ảnh duy nhất
   * 
   * @param {Buffer|String} imageData - Buffer dữ liệu hoặc đường dẫn file
   * @param {Object} metadata - Metadata công việc (filename, specs, folder...)
   * @param {Object} options - Tùy chọn BullMQ
   * @returns {Promise<Job>}
   */
  async processImage(imageData, metadata = {}, options = {}) {
    const {
      priority = JOB_PRIORITY.NORMAL,
      jobId,
      deduplication = true,
    } = options;

    // Chuẩn hóa dữ liệu ảnh: Buffer → base64
    let serialisedData;
    if (Buffer.isBuffer(imageData)) {
      serialisedData = imageData.toString("base64");
    } else if (typeof imageData === "string") {
      serialisedData = imageData;
    } else {
      serialisedData = imageData;
    }

    const dedupKey =
      options.dedupKey ||
      (Buffer.isBuffer(imageData)
        ? await this.generateDedupKey(imageData, metadata)
        : null);

    return this.addJob(
      JOB_TYPES.PROCESS_IMAGE,
      {
        imageBuffer: serialisedData,
        metadata,
        targetSpecs: metadata.specs || null,
        dedupKey,
      },
      {
        priority,
        deduplication: deduplication && !!dedupKey,
        ...(jobId && { jobId }),
      },
    );
  }

  /**
   * Nâng cấp độ phân giải bằng AI
   */
  async upscaleImage(imageData, options = {}) {
    const {
      imageBuffer,
      scale = 2,
      model = "anime",
      priority = JOB_PRIORITY.HIGH,
    } = options;

    return this.addJob(
      JOB_TYPES.UPSCALE_IMAGE,
      {
        imageBuffer: imageBuffer?.toString("base64"),
        scale,
        model,
        dedupKey:
          options.dedupKey ||
          this.generateDedupKey(imageBuffer, { scale, model }),
      },
      {
        priority,
        deduplication: options.deduplication ?? true,
      },
    );
  }

  /**
   * Cắt ảnh thông minh với nhận diện khuôn mặt
   */
  async smartCrop(imageData, options = {}) {
    const {
      imageBuffer,
      targetAspectRatio,
      priority = JOB_PRIORITY.NORMAL,
    } = options;

    return this.addJob(
      JOB_TYPES.SMART_CROP,
      {
        imageBuffer: imageBuffer?.toString("base64"),
        targetAspectRatio,
        detectFaces: true,
        dedupKey: options.dedupKey,
      },
      {
        priority,
        deduplication: options.deduplication ?? false,
      },
    );
  }

  /**
   * Xử lý hàng loạt nhiều ảnh
   */
  async batchProcess(images, options = {}) {
    const { priority = JOB_PRIORITY.LOW } = options;

    const jobs = await Promise.all(
      images.map((image, index) =>
        this.addJob(
          JOB_TYPES.BATCH_PROCESS,
          {
            imageBuffer: image.buffer?.toString("base64"),
            metadata: image.metadata,
            targetSpecs: image.targetSpecs,
            batchIndex: index,
            totalBatches: images.length,
          },
          {
            priority: priority + Math.floor(index / 10), // Phân cấp ưu tiên
            deduplication: false,
          },
        ),
      ),
    );

    logger.info(`Đã thêm ${jobs.length} ảnh vào xử lý hàng loạt`);
    return jobs;
  }

  /**
   * Lấy trạng thái và tiến độ của công việc
   * 
   * @param {String} jobId - ID của công việc
   * @returns {Promise<Object|Null>} Trạng thái chi tiết
   */
  async getJobStatus(jobId) {
    const job = await Job.fromId(this.queue, jobId);
    if (!job) return null;

    const state = await job.getState();
    const progress = await job.progress;

    return {
      id: job.id,
      name: job.name,
      state,
      progress,
      data: job.data,
      returnvalue: job.returnvalue,
      failedReason: job.failedReason,
      attemptsMade: job.attemptsMade,
      timestamp: job.timestamp,
      processedOn: job.processedOn,
      finishedOn: job.finishedOn,
    };
  }

  /**
   * Cập nhật tiến độ của công việc
   */
  async updateProgress(jobId, stage, percent) {
    const job = await Job.fromId(this.queue, jobId);
    if (!job) return false;

    const stageInfo = JOB_STAGES[stage];
    const calculatedPercent = stageInfo
      ? stageInfo.progress[0] +
        (percent / 100) * (stageInfo.progress[1] - stageInfo.progress[0])
      : percent;

    await job.updateProgress({
      stage: stageInfo?.name || stage,
      percent: Math.round(calculatedPercent),
      rawPercent: percent,
      timestamp: Date.now(),
    });

    return true;
  }

  /**
   * Hủy một công việc đang chờ hoặc đang chạy
   */
  async cancelJob(jobId) {
    const job = await Job.fromId(this.queue, jobId);
    if (!job) return false;

    const state = await job.getState();
    if (state === "completed" || state === "failed") {
      return false; // Không thể hủy công việc đã xong
    }

    await job.remove();
    this.clearDedup(job.data?.dedupKey);

    logger.info(`Đã hủy công việc ${jobId}`);
    return true;
  }

  /**
   * Lấy thống kê của hàng đợi
   */
  async getStats() {
    const [waiting, active, completed, failed, delayed, paused] =
      await Promise.all([
        this.queue.getWaitingCount(),
        this.queue.getActiveCount(),
        this.queue.getCompletedCount(),
        this.queue.getFailedCount(),
        this.queue.getDelayedCount(),
        this.queue.getPausedCount(),
      ]);

    return {
      waiting,
      active,
      completed,
      failed,
      delayed,
      paused,
      total: waiting + active + delayed,
    };
  }

  /**
   * Dọn dẹp các công việc cũ
   */
  async cleanJobs(olderThanHours = 24, status = "completed") {
    const cleaned = await this.queue.clean(
      olderThanHours * 60 * 60 * 1000,
      100,
      status,
    );
    logger.info(
      `Đã dọn dẹp ${cleaned.length} công việc ${status} cũ hơn ${olderThanHours} giờ`,
    );
    return cleaned;
  }

  /**
   * Tạm dừng/Tiếp tục hàng đợi
   */
  async pause() {
    await this.queue.pause();
    logger.info("Đã tạm dừng hàng đợi xử lý ảnh");
  }

  async resume() {
    await this.queue.resume();
    logger.info("Đã tiếp tục hàng đợi xử lý ảnh");
  }

  // ════════════════════════════════════════
  // DEDUPLICATION HELPERS
  // ════════════════════════════════════════

  /**
   * Tạo key khử trùng lặp dựa trên buffer và metadata
   */
  async generateDedupKey(buffer, metadata) {
    if (!buffer) return null;
    const crypto = await import("crypto");
    const hash = crypto.createHash("md5");
    hash.update(buffer);
    if (metadata) {
      hash.update(JSON.stringify(metadata));
    }
    return hash.digest("hex");
  }

  /**
   * Kiểm tra xem công việc đã tồn tại trong hàng đợi chưa
   */
  async checkDedup(key) {
    if (!key) return null;

    // Kiểm tra in-memory cache
    if (this.dedupCache.has(key)) {
      const jobId = this.dedupCache.get(key);
      const status = await this.getJobStatus(jobId);
      if (status && ["waiting", "active", "delayed"].includes(status.state)) {
        return { jobId, status };
      }
    }

    // Kiểm tra Redis cache
    const cached = await cacheHelper.get(`img:dedup:${key}`);
    if (cached) {
      return JSON.parse(cached);
    }

    return null;
  }

  /**
   * Đánh dấu key là đang được xử lý
   */
  async setDedup(key, jobId) {
    if (!key) return;

    this.dedupCache.set(key, jobId);
    this._dedupEntries.set(key, Date.now());

    // Cache trong Redis với TTL 1 giờ
    await cacheHelper.set(
      `img:dedup:${key}`,
      JSON.stringify({ jobId, timestamp: Date.now() }),
      3600,
    );
  }

  /**
   * Xóa đánh dấu trùng lặp
   */
  clearDedup(key) {
    if (!key) return;
    this.dedupCache.delete(key);
    this._dedupEntries.delete(key);
  }

  /**
   * Giải phóng tài nguyên
   */
  async close() {
    if (this._dedupCleanupTimer) {
      clearInterval(this._dedupCleanupTimer);
      this._dedupCleanupTimer = null;
    }
    await this.queue.close();
    this.dedupCache.clear();
    this._dedupEntries.clear();
  }
}

/** Instance mặc định */
export const imageQueueService = new ImageQueueService();
export default imageQueueService;
