/**
 * @file enhance.util.js
 * @module Utils
 * @description Sử dụng kỹ thuật tách tần số để tăng cường độ sắc nét hình ảnh mà vẫn giữ chất lượng tự nhiên.
 */

import sharp from "sharp";
import { logger } from "./logger.js";

// ════════════════════════════════════════
// CẤU HÌNH & HẰNG SỐ (CONFIG)
// ════════════════════════════════════════

/**
 * Cấu hình mặc định cho quy trình tăng cường hình ảnh.
 */
export const DEFAULT_OPTIONS = {
  blurRadius: 5,     // Bán kính làm mờ để tách tần số.
  highFreqGain: 1.1, // Hệ số tăng cường chi tiết.
  lowFreqDenoise: 0, // Mức độ khử nhiễu tần số thấp (mặc định tắt).
  format: "raw",
  blendMode: "linear",
};

// ════════════════════════════════════════
// PHÂN TÁCH & XỬ LÝ TẦN SỐ (CORE LOGIC)
// ════════════════════════════════════════

/**
 * Phân tách hình ảnh thành hai lớp tần số thấp và cao.
 *
 * @param {Buffer} imageBuffer - Buffer ảnh gốc.
 * @param {Object} [options] - Các tùy chọn cấu hình.
 * @returns {Promise<Object>} Đối tượng chứa dữ liệu hai lớp và metadata.
 */
export async function separateFrequencies(imageBuffer, options = {}) {
  const config = { ...DEFAULT_OPTIONS, ...options };

  try {
    const metadata = await sharp(imageBuffer).metadata();
    const { width, height, channels } = metadata;

    // Lớp tần số thấp (Low Frequency): Chứa màu sắc và các mảng khối.
    const lowFreqBuffer = await sharp(imageBuffer)
      .blur(config.blurRadius)
      .raw()
      .toBuffer({ resolveWithObject: true });

    const originalRaw = await sharp(imageBuffer).raw().toBuffer();

    // Lớp tần số cao (High Frequency): Chứa chi tiết và đường nét.
    const highFreqBuffer = calculateHighFrequency(
      originalRaw,
      lowFreqBuffer.data,
      config.highFreqGain,
      channels,
    );

    return {
      lowFreq: lowFreqBuffer.data,
      highFreq: highFreqBuffer,
      original: originalRaw,
      metadata: { width, height, channels },
      options: config,
    };
  } catch (error) {
    logger.error(`[Enhance] Phân tách tần số thất bại: ${error.message}`);
    throw error;
  }
}

/**
 * Tính toán dữ liệu tần số cao bằng phép trừ ảnh gốc cho ảnh làm mờ.
 * @private
 */
function calculateHighFrequency(original, lowFreq, gain, channels) {
  const size = original.length;
  const highFreq = Buffer.alloc(size);

  for (let i = 0; i < size; i += channels) {
    for (let c = 0; c < channels; c++) {
      const diff = (original[i + c] - lowFreq[i + c]) * gain;
      // Trung tâm hóa ở mức xám 128 (Neutral Gray)
      highFreq[i + c] = Math.max(0, Math.min(255, 128 + diff));
    }
  }

  return highFreq;
}

/**
 * Xử lý lớp tần số thấp (Màu sắc và khối hình).
 *
 * @param {Buffer} lowFreqBuffer - Dữ liệu tần số thấp thô.
 * @param {Object} metadata - Metadata của ảnh.
 * @param {Object} [options] - Tùy chọn xử lý.
 */
export async function processLowFrequency(
  lowFreqBuffer,
  metadata,
  options = {},
) {
  const config = { ...DEFAULT_OPTIONS, ...options };

  try {
    const { width, height, channels } = metadata;

    if (config.lowFreqDenoise > 0) {
      const denoised = Buffer.alloc(lowFreqBuffer.length);
      for (let i = 0; i < lowFreqBuffer.length; i += channels) {
        for (let c = 0; c < channels; c++) {
          denoised[i + c] = applyChannelSmoothing(
            lowFreqBuffer, i + c, width, height, channels, config.lowFreqDenoise,
          );
        }
      }
      return denoised;
    }
    return lowFreqBuffer;
  } catch (error) {
    logger.error(`[Enhance] Xử lý tần số thấp thất bại: ${error.message}`);
    throw error;
  }
}

/**
 * Xử lý lớp tần số cao (Chi tiết và đường kẻ).
 *
 * @param {Buffer} highFreqBuffer - Dữ liệu tần số cao thô.
 * @param {Object} metadata - Metadata của ảnh.
 * @param {Object} [options] - Tùy chọn xử lý.
 */
export async function processHighFrequency(
  highFreqBuffer,
  metadata,
  options = {},
) {
  const config = { ...DEFAULT_OPTIONS, ...options };

  try {
    const { channels } = metadata;
    const enhanced = Buffer.alloc(highFreqBuffer.length);

    for (let i = 0; i < highFreqBuffer.length; i += channels) {
      for (let c = 0; c < channels; c++) {
        const value = highFreqBuffer[i + c];
        const centered = value - 128;
        // Áp dụng tăng cường cho các chi tiết lệch khỏi mức xám trung tính
        const enhancedValue = 128 + centered * config.highFreqGain;
        enhanced[i + c] = Math.max(0, Math.min(255, enhancedValue));
      }
    }

    return enhanced;
  } catch (error) {
    logger.error(`[Enhance] Xử lý tần số cao thất bại: ${error.message}`);
    throw error;
  }
}

/**
 * Làm mượt kênh màu dựa trên độ tương đồng màu sắc cục bộ.
 * @private
 */
function applyChannelSmoothing(buffer, index, width, height, channels, strength) {
  const x = (index / channels) % width;
  const y = Math.floor(index / channels / width);
  const c = index % channels;

  let sum = buffer[index];
  let count = 1;

  const neighbors = [
    { dx: -1, dy: 0 }, { dx: 1, dy: 0 },
    { dx: 0, dy: -1 }, { dx: 0, dy: 1 },
  ];

  for (const { dx, dy } of neighbors) {
    const nx = x + dx;
    const ny = y + dy;

    if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
      const nIndex = (ny * width + nx) * channels + c;
      const diff = Math.abs(buffer[index] - buffer[nIndex]);
      // Trọng số theo phân phối Gauss để giữ lại các cạnh sắc nét
      const weight = Math.exp(-diff / (strength * 50));
      sum += buffer[nIndex] * weight;
      count += weight;
    }
  }

  return Math.round(sum / count);
}

/**
 * Kết hợp lại các lớp tần số để tái tạo hình ảnh hoàn chỉnh.
 *
 * @param {Buffer} lowFreq - Buffer tần số thấp đã xử lý.
 * @param {Buffer} highFreq - Buffer tần số cao đã xử lý.
 * @param {Object} metadata - Metadata ảnh.
 * @param {Object} [options] - Tùy chọn trộn ảnh.
 * @returns {Promise<Buffer>} Buffer ảnh kết quả.
 */
export async function recombineFrequencies(
  lowFreq,
  highFreq,
  metadata,
  options = {},
) {
  const config = { ...DEFAULT_OPTIONS, ...options };
  const { width, height, channels } = metadata;

  try {
    const output = Buffer.alloc(lowFreq.length);

    for (let i = 0; i < lowFreq.length; i += channels) {
      for (let c = 0; c < channels; c++) {
        const lf = lowFreq[i + c];
        const hf = highFreq[i + c];

        let result;
        switch (config.blendMode) {
          case "overlay":
            result = hf < 128 ? (2 * lf * hf) / 255 : 255 - (2 * (255 - lf) * (255 - hf)) / 255;
            break;
          case "softLight":
            result = hf < 128 ? (2 * lf * hf) / 255 + ((lf * lf) / 255) * (1 - (2 * hf) / 255) : 2 * lf * (1 - hf / 255) + Math.sqrt(lf / 255) * (2 * hf - 255);
            break;
          case "linear":
          default:
            // Phép cộng tuyến tính: Kết quả = Thấp + (Cao - 128)
            result = lf + (hf - 128);
            break;
        }

        output[i + c] = Math.max(0, Math.min(255, Math.round(result)));
      }
    }

    return await sharp(output, { raw: { width, height, channels } })
      .toFormat("png")
      .toBuffer();
  } catch (error) {
    logger.error(`[Enhance] Kết hợp tần số thất bại: ${error.message}`);
    throw error;
  }
}

// ════════════════════════════════════════
// QUY TRÌNH NÂNG CẤP (MAIN FLOW)
// ════════════════════════════════════════

/**
 * Quy trình tăng cường chất lượng ảnh chuyên sâu cho Anime.
 *
 * @param {Buffer} imageBuffer - Buffer ảnh đầu vào.
 * @param {Object} [options] - Các tùy chọn bổ sung.
 */
export async function processAnimeOptimized(imageBuffer, options = {}) {
  const animeOptions = {
    blurRadius: 5,
    highFreqGain: 1.15, // Tăng cường đường nét Anime một cách tinh tế
    lowFreqDenoise: 0,
    blendMode: "linear",
    ...options,
  };

  try {
    const separated = await separateFrequencies(imageBuffer, animeOptions);
    const processedLow = await processLowFrequency(separated.lowFreq, separated.metadata, animeOptions);
    const processedHigh = await processHighFrequency(separated.highFreq, separated.metadata, animeOptions);
    return await recombineFrequencies(processedLow, processedHigh, separated.metadata, animeOptions);
  } catch (error) {
    logger.error(`[Enhance] Quy trình nâng cấp Anime thất bại: ${error.message}`);
    throw error;
  }
}

/**
 * Điểm vào chính để thực hiện tăng cường độ sắc nét hình ảnh.
 *
 * @param {Buffer} buffer - Buffer ảnh đầu vào.
 * @param {{isAnime: boolean}} options - Cấu hình loại nội dung.
 * @returns {Promise<Buffer>} Buffer ảnh sau khi được tăng cường.
 */
export const enhanceImage = async (buffer, { isAnime = true } = {}) => {
  try {
    if (isAnime) {
      logger.info("[Enhance] Áp dụng tăng cường Anime (Frequency Separation)");
      return await processAnimeOptimized(buffer);
    }

    // Tăng cường tiêu chuẩn cho ảnh thực tế bằng Unsharp Mask cân bằng
    logger.info("[Enhance] Áp dụng tăng cường tiêu chuẩn (Unsharp Mask)");
    return await sharp(buffer)
      .sharpen({
        sigma: 0.5,
        m1: 0.8,
        m2: 0.05,
      })
      .toBuffer();
  } catch (err) {
    logger.warn(`[Enhance] Tăng cường thất bại, giữ nguyên ảnh gốc: ${err.message}`);
    return buffer;
  }
};

