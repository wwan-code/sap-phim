/**
 * @file image-queue.worker.js
 * @module Workers
 * @description Bộ xử lý trung tâm cho hàng đợi IMAGE_PROCESSING.
 */

import fs from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import sharp from "sharp";

import { registerWorker, QUEUE_NAMES } from "../../../config/queue.config.js";
import { processImage } from "../../../utils/image-processor.util.js";
import {
  storageService,
  generateFilePath,
} from "../../upload/services/storage.service.js";
import { progressService } from "../services/progress.service.js";
import { getMediaUrl, IMAGE_SPECS, mediaConfig } from "../../../config/media.config.js";
import { logger } from "../../../utils/logger.js";
import Movie from "../../../models/movie.model.js";
import movieCacheService from "../../movie/services/movie-cache.service.js";
import movieImageService from "../../movie/services/movie-image.service.js";

/**
 * Định nghĩa các loại công việc xử lý ảnh
 */
export const IMAGE_JOB_TYPES = {
  PROCESS_IMAGE: "process-image",
  UPSCALE_IMAGE: "upscale-image",
  CONVERT_FORMAT: "convert-format",
  BATCH_PROCESS: "batch-process",
  PROCESS_MOVIE_IMAGE: "process-movie-image",
  PROCESS_ALL_MOVIE_IMAGES: "process-all-movie-images",
};

sharp.cache(false);

const MOVIE_IMAGE_TYPES = ["poster", "banner", "cover", "logo"];
const DEFAULT_IMAGE_FORMAT = "webp";
const DEFAULT_IMAGE_QUALITY = 88;


const sanitizePathSegment = (value, fallback = "movie") => {
  const safe = String(value || fallback)
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return safe || fallback;
};

const normalizeRelativePath = (absolutePath) =>
  path.relative(mediaConfig.uploadsDir, absolutePath).replace(/\\/g, "/");

const toStoredFile = async (absolutePath, fallback = {}) => {
  const relativePath = normalizeRelativePath(absolutePath);
  let metadata = {};

  try {
    const fileBuffer = await fs.readFile(absolutePath);
    metadata = await sharp(fileBuffer).metadata();
  } catch (_) {
    metadata = {};
  }

  const stat = await fs.stat(absolutePath).catch(() => null);

  return {
    path: relativePath,
    url: getMediaUrl(relativePath),
    width: metadata.width || fallback.width || null,
    height: metadata.height || fallback.height || null,
    format: metadata.format || fallback.format || path.extname(absolutePath).replace(".", ""),
    bytes: stat?.size || fallback.bytes || null,
  };
};

const writeImageFile = async (outputDir, filename, buffer, writtenPaths) => {
  const absolutePath = path.join(outputDir, filename);
  await fs.writeFile(absolutePath, buffer);
  writtenPaths.push(absolutePath);
  return absolutePath;
};

const cleanupFiles = async (paths = []) => {
  await Promise.all(
    paths.map(async (filePath) => {
      try {
        await fs.unlink(filePath);
      } catch (error) {
        if (error.code !== "ENOENT") {
          logger.warn("[Worker Movie Image] Failed to cleanup output file", {
            path: filePath,
            error: error.message,
          });
        }
      }
    }),
  );
};

const getMovieOutputDir = async (movie) => {
  const date = new Date(movie?.release_date || movie?.created_at || Date.now());
  const dateFolder = `${String(date.getMonth() + 1).padStart(2, "0")}-${date.getFullYear()}`;
  const folderName = sanitizePathSegment(movie?.slug || movie?.id);
  const outputDir = path.join(mediaConfig.uploadsDir, "movies", dateFolder, folderName);
  await fs.mkdir(outputDir, { recursive: true });
  return { outputDir, dateFolder, folderName };
};

const getMovieImageSpec = (type) => {
  const spec = IMAGE_SPECS[type] || {};
  return {
    width: spec.targetWidth || spec.width || 1920,
    height: spec.targetHeight || spec.height || 1080,
    format: spec.format || DEFAULT_IMAGE_FORMAT,
    quality: spec.quality || DEFAULT_IMAGE_QUALITY,
    fit: spec.fit || "cover",
    minWidth: spec.minWidth || 1,
    minHeight: spec.minHeight || 1,
  };
};

const formatOutputBuffer = async (buffer, format, quality) => {
  const pipeline = sharp(buffer, { failOnError: false });

  switch ((format || DEFAULT_IMAGE_FORMAT).toLowerCase()) {
    case "avif":
      return pipeline.avif({ quality, effort: 4 }).toBuffer();
    case "png":
      return pipeline.png({ compressionLevel: 9, adaptiveFiltering: true }).toBuffer();
    case "jpeg":
    case "jpg":
      return pipeline.jpeg({ quality, mozjpeg: true }).toBuffer();
    case "webp":
    default:
      return pipeline.webp({ quality, effort: 4, smartSubsample: true }).toBuffer();
  }
};



const ensureLogoCanvas = async (buffer, spec) =>
  sharp(buffer, { failOnError: false })
    .resize(spec.width, spec.height, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
      withoutEnlargement: false,
    })
    .toBuffer();

const buildMovieImageRecord = async ({
  inputBuffer,
  outputDir,
  type,
  movieId,
  jobId,
  sourceFile,
  writtenPaths,
  onProgress,
}) => {
  const spec = getMovieImageSpec(type);
  const isLogo = type === "logo";
  const baseName = `${sanitizePathSegment(type)}-${Date.now()}-${randomUUID()}`;

  const primaryResult = await processImage(inputBuffer, type, {
    specs: {
      width: spec.width,
      height: spec.height,
      quality: spec.quality,
      format: spec.format,
      crop: !isLogo,
      upscale: !isLogo,
      enhance: true,
      ...(isLogo && {
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      }),
    },
    onProgress,
  });

  let primaryBuffer = primaryResult.buffer;
  if (isLogo) {
    primaryBuffer = await ensureLogoCanvas(primaryBuffer, spec);
    primaryBuffer = await formatOutputBuffer(primaryBuffer, spec.format, spec.quality);
  }

  const primaryFormat = primaryResult.metadata?.finalFormat || spec.format || DEFAULT_IMAGE_FORMAT;
  const primaryPath = await writeImageFile(
    outputDir,
    `${baseName}.${primaryFormat}`,
    primaryBuffer,
    writtenPaths,
  );
  const primary = await toStoredFile(primaryPath, {
    width: spec.width,
    height: spec.height,
    format: primaryFormat,
  });

  return {
    url: primary.url,
    path: primary.path,
    width: primary.width,
    height: primary.height,
    format: primary.format,
    bytes: primary.bytes,
    metadata: {
      type,
      movieId,
      jobId,
      processedAt: new Date().toISOString(),
      stages: primaryResult.metadata?.stages || [],
      cropStrategy: primaryResult.metadata?.cropStrategy || null,
      upscaleMethod: primaryResult.metadata?.upscaleMethod || null,
      source: sourceFile
        ? {
          originalname: sourceFile.originalname,
          mimetype: sourceFile.mimetype,
          size: sourceFile.size,
        }
        : null,
      performance: primaryResult.performance || null,
    },
  };
};

/**
 * Chuyển đổi dữ liệu đầu vào thành Buffer
 *
 * @description Hỗ trợ đường dẫn tệp (String), chuỗi Base64 hoặc đối tượng Buffer đã bị serialize bởi BullMQ.
 * @param {string|Object|Buffer} input - Dữ liệu hình ảnh đầu vào
 * @returns {Promise<Buffer>} Dữ liệu dạng Buffer
 */
async function resolveBuffer(input) {
  if (typeof input === "string") {
    if (existsSync(input)) {
      return fs.readFile(input);
    }
    return Buffer.from(input, "base64");
  }

  if (
    input &&
    typeof input === "object" &&
    input.type === "Buffer" &&
    Array.isArray(input.data)
  ) {
    return Buffer.from(input.data);
  }

  return Buffer.from(input);
}

/**
 * Phát tín hiệu tiến độ xử lý thông qua Socket.io
 *
 * @param {string} jobId - ID của công việc
 * @param {string} stage - Giai đoạn xử lý (ANALYZING, PREPROCESSING, UPSCALING, v.v.)
 * @param {number} percent - Phần trăm hoàn thành
 * @param {Object} details - Thông tin chi tiết bổ sung
 */
function emitJobProgress(jobId, stage, percent, details = {}) {
  try {
    const normalizedDetails = {
      ...details,
      ...(details.outputs
        ? { outputs: details.outputs }
        : details.results
          ? { outputs: { images: details.results } }
          : details.finalImages
            ? { outputs: { images: details.finalImages } }
            : {}),
    };

    if (stage === "COMPLETED") {
      progressService.emitProcessingComplete(jobId, { ...normalizedDetails });
    } else if (stage === "FAILED") {
      progressService.emitProcessingStage(jobId, "FAILED", {
        percent,
        status: "failed",
        ...normalizedDetails,
      });
    } else {
      progressService.emitProcessingStage(jobId, stage, {
        percent,
        ...normalizedDetails,
      });
    }
  } catch (_) {
    // Không chặn luồng xử lý chính nếu việc phát socket gặp lỗi
  }
}

/**
 * Xử lý một hình ảnh đơn lẻ (Xác thực, Nâng cấp AI, Lưu trữ)
 *
 * @param {Object} job - Đối tượng công việc BullMQ
 */
async function handleProcessImage(job) {
  const {
    imageBuffer,
    metadata = {},
    targetSpecs = {},
    jobId = job.id,
  } = job.data;

  logger.info(`[Worker Ảnh] Đang xử lý công việc: ${job.id}`, { jobId });
  await job.updateProgress(10);
  emitJobProgress(jobId, "ANALYZING", 10);

  const inputBuffer = await resolveBuffer(imageBuffer);
  await job.updateProgress(20);

  const imageType = metadata.imageType || targetSpecs.type || "generic";
  const pipelineOptions = targetSpecs
    ? {
      specs: {
        ...targetSpecs,
        crop: targetSpecs.crop ?? true,
        upscale: targetSpecs.upscale ?? true,
      },
    }
    : {};

  emitJobProgress(jobId, "PREPROCESSING", 20);

  const result = await processImage(inputBuffer, imageType, pipelineOptions);
  await job.updateProgress(80);
  emitJobProgress(jobId, "STORING", 85);

  const filename = metadata.filename || `processed_${job.id}.webp`;
  const filePath = generateFilePath(filename, metadata.folder || "images");
  const storeResult = await storageService.store(filePath, result.buffer);

  await job.updateProgress(100);
  emitJobProgress(jobId, "COMPLETED", 100, { url: storeResult.url });

  logger.info(`[Worker Ảnh] Đã hoàn tất và lưu trữ tại: ${storeResult.url}`);

  return {
    success: true,
    url: storeResult.url,
    path: storeResult.path,
    engine: storeResult.engine,
    metadata: result.metadata,
    performance: result.performance,
  };
}

/**
 * Xử lý hàng loạt hình ảnh
 */
async function handleBatchProcess(job) {
  const { images = [], options = {}, jobId = job.id } = job.data;
  const total = images.length;

  logger.info(
    `[Worker Ảnh] Xử lý hàng loạt: ${total} hình ảnh (Job ${job.id})`,
  );

  const results = [];

  for (let i = 0; i < images.length; i++) {
    const {
      imageBuffer,
      imageType = "generic",
      targetSpecs = {},
      filename,
    } = images[i];

    try {
      const inputBuffer = await resolveBuffer(imageBuffer);
      const pipelineOptions = targetSpecs
        ? {
          specs: {
            ...targetSpecs,
            crop: targetSpecs.crop ?? true,
            upscale: targetSpecs.upscale ?? true,
          },
        }
        : {};

      const result = await processImage(
        inputBuffer,
        imageType,
        pipelineOptions,
      );

      const outFilename = filename || `batch_${job.id}_${i}.webp`;
      const filePath = generateFilePath(
        outFilename,
        options.folder || "images",
      );
      const storeResult = await storageService.store(filePath, result.buffer);

      results.push({
        success: true,
        index: i,
        url: storeResult.url,
        path: storeResult.path,
        metadata: result.metadata,
      });
    } catch (err) {
      logger.error(
        `[Worker Ảnh] Ảnh thứ ${i} trong batch thất bại:`,
        err.message,
      );
      results.push({ success: false, index: i, error: err.message });
    }

    const progress = Math.round(((i + 1) / total) * 100);
    await job.updateProgress(progress);
    emitJobProgress(jobId, "PREPROCESSING", progress);
  }

  return {
    success: true,
    results,
    summary: {
      total,
      successful: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
    },
  };
}


/**
 * Bộ điều phối công việc xử lý ảnh (Main Dispatcher)
 */
const getQueuedMovieFileCount = (files = {}) =>
  MOVIE_IMAGE_TYPES.filter((type) => Boolean(files?.[type]?.[0])).length;

async function processMovieImageUpload({
  job,
  movie,
  type,
  file,
  jobId,
  currentIndex,
  totalFiles,
}) {
  const tempPath = file?.path;
  const typeWrittenPaths = [];
  const startPercent = 30 + Math.round(((currentIndex - 1) / totalFiles) * 60);
  const endPercent = 30 + Math.round((currentIndex / totalFiles) * 60);

  if (!existsSync(tempPath)) {
    throw new Error("Temporary upload file is missing");
  }

  emitJobProgress(jobId, "IMAGE_START", startPercent, {
    message: `Starting ${type} processing...`,
    currentImage: currentIndex,
    totalImages: totalFiles,
    imageType: type,
  });

  const inputBuffer = await fs.readFile(tempPath);
  const { outputDir } = await getMovieOutputDir(movie);

  let record;
  try {
    record = await buildMovieImageRecord({
      inputBuffer,
      outputDir,
      type,
      movieId: movie.id,
      jobId,
      sourceFile: file,
      writtenPaths: typeWrittenPaths,
      onProgress: (percent) => {
        const range = Math.max(1, endPercent - startPercent);
        const scaledPercent = Math.round(startPercent + (percent / 100) * (range * 0.85));
        emitJobProgress(jobId, "UPSCALING", scaledPercent, {
          message: `AI processing ${type} (${Math.round(percent)}%)...`,
          currentImage: currentIndex,
          totalImages: totalFiles,
          imageType: type,
        });
      },
    });
  } catch (error) {
    await cleanupFiles(typeWrittenPaths);
    throw error;
  }

  await job.updateProgress(endPercent);
  emitJobProgress(jobId, "IMAGE_DONE", endPercent, {
    message: `Finished ${type}`,
    currentImage: currentIndex,
    totalImages: totalFiles,
    imageType: type,
  });

  return { record, writtenPaths: typeWrittenPaths };
}

async function handleProcessMovieImageV2(job) {
  const { tempPath, type, movieId, jobId = job.id } = job.data;

  if (!MOVIE_IMAGE_TYPES.includes(type)) {
    throw new Error(`Unsupported movie image type: ${type}`);
  }

  const movie = await Movie.findByPk(movieId);
  if (!movie) {
    throw new Error(`Movie not found: ${movieId}`);
  }

  await job.updateProgress(5);
  emitJobProgress(jobId, "ANALYZING", 5, { movieId, imageType: type });

  const previousImages = { ...(movie.images || {}) };
  const oldImagePaths = movieImageService.extractImagePaths({ [type]: previousImages[type] });

  let processed;
  try {
    processed = await processMovieImageUpload({
      job,
      movie,
      type,
      file: { path: tempPath },
      jobId,
      currentIndex: 1,
      totalFiles: 1,
    });

    emitJobProgress(jobId, "STORING", 95, {
      message: "Saving movie image metadata...",
      movieId,
      imageType: type,
    });

    const freshMovie = await Movie.findByPk(movieId);
    if (!freshMovie) {
      throw new Error(`Movie not found while saving image metadata: ${movieId}`);
    }

    const nextImages = { ...(freshMovie.images || {}) };
    nextImages[type] = processed.record;
    freshMovie.images = nextImages;
    freshMovie.changed("images", true);
    await freshMovie.save();

    await Promise.all([
      movieCacheService.invalidateMovie(movieId, freshMovie.slug),
      movieImageService.deleteImages(oldImagePaths),
    ]);

    await job.updateProgress(100);
    emitJobProgress(jobId, "COMPLETED", 100, {
      message: "Movie image processing completed",
      movieId,
      slug: freshMovie.slug,
      outputs: { images: { [type]: processed.record } },
    });

    return { success: true, type, files: processed.record, movieId };
  } catch (error) {
    await cleanupFiles(processed?.writtenPaths || []);
    throw error;
  } finally {
    if (tempPath) await fs.unlink(tempPath).catch(() => { });
  }
}

async function handleProcessAllMovieImagesV2(job) {
  const { movieId, files = {}, jobId = job.id } = job.data;

  logger.info("[Worker Movie Image] Processing movie image batch", {
    movieId,
    queueJobId: job.id,
    jobId,
  });

  const movie = await Movie.findByPk(movieId);
  if (!movie) {
    throw new Error(`Movie not found: ${movieId}`);
  }

  const totalFiles = getQueuedMovieFileCount(files);
  if (totalFiles === 0) {
    await job.updateProgress(100);
    emitJobProgress(jobId, "COMPLETED", 100, {
      message: "No movie images to process",
      movieId,
      slug: movie.slug,
      outputs: { images: movie.images || {} },
    });
    return { success: true, finalImages: movie.images || {}, skipped: true };
  }

  await job.updateProgress(10);
  emitJobProgress(jobId, "ANALYZING", 10, {
    message: "Preparing movie image batch...",
    movieId,
    totalImages: totalFiles,
  });

  const previousImages = { ...(movie.images || {}) };
  const finalImages = { ...previousImages };
  const processedTypes = [];
  const failures = [];
  const writtenPaths = [];
  let completed = 0;
  let currentIndex = 0;

  for (const type of MOVIE_IMAGE_TYPES) {
    const file = files?.[type]?.[0];
    if (!file) continue;

    currentIndex += 1;

    try {
      const result = await processMovieImageUpload({
        job,
        movie,
        type,
        file,
        jobId,
        currentIndex,
        totalFiles,
      });

      finalImages[type] = result.record;
      writtenPaths.push(...result.writtenPaths);
      processedTypes.push(type);
      completed += 1;
    } catch (error) {
      failures.push({ type, error: error.message });
      logger.error("[Worker Movie Image] Failed to process movie image", {
        movieId,
        type,
        error: error.message,
      });
    } finally {
      if (file?.path) await fs.unlink(file.path).catch(() => { });
    }
  }

  if (completed === 0) {
    const errorMessage = failures.length > 0
      ? failures.map((item) => `${item.type}: ${item.error}`).join("; ")
      : "No images were processed";

    await cleanupFiles(writtenPaths);
    emitJobProgress(jobId, "FAILED", 100, {
      message: errorMessage,
      failures,
      movieId,
      totalImages: totalFiles,
    });
    throw new Error(errorMessage);
  }

  emitJobProgress(jobId, "STORING", 95, {
    message: "Saving movie image metadata...",
    movieId,
    currentImage: completed,
    totalImages: totalFiles,
    imageType: "database",
  });

  try {
    const freshMovie = await Movie.findByPk(movieId);
    if (!freshMovie) {
      throw new Error(`Movie not found while saving image metadata: ${movieId}`);
    }

    const latestImages = { ...(freshMovie.images || {}) };
    for (const type of processedTypes) {
      latestImages[type] = finalImages[type];
    }

    freshMovie.images = latestImages;
    freshMovie.changed("images", true);
    await freshMovie.save();
    await movieCacheService.invalidateMovie(movieId, freshMovie.slug);

    const oldImagePaths = processedTypes.flatMap((type) =>
      movieImageService.extractImagePaths({ [type]: previousImages[type] }),
    );
    await movieImageService.deleteImages(oldImagePaths);

    const outputs = { images: latestImages };

    if (failures.length > 0) {
      await job.updateProgress(100);
      emitJobProgress(jobId, "PARTIAL_FAILURE", 100, {
        status: "partial_failure",
        message: "Some movie images failed to process",
        failures,
        outputs,
        movieId,
        slug: freshMovie.slug,
      });
      return {
        success: false,
        partial: true,
        finalImages: latestImages,
        failures,
        processedTypes,
      };
    }

    await job.updateProgress(100);
    emitJobProgress(jobId, "COMPLETED", 100, {
      message: "Movie image processing completed",
      outputs,
      movieId,
      slug: freshMovie.slug,
      imageCount: completed,
    });

    return { success: true, finalImages: latestImages, processedTypes };
  } catch (error) {
    await cleanupFiles(writtenPaths);
    throw error;
  }
}

async function imageJobProcessor(job) {
  const startTime = Date.now();

  try {
    let result;

    switch (job.name) {
      case IMAGE_JOB_TYPES.PROCESS_IMAGE:
      case IMAGE_JOB_TYPES.UPSCALE_IMAGE:
      case IMAGE_JOB_TYPES.CONVERT_FORMAT:
        result = await handleProcessImage(job);
        break;

      case IMAGE_JOB_TYPES.BATCH_PROCESS:
        result = await handleBatchProcess(job);
        break;

      case IMAGE_JOB_TYPES.PROCESS_MOVIE_IMAGE:
      case "process-movie-image":
        result = await handleProcessMovieImageV2(job);
        break;

      case IMAGE_JOB_TYPES.PROCESS_ALL_MOVIE_IMAGES:
        result = await handleProcessAllMovieImagesV2(job);
        break;

      default:
        throw new Error(
          `[Worker Ảnh] Loại công việc không xác định: ${job.name}`,
        );
    }

    logger.info(
      `[Worker Ảnh] Công việc ${job.id} (${job.name}) hoàn tất trong ${Date.now() - startTime}ms`,
    );
    return result;
  } catch (error) {
    const failedJobId = job.data?.jobId || job.id;
    emitJobProgress(failedJobId, "FAILED", 100, {
      message: error.message,
      queueJobId: job.id,
    });
    logger.error(
      `[Worker Ảnh] Công việc ${job.id} (${job.name}) thất bại sau ${Date.now() - startTime}ms:`,
      error.message,
    );
    throw error;
  }
}

/**
 * Khởi tạo Worker xử lý ảnh thống nhất
 *
 * @param {Object} options - Cấu hình tùy chọn
 * @param {number} options.concurrency - Số lượng công việc xử lý đồng thời (mặc định: 2)
 * @param {number} options.maxPerSecond - Giới hạn tần suất xử lý (mặc định: 5/giây)
 */
export function initImageQueueWorker(options = {}) {
  const worker = registerWorker(
    QUEUE_NAMES.IMAGE_PROCESSING,
    imageJobProcessor,
    {
      concurrency: options.concurrency || 2,
      limiter: {
        max: options.maxPerSecond || 5,
        duration: 1000,
      },
    },
  );

  return worker;
}

export default {
  IMAGE_JOB_TYPES,
  initImageQueueWorker,
  imageJobProcessor,
};
