/**
 * @file esrgan.util.js
 * @module Utils
 * @description Tích hợp mô hình ESRGAN với ONNX Runtime để nâng cấp độ phân giải hình ảnh.
 */

import sharp from "sharp";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { logger } from "./logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ════════════════════════════════════════
// CẤU HÌNH HỆ THỐNG AI (AI CONFIG)
// ════════════════════════════════════════

/**
 * Cấu hình tham số cho ESRGAN.
 */
const ESRGAN_CONFIG = {
  models: {
    x2: "realesrgan-x2.onnx", // Tốc độ nhanh, phù hợp tỷ lệ nâng cấp thấp.
    x4: "realesrgan-x4.onnx", // Chất lượng cao nhất, tốn tài nguyên hơn.
    anime: "realesrgan-anime.onnx", // Chuyên biệt cho Anime (Yêu cầu đầu vào 512x512).
  },

  defaultModel: "x2",

  modelSelectionThresholds: {
    x2Max: 2.2, // Sử dụng x2 cho tỷ lệ nâng cấp <= 2.2x.
    x4Min: 2.2, // Sử dụng x4 cho tỷ lệ > 2.2x.
  },

  modelDir: path.join(__dirname, "../../onnx-models"),

  tileSize: 64, // Kích thước mảnh mặc định (Pixel).

  // Kích thước mảnh đặc thù theo từng mô hình.
  tileSizeByModel: {
    x2: 64,
    x4: 64,
    anime: 512,
  },

  tileOverlap: 16, // Độ chồng lấp để xóa mờ đường kẻ giữa các mảnh.
  maxDirectSize: 512, // Kích thước tối đa để xử lý trực tiếp không cần chia mảnh.
  logProgress: true,
  progressInterval: 25, 
  tileBatchSize: 2, // Số lượng mảnh xử lý song song để tránh tràn RAM.
  enableFallback: true, // Tự động chuyển sang Sharp nếu AI lỗi.
};

let ort = null;
let ortLoaded = false;
let ortLoadError = null;
const modelSessions = new Map();

// ════════════════════════════════════════
// KHỞI TẠO & QUẢN LÝ MÔ HÌNH (MODEL MGMT)
// ════════════════════════════════════════

/**
 * Tải trì hoãn (Lazy load) ONNX Runtime.
 * @private
 */
async function loadONNXRuntime() {
  if (ortLoaded) {
    if (ortLoadError) throw ortLoadError;
    return ort;
  }

  try {
    logger.info("[Esrgan] Đang tải thư viện ONNX Runtime...");
    ort = await import("onnxruntime-node");
    ortLoaded = true;
    logger.info("[Esrgan] Thư viện ONNX Runtime đã sẵn sàng.");
    return ort;
  } catch (error) {
    ortLoadError = error;
    ortLoaded = true;
    logger.error(`[Esrgan] Không thể tải ONNX Runtime: ${error.message}`);
    throw error;
  }
}

/**
 * Kiểm tra xem hệ thống AI có sẵn sàng hoạt động không.
 * @returns {Promise<boolean>}
 */
async function isESRGANAvailable() {
  try {
    await loadONNXRuntime();
    return true;
  } catch {
    return false;
  }
}

/**
 * Kiểm tra sự tồn tại của tệp mô hình AI trong hệ thống.
 * @private
 */
function modelExists(modelName) {
  const modelPath = path.join(
    ESRGAN_CONFIG.modelDir,
    ESRGAN_CONFIG.models[modelName],
  );
  return fs.existsSync(modelPath);
}

/**
 * Lựa chọn mô hình tối ưu dựa trên nội dung và yêu cầu.
 *
 * @private
 * @param {number} targetScale - Tỷ lệ nâng cấp mong muốn.
 * @param {string} [imageType] - Loại ảnh (anime, photo...).
 * @param {number} [animeConfidence] - Độ tin cậy nhận diện Anime.
 */
function selectOptimalModel(
  targetScale,
  imageType = "photo",
  animeConfidence = 0,
) {
  const { x2Max } = ESRGAN_CONFIG.modelSelectionThresholds;

  // Chiến lược ưu tiên cho hệ thống "RẠP ANIME"
  const isAnimeContent =
    imageType === "anime" ||
    imageType === "manga" ||
    imageType === "illustration";
  const isLikelyAnime = animeConfidence > 0.4;
  const isWorthUsingAnime = targetScale >= 2.0;

  if (
    (isAnimeContent || isLikelyAnime) &&
    isWorthUsingAnime &&
    modelExists("anime")
  ) {
    logger.info(`[Esrgan] Chọn mô hình ANIME (Tỷ lệ: ${targetScale.toFixed(2)}x)`);
    return "anime";
  }

  if (targetScale <= x2Max) {
    return "x2";
  }

  return "x4";
}

/**
 * Khởi tạo hoặc lấy lại Session của mô hình (Cơ chế Cache).
 * @private
 */
async function getModelSession(modelName) {
  if (modelSessions.has(modelName)) {
    return modelSessions.get(modelName);
  }

  const ort = await loadONNXRuntime();
  const modelPath = path.join(
    ESRGAN_CONFIG.modelDir,
    ESRGAN_CONFIG.models[modelName],
  );

  if (!fs.existsSync(modelPath)) {
    throw new Error(`Không tìm thấy mô hình: ${modelPath}`);
  }

  logger.info(`[Esrgan] Đang nạp mô hình: ${modelName}`);

  const session = await ort.InferenceSession.create(modelPath, {
    executionProviders: ["cpu"], // Sử dụng CPU để đảm bảo ổn định đa nền tảng
    graphOptimizationLevel: "all",
  });

  modelSessions.set(modelName, session);
  return session;
}

// ════════════════════════════════════════
// CHUYỂN ĐỔI DỮ LIỆU (DATA CONVERSION)
// ════════════════════════════════════════

/**
 * Chuyển đổi Buffer ảnh sang Tensor (Đầu vào AI).
 * @private
 */
async function imageToTensor(buffer, ort, useFloat16 = false) {
  const { data, info } = await sharp(buffer)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  const float32Data = new Float32Array(channels * height * width);

  for (let c = 0; c < channels; c++) {
    for (let h = 0; h < height; h++) {
      for (let w = 0; w < width; w++) {
        const srcIdx = (h * width + w) * channels + c;
        const dstIdx = c * height * width + h * width + w;
        float32Data[dstIdx] = data[srcIdx] / 255.0;
      }
    }
  }

  if (useFloat16) {
    const float16Data = new Uint16Array(float32Data.length);
    for (let i = 0; i < float32Data.length; i++) {
      float16Data[i] = float32ToFloat16(float32Data[i]);
    }
    return new ort.Tensor("float16", float16Data, [1, channels, height, width]);
  }

  return new ort.Tensor("float32", float32Data, [1, channels, height, width]);
}

/**
 * Chuyển đổi Float32 sang Float16 (Half-precision).
 * @private
 */
function float32ToFloat16(value) {
  const floatView = new Float32Array(1);
  const int32View = new Int32Array(floatView.buffer);
  floatView[0] = value;
  const f = int32View[0];

  const sign = (f >> 16) & 0x8000;
  const exponent = ((f >> 23) & 0xff) - 127 + 15;
  const mantissa = f & 0x007fffff;

  if (exponent <= 0) return sign;
  if (exponent >= 31) return sign | 0x7c00;

  return sign | (exponent << 10) | (mantissa >> 13);
}

/**
 * Chuyển đổi Float16 sang Float32.
 * @private
 */
function float16ToFloat32(h) {
  const s = (h & 0x8000) >> 15;
  const e = (h & 0x7c00) >> 10;
  const f = h & 0x03ff;

  if (e == 0) return (s ? -1 : 1) * Math.pow(2, -14) * (f / 1024);
  if (e == 0x1f) return f ? NaN : (s ? -1 : 1) * Infinity;

  return (s ? -1 : 1) * Math.pow(2, e - 15) * (1 + f / 1024);
}

/**
 * Chuyển đổi Tensor (Đầu ra AI) ngược lại Buffer ảnh.
 * @private
 */
async function tensorToImage(tensor, width, height) {
  const data = tensor.data;
  const channels = 3;
  const isFloat16 = tensor.type === "float16";
  const uint8Data = new Uint8Array(channels * height * width);

  for (let c = 0; c < channels; c++) {
    for (let h = 0; h < height; h++) {
      for (let w = 0; w < width; w++) {
        const srcIdx = c * height * width + h * width + w;
        const dstIdx = (h * width + w) * channels + c;

        let value = isFloat16 ? float16ToFloat32(data[srcIdx]) : data[srcIdx];
        value = Math.max(0, Math.min(1, value)) * 255;
        uint8Data[dstIdx] = Math.round(value);
      }
    }
  }

  return sharp(Buffer.from(uint8Data), {
    raw: { width, height, channels },
  })
    .png()
    .toBuffer();
}

// ════════════════════════════════════════
// XỬ LÝ SUY LUẬN AI (INFERENCE)
// ════════════════════════════════════════

/**
 * Xử lý AI cho một mảnh ảnh (Tile).
 * @private
 */
async function processTile(tileBuffer, session, scale, ort, modelName = "x2") {
  try {
    const useFloat16 = modelName === "anime";
    const inputTensor = await imageToTensor(tileBuffer, ort, useFloat16);
    const inputName = session.inputNames[0];
    const feeds = { [inputName]: inputTensor };

    const results = await session.run(feeds);
    const outputName = session.outputNames[0];
    const outputTensor = results[outputName];

    if (!outputTensor) throw new Error(`Không tìm thấy tensor đầu ra: ${outputName}`);

    const [, , outHeight, outWidth] = outputTensor.dims;
    return tensorToImage(outputTensor, outWidth, outHeight);
  } catch (error) {
    logger.error(`[Esrgan] Lỗi xử lý mảnh ảnh: ${error.message}`);
    throw error;
  }
}

/**
 * Nâng cấp độ phân giải hình ảnh bằng ESRGAN AI.
 *
 * @param {Buffer} buffer - Buffer ảnh gốc.
 * @param {Object} [options] - Các tùy chọn (targetWidth, targetHeight, model...).
 * @returns {Promise<Object>} Buffer ảnh kết quả và metadata.
 */
async function esrganUpscale(buffer, options = {}) {
  const startTime = Date.now();
  const {
    useTiling = true,
    imageType = "photo",
    animeConfidence = 0,
  } = options;

  try {
    const ort = await loadONNXRuntime();
    const metadata = await sharp(buffer).metadata();
    const { width, height } = metadata;

    let model, scale;
    if (options.model) {
      model = options.model;
      scale = model === "x4" || model === "anime" ? 4 : 2;
    } else if (options.targetWidth && options.targetHeight) {
      const targetScale = Math.max(options.targetWidth / width, options.targetHeight / height);
      model = selectOptimalModel(targetScale, imageType, animeConfidence);
      scale = model === "x4" || model === "anime" ? 4 : 2;
    } else {
      scale = options.scale || 2;
      model = scale > 2.5 ? "x4" : ESRGAN_CONFIG.defaultModel;
    }

    if (!modelExists(model)) {
      return fallbackUpscale(buffer, scale, "Tệp mô hình không tồn tại");
    }

    const session = await getModelSession(model);
    logger.info(`[Esrgan] Đang xử lý ${width}x${height} → Mô hình: ${model} (${scale}x)`);

    const modelTileSize = ESRGAN_CONFIG.tileSizeByModel[model] || ESRGAN_CONFIG.tileSize;
    const exactMatch = width === modelTileSize && height === modelTileSize;

    // Kích hoạt Tiling nếu ảnh lớn hơn giới hạn hoặc sai kích thước đầu vào mô hình
    const needsTiling = useTiling && (width > ESRGAN_CONFIG.maxDirectSize || height > ESRGAN_CONFIG.maxDirectSize || !exactMatch);

    let outputBuffer;
    if (needsTiling) {
      outputBuffer = await processWithTiling(buffer, session, scale, ort, width, height, model, options);
    } else {
      outputBuffer = await processTile(buffer, session, scale, ort, model);
      if (typeof options?.onProgress === "function") options.onProgress(100);
    }

    const duration = Date.now() - startTime;
    const outputMeta = await sharp(outputBuffer).metadata();

    logger.info(`[Esrgan] Hoàn tất trong ${duration}ms: ${width}x${height} → ${outputMeta.width}x${outputMeta.height}`);

    return {
      buffer: outputBuffer,
      metadata: {
        model, scale,
        originalWidth: width, originalHeight: height,
        outputWidth: outputMeta.width, outputHeight: outputMeta.height,
        duration, usedTiling: needsTiling,
        method: "esrgan",
      },
    };
  } catch (error) {
    logger.error(`[Esrgan] Nâng cấp AI thất bại: ${error.message}`);
    if (ESRGAN_CONFIG.enableFallback) {
      return fallbackUpscale(buffer, options.scale || 2, error.message);
    }
    throw error;
  }
}

/**
 * Xử lý hình ảnh bằng kỹ thuật chia mảnh (Tiling) để tối ưu bộ nhớ.
 * @private
 */
async function processWithTiling(buffer, session, scale, ort, width, height, modelName, options) {
  const tileSize = ESRGAN_CONFIG.tileSizeByModel[modelName] || ESRGAN_CONFIG.tileSize;
  const overlap = ESRGAN_CONFIG.tileOverlap;
  const step = tileSize - overlap;
  const batchSize = ESRGAN_CONFIG.tileBatchSize;

  const tilesX = Math.ceil((width - overlap) / step);
  const tilesY = Math.ceil((height - overlap) / step);
  const totalTiles = tilesX * tilesY;

  const outWidth = width * scale;
  const outHeight = height * scale;

  let outputBuffer = await sharp({
    create: { width: outWidth, height: outHeight, channels: 3, background: { r: 0, g: 0, b: 0 } },
  })
    .png()
    .toBuffer();

  const tiles = [];
  for (let ty = 0; ty < tilesY; ty++) {
    for (let tx = 0; tx < tilesX; tx++) {
      const extractX = Math.max(0, Math.min(tx * step, Math.max(0, width - tileSize)));
      const extractY = Math.max(0, Math.min(ty * step, Math.max(0, height - tileSize)));
      const extractWidth = Math.min(tileSize, width - extractX);
      const extractHeight = Math.min(tileSize, height - extractY);

      tiles.push({ tx, ty, extractX, extractY, extractWidth, extractHeight, outX: extractX * scale, outY: extractY * scale });
    }
  }

  const processSingleTile = async (tile) => {
    const { extractX, extractY, extractWidth, extractHeight, outX, outY } = tile;
    let tileBuffer = await sharp(buffer)
      .extract({ left: extractX, top: extractY, width: extractWidth, height: extractHeight })
      .toBuffer();

    if (extractWidth < tileSize || extractHeight < tileSize) {
      tileBuffer = await sharp(tileBuffer)
        .extend({ top: 0, bottom: tileSize - extractHeight, left: 0, right: tileSize - extractWidth, background: { r: 0, g: 0, b: 0 } })
        .toBuffer();
    }

    const processedTile = await processTile(tileBuffer, session, scale, ort, modelName);
    let finalTile = processedTile;
    if (extractWidth < tileSize || extractHeight < tileSize) {
      finalTile = await sharp(processedTile)
        .extract({ left: 0, top: 0, width: extractWidth * scale, height: extractHeight * scale })
        .toBuffer();
    }

    return { input: finalTile, left: outX, top: outY };
  };

  const composites = [];
  let processedCount = 0;

  for (let i = 0; i < tiles.length; i += batchSize) {
    const batch = tiles.slice(i, i + batchSize);
    const results = await Promise.all(batch.map(processSingleTile));
    composites.push(...results);

    processedCount += batch.length;
    const progress = (processedCount / totalTiles) * 100;
    if (typeof options?.onProgress === "function") options.onProgress(progress);

    if (ESRGAN_CONFIG.logProgress && totalTiles > 4) {
      const threshold = ESRGAN_CONFIG.progressInterval;
      if (Math.floor(progress / threshold) > Math.floor(((processedCount - batch.length) / totalTiles * 100) / threshold)) {
        logger.info(`[Esrgan] Tiến độ xử lý AI: ${Math.round(progress)}% (${processedCount}/${totalTiles} mảnh)`);
      }
    }
  }

  return await sharp(outputBuffer).composite(composites).toBuffer();
}

/**
 * Cơ chế dự phòng: Nâng cấp bằng Sharp (Lanczos3) khi AI không khả dụng.
 * @private
 */
async function fallbackUpscale(buffer, scale, reason) {
  const metadata = await sharp(buffer).metadata();
  const targetWidth = Math.round(metadata.width * scale);
  const targetHeight = Math.round(metadata.height * scale);

  logger.info(`[Esrgan] Kích hoạt chế độ dự phòng: Nâng cấp lên ${targetWidth}x${targetHeight} (${reason})`);

  const outputBuffer = await sharp(buffer)
    .resize(targetWidth, targetHeight, { kernel: "lanczos3", fit: "fill" })
    .sharpen({ sigma: 0.8, m1: 0.8, m2: 0.4 })
    .toBuffer();

  return {
    buffer: outputBuffer,
    metadata: {
      model: "fallback-sharp", scale,
      originalWidth: metadata.width, originalHeight: metadata.height,
      outputWidth: targetWidth, outputHeight: targetHeight,
      method: "sharp-fallback", fallbackReason: reason,
    },
  };
}

/**
 * Giải phóng tài nguyên các Session mô hình AI.
 */
async function cleanupESRGAN() {
  for (const session of modelSessions.values()) {
    try { await session.release(); } catch (e) {}
  }
  modelSessions.clear();
}

/**
 * Lấy danh sách các mô hình hiện có trong hệ thống.
 */
function getAvailableModels() {
  return Object.entries(ESRGAN_CONFIG.models)
    .filter(([, file]) => fs.existsSync(path.join(ESRGAN_CONFIG.modelDir, file)))
    .map(([name, file]) => ({ name, file, path: path.join(ESRGAN_CONFIG.modelDir, file) }));
}

export {
  esrganUpscale,
  esrganUpscale as upscaleWithFallback,
  isESRGANAvailable,
  getAvailableModels,
  cleanupESRGAN,
  ESRGAN_CONFIG,
};

export default {
  esrganUpscale,
  upscaleWithFallback: esrganUpscale,
  isESRGANAvailable,
  getAvailableModels,
  cleanupESRGAN,
  ESRGAN_CONFIG,
};

