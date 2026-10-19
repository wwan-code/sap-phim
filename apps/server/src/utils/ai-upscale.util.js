/**
 * @file ai-upscale.util.js
 * @module Utils
 * @description Lớp vỏ điều phối quy trình tăng độ phân giải hình ảnh thông minh bằng AI ESRGAN và Sharp.
 */

import sharp from "sharp";
import { logger } from "./logger.js";
import { esrganUpscale } from "./esrgan.util.js";

// ════════════════════════════════════════
// XỬ LÝ NÂNG CẤP ẢNH (MAIN LOGIC)
// ════════════════════════════════════════

/**
 * Nâng cấp hoặc thu nhỏ hình ảnh về kích thước mục tiêu một cách thông minh.
 *
 * @description Tự động lựa chọn giữa Downscale (Sharp), Upscale (ESRGAN) hoặc Giữ nguyên dựa trên kích thước thực tế.
 * @param {Buffer} buffer - Dữ liệu ảnh đầu vào.
 * @param {number} targetWidth - Chiều rộng đích mong muốn.
 * @param {number} targetHeight - Chiều cao đích mong muốn.
 * @param {Object} options - Các tùy chọn bổ sung (loại ảnh, mô hình, callback tiến độ).
 * @returns {Promise<{buffer: Buffer, metadata: {method: string, timeMs: number}}>} Kết quả gồm Buffer ảnh và metadata xử lý.
 */
export const aiUpscale = async (
  buffer,
  targetWidth,
  targetHeight,
  options = {},
) => {
  const startTime = Date.now();
  try {
    const metadata = await sharp(buffer).metadata();
    const { width, height } = metadata;

    // Trường hợp 1: Ảnh gốc đã lớn hơn mục tiêu -> Thu nhỏ chất lượng cao (Downscale)
    if (width > targetWidth || height > targetHeight) {
      logger.info(`[AiUpscale] Ảnh lớn hơn mục tiêu (${width}x${height}). Thực hiện Downscale bằng thuật toán Lanczos3...`);
      const finalBuffer = await sharp(buffer)
        .resize(targetWidth, targetHeight, {
          fit: "cover",
          kernel: "lanczos3",
          withoutEnlargement: true,
        })
        .toBuffer();

      return {
        buffer: finalBuffer,
        metadata: { method: "sharp_downscale", timeMs: Date.now() - startTime },
      };
    }

    // Trường hợp 2: Ảnh gốc đã đúng kích thước mục tiêu -> Giữ nguyên để tiết kiệm tài nguyên
    if (width === targetWidth && height === targetHeight) {
      logger.info("[AiUpscale] Ảnh đã đúng kích thước mục tiêu, bỏ qua xử lý.");
      return { buffer, metadata: { method: "none", timeMs: 0 } };
    }

    // Trường hợp 3: Ảnh nhỏ hơn mục tiêu -> Thực hiện nâng cấp độ phân giải bằng AI
    const scaleX = targetWidth / width;
    const scaleY = targetHeight / height;
    const scale = Math.max(scaleX, scaleY);

    logger.info(`[AiUpscale] Đang nâng cấp từ ${width}x${height} lên ${targetWidth}x${targetHeight} (Tỷ lệ ~${scale.toFixed(2)}x)`);

    // Chuyển giao việc xử lý cho module ESRGAN (Bộ xử lý AI chính)
    const result = await esrganUpscale(buffer, {
      ...options,
      scale,
      targetWidth,
      targetHeight,
    });

    // Tinh chỉnh kích thước cuối cùng nếu AI trả về sai lệch nhỏ (do cơ chế mảnh/tiling)
    const outMeta = await sharp(result.buffer).metadata();
    if (outMeta.width !== targetWidth || outMeta.height !== targetHeight) {
      const finalBuffer = await sharp(result.buffer)
        .resize(targetWidth, targetHeight, { fit: "cover", kernel: "lanczos3" })
        .toBuffer();

      return {
        buffer: finalBuffer,
        metadata: {
          method: result.metadata?.method || "esrgan",
          timeMs: Date.now() - startTime,
        },
      };
    }

    return {
      buffer: result.buffer,
      metadata: {
        method: result.metadata?.method || "esrgan",
        timeMs: Date.now() - startTime,
      },
    };
  } catch (error) {
    // Cơ chế dự phòng cuối cùng (Ultimate Fallback) nếu toàn bộ hệ thống AI gặp sự cố
    logger.error(`[AiUpscale] Xử lý AI thất bại, đang chuyển sang thuật toán dự phòng Sharp: ${error.message}`);
    const finalBuffer = await sharp(buffer)
      .resize(targetWidth, targetHeight, { fit: "cover", kernel: "lanczos3" })
      .toBuffer();

    return {
      buffer: finalBuffer,
      metadata: {
        method: "sharp_ultimate_fallback",
        timeMs: Date.now() - startTime,
      },
    };
  }
};

