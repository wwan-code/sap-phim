/**
 * Cấu hình Truyền thông (Media Configuration)
 *
 * @name media.config.js
 * @module Config
 * @description Quản lý lưu trữ cục bộ, phân cấp thư mục, giới hạn kích thước
 * và các thông số kỹ thuật tối ưu hóa cho Hình ảnh, Video và Ảnh động (GIF).
 */

import path from "path";
import { fileURLToPath } from "url";
import { env } from "./env.config.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Thư mục gốc chứa toàn bộ tệp tải lên
const uploadsDir = path.join(__dirname, "../../uploads");

/**
 * Cấu hình Media tổng quát
 */
export const mediaConfig = {
  uploadsDir,
  publicPath: "/uploads",
  baseUrl: `${env.backendUrl || `http://localhost:${env.port}`}/uploads`,

  // Cấu trúc phân cấp thư mục con
  directories: {
    video: path.join(uploadsDir, "videos"),
    covers: path.join(uploadsDir, "covers"),
    avatars: path.join(uploadsDir, "avatars"),
    reviews: path.join(uploadsDir, "reviews"),
    temp: path.join(uploadsDir, "temp"),
  },

  // Giới hạn kích thước tệp tin (Bytes)
  limits: {
    image: 10 * 1024 * 1024, // 10MB
    video: 100 * 1024 * 1024, // 100MB
    gif: 20 * 1024 * 1024, // 20MB
    avatar: 5 * 1024 * 1024, // 5MB
  },

  // Định dạng MIME được phép
  allowedTypes: {
    image: [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp",
      "image/avif",
      "image/heic",
      "image/heif",
      "image/svg+xml",
    ],
    video: ["video/mp4", "video/webm", "video/quicktime", "video/x-msvideo"],
    gif: ["image/gif"],
    avatar: ["image/jpeg", "image/jpg", "image/png", "image/webp"],
  },

  // Phần mở rộng tệp tin tương ứng
  allowedExtensions: {
    image: [".jpg", ".jpeg", ".png", ".webp", ".avif", ".heic", ".heif", ".svg"],
    video: [".mp4", ".webm", ".mov", ".avi"],
    gif: [".gif"],
    avatar: [".jpg", ".jpeg", ".png", ".webp"],
  },

  // Thông số xử lý ảnh mặc định (Sharp)
  image: {
    cover: {
      desktop: { width: 1920, height: 600, fit: "cover" },
      mobile: { width: 768, height: 400, fit: "cover" },
      quality: 95,
      format: "webp",
    },
    avatar: {
      small: { width: 50, height: 50, fit: "cover" },
      medium: { width: 150, height: 150, fit: "cover" },
      large: { width: 300, height: 300, fit: "cover" },
      quality: 90,
      format: "webp",
    },
  },

  // Thông số xử lý Video
  video: {
    thumbnail: {
      width: 320,
      height: 180,
      format: "jpg",
    },
    formats: ["mp4", "webm"],
    maxDuration: 300, // Giới hạn 5 phút cho video tải lên thủ công
  },

  // Chính sách tự động dọn dẹp
  cleanup: {
    tempFileAge: 24 * 60 * 60 * 1000, // Xóa file tạm sau 24 giờ
    orphanedFileAge: 7 * 24 * 60 * 60 * 1000, // Xóa file mồ côi sau 7 ngày
  },
};

/**
 * Thông số kỹ thuật chi tiết cho từng loại ảnh (Image Specs)
 */
export const IMAGE_SPECS = {
  banner: {
    name: "Banner",
    aspectRatio: { width: 21, height: 9 },
    targetWidth: 1920,
    targetHeight: 823,
    format: "avif", // Ưu tiên AVIF để có dung lượng thấp nhất
    quality: 100,
    fallbackFormats: ["webp", "jpeg"],
    sharpen: { sigma: 0.6, m1: 0.8, m2: 0.4 },
    compression: { effort: 4, smartSubsample: true },
    minWidth: 960,
    minHeight: 411,
    priority: 3,
  },
  poster: {
    name: "Poster",
    aspectRatio: { width: 2, height: 3 },
    targetWidth: 600,
    targetHeight: 900,
    format: "webp",
    quality: 98,
    fallbackFormats: ["jpeg"],
    sharpen: { sigma: 0.5, m1: 0.7, m2: 0.3 },
    compression: { effort: 5, smartSubsample: true },
    minWidth: 300,
    minHeight: 450,
    priority: 2,
  },
  cover: {
    name: "Cover",
    aspectRatio: { width: 16, height: 9 },
    targetWidth: 1280,
    targetHeight: 720,
    format: "webp",
    quality: 95,
    fallbackFormats: ["jpeg"],
    sharpen: { sigma: 0.5, m1: 0.6, m2: 0.3 },
    compression: { effort: 4, smartSubsample: true },
    minWidth: 640,
    minHeight: 360,
    priority: 2,
  },
  logo: {
    name: "Logo",
    aspectRatio: null, // Không ép tỷ lệ (Free-form)
    targetWidth: 400,
    targetHeight: 200,
    format: "webp",
    quality: 95,
    fallbackFormats: ["png"],
    sharpen: { sigma: 0.3, m1: 0.5, m2: 0.2 },
    compression: { effort: 4, smartSubsample: true },
    minWidth: 100,
    minHeight: 50,
    priority: 1,
    fit: "contain", // Giữ nguyên độ trong suốt và tỷ lệ ảnh
  },
};

/**
 * Các chiến lược cắt ảnh (Crop Strategies)
 */
export const CROP_STRATEGY = {
  CENTER: "center", // Cắt từ tâm
  SMART: "smart", // Tự động chọn vùng quan trọng
  ATTENTION: "attention", // Vùng thu hút thị giác nhất
  ENTROPY: "entropy", // Vùng chứa nhiều thông tin nhất
  AUTO: "auto", // Hệ thống tự động quyết định dựa trên metadata
};

/**
 * Chế độ xử lý (Processing Modes)
 */
export const PROCESSING_MODE = {
  FAST: "fast", // Ưu tiên tốc độ
  BALANCED: "balanced", // Cân bằng giữa tốc độ và chất lượng
  QUALITY: "quality", // Ưu tiên chất lượng tối đa
};

/**
 * Các thiết lập xử lý mặc định
 */
export const PROCESSING_DEFAULTS = {
  mode: PROCESSING_MODE.BALANCED,
  cropStrategy: CROP_STRATEGY.AUTO,
  autoRotate: true,
  resizeKernel: {
    fast: "cubic",
    balanced: "lanczos3",
    quality: "lanczos3",
  },
  modulate: {
    brightness: 1.0,
    saturation: 1.02, // Tăng nhẹ độ bão hòa màu để ảnh sinh động hơn
    hue: 0,
  },
  adaptiveSharpening: true, // Tự động làm nét dựa trên độ phân giải
  denoise: {
    enabled: "auto",
    sigma: 0.5,
  },
  maxDimension: 10000,
  absoluteMinWidth: 100,
  absoluteMinHeight: 100,
  maxMemoryPerImage: 512 * 1024 * 1024, // Giới hạn 512MB RAM cho mỗi luồng Sharp
  processingTimeout: 60000,
  maxRetries: 2,
  retryDelay: 1000,
  enableCache: true,
  cacheTTL: 86400,
  progressiveThreshold: 5 * 1024 * 1024,
};

/**
 * Danh mục mã lỗi xử lý hình ảnh
 */
export const IMAGE_ERRORS = {
  INVALID_FORMAT: {
    code: "INVALID_FORMAT",
    message: "Định dạng ảnh không được hỗ trợ.",
    recoverable: false,
  },
  DECODE_FAILED: {
    code: "DECODE_FAILED",
    message: "Không thể đọc file ảnh.",
    recoverable: true,
  },
  CONVERT_FAILED: {
    code: "CONVERT_FAILED",
    message: "Không thể xử lý ảnh.",
    recoverable: true,
  },
  FILE_TOO_LARGE: {
    code: "FILE_TOO_LARGE",
    message: "File quá lớn. Tối đa 10MB.",
    recoverable: false,
  },
  IMAGE_TOO_SMALL: {
    code: "IMAGE_TOO_SMALL",
    message: "Ảnh quá nhỏ để xử lý.",
    recoverable: false,
  },
  CROP_FAILED: {
    code: "CROP_FAILED",
    message: "Không thể cắt ảnh về tỷ lệ yêu cầu.",
    recoverable: true,
  },
  RESIZE_FAILED: {
    code: "RESIZE_FAILED",
    message: "Không thể thay đổi kích thước ảnh.",
    recoverable: true,
  },
  EMPTY_BUFFER: {
    code: "EMPTY_BUFFER",
    message: "File ảnh rỗng hoặc không hợp lệ.",
    recoverable: false,
  },
  HEIF_CONVERSION_FAILED: {
    code: "HEIF_CONVERSION_FAILED",
    message: "Không thể chuyển đổi ảnh HEIF/HEIC.",
    recoverable: true,
  },
  TIMEOUT: {
    code: "TIMEOUT",
    message: "Xử lý ảnh quá lâu.",
    recoverable: true,
  },
  MEMORY_LIMIT: {
    code: "MEMORY_LIMIT",
    message: "Ảnh quá lớn để xử lý (Vượt giới hạn bộ nhớ).",
    recoverable: false,
  },
  QUALITY_TOO_LOW: {
    code: "QUALITY_TOO_LOW",
    message: "Chất lượng ảnh sau xử lý quá thấp.",
    recoverable: false,
  },
};

/**
 * Lấy thông số kỹ thuật cho một loại ảnh cụ thể
 *
 * @param {string} imageType - Loại ảnh (banner, poster, cover, logo)
 * @returns {Object} Thông số kỹ thuật của loại ảnh
 * @throws {Error} Khi loại ảnh không hợp lệ
 */
export const getImageSpec = (imageType) => {
  const spec = IMAGE_SPECS[imageType.toLowerCase()];
  if (!spec) {
    throw new Error(`Loại ảnh không xác định: ${imageType}`);
  }
  return spec;
};

/**
 * Kiểm tra kích thước ảnh so với yêu cầu
 *
 * @param {number} width - Chiều rộng hiện tại
 * @param {number} height - Chiều cao hiện tại
 * @param {string} imageType - Loại ảnh mục tiêu
 * @returns {Object} Kết quả kiểm tra kèm thông điệp
 */
export const checkImageSize = (width, height, imageType) => {
  const spec = getImageSpec(imageType);
  if (
    width < PROCESSING_DEFAULTS.absoluteMinWidth ||
    height < PROCESSING_DEFAULTS.absoluteMinHeight
  ) {
    return {
      isSmall: true,
      isTooSmall: true,
      severity: "critical",
      message: "Ảnh quá nhỏ so với yêu cầu hệ thống tối thiểu.",
    };
  }
  if (width < spec.minWidth || height < spec.minHeight) {
    return {
      isSmall: true,
      isTooSmall: false,
      severity: "medium",
      message: "Ảnh nhỏ hơn kích thước đề xuất để đạt chất lượng tốt nhất.",
    };
  }
  return { isSmall: false, isTooSmall: false, severity: "none" };
};

/**
 * Tính toán độ nén (Quality) tối ưu dựa trên tỷ lệ thay đổi kích thước
 *
 * @param {string} imageType - Loại ảnh
 * @param {number} originalSize - Kích thước gốc
 * @param {number} targetSize - Kích thước đích
 * @returns {number} Giá trị quality từ 0-100
 */
export const selectQuality = (imageType, originalSize, targetSize) => {
  const spec = getImageSpec(imageType);
  const baseQuality = spec.quality || 90;
  const sizeRatio = targetSize / originalSize;

  // Nếu ảnh được phóng to (upscale), tăng chất lượng để bù đắp nhiễu
  if (sizeRatio > 1.5) return Math.min(100, baseQuality + 5);
  // Nếu ảnh thu nhỏ nhiều, giảm nhẹ chất lượng để tối ưu dung lượng
  if (sizeRatio < 0.5) return Math.max(70, baseQuality - 5);

  return baseQuality;
};

/**
 * Xác định chế độ xử lý tối ưu dựa trên tài nguyên tệp tin
 *
 * @param {number} width - Chiều rộng
 * @param {number} height - Chiều cao
 * @param {number} fileSize - Dung lượng tệp (Bytes)
 * @returns {string} Chế độ xử lý tối ưu
 */
export const getOptimalMode = (width, height, fileSize) => {
  const totalPixels = width * height;

  // Ưu tiên tốc độ cho ảnh dung lượng lớn (> 25MP hoặc > 10MB)
  if (totalPixels > 25000000 || fileSize > 10 * 1024 * 1024)
    return PROCESSING_MODE.FAST;

  // Ưu tiên chất lượng tối đa cho ảnh nhỏ (< 0.5MP và < 1MB)
  if (totalPixels < 500000 && fileSize < 1024 * 1024)
    return PROCESSING_MODE.QUALITY;

  return PROCESSING_MODE.BALANCED;
};

/**
 * Lấy đường dẫn URL tương đối (Lưu vào Database)
 *
 * @param {string} relativePath - Đường dẫn tương đối từ thư mục uploads
 * @returns {string|null} Đường dẫn chuẩn hóa để truy cập qua Web
 */
export const getMediaUrl = (relativePath) => {
  if (!relativePath) return null;
  if (relativePath.startsWith("http")) return relativePath;
  if (relativePath.startsWith("/uploads")) return relativePath;

  const normalizedPath = relativePath.replace(/\\/g, "/");
  return `${mediaConfig.publicPath}/${normalizedPath.replace(/^\//, "")}`;
};

/**
 * Lấy đường dẫn tương đối từ URL đầy đủ hoặc Public Path
 *
 * @param {string} input - URL hoặc đường dẫn công khai
 * @returns {string|null} Đường dẫn tương đối sau khi loại bỏ prefix
 */
export const getRelativePath = (input) => {
  if (!input) return null;

  let pathStr = input;

  if (input.startsWith("http")) {
    if (input.startsWith(mediaConfig.baseUrl)) {
      pathStr = input.replace(mediaConfig.baseUrl, "");
    } else {
      return input;
    }
  }

  if (pathStr.startsWith(mediaConfig.publicPath)) {
    pathStr = pathStr.replace(mediaConfig.publicPath, "");
  }

  return sanitizePath(pathStr);
};

/**
 * Làm sạch đường dẫn để ngăn chặn tấn công Path Traversal
 *
 * @param {string} filePath - Đường dẫn cần làm sạch
 * @returns {string} Đường dẫn đã được chuẩn hóa an toàn
 */
export const sanitizePath = (filePath) => {
  if (!filePath) return "";

  const normalized = path.normalize(filePath).replace(/\\/g, "/");

  const sanitized = normalized
    .replace(/^(\.\.\/|\/)+/, "")
    .replace(/\/(\.\.\/)+/g, "/");

  return sanitized;
};

export default mediaConfig;
