/**
 * Middleware & Tiện ích Tải lên (Upload Middleware & Utility)
 *
 * @file upload.middleware.js
 * @module Middlewares
 * @description Hệ thống xử lý tải lên tệp tin tập trung, hỗ trợ tiền xử lý hình ảnh (Sharp) và quản lý lưu trữ.
 * Tích hợp cơ chế Circuit Breaker để bảo vệ hệ thống khỏi quá tải và các lớp bảo mật chống Path Traversal.
 *
 * @note Mọi tệp tin tải lên đều qua bước khử độc (Sanitization) và kiểm tra định dạng nghiêm ngặt.
 */

import crypto from "crypto";
import multer from "multer";
import path from "path";
import fs from "fs/promises";
import { existsSync, mkdirSync } from "fs";
import sharp from "sharp";
import { v4 as uuidv4 } from "uuid";
import { env } from "../config/env.config.js";
import { mediaConfig, getMediaUrl } from "../config/media.config.js";
import {
  createCircuitBreaker,
  CircuitBreakerError,
} from "../utils/circuit-breaker.util.js";
import { logger } from "../utils/logger.js";

/**
 * Khởi tạo Circuit Breaker cho tính năng tải lên.
 * Giúp tự động ngắt kết nối khi phát hiện hệ thống lưu trữ (Disk/S3) gặp sự cố liên tiếp.
 */
const uploadCircuitBreaker = createCircuitBreaker("upload-middleware", {
  failureThreshold: 5,
  resetTimeoutMs: 30000,
  halfOpenMaxCalls: 3,
});

/**
 * Chuẩn hóa và làm sạch tên tệp tin (Sanitization).
 * Loại bỏ các ký tự nguy hiểm, ngăn chặn tấn công và giới hạn độ dài tên file.
 *
 * @param {string} filename - Tên tệp tin gốc từ người dùng
 * @returns {string} Tên tệp tin đã được xử lý an toàn
 */
const sanitizeFilename = (filename) => {
  if (!filename || typeof filename !== "string") {
    return "file";
  }

  let sanitized = filename;
  let prevLength;

  do {
    prevLength = sanitized.length;
    sanitized = sanitized
      .replace(/\.\./g, "")
      .replace(/[\/\\]/g, "")
      .replace(/[<>:"|?*\x00-\x1f]/g, "");
  } while (sanitized.length !== prevLength);

  sanitized = sanitized.replace(/[^\w\s.-]/g, "");
  const ext = path.extname(sanitized);
  const name = path.basename(sanitized, ext);
  const safeName = name.substring(0, 50) || "file";

  return safeName;
};

/**
 * Xác thực tính hợp lệ của đường dẫn lưu trữ (Security Boundary Check).
 * Ngăn chặn tuyệt đối các cuộc tấn công Duyệt thư mục (Path Traversal).
 *
 * @param {string} targetPath - Đường dẫn đích cần kiểm tra
 * @returns {string} Đường dẫn tuyệt đối đã được xác thực
 * @throws {Error} Nếu phát hiện đường dẫn có dấu hiệu tấn công hoặc nằm ngoài vùng cho phép
 */
const validateUploadPath = (targetPath) => {
  const normalizedPath = path.normalize(targetPath);
  const resolved = path.resolve(normalizedPath);
  const uploadDirResolved = path.resolve(
    path.normalize(mediaConfig.uploadsDir),
  );

  if (!resolved.startsWith(uploadDirResolved)) {
    throw new Error("Phát hiện hành vi tấn công Duyệt thư mục (Path Traversal)");
  }

  const suspiciousPatterns = [/\.\./, /\x00/];
  for (const pattern of suspiciousPatterns) {
    if (pattern.test(targetPath)) {
      throw new Error("Phát hiện mẫu đường dẫn không an toàn");
    }
  }

  return resolved;
};

/**
 * Đảm bảo thư mục tồn tại trên hệ thống tập tin.
 * Nếu thư mục chưa có, hệ thống sẽ tự động tạo mới (bao gồm cả thư mục cha).
 *
 * @param {string} dir - Đường dẫn thư mục cần kiểm tra/tạo
 */
const ensureDir = async (dir) => {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
};

// Tự động khởi tạo cấu trúc thư mục lưu trữ khi ứng dụng bắt đầu
Object.values(mediaConfig.directories).forEach(ensureDir);

/**
 * Tạo tên tệp tin duy nhất (UUID) để tránh xung đột dữ liệu trên đĩa.
 *
 * @param {string} originalname - Tên tệp tin gốc
 * @param {string} prefix - Tiền tố bổ sung (tùy chọn)
 * @returns {string} Tên tệp tin duy nhất kèm phần mở rộng gốc
 */
const generateFilename = (originalname, prefix = "") => {
  const ext = path.extname(originalname).toLowerCase();
  const name = uuidv4();
  return prefix ? `${prefix}_${name}${ext}` : `${name}${ext}`;
};

/**
 * Cấu hình bộ lưu trữ Multer (Disk Storage).
 * Xác định thư mục đích và quy tắc đặt tên tệp dựa trên loại tải lên.
 */
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let uploadType = req.uploadType || "temp";

    if (uploadType === "products" && file.fieldname === "video") {
      uploadType = "products_video";
    }

    const dir =
      mediaConfig.directories[uploadType] || mediaConfig.directories.temp;
    ensureDir(dir);
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const prefix = req.uploadPrefix || "";
    cb(null, generateFilename(file.originalname, prefix));
  },
});

/**
 * Bộ lọc tệp tin (File Filter).
 * Kiểm tra định dạng MIME của tệp tin so với danh sách cho phép trong cấu hình.
 */
const fileFilter = (req, file, cb) => {
  const fileType = req.fileType || "image";
  const allowedTypes =
    req.fileType === "mixed"
      ? [...mediaConfig.allowedTypes.image, ...mediaConfig.allowedTypes.video]
      : mediaConfig.allowedTypes[fileType] || mediaConfig.allowedTypes.image;

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        `Định dạng tệp không được hỗ trợ. Chỉ chấp nhận: ${allowedTypes.join(", ")}`,
      ),
      false,
    );
  }
};

/**
 * Factory khởi tạo bộ tải lên Multer với các giới hạn tùy chỉnh.
 *
 * @param {Object} options - Cấu hình giới hạn (loại file, dung lượng tối đa, số lượng tối đa)
 * @returns {multer.Multer} Đối tượng Multer đã cấu hình
 */
export const createUploader = (options = {}) => {
  const {
    fileType = "image",
    maxSize = mediaConfig.limits.image,
    maxFiles = 10,
  } = options;

  return multer({
    storage,
    fileFilter,
    limits: {
      fileSize: maxSize,
      files: maxFiles,
    },
  });
};

/**
 * Tiền xử lý hình ảnh sử dụng thư viện Sharp.
 * Thực hiện: Resize, tối ưu dung lượng, và chuyển đổi sang định dạng WebP.
 *
 * @param {string} inputPath - Đường dẫn tệp nguồn (tạm thời)
 * @param {string} outputDir - Thư mục lưu trữ đích
 * @param {Object} settings - Cấu hình xử lý (kích thước, chất lượng, tỷ lệ khung hình)
 * @returns {Promise<Object>} Thông tin các tệp tin sau xử lý
 */
export const processImage = async (inputPath, outputDir, settings = {}) => {
  const {
    sizes = {},
    quality = 85,
    format = "webp",
    aspectRatio = "1:1",
  } = settings;

  ensureDir(outputDir);
  const filename = path.basename(inputPath, path.extname(inputPath));
  const results = {};

  const getAspectDimensions = (baseWidth) => {
    if (aspectRatio === "3:4") {
      return { width: baseWidth, height: Math.round(baseWidth * (4 / 3)) };
    }
    if (aspectRatio === "16:9") {
      return { width: baseWidth, height: Math.round(baseWidth * (9 / 16)) };
    }
    return { width: baseWidth, height: baseWidth };
  };

  try {
    const inputBuffer = await fs.readFile(inputPath);

    for (const [sizeName, dimensions] of Object.entries(sizes)) {
      const outputFilename = `${filename}_${sizeName}.${format}`;
      const outputPath = path.join(outputDir, outputFilename);
      const aspectDims = getAspectDimensions(dimensions.width);

      await sharp(inputBuffer)
        .resize(aspectDims.width, aspectDims.height, {
          fit: dimensions.fit || "cover",
          withoutEnlargement: true,
        })
        .toFormat(format, { quality })
        .toFile(outputPath);

      results[sizeName] = {
        path: path
          .relative(mediaConfig.uploadsDir, outputPath)
          .replace(/\\/g, "/"),
        url: getMediaUrl(path.relative(mediaConfig.uploadsDir, outputPath)),
      };
    }

    if (settings.keepOriginal !== false) {
      const originalFilename = `${filename}_original.${format}`;
      const originalOutputPath = path.join(outputDir, originalFilename);
      const originalDims = getAspectDimensions(1920);

      await sharp(inputBuffer)
        .resize(originalDims.width, originalDims.height, {
          fit: "inside",
          withoutEnlargement: true,
        })
        .toFormat(format, { quality: 90 })
        .toFile(originalOutputPath);

      results.original = {
        path: path
          .relative(mediaConfig.uploadsDir, originalOutputPath)
          .replace(/\\/g, "/"),
        url: getMediaUrl(
          path.relative(mediaConfig.uploadsDir, originalOutputPath),
        ),
      };
    }

    // Dọn dẹp tệp tin tạm sau khi xử lý thành công
    try {
      await fs.unlink(inputPath);
    } catch (err) {
      logger.warn(
        `[UploadMiddleware] Không thể xóa tệp tạm sau khi xử lý: ${inputPath}`,
        err,
      );
    }

    return { success: true, files: results };
  } catch (error) {
    logger.error("[UploadMiddleware] Lỗi khi xử lý hình ảnh:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Xử lý ảnh đại diện (Avatar).
 * Tự động cắt ảnh theo khung vuông 150x150 và tối ưu hóa WebP.
 *
 * @param {Object} file - Đối tượng file từ Multer
 * @returns {Promise<Object>} Thông tin ảnh đại diện sau xử lý
 */
export const processAvatarImage = async (file) => {
  const outputDir = mediaConfig.directories.avatars;
  ensureDir(outputDir);

  const filename = path.basename(file.path, path.extname(file.path));
  const format = "webp";
  const outputFilename = `${filename}.${format}`;
  const outputPath = path.join(outputDir, outputFilename);

  try {
    const inputBuffer = await fs.readFile(file.path);

    await sharp(inputBuffer)
      .resize(150, 150, {
        fit: "cover",
        withoutEnlargement: true,
      })
      .flatten({ background: "#ffffff" })
      .toFormat(format, { quality: 90 })
      .toFile(outputPath);

    try {
      await fs.unlink(file.path);
    } catch (err) {
      logger.warn(
        `[UploadMiddleware] Không thể xóa tệp ảnh đại diện tạm: ${file.path}`,
      );
    }

    const relativePath = path
      .relative(mediaConfig.uploadsDir, outputPath)
      .replace(/\\/g, "/");

    return {
      success: true,
      files: {
        avatar: {
          path: relativePath,
          url: getMediaUrl(relativePath),
        },
      },
    };
  } catch (error) {
    logger.error("[UploadMiddleware] Lỗi xử lý ảnh đại diện:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Xử lý ảnh bìa (Cover Image).
 * Tối ưu hóa kích thước 1920x600 phù hợp cho giao diện Banner.
 *
 * @param {Object} file - Đối tượng file từ Multer
 * @returns {Promise<Object>} Thông tin ảnh bìa sau xử lý
 */
export const processCoverImage = async (file) => {
  const outputDir = mediaConfig.directories.covers;
  await ensureDir(outputDir);

  const filename = path.basename(file.path, path.extname(file.path));
  const format = "webp";
  const outputFilename = `${filename}.${format}`;
  const outputPath = path.join(outputDir, outputFilename);

  try {
    const inputBuffer = await fs.readFile(file.path);

    await sharp(inputBuffer)
      .resize(1920, 600, {
        fit: "cover",
        withoutEnlargement: true,
      })
      .flatten({ background: "#1f2229" })
      .toFormat(format, { quality: 85 })
      .toFile(outputPath);

    try {
      await fs.unlink(file.path);
    } catch (err) {
      logger.warn(
        `[UploadMiddleware] Không thể xóa tệp ảnh bìa tạm: ${file.path}`,
      );
    }

    const relativePath = path
      .relative(mediaConfig.uploadsDir, outputPath)
      .replace(/\\/g, "/");

    return {
      success: true,
      files: {
        cover: {
          path: relativePath,
          url: getMediaUrl(relativePath),
        },
      },
    };
  } catch (error) {
    logger.error("[UploadMiddleware] Lỗi xử lý ảnh bìa:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Xóa vĩnh viễn tệp tin khỏi hệ thống lưu trữ.
 *
 * @param {string} relativePath - Đường dẫn tương đối của tệp cần xóa
 * @returns {Promise<boolean>} Kết quả thực hiện
 */
export const deleteFile = async (relativePath) => {
  try {
    if (!relativePath) return false;

    let cleanPath = relativePath;
    if (cleanPath.startsWith("http")) return false;

    if (cleanPath.startsWith("/uploads/"))
      cleanPath = cleanPath.replace("/uploads/", "");
    else if (cleanPath.startsWith("uploads/"))
      cleanPath = cleanPath.replace("uploads/", "");

    const fullPath = path.join(mediaConfig.uploadsDir, cleanPath);

    if (existsSync(fullPath)) {
      await fs.unlink(fullPath);
      return true;
    }
    return false;
  } catch (error) {
    logger.error("[UploadMiddleware] Lỗi khi xóa tệp tin:", error);
    return false;
  }
};

const isClientOrValidationError = (err) => {
  if (!err) return false;
  if (err.name === "MulterError") return true;
  if (err.statusCode && err.statusCode < 500) return true;
  if (err.status && err.status < 500) return true;
  if (
    typeof err.message === "string" &&
    (err.message.includes("Định dạng tệp không được hỗ trợ") ||
      err.message.includes("Chỉ chấp nhận") ||
      err.message.includes("Kích thước tệp") ||
      err.message.includes("không hợp lệ"))
  ) {
    return true;
  }
  return false;
};

/**
 * Wrapper tích hợp Circuit Breaker cho các tác vụ tải lên.
 * Đảm bảo hệ thống không bị treo nếu tiến trình xử lý tệp tin gặp lỗi hàng loạt.
 *
 * @param {Function} setupFn - Hàm thiết lập cấu hình Request
 * @param {Function} uploaderFn - Hàm thực hiện tải lên từ Multer
 */
const withBreaker = (setupFn, uploaderFn) => {
  return async (req, res, nextOrCb) => {
    try {
      let clientError = null;
      await uploadCircuitBreaker.execute(async () => {
        const uploader = setupFn(req);
        return new Promise((resolve, reject) => {
          uploaderFn(uploader)(req, res, (err) => {
            if (err) {
              if (isClientOrValidationError(err)) {
                clientError = err;
                resolve();
              } else {
                reject(err);
              }
            } else {
              resolve();
            }
          });
        });
      });

      if (clientError) {
        if (!req.readableEnded) {
          req.resume();
        }
        return nextOrCb(clientError);
      }

      nextOrCb();
    } catch (error) {
      if (!req.readableEnded) {
        req.resume();
      }

      if (error instanceof CircuitBreakerError) {
        const err = new Error(
          "Hệ thống tải lên hiện đang bận hoặc quá tải, vui lòng thử lại sau ít phút",
        );
        err.statusCode = 503;
        return nextOrCb(err);
      }
      nextOrCb(error);
    }
  };
};

/**
 * Middleware: Tải lên một hình ảnh duy nhất (Trường mặc định: 'image').
 */
export const uploadSingleImage = (fieldName = "image") =>
  withBreaker(
    (req) => {
      req.uploadType = "temp";
      req.uploadPrefix = "image";
      req.fileType = "image";
      return createUploader({ maxSize: mediaConfig.limits.image });
    },
    (uploader) => uploader.single(fieldName),
  );

/**
 * Middleware: Tải lên ảnh đại diện của người dùng.
 */
export const uploadAvatar = withBreaker(
  (req) => {
    req.uploadType = "temp";
    req.uploadPrefix = "avatar";
    req.fileType = "avatar";
    return createUploader({ maxSize: mediaConfig.limits.avatar });
  },
  (uploader) => uploader.single("avatar"),
);

/**
 * Middleware: Tải lên ảnh bìa (Cover / Banner).
 */
export const uploadCover = withBreaker(
  (req) => {
    req.uploadType = "temp";
    req.uploadPrefix = "cover";
    req.fileType = "image";
    return createUploader({ maxSize: mediaConfig.limits.image });
  },
  (uploader) => uploader.single("cover"),
);

/**
 * Middleware: Tải lên danh sách nhiều hình ảnh.
 */
export const uploadMultipleImages = (fieldName = "images", maxFiles = 10) =>
  withBreaker(
    (req) => {
      req.uploadType = "temp";
      req.uploadPrefix = "batch";
      req.fileType = "image";
      return createUploader({
        maxSize: mediaConfig.limits.image,
        maxFiles,
      });
    },
    (uploader) => uploader.array(fieldName, maxFiles),
  );

/**
 * Middleware: Tải lên tệp tin theo các trường xác định trước.
 */
export const uploadFields = (fields = []) =>
  withBreaker(
    (req) => {
      req.uploadType = "temp";
      req.uploadPrefix = "field";
      req.fileType = "image";
      return createUploader({
        maxSize: mediaConfig.limits.image,
        maxFiles: fields.length,
      });
    },
    (uploader) => uploader.fields(fields),
  );

/**
 * Middleware: Xử lý tập trung các lỗi phát sinh từ Multer.
 */
export const handleUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    const error = new Error();
    if (err.code === "LIMIT_FILE_SIZE") {
      error.message = "Dung lượng tệp vượt quá giới hạn cho phép";
      error.statusCode = 413;
    } else if (err.code === "LIMIT_FILE_COUNT") {
      error.message = "Số lượng tệp tải lên vượt quá mức tối đa";
      error.statusCode = 400;
    } else {
      error.message = err.message;
      error.statusCode = 400;
    }
    return next(error);
  }

  if (err) {
    if (!err.statusCode) err.statusCode = 400;
    return next(err);
  }

  next();
};

/**
 * Kiểm tra định dạng Video có nằm trong danh sách hỗ trợ hay không.
 */
const isAllowedVideoMimeType = (mimetype) => {
  const allowedTypes = [
    "video/mp4",
    "video/x-matroska",
    "video/avi",
    "video/x-msvideo",
    "video/quicktime",
    "video/webm",
  ];
  return allowedTypes.includes(mimetype);
};

/**
 * Kiểm tra phần mở rộng của tệp tin video.
 */
const isAllowedVideoExtension = (filename) => {
  const ext = path.extname(filename).toLowerCase();
  const allowedExts = [".mp4", ".mkv", ".avi", ".mov", ".webm"];
  return allowedExts.includes(ext);
};

/**
 * Cấu hình bộ lưu trữ dành riêng cho Video thô (Raw).
 */
const videoStorage = multer.diskStorage({
  destination: async (req, file, cb) => {
    try {
      const uploadPath = path.join(env.upload.uploadDir, "videos", "raw");
      const validatedPath = validateUploadPath(uploadPath);
      await ensureDir(validatedPath);
      cb(null, validatedPath);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    try {
      const sanitizedName = sanitizeFilename(file.originalname);
      const ext = path.extname(file.originalname);
      const timestamp = Date.now();
      const random = crypto.randomBytes(8).toString("hex");
      const filename = `${timestamp}_${random}_${sanitizedName}${ext}`;
      cb(null, filename);
    } catch (error) {
      cb(error);
    }
  },
});

/**
 * Bộ lọc tệp tin Video: Định dạng, phần mở rộng và độ dài tên tệp.
 */
const videoFileFilter = (req, file, cb) => {
  try {
    if (!isAllowedVideoMimeType(file.mimetype)) {
      return cb(new Error("Định dạng video này không được hỗ trợ"));
    }

    if (!isAllowedVideoExtension(file.originalname)) {
      return cb(new Error("Phần mở rộng của tệp video không hợp lệ"));
    }

    if (!file.originalname || file.originalname.length > 255) {
      return cb(new Error("Tên tệp tin quá dài (tối đa 255 ký tự)"));
    }

    const suspiciousPatterns = [/\.\./, /[\/\\]/, /\x00/];
    for (const pattern of suspiciousPatterns) {
      if (pattern.test(file.originalname)) {
        return cb(
          new Error("Tên tệp tin chứa ký tự không hợp lệ hoặc không an toàn"),
        );
      }
    }

    cb(null, true);
  } catch (error) {
    cb(error);
  }
};

const VIDEO_MAX_SIZE = 2 * 1024 * 1024 * 1024; // Giới hạn mặc định: 2GB

/**
 * Middleware: Tải lên tệp tin Video.
 */
export const uploadVideo = multer({
  storage: videoStorage,
  fileFilter: videoFileFilter,
  limits: {
    fileSize: VIDEO_MAX_SIZE,
    files: 1,
  },
});

/**
 * Xuất khẩu các Middleware tải lên dưới dạng đối tượng (Tương thích ngược).
 */
export const uploadMiddleware = {
  single: uploadSingleImage,
  array: uploadMultipleImages,
  fields: uploadFields,
};

export default {
  uploadMiddleware,
  uploadSingleImage,
  uploadMultipleImages,
  uploadFields,
  uploadAvatar,
  uploadCover,
  uploadVideo: uploadVideo.single("video"),
  handleUploadError,
  processImage,
  processAvatarImage,
  processCoverImage,
  deleteFile,
};

