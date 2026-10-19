/**
 * Dịch vụ Lưu trữ (Storage Service)
 * 
 * @description Quản lý việc lưu trữ tệp tin đa nền tảng (Local & Supabase/S3).
 * Hỗ trợ cơ chế dự phòng (fallback) tự động và bảo vệ bằng Circuit Breaker.
 */

import fs from "fs/promises";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import { env } from "../../../config/env.config.js";
import { mediaConfig } from "../../../config/media.config.js";
import { logger } from "../../../utils/logger.js";
import {
  circuitBreakerRegistry
} from "../../../utils/circuit-breaker.util.js";

// ════════════════════════════════════════
// CONSTANTS & ERRORS
// ════════════════════════════════════════

/**
 * Các loại Engine lưu trữ
 */
export const STORAGE_ENGINE = {
  LOCAL: "local",
  SUPABASE: "supabase",
};

/**
 * Lớp lỗi chuyên biệt cho Storage
 */
export class StorageError extends Error {
  constructor(message, engine, code, originalError) {
    super(message);
    this.name = "StorageError";
    this.engine = engine;
    this.code = code;
    this.originalError = originalError;
  }
}

// ════════════════════════════════════════
// ENGINE LƯU TRỮ LOCAL (LOCAL STORAGE ENGINE)
// ════════════════════════════════════════

/**
 * Triển khai lưu trữ tệp tin trên đĩa cứng local
 */
class LocalStorageEngine {
  constructor() {
    this.basePath = mediaConfig.uploadDir || "uploads";
    this.circuitBreaker = circuitBreakerRegistry.get("storage-local", {
      failureThreshold: 5,
      resetTimeoutMs: 15000,
    });
  }

  /**
   * Lưu trữ tệp tin
   */
  async store(filePath, buffer, options = {}) {
    return this.circuitBreaker.execute(async () => {
      try {
        const fullPath = path.join(this.basePath, filePath);
        const dir = path.dirname(fullPath);

        // Đảm bảo thư mục tồn tại
        await fs.mkdir(dir, { recursive: true });

        // Ghi file
        await fs.writeFile(fullPath, buffer);

        // Lấy thông tin file
        const stats = await fs.stat(fullPath);

        logger.debug(`Đã lưu file local: ${filePath}`, {
          size: stats.size,
          engine: STORAGE_ENGINE.LOCAL,
        });

        return {
          path: filePath,
          fullPath,
          size: stats.size,
          engine: STORAGE_ENGINE.LOCAL,
          url: this.getUrl(filePath),
        };
      } catch (error) {
        throw new StorageError(
          `Lưu trữ local thất bại: ${error.message}`,
          STORAGE_ENGINE.LOCAL,
          "STORE_FAILED",
          error,
        );
      }
    });
  }

  /**
   * Truy xuất tệp tin
   */
  async retrieve(filePath) {
    return this.circuitBreaker.execute(async () => {
      try {
        const fullPath = this._resolveSafePath(filePath);
        const buffer = await fs.readFile(fullPath);
        const stats = await fs.stat(fullPath);

        return {
          buffer,
          size: stats.size,
          modifiedTime: stats.mtime,
          engine: STORAGE_ENGINE.LOCAL,
        };
      } catch (error) {
        if (error.code === "ENOENT") {
          throw new StorageError(
            `Không tìm thấy file: ${filePath}`,
            STORAGE_ENGINE.LOCAL,
            "NOT_FOUND",
            error,
          );
        }
        throw new StorageError(
          `Truy xuất file thất bại: ${error.message}`,
          STORAGE_ENGINE.LOCAL,
          "RETRIEVE_FAILED",
          error,
        );
      }
    });
  }

  /**
   * Xóa tệp tin
   */
  async delete(filePath) {
    return this.circuitBreaker.execute(async () => {
      try {
        const fullPath = this._resolveSafePath(filePath);
        await fs.unlink(fullPath);

        // Thử xóa thư mục cha nếu trống
        const dir = path.dirname(fullPath);
        if (dir !== this.basePath) {
          try {
            await fs.rmdir(dir);
          } catch (e) {
            // Thư mục không trống, bỏ qua
          }
        }

        logger.debug(`Đã xóa file local: ${filePath}`);
        return true;
      } catch (error) {
        if (error.code === "ENOENT") return true;
        throw new StorageError(
          `Xóa file thất bại: ${error.message}`,
          STORAGE_ENGINE.LOCAL,
          "DELETE_FAILED",
          error,
        );
      }
    });
  }

  /**
   * Kiểm tra sự tồn tại
   */
  async exists(filePath) {
    try {
      const fullPath = this._resolveSafePath(filePath);
      await fs.access(fullPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Giải quyết đường dẫn an toàn để tránh tấn công Path Traversal
   * @private
   */
  _resolveSafePath(filePath) {
    const normalizedRelative = path.normalize(filePath).replace(/^(\.\.[\/\\])+/, "");
    const fullPath = path.resolve(this.basePath, normalizedRelative);
    const absoluteBase = path.resolve(this.basePath);

    if (!fullPath.startsWith(absoluteBase)) {
      const error = new Error(`Truy cập bị từ chối: Đường dẫn nằm ngoài phạm vi (${filePath})`);
      error.code = "FORBIDDEN_PATH";
      throw error;
    }

    return fullPath;
  }

  /**
   * Lấy URL truy cập
   */
  getUrl(filePath) {
    const baseUrl = env.app?.apiUrl || env.apiUrl || "";
    return `${baseUrl}/uploads/${filePath.replace(/\\/g, "/")}`;
  }
}

// ════════════════════════════════════════
// ENGINE LƯU TRỮ SUPABASE (SUPABASE ENGINE)
// ════════════════════════════════════════

/**
 * Triển khai lưu trữ tệp tin trên Supabase Storage
 */
class SupabaseStorageEngine {
  constructor() {
    this.bucket = env.supabase?.bucket || "images";
    this.enabled = !!(env.supabase?.url && env.supabase?.serviceKey);

    if (this.enabled) {
      this.client = createClient(env.supabase.url, env.supabase.serviceKey);
    }

    this.circuitBreaker = circuitBreakerRegistry.get("storage-supabase", {
      failureThreshold: 3,
      resetTimeoutMs: 30000,
    });
  }

  /**
   * Lưu trữ tệp tin lên Cloud
   */
  async store(filePath, buffer, options = {}) {
    if (!this.enabled) {
      throw new StorageError("Supabase chưa được cấu hình", STORAGE_ENGINE.SUPABASE, "NOT_CONFIGURED");
    }

    return this.circuitBreaker.execute(async () => {
      try {
        const normalizedPath = filePath.replace(/^\\?\//, "");

        const { data, error } = await this.client.storage
          .from(this.bucket)
          .upload(normalizedPath, buffer, {
            contentType: options.contentType || "application/octet-stream",
            upsert: options.upsert ?? true,
          });

        if (error) throw new Error(error.message);

        const { data: urlData } = this.client.storage
          .from(this.bucket)
          .getPublicUrl(normalizedPath);

        logger.debug(`Đã lưu file lên Supabase: ${filePath}`, {
          size: buffer.length,
          engine: STORAGE_ENGINE.SUPABASE,
        });

        return {
          path: filePath,
          fullPath: normalizedPath,
          size: buffer.length,
          engine: STORAGE_ENGINE.SUPABASE,
          url: urlData.publicUrl,
          metadata: data,
        };
      } catch (error) {
        throw new StorageError(
          `Lưu trữ Supabase thất bại: ${error.message}`,
          STORAGE_ENGINE.SUPABASE,
          "STORE_FAILED",
          error,
        );
      }
    });
  }

  /**
   * Truy xuất tệp tin từ Cloud
   */
  async retrieve(filePath) {
    if (!this.enabled) {
      throw new StorageError("Supabase chưa được cấu hình", STORAGE_ENGINE.SUPABASE, "NOT_CONFIGURED");
    }

    return this.circuitBreaker.execute(async () => {
      try {
        const normalizedPath = filePath.replace(/^\\?\//, "");

        const { data, error } = await this.client.storage
          .from(this.bucket)
          .download(normalizedPath);

        if (error) throw new Error(error.message);

        const buffer = Buffer.from(await data.arrayBuffer());

        return {
          buffer,
          size: buffer.length,
          engine: STORAGE_ENGINE.SUPABASE,
        };
      } catch (error) {
        throw new StorageError(
          `Truy xuất Supabase thất bại: ${error.message}`,
          STORAGE_ENGINE.SUPABASE,
          "RETRIEVE_FAILED",
          error,
        );
      }
    });
  }

  /**
   * Xóa tệp tin trên Cloud
   */
  async delete(filePath) {
    if (!this.enabled) {
      throw new StorageError("Supabase chưa được cấu hình", STORAGE_ENGINE.SUPABASE, "NOT_CONFIGURED");
    }

    return this.circuitBreaker.execute(async () => {
      try {
        const normalizedPath = filePath.replace(/^\\?\//, "");

        const { error } = await this.client.storage
          .from(this.bucket)
          .remove([normalizedPath]);

        if (error) throw new Error(error.message);

        logger.debug(`Đã xóa file trên Supabase: ${filePath}`);
        return true;
      } catch (error) {
        throw new StorageError(
          `Xóa file trên Supabase thất bại: ${error.message}`,
          STORAGE_ENGINE.SUPABASE,
          "DELETE_FAILED",
          error,
        );
      }
    });
  }

  /**
   * Kiểm tra sự tồn tại trên Cloud
   */
  async exists(filePath) {
    if (!this.enabled) return false;

    try {
      const normalizedPath = filePath.replace(/^\\?\//, "");

      const { data, error } = await this.client.storage
        .from(this.bucket)
        .list(path.dirname(normalizedPath), {
          limit: 1,
          search: path.basename(normalizedPath),
        });

      if (error) return false;
      return data && data.length > 0;
    } catch {
      return false;
    }
  }

  /**
   * Lấy URL công khai
   */
  getUrl(filePath) {
    if (!this.enabled) return null;

    const normalizedPath = filePath.replace(/^\\?\//, "");
    const { data } = this.client.storage
      .from(this.bucket)
      .getPublicUrl(normalizedPath);

    return data.publicUrl;
  }
}

// ════════════════════════════════════════
// DỊCH VỤ CHÍNH (MAIN STORAGE SERVICE)
// ════════════════════════════════════════

export class StorageService {
  constructor(options = {}) {
    this.primaryEngine = options.primaryEngine || STORAGE_ENGINE.LOCAL;
    this.fallbackEnabled = options.fallbackEnabled ?? true;
    this.mirrorEnabled = options.mirrorEnabled ?? false; // Lưu vào cả 2 engine

    this.engines = {
      [STORAGE_ENGINE.LOCAL]: new LocalStorageEngine(),
      [STORAGE_ENGINE.SUPABASE]: new SupabaseStorageEngine(),
    };

    this.circuitBreaker = circuitBreakerRegistry.get("storage", {
      failureThreshold: 5,
      resetTimeoutMs: 15000,
    });
  }

  /**
   * Lưu trữ tệp tin với cơ chế dự phòng tự động
   */
  async store(filePath, buffer, options = {}) {
    return this.circuitBreaker.execute(async () => {
      const engines = this.getEngineOrder();
      const errors = [];

      for (const engineName of engines) {
        const engine = this.engines[engineName];

        try {
          const result = await engine.store(filePath, buffer, options);

          logger.info(`Lưu file thành công`, {
            path: filePath,
            engine: engineName,
            size: result.size,
          });

          // Mirror sang engine còn lại nếu bật
          if (this.mirrorEnabled && engineName === this.primaryEngine) {
            const mirrorEngine = engines.find((e) => e !== engineName);
            if (mirrorEngine) {
              this.mirrorToEngine(mirrorEngine, filePath, buffer, options).catch((err) => {
                logger.warn(`Mirror sang ${mirrorEngine} thất bại`, { error: err.message });
              });
            }
          }

          return result;
        } catch (error) {
          errors.push({ engine: engineName, error: error.message });
          logger.warn(`Lưu trữ thất bại trên ${engineName}, đang thử dự phòng`, {
            error: error.message,
            path: filePath,
          });
        }
      }

      throw new StorageError(
        `Tất cả các engine lưu trữ đều thất bại: ${JSON.stringify(errors)}`,
        "ALL",
        "ALL_ENGINES_FAILED",
      );
    });
  }

  /**
   * Truy xuất tệp tin từ bất kỳ engine khả dụng nào
   */
  async retrieve(filePath) {
    return this.circuitBreaker.execute(async () => {
      const engines = this.getEngineOrder();

      for (const engineName of engines) {
        const engine = this.engines[engineName];

        try {
          const result = await engine.retrieve(filePath);
          logger.debug(`Đã truy xuất file từ ${engineName}`, { path: filePath });

          return { ...result, engine: engineName };
        } catch (error) {
          logger.debug(`Truy xuất thất bại trên ${engineName}`, { error: error.message });
        }
      }

      throw new StorageError(
        `Không tìm thấy file trên bất kỳ engine nào: ${filePath}`,
        "ALL",
        "NOT_FOUND",
      );
    });
  }

  /**
   * Xóa tệp tin trên tất cả các engine
   */
  async delete(filePath) {
    const results = {};
    const errors = [];

    for (const [engineName, engine] of Object.entries(this.engines)) {
      try {
        results[engineName] = await engine.delete(filePath);
      } catch (error) {
        errors.push({ engine: engineName, error: error.message });
        results[engineName] = false;
      }
    }

    const successCount = Object.values(results).filter(Boolean).length;

    if (successCount === 0 && errors.length > 0) {
      throw new StorageError(
        `Xóa thất bại trên tất cả các engine: ${JSON.stringify(errors)}`,
        "ALL",
        "DELETE_FAILED",
      );
    }

    logger.info(`Đã xóa file`, { path: filePath, results });
    return results;
  }

  /**
   * Kiểm tra sự tồn tại trên bất kỳ engine nào
   */
  async exists(filePath) {
    for (const [engineName, engine] of Object.entries(this.engines)) {
      if (await engine.exists(filePath)) {
        return { exists: true, engine: engineName };
      }
    }
    return { exists: false, engine: null };
  }

  /**
   * Lấy URL từ engine chính
   */
  async getUrl(filePath) {
    const engine = this.engines[this.primaryEngine];
    return engine.getUrl(filePath);
  }

  /**
   * Đồng bộ tệp tin sang Cloud (Async)
   */
  async mirrorToEngine(engineName, filePath, buffer, options) {
    const engine = this.engines[engineName];
    if (!engine) return;

    try {
      await engine.store(filePath, buffer, { ...options, upsert: true });
      logger.debug(`Đã mirror file sang ${engineName}`, { path: filePath });
    } catch (error) {
      logger.warn(`Mirror thất bại sang ${engineName}`, { error: error.message });
      throw error;
    }
  }

  /**
   * Lấy thứ tự engine (Chính trước, dự phòng sau)
   */
  getEngineOrder() {
    const order = [this.primaryEngine];
    if (this.fallbackEnabled) {
      const fallback = Object.keys(this.engines).find((e) => e !== this.primaryEngine);
      if (fallback) order.push(fallback);
    }
    return order;
  }
}

/** Instance mặc định */
export const storageService = new StorageService();

/**
 * Tạo đường dẫn file duy nhất cho upload
 */
export const generateFilePath = (filename, type = "images", options = {}) => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 10);
  const extension = path.extname(filename).toLowerCase() || ".webp";
  const sanitizedName = path
    .basename(filename, extension)
    .replace(/[^a-zA-Z0-9]/g, "-")
    .substring(0, 30);

  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  const variant = options.variant ? `-${options.variant}` : "";

  return `${type}/${year}/${month}/${day}/${sanitizedName}-${timestamp}-${random}${variant}${extension}`;
};

export default storageService;
