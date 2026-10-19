/**
 * Bộ điều khiển Tải lên (Upload Controller)
 * 
 * @description Xử lý các yêu cầu tải lên tệp tin, điều phối công việc hàng đợi và cung cấp thông tin trạng thái.
 */

import { responseUtil } from "../../../utils/response.util.js";
import {
  processAvatarImage,
  processCoverImage,
} from "../../../middlewares/upload.middleware.js";
import { getRelativePath } from "../../../config/media.config.js";
import {
  imageQueueService,
  JOB_PRIORITY,
} from "../services/image-queue.service.js";
import {
  storageService,
  generateFilePath,
} from "../services/storage.service.js";
import { createProgressTracker } from "../../jobs/services/progress.service.js";
import fs from "fs/promises";
import { getRedisClient, cacheHelper, cacheConfig } from "../../../config/redis.config.js";
import User from "../../../models/user.model.js";
import { logger } from "../../../utils/logger.js";

// ════════════════════════════════════════
// CONTROLLER IMPLEMENTATION
// ════════════════════════════════════════

export const uploadController = {
  /**
   * Tạo ID công việc duy nhất
   * @returns {String} jobId
   */
  generateJobId() {
    return `upload_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  },

  /**
   * [GET] /api/v1/upload/verify-upload-token
   * @description Xác thực token upload TUS từ Nginx (auth_request).
   * Token format: "episodeId:userId:timestamp"
   */
  async verifyUploadToken(req, res, next) {
    try {
      const originalMethod = req.headers["x-original-method"] || req.method;
      if (originalMethod === "OPTIONS") {
        return res.status(200).send("OK");
      }

      const uploadToken = req.headers["x-upload-token"];

      if (!uploadToken) {
        logger.warn(`[TUS-Auth] Bị từ chối vì thiếu upload_token từ IP: ${req.ip}`);
        return res.status(401).json({ success: false, message: "Thiếu Upload Token" });
      }

      const [episodeId, userId, timestamp] = uploadToken.split(":");

      if (!episodeId || !userId || !timestamp) {
        return res.status(401).json({ success: false, message: "Upload Token không hợp lệ" });
      }

      const redis = getRedisClient();
      const lockKey = `episode:upload:lock:${episodeId}`;
      const expectedValue = `${userId}:${timestamp}`;

      const existingLock = await redis.get(lockKey);

      if (!existingLock || existingLock !== expectedValue) {
        logger.warn(`[TUS-Auth] Lock thất bại cho episode ${episodeId}. Token: ${uploadToken}`);
        return res.status(403).json({ success: false, message: "Upload Token đã hết hạn hoặc không hợp lệ" });
      }

      // Refresh lock TTL để không bị mất lock trong lúc đang upload (giãn thêm 1 giờ)
      await redis.expire(lockKey, 3600);

      // Trả về 200 OK cho Nginx để cho phép request đi tiếp
      return res.status(200).send("OK");
    } catch (error) {
      logger.error(`[TUS-Auth] Lỗi hệ thống: ${error.message}`);
      return res.status(500).json({ success: false, message: "Lỗi hệ thống khi xác thực token" });
    }
  },

  /**
   * [POST] /api/v1/upload/image
   * @description Tải lên một hình ảnh duy nhất với tùy chọn xử lý AI.
   * Lưu trực tiếp vào storage hoặc đẩy vào hàng đợi nếu bật aiProcessing.
   */
  async uploadImage(req, res, next) {
    try {
      if (!req.file) {
        const error = new Error("Không có file nào được upload");
        error.statusCode = 400;
        throw error;
      }

      const jobId = req.body.jobId || uploadController.generateJobId();
      const enableAI =
        req.body.aiProcessing === "true" || req.body.aiProcessing === true;
      const priority = req.body.priority || "NORMAL";

      // Khởi tạo trình theo dõi tiến độ
      const tracker = createProgressTracker(jobId, "upload");
      tracker.start({
        filename: req.file.originalname,
        fileSize: req.file.size,
      });

      let result;

      // Nếu yêu cầu xử lý AI, đẩy vào hàng đợi
      if (enableAI) {
        const specs = uploadController.parseSpecs(req.body, req.route.path);

        const job = await imageQueueService.processImage(
          req.file.buffer || req.file.path,
          {
            specs,
            filename: req.file.originalname,
            mimetype: req.file.mimetype,
          },
          {
            priority: JOB_PRIORITY[priority] || JOB_PRIORITY.NORMAL,
            jobId,
          },
        );

        tracker.progress(100);
        tracker.complete({
          queued: true,
          jobId: job.id,
        });

        result = {
          jobId: job.id,
          status: "queued",
          message: "Đã thêm vào hàng đợi xử lý",
          progress: 100,
          specs,
        };
      } else {
        // Xử lý trực tiếp không qua AI
        const buffer = req.file.buffer || (await fs.readFile(req.file.path));
        const filePath = generateFilePath(req.file.originalname, "images");

        const storeResult = await storageService.store(filePath, buffer);

        tracker.progress(100);
        tracker.complete({
          path: filePath,
          url: storeResult.url,
        });

        result = {
          path: filePath,
          url: storeResult.url,
          engine: storeResult.engine,
          size: storeResult.size,
          status: "completed",
        };
      }

      return responseUtil.success(res, result, "Upload thành công", 201);
    } catch (error) {
      next(error);
    }
  },

  /**
   * [POST] /api/v1/upload/avatar
   * @description Tải lên ảnh đại diện (tự động thay đổi kích thước và cập nhật hồ sơ người dùng).
   */
  async uploadAvatar(req, res, next) {
    try {
      if (!req.file) {
        const error = new Error("Không có file nào được upload");
        error.statusCode = 400;
        throw error;
      }

      const result = await processAvatarImage(req.file);

      if (!result.success) {
        throw new Error(result.error || "Lỗi xử lý ảnh avatar");
      }

      const avatarUrl = result.files.avatar.url;
      const avatarPath = result.files.avatar.path;

      // Tự động cập nhật hồ sơ người dùng nếu đã đăng nhập
      const userId = req.userId || req.user?.id;
      if (userId) {
        await User.update({ avatar_url: avatarUrl }, { where: { id: userId } });
        await Promise.all([
          cacheHelper.del(`${cacheConfig.prefix.profile}${userId}`),
          cacheHelper.del(`${cacheConfig.prefix.user}${userId}`),
        ]);
      }

      return responseUtil.success(
        res,
        {
          avatar_url: avatarUrl,
          path: avatarPath,
        },
        "Upload avatar thành công",
        201,
      );
    } catch (error) {
      next(error);
    }
  },

  /**
   * [POST] /api/v1/upload/cover
   * @description Tải lên ảnh bìa (tự động thay đổi kích thước thành 1920x600 và cập nhật hồ sơ người dùng).
   */
  async uploadCover(req, res, next) {
    try {
      if (!req.file) {
        const error = new Error("Không có file nào được upload");
        error.statusCode = 400;
        throw error;
      }

      const result = await processCoverImage(req.file);

      if (!result.success) {
        throw new Error(result.error || "Lỗi xử lý ảnh bìa");
      }

      const coverUrl = result.files.cover.url;
      const coverPath = result.files.cover.path;

      // Tự động cập nhật hồ sơ người dùng nếu đã đăng nhập
      const userId = req.userId || req.user?.id;
      if (userId) {
        await User.update({ cover_url: coverUrl }, { where: { id: userId } });
        await cacheHelper.del(`${cacheConfig.prefix.profile}${userId}`);
      }

      return responseUtil.success(
        res,
        {
          cover_url: coverUrl,
          path: coverPath,
        },
        "Upload ảnh bìa thành công",
        201,
      );
    } catch (error) {
      next(error);
    }
  },

  /**
   * [DELETE] /api/v1/upload/
   * @description Xóa tệp tin đã tải lên khỏi hệ thống lưu trữ.
   */
  async deleteFile(req, res, next) {
    try {
      const { url } = req.body;
      if (!url) {
        const error = new Error("URL file không được để trống");
        error.statusCode = 400;
        throw error;
      }

      const relativePath = getRelativePath(url);
      if (!relativePath) {
        const error = new Error("URL file không hợp lệ");
        error.statusCode = 400;
        throw error;
      }

      await storageService.delete(relativePath);

      return responseUtil.success(res, null, "Xóa file thành công");
    } catch (error) {
      next(error);
    }
  },

  /**
   * [POST] /api/v1/upload/batch
   * @description Tải lên hàng loạt nhiều tệp tin.
   */
  async batchUpload(req, res, next) {
    try {
      if (!req.files || req.files.length === 0) {
        const error = new Error("Không có file nào được upload");
        error.statusCode = 400;
        throw error;
      }

      const batchId = req.body.batchId || `batch_${Date.now()}`;
      const enableAI =
        req.body.aiProcessing === "true" || req.body.aiProcessing === true;
      const priority = req.body.priority || "LOW";
      const specs = uploadController.parseSpecs(req.body, "batch");

      const tracker = createProgressTracker(batchId, "upload");
      tracker.start({
        totalFiles: req.files.length,
        batchId,
      });

      const results = [];
      const errors = [];

      for (let i = 0; i < req.files.length; i++) {
        const file = req.files[i];

        try {
          let result;

          if (enableAI) {
            const job = await imageQueueService.processImage(
              file.buffer || file.path,
              {
                specs,
                filename: file.originalname,
                batchId,
                batchIndex: i,
              },
              {
                priority: JOB_PRIORITY[priority] || JOB_PRIORITY.LOW,
              },
            );

            result = {
              jobId: job.id,
              filename: file.originalname,
              status: "queued",
            };
          } else {
            const buffer = file.buffer || (await fs.readFile(file.path));
            const filePath = generateFilePath(file.originalname, "images");
            const storeResult = await storageService.store(filePath, buffer);

            result = {
              path: filePath,
              url: storeResult.url,
              filename: file.originalname,
              status: "completed",
            };
          }

          results.push(result);
        } catch (err) {
          errors.push({
            filename: file.originalname,
            error: err.message,
          });
        }

        // Cập nhật tiến độ
        tracker.progress(Math.round(((i + 1) / req.files.length) * 100));
      }

      tracker.complete({
        completed: results.length,
        errors: errors.length,
      });

      return responseUtil.success(
        res,
        {
          batchId,
          total: req.files.length,
          completed: results.length,
          errors: errors.length,
          results,
          failed: errors,
        },
        "Batch upload thành công",
        201,
      );
    } catch (error) {
      next(error);
    }
  },

  /**
   * [POST] /api/v1/upload/process
   * @description Xử lý lại tệp tin đã tồn tại trong storage.
   */
  async processExisting(req, res, next) {
    try {
      const { path: filePath, specs } = req.body;

      if (!filePath) {
        const error = new Error("Đường dẫn file không được để trống");
        error.statusCode = 400;
        throw error;
      }

      const jobId = req.body.jobId || uploadController.generateJobId();
      const priority = req.body.priority || "HIGH";

      // Truy xuất file từ storage
      const { buffer } = await storageService.retrieve(filePath);

      // Đẩy vào hàng đợi xử lý
      const job = await imageQueueService.processImage(
        buffer,
        {
          specs,
          filePath,
          reprocess: true,
        },
        {
          priority: JOB_PRIORITY[priority] || JOB_PRIORITY.HIGH,
          jobId,
        },
      );

      return responseUtil.success(
        res,
        {
          jobId: job.id,
          status: "queued",
          message: "Đã thêm vào hàng đợi xử lý lại",
        },
        "Đã yêu cầu xử lý lại",
        202,
      );
    } catch (error) {
      next(error);
    }
  },

  /**
   * [GET] /api/v1/upload/status/:jobId
   * @description Lấy trạng thái chi tiết của công việc.
   */
  async getJobStatus(req, res, next) {
    try {
      const { jobId } = req.params;

      const status = await imageQueueService.getJobStatus(jobId);

      if (!status) {
        const error = new Error("Không tìm thấy job");
        error.statusCode = 404;
        throw error;
      }

      return responseUtil.success(res, status, "Lấy trạng thái thành công");
    } catch (error) {
      next(error);
    }
  },

  /**
   * [DELETE] /api/v1/upload/cancel/:jobId
   * @description Hủy công việc đang xử lý.
   */
  async cancelJob(req, res, next) {
    try {
      const { jobId } = req.params;

      const cancelled = await imageQueueService.cancelJob(jobId);

      if (!cancelled) {
        const error = new Error(
          "Không thể hủy job (đã hoàn thành hoặc không tồn tại)",
        );
        error.statusCode = 400;
        throw error;
      }

      return responseUtil.success(
        res,
        { jobId, cancelled: true },
        "Đã hủy job thành công",
      );
    } catch (error) {
      next(error);
    }
  },

  /**
   * [GET] /api/v1/upload/stats
   * @description Lấy thống kê về upload (Dành cho Admin).
   */
  async getStats(req, res, next) {
    try {
      const [queueStats, storageStats] = await Promise.all([
        imageQueueService.getStats(),
        storageService.getStats(),
      ]);

      return responseUtil.success(
        res,
        {
          queue: queueStats,
          storage: storageStats,
          timestamp: Date.now(),
        },
        "Lấy thống kê thành công",
      );
    } catch (error) {
      next(error);
    }
  },

  /**
   * Phân tách thông số xử lý từ body request
   * @private
   */
  parseSpecs(body, route) {
    const specs = {
      type: body.type || "image",
      width: parseInt(body.width) || 1920,
      height: parseInt(body.height) || 1080,
      quality: parseInt(body.quality) || 90,
      format: body.format || "webp",
      upscale: body.upscale === "true" || body.upscale === true,
      crop: body.crop === "true" || body.crop !== "false",
      variants: body.variants ? JSON.parse(body.variants) : null,
    };

    // Ghi đè thông số dựa trên route hoặc loại ảnh
    if (route.includes("avatar") || body.type === "avatar") {
      specs.type = "avatar";
      specs.width = 400;
      specs.height = 400;
      specs.variants = [
        { name: "large", width: 200, height: 200, quality: 85 },
        { name: "medium", width: 150, height: 150, quality: 80 },
        { name: "small", width: 50, height: 50, quality: 75 },
      ];
    } else if (
      route.includes("cover") ||
      route.includes("banner") ||
      body.type === "cover"
    ) {
      specs.type = "banner";
      specs.width = 1920;
      specs.height = 600;
      specs.variants = [
        { name: "desktop", width: 1920, height: 600, quality: 90 },
        { name: "mobile", width: 768, height: 400, quality: 85 },
      ];
    } else if (body.type === "poster") {
      specs.type = "poster";
      specs.width = 1000;
      specs.height = 1500;
      specs.variants = [
        { name: "large", width: 1000, height: 1500, quality: 90 },
        { name: "medium", width: 500, height: 750, quality: 85 },
        { name: "small", width: 250, height: 375, quality: 80 },
      ];
    }

    return specs;
  },
};

export default uploadController;
