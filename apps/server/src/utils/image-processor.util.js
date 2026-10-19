/**
 * @file image-processor.util.js
 * @module Utils
 * @description Triển khai pipeline xử lý ảnh từ decode, preprocess, crop, upscale, enhance đến optimize.
 */

import { logger } from "./logger.js";
import {
  isAvifFormat,
  isHeifFormat,
  convertHeifToJpeg,
  processAvifInput,
  convertToFormat,
} from "./format.util.js";
import { normalizeOrientation, cropToAspectRatio } from "./crop.util.js";
import { aiUpscale } from "./ai-upscale.util.js";
import { enhanceImage } from "./enhance.util.js";
import { IMAGE_SPECS } from "../config/media.config.js";

/**
 * Xử lý hình ảnh qua Pipeline chuẩn hóa và nâng cấp tự động.
 *
 * @description Điều phối các module con để thực hiện quy trình xử lý ảnh khép kín dựa trên cấu hình loại ảnh (Avatar, Poster, Banner...).
 * @param {Buffer} buffer - Dữ liệu ảnh thô đầu vào.
 * @param {string} [imageType="generic"] - Loại ảnh để áp dụng thông số kỹ thuật (Specs).
 * @param {Object} [options={}] - Các tùy chọn mở rộng (Mô hình AI, Callback tiến độ).
 * @returns {Promise<Object>} Đối tượng chứa buffer kết quả, metadata xử lý và báo cáo hiệu năng.
 * @throws {Error} Khi một trong các giai đoạn của Pipeline gặp lỗi nghiêm trọng.
 */
export const processImage = async (
  buffer,
  imageType = "generic",
  options = {},
) => {
  const startTime = Date.now();
  let currentBuffer = buffer;
  const metadata = { stages: [] };

  // Khởi tạo cấu hình kỹ thuật dựa trên loại ảnh
  const baseSpecs = IMAGE_SPECS[imageType?.toLowerCase()] || {};
  const specs = {
    width: 1920,
    height: 1080,
    quality: 90,
    format: "webp",
    upscale: false,
    crop: false,
    ...baseSpecs,
    ...(options.specs || {}),
  };

  const targetW = specs.width || specs.targetWidth || 1920;
  const targetH = specs.height || specs.targetHeight || 1080;

  try {
    // ════════════════════════════════════════
    // GIAI ĐOẠN 1: GIẢI MÃ ĐỊNH DẠNG (DECODING)
    // ════════════════════════════════════════
    // Hỗ trợ các định dạng hiện đại từ thiết bị di động (HEIF/HEIC, AVIF)
    if (isHeifFormat(currentBuffer)) {
      currentBuffer = await convertHeifToJpeg(currentBuffer);
      metadata.stages.push("heif_convert");
    } else if (isAvifFormat(currentBuffer)) {
      const avifResult = await processAvifInput(currentBuffer);
      currentBuffer = avifResult.buffer;
      metadata.stages.push("avif_convert");
    }

    // ════════════════════════════════════════
    // GIAI ĐOẠN 2: TIỀN XỬ LÝ (PREPROCESS)
    // ════════════════════════════════════════
    // Tự động xoay ảnh theo EXIF để đảm bảo ảnh luôn đúng hướng nhìn
    currentBuffer = await normalizeOrientation(currentBuffer);

    // ════════════════════════════════════════
    // GIAI ĐOẠN 3: CẮT ẢNH THÔNG MINH (SMART CROP)
    // ════════════════════════════════════════
    // Cắt ảnh theo tỷ lệ khung hình mục tiêu, ưu tiên bảo vệ vùng chủ thể (khuôn mặt)
    if (specs.crop && targetW && targetH) {
      const cropResult = await cropToAspectRatio(
        currentBuffer,
        { width: targetW, height: targetH },
        "auto",
        imageType,
      );
      currentBuffer = cropResult.buffer;
      metadata.stages.push("crop");
      metadata.cropStrategy = cropResult.cropInfo?.strategy;
    }

    // ════════════════════════════════════════
    // GIAI ĐOẠN 4: NÂNG CẤP ĐỘ PHÂN GIẢI (AI UPSCALE)
    // ════════════════════════════════════════
    // Sử dụng mô hình Super-Resolution (ESRGAN) nếu ảnh gốc quá nhỏ so với yêu cầu
    if (specs.upscale && targetW && targetH) {
      const upscaleResult = await aiUpscale(
        currentBuffer,
        targetW,
        targetH,
        {
          imageType,
          model: options.model,
          onProgress: options.onProgress,
        },
      );
      currentBuffer = upscaleResult.buffer;
      metadata.stages.push("ai_upscale");
      metadata.upscaleMethod = upscaleResult.metadata.method;
    }

    // ════════════════════════════════════════
    // GIAI ĐOẠN 5: TĂNG CƯỜNG CHI TIẾT (ENHANCE)
    // ════════════════════════════════════════
    // Áp dụng kỹ thuật hậu xử lý để làm sắc nét và cân bằng màu sắc cho Anime/Movie
    const enableEnhance = specs.enhance !== false;
    if (enableEnhance) {
      const isAnime =
        imageType === "banner" ||
        imageType === "poster" ||
        imageType === "cover";
      currentBuffer = await enhanceImage(currentBuffer, { isAnime });
      metadata.stages.push("enhance");
    }

    // ════════════════════════════════════════
    // GIAI ĐOẠN 6: TỐI ƯU HÓA CUỐI CÙNG (OPTIMIZE)
    // ════════════════════════════════════════
    // Chuyển đổi sang định dạng nén hiệu quả cao (WebP/AVIF) để giảm băng thông
    const finalFormat = specs.format || "webp";
    const quality = specs.quality || 90;
    const optResult = await convertToFormat(
      currentBuffer,
      finalFormat,
      quality,
      ["jpeg", "png"],
    );
    currentBuffer = optResult.buffer;
    metadata.stages.push("optimize");
    metadata.finalFormat = optResult.format;

    const duration = Date.now() - startTime;
    logger.info(`[ImageProcessor] Hoàn tất Pipeline cho ${imageType} trong ${duration}ms. Các bước: ${metadata.stages.join(" -> ")}`);

    return {
      buffer: currentBuffer,
      metadata,
      performance: { durationMs: duration },
    };
  } catch (err) {
    logger.error(`[ImageProcessor] Pipeline thất bại nghiêm trọng: ${err.message}`);
    throw err;
  }
};

