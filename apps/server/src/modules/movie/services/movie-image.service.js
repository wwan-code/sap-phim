/**
 * Dịch vụ Hình ảnh Phim (Movie Image Service)
 * 
 * @description Xử lý hình ảnh phim bằng AI (Sharp và Real-ESRGAN).
 * Cung cấp cơ chế đưa vào hàng đợi (Queue) để xử lý bất đồng bộ nhằm tránh quá tải server.
 */
import path from "path";
import fs from "fs/promises";
import { existsSync, mkdirSync } from "fs";
import { v4 as uuidv4 } from "uuid";
import { logger } from "../../../utils/logger.js";
import { mediaConfig, IMAGE_SPECS } from "../../../config/media.config.js";

const OUTPUT_FORMAT = "webp";
const OUTPUT_QUALITY = 85;
const MOVIE_IMAGE_FIELDS = ["poster", "banner", "cover", "logo"];

const safeQueueJobId = (value) =>
  String(value || uuidv4()).replace(/[^a-zA-Z0-9:_-]/g, "-");

const IMAGE_FILE_RE = /\.(avif|gif|heic|heif|jpe?g|png|webp)(\?.*)?$/i;
const IMAGE_PATH_KEYS = new Set([
  "url",
  "path",
  "poster",
  "banner",
  "cover",
  "logo",
  "thumbnail",
  "preview",
  "primary",
  "original",
  "webp",
]);

const isImagePathValue = (value, key = null) => {
  if (!value || typeof value !== "string") return false;
  const normalized = value.replace(/\\/g, "/").trim();

  if (normalized.startsWith("http")) return true;
  if (normalized.startsWith("/uploads/") || normalized.startsWith("uploads/")) return true;
  if (normalized.startsWith("movies/")) return true;
  if (IMAGE_PATH_KEYS.has(key) && IMAGE_FILE_RE.test(normalized)) return true;

  return normalized.includes("/") && IMAGE_FILE_RE.test(normalized);
};

const collectImagePaths = (value, paths, key = null) => {
  if (!value) return;

  if (typeof value === "string") {
    if (isImagePathValue(value, key)) {
      paths.push(value);
    }
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item) => collectImagePaths(item, paths, key));
    return;
  }

  if (typeof value === "object") {
    Object.entries(value).forEach(([childKey, item]) => collectImagePaths(item, paths, childKey));
  }
};

class MovieImageService {
  constructor() {
    this.uploadsDir = mediaConfig.uploadsDir;
    this.moviesDir = path.join(this.uploadsDir, "movies");
    this.ensureDirectories();
  }

  /**
   * Đảm bảo các thư mục tải lên tồn tại
   */
  ensureDirectories() {
    if (!existsSync(this.moviesDir)) {
      mkdirSync(this.moviesDir, { recursive: true });
    }
  }

  /**
   * Tạo tên tệp duy nhất
   * @param {string} prefix - Tiền tố tên tệp
   * @returns {string} Tên tệp định dạng webp
   */
  generateFilename(prefix = "image") {
    return `${prefix}_${uuidv4()}.${OUTPUT_FORMAT}`;
  }

  /**
   * Chuẩn bị payload danh sách file ảnh phim cho tiến trình (Worker)
   * Thay vì queue luôn, nó trả về payload để movie.service.js có thể đưa vào Job Pipeline.
   * 
   * @param {Object} files - Đối tượng Multer files { poster: [...], banner: [...], cover: [...] }
   * @param {String} movieId - ID phim
   * @param {String} jobId - ID công việc (tracking)
   */
  prepareImagePayload(files, movieId, jobId) {
    const progressJobId = safeQueueJobId(jobId);
    const queuedFiles = {};
    let fileCount = 0;

    for (const type of MOVIE_IMAGE_FIELDS) {
      if (!files[type] || !files[type][0]) continue;

      const file = files[type][0];
      queuedFiles[type] = [{
        path: file.path,
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        fieldname: file.fieldname,
      }];
      fileCount++;
    }

    if (fileCount === 0) {
      return { hasFiles: false, jobCount: 0, jobId: progressJobId };
    }

    return {
      hasFiles: true,
      jobCount: fileCount,
      jobId: progressJobId,
      payload: {
        movieId,
        files: queuedFiles,
        jobId: progressJobId,
      }
    };
  }

  /**
   * Xóa danh sách các tệp hình ảnh
   * @param {string[]} imagePaths - Mảng các đường dẫn ảnh
   */
  async deleteUploadedTempFiles(files) {
    const paths = [];
    for (const type of MOVIE_IMAGE_FIELDS) {
      if (files?.[type]?.[0]?.path) {
        paths.push(files[type][0].path);
      }
    }

    await Promise.all(
      paths.map(async (filePath) => {
        try {
          await fs.unlink(filePath);
        } catch (error) {
          if (error.code !== "ENOENT") {
            logger.warn("[MovieImage] Failed to remove temp upload", {
              path: filePath,
              error: error.message,
            });
          }
        }
      }),
    );
  }

  async cleanupMovieAssets(movie = {}) {
    const movieIdentifiers = [movie?.slug, movie?.id]
      .filter(Boolean)
      .map((value) => String(value).trim())
      .filter(Boolean);

    const removedPaths = [];
    const imagePaths = this.extractImagePaths(movie?.images);

    for (const imagePath of imagePaths) {
      try {
        const deleted = await this.deleteFile(imagePath);
        if (deleted) {
          removedPaths.push(imagePath);
        }
      } catch (error) {
        logger.warn("[MovieImage] Lỗi khi xóa ảnh movie", {
          path: imagePath,
          error: error.message,
        });
      }
    }

    if (movieIdentifiers.length === 0) {
      return removedPaths;
    }

    const normalizedMatches = new Set(movieIdentifiers.map((value) => value.toLowerCase()));
    const stack = [this.moviesDir];

    while (stack.length > 0) {
      const currentDir = stack.pop();
      if (!currentDir || !existsSync(currentDir)) continue;

      let entries;
      try {
        entries = await fs.readdir(currentDir, { withFileTypes: true });
      } catch (error) {
        continue;
      }

      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);

        if (entry.isDirectory()) {
          if (normalizedMatches.has(entry.name.toLowerCase())) {
            try {
              await fs.rm(fullPath, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
              removedPaths.push(fullPath);
            } catch (error) {
              logger.warn("[MovieImage] Lỗi khi xóa thư mục movie", {
                path: fullPath,
                error: error.message,
              });
            }
            continue;
          }

          stack.push(fullPath);
        }
      }
    }

    return removedPaths;
  }

  async deleteImages(imagePaths) {
    const results = [];

    for (const imagePath of imagePaths) {
      if (!imagePath) continue;

      try {
        const result = await this.deleteFile(imagePath);
        results.push({ path: imagePath, deleted: result });
      } catch (error) {
        logger.warn("[MovieImage] Lỗi khi xóa ảnh", {
          path: imagePath,
          error: error.message,
        });
        results.push({ path: imagePath, deleted: false, error: error.message });
      }
    }

    return results;
  }

  /**
   * Xóa một tệp duy nhất
   * @param {string} filePath - Đường dẫn tệp
   * @param {number} [retries=3] - Số lần thử lại nếu gặp EBUSY/EPERM
   * @returns {Promise<boolean>} Kết quả xóa
   */
  async deleteFile(filePath, retries = 3) {
    try {
      let cleanPath = filePath;

      // Không xử lý nếu là URL tuyệt đối (CDN/S3 bên thứ 3)
      if (cleanPath.startsWith("http")) {
        return false;
      }

      // Chuẩn hóa đường dẫn (loại bỏ tiền tố uploads)
      if (cleanPath.startsWith("/uploads/")) {
        cleanPath = cleanPath.replace("/uploads/", "");
      } else if (cleanPath.startsWith("uploads/")) {
        cleanPath = cleanPath.replace("uploads/", "");
      }

      const fullPath = path.join(this.uploadsDir, cleanPath);

      if (existsSync(fullPath)) {
        for (let i = 0; i <= retries; i++) {
          try {
            await fs.unlink(fullPath);
            return true;
          } catch (unlinkErr) {
            if (unlinkErr.code === "ENOENT") {
              return true;
            }
            if ((unlinkErr.code === "EBUSY" || unlinkErr.code === "EPERM") && i < retries) {
              await new Promise((r) => setTimeout(r, 80 * (i + 1)));
              continue;
            }
            throw unlinkErr;
          }
        }
      }

      return false;
    } catch (error) {
      if (error.code !== "ENOENT") {
        logger.error("[MovieImage] Lỗi khi xóa tệp", { path: filePath, error: error.message });
      }
      return false;
    }
  }

  extractImagePaths(images) {
    const collectedPaths = [];
    collectImagePaths(images, collectedPaths);
    return [...new Set(collectedPaths.filter((p) => p && !p.startsWith("http")))];
  }

  /**
   * Lấy thông tin ảnh mặc định (Placeholder)
   */
  getPlaceholderImages() {
    return {
      poster: "/images/placeholder-poster.jpg",
      banner: "/images/placeholder-banner.jpg",
      cover: "/images/placeholder-cover.jpg",
      logo: "",
    };
  }
}

export const movieImageService = new MovieImageService();
export default movieImageService;
