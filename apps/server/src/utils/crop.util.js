/**
 * @file crop.util.js
 * @module Utils
 * @description Cung cấp các công cụ chuẩn hóa hướng ảnh, trích xuất metadata và thực hiện cắt ảnh thông minh.
 */

import sharp from "sharp";
import { logger } from "./logger.js";
import { CROP_STRATEGY, IMAGE_ERRORS } from "../config/media.config.js";
import { smartBannerCrop } from "./face-detection.util.js";
import { createImageProcessingError } from "./errors/image-processing.error.js";

// ════════════════════════════════════════
// CHUẨN HÓA & TRÍCH XUẤT (CORE UTILS)
// ════════════════════════════════════════

/**
 * Chuẩn hóa hướng ảnh dựa trên thẻ EXIF.
 *
 * @description Tự động xoay ảnh về đúng hướng nhìn và loại bỏ metadata hướng cũ để tránh hiển thị sai trên các trình duyệt.
 * @param {Buffer} buffer - Dữ liệu ảnh đầu vào.
 * @returns {Promise<Buffer>} Buffer ảnh đã được chuẩn hóa hướng.
 */
export const normalizeOrientation = async (buffer) => {
  try {
    return await sharp(buffer)
      .rotate()
      .withMetadata({ orientation: undefined })
      .toBuffer();
  } catch (error) {
    logger.warn(`[Crop] Không thể chuẩn hóa hướng ảnh: ${error.message}`);
    return buffer;
  }
};

/**
 * Trích xuất Metadata mở rộng và các thông số chất lượng hình ảnh.
 *
 * @param {Buffer} buffer - Dữ liệu ảnh đầu vào.
 * @returns {Promise<Object>} Metadata chi tiết (kích thước, độ sắc nét, màu chủ đạo, entropy).
 */
export const getImageMetadata = async (buffer) => {
  try {
    const metadata = await sharp(buffer, { failOnError: false }).metadata();
    const stats = await sharp(buffer).stats();

    return {
      ...metadata,
      isLowQuality: stats.entropy < 6.0,
      isNoisy: stats.entropy > 7.5,
      dominantColor: stats.dominant,
      sharpness: stats.entropy,
    };
  } catch (error) {
    logger.error(`[Crop] Lỗi trích xuất metadata: ${error.message}`);
    throw createImageProcessingError(
      IMAGE_ERRORS.DECODE_FAILED.code,
      IMAGE_ERRORS.DECODE_FAILED.message,
      error,
      false,
    );
  }
};

/**
 * Lựa chọn chiến lược cắt ảnh tự động dựa trên phân tích nội dung.
 *
 * @private
 * @param {Object} metadata - Metadata của ảnh.
 * @param {string} preferredStrategy - Chiến lược ưu tiên được yêu cầu.
 * @param {string} imageType - Loại ảnh (banner, avatar, poster...).
 * @returns {Promise<string>} Chiến lược cắt ảnh cuối cùng được chọn.
 */
const selectCropStrategy = async (metadata, preferredStrategy, imageType) => {
  if (imageType === "banner") {
    logger.info("[Crop] Phát hiện ảnh Banner - Ưu tiên nhận diện khuôn mặt (Face-aware)");
    return "face-aware";
  }

  if (preferredStrategy !== CROP_STRATEGY.AUTO) {
    return preferredStrategy;
  }

  try {
    // Tự động chọn dựa trên độ chi tiết (Sharpness/Entropy) của ảnh
    if (metadata.sharpness > 7.0) {
      return CROP_STRATEGY.ATTENTION;
    }

    if (metadata.sharpness < 6.5) {
      return CROP_STRATEGY.ENTROPY;
    }

    return CROP_STRATEGY.ATTENTION;
  } catch (error) {
    logger.warn(`[Crop] Tự động chọn chiến lược thất bại, sử dụng 'attention': ${error.message}`);
    return CROP_STRATEGY.ATTENTION;
  }
};

// ════════════════════════════════════════
// XỬ LÝ CẮT ẢNH (MAIN LOGIC)
// ════════════════════════════════════════

/**
 * Cắt ảnh theo tỷ lệ khung hình mục tiêu với các thuật toán thông minh.
 *
 * @param {Buffer} buffer - Dữ liệu ảnh đầu vào.
 * @param {{width: number, height: number}} aspectRatio - Tỷ lệ khung hình đích.
 * @param {string} strategy - Chiến lược cắt (auto, center, attention, entropy).
 * @param {string} imageType - Loại ảnh để áp dụng logic riêng biệt (VD: banner).
 * @returns {Promise<{buffer: Buffer, cropInfo: Object}>} Buffer ảnh sau khi cắt và thông tin xử lý.
 */
export const cropToAspectRatio = async (
  buffer,
  aspectRatio,
  strategy,
  imageType,
) => {
  try {
    const metadata = await getImageMetadata(buffer);
    const { width, height } = metadata;

    const targetRatio = aspectRatio.width / aspectRatio.height;
    const currentRatio = width / height;

    // Nếu tỷ lệ đã khớp (sai số < 2%), bỏ qua bước cắt để tối ưu hiệu năng
    if (Math.abs(currentRatio - targetRatio) < 0.02) {
      logger.info("[Crop] Ảnh đã đúng tỷ lệ khung hình, bỏ qua bước cắt.");
      return { buffer, cropInfo: { strategy: "none" } };
    }

    let cropWidth, cropHeight;
    if (currentRatio > targetRatio) {
      cropHeight = height;
      cropWidth = Math.round(height * targetRatio);
    } else {
      cropWidth = width;
      cropHeight = Math.round(width / targetRatio);
    }

    const selectedStrategy = await selectCropStrategy(metadata, strategy, imageType);

    // Xử lý cắt ảnh nhận diện khuôn mặt (Đặc thù cho Banner nội dung Anime/Người đóng)
    if (selectedStrategy === "face-aware" && imageType === "banner") {
      logger.info("[Crop] Đang áp dụng cơ chế cắt ảnh Face-aware...");
      try {
        const result = await smartBannerCrop(buffer, aspectRatio, { isAnime: true });
        logger.info(`[Crop] Hoàn tất Face-aware: Đã bảo vệ ${result.cropInfo.facesIncluded}/${result.cropInfo.totalFaces} khuôn mặt.`);

        return {
          buffer: result.buffer,
          cropInfo: {
            ...result.cropInfo,
            originalDimensions: { width, height },
            targetDimensions: { width: cropWidth, height: cropHeight },
          },
        };
      } catch (faceError) {
        logger.warn(`[Crop] Face-aware thất bại, chuyển sang chế độ 'attention': ${faceError.message}`);
      }
    }

    let position;
    switch (selectedStrategy) {
      case CROP_STRATEGY.ATTENTION:
        position = sharp.strategy.attention; // Tập trung vào vùng có độ tương phản và chi tiết cao nhất
        break;
      case CROP_STRATEGY.ENTROPY:
        position = sharp.strategy.entropy; // Tập trung vào vùng chứa nhiều thông tin (Shannon entropy)
        break;
      case CROP_STRATEGY.CENTER:
      default:
        position = "center";
    }

    logger.info(`[Crop] Thực hiện cắt: ${width}×${height} → ${cropWidth}×${cropHeight} (Chiến lược: ${selectedStrategy})`);

    try {
      const croppedBuffer = await sharp(buffer)
        .resize(cropWidth, cropHeight, { fit: "cover", position: position })
        .toBuffer();

      return {
        buffer: croppedBuffer,
        cropInfo: {
          strategy: selectedStrategy,
          originalDimensions: { width, height },
          targetDimensions: { width: cropWidth, height: cropHeight },
        },
      };
    } catch (smartError) {
      logger.warn(`[Crop] Cắt ảnh thông minh thất bại, sử dụng mặc định Center: ${smartError.message}`);
      const croppedBuffer = await sharp(buffer)
        .extract({
          left: Math.max(0, Math.round((width - cropWidth) / 2)),
          top: Math.max(0, Math.round((height - cropHeight) / 2)),
          width: cropWidth,
          height: cropHeight,
        })
        .toBuffer();

      return {
        buffer: croppedBuffer,
        cropInfo: {
          strategy: "center",
          originalDimensions: { width, height },
          targetDimensions: { width: cropWidth, height: cropHeight },
        },
      };
    }
  } catch (error) {
    throw createImageProcessingError(
      IMAGE_ERRORS.CROP_FAILED.code,
      IMAGE_ERRORS.CROP_FAILED.message,
      error,
      true,
    );
  }
};

