/**
 * @file format.util.js
 * @module Utils
 * @description Cung cấp các công cụ nhận diện và chuyển đổi giữa các định dạng hình ảnh hiện đại.
 */

import sharp from "sharp";
import heicConvert from "heic-convert";
import { logger } from "./logger.js";
import { IMAGE_ERRORS } from "../config/media.config.js";
import { createImageProcessingError } from "./errors/image-processing.error.js";

// ════════════════════════════════════════
// NHẬN DIỆN ĐỊNH DẠNG (DETECTION)
// ════════════════════════════════════════

/**
 * Kiểm tra xem Buffer có phải là định dạng AVIF hay không.
 *
 * @param {Buffer} buffer - Dữ liệu ảnh thô.
 * @returns {boolean}
 */
export const isAvifFormat = (buffer) => {
  if (buffer.length < 12) return false;
  const ftyp = buffer.slice(4, 8).toString("ascii");
  if (ftyp !== "ftyp") return false;
  const brand = buffer.slice(8, 12).toString("ascii").toLowerCase();
  return brand === "avif" || brand === "avis";
};

/**
 * Kiểm tra xem Buffer có phải là định dạng HEIF/HEIC hay không.
 *
 * @param {Buffer} buffer - Dữ liệu ảnh thô.
 * @returns {boolean}
 */
export const isHeifFormat = (buffer) => {
  if (buffer.length < 12) return false;
  if (isAvifFormat(buffer)) return false; // Tránh nhầm lẫn với AVIF vì cùng cấu trúc container ISO
  const ftyp = buffer.slice(4, 8).toString("ascii");
  if (ftyp !== "ftyp") return false;
  const brand = buffer.slice(8, 12).toString("ascii").toLowerCase();
  const heifBrands = [
    "heic", "heix", "hevc", "hevx", "heim",
    "heis", "hevm", "hevs", "mif1", "msf1",
  ];
  return heifBrands.some(
    (b) => brand.includes(b) || brand.startsWith(b.substring(0, 3)),
  );
};

// ════════════════════════════════════════
// CHUYỂN ĐỔI ĐỊNH DẠNG (CONVERSION)
// ════════════════════════════════════════

/**
 * Chuyển đổi định dạng HEIF/HEIC sang JPEG.
 *
 * @description Do Sharp không hỗ trợ HEIF ghi, chúng ta sử dụng thư viện heic-convert để giải mã.
 * @param {Buffer} buffer - Dữ liệu ảnh HEIF đầu vào.
 * @param {number} [retries=2] - Số lần thử lại nếu gặp lỗi giải mã.
 * @returns {Promise<Buffer>} Buffer ảnh JPEG.
 */
export const convertHeifToJpeg = async (buffer, retries = 2) => {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      if (attempt > 0) {
        logger.info(`[Format] Thử lại lần thứ ${attempt}/${retries} cho tệp HEIF...`);
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
      }

      logger.info("[Format] Đang chuyển đổi HEIF/HEIC sang JPEG...");
      const jpegBuffer = await heicConvert({
        buffer: buffer,
        format: "JPEG",
        quality: 0.95,
      });

      return Buffer.from(jpegBuffer);
    } catch (error) {
      if (attempt === retries) {
        logger.error("[Format] Chuyển đổi HEIF thất bại hoàn toàn:", error.message);
        throw createImageProcessingError(
          IMAGE_ERRORS.HEIF_CONVERSION_FAILED.code,
          IMAGE_ERRORS.HEIF_CONVERSION_FAILED.message,
          error,
          true,
        );
      }
    }
  }
};

/**
 * Xử lý giải mã và chuyển đổi tệp AVIF phức tạp.
 *
 * @description Áp dụng nhiều chiến lược (Sharp Native, Re-encoding qua JPEG, Raw Pixel)
 * để đảm bảo khả năng tương thích với các phiên bản AVIF khác nhau.
 * @param {Buffer} buffer - Buffer ảnh AVIF.
 * @returns {Promise<Object>} Buffer đã chuyển đổi.
 */
export const processAvifInput = async (buffer) => {
  const strategies = [
    { name: "Sharp Native", format: "png" },
    { name: "Sharp JPEG", format: "jpeg" },
    { name: "Raw Buffer", format: "raw" },
  ];

  for (const strategy of strategies) {
    try {
      logger.info(`[Format] Đang thử giải mã AVIF bằng chiến lược: ${strategy.name}...`);

      let convertedBuffer;
      if (strategy.format === "raw") {
        // Chiến lược cuối cùng: Trích xuất dữ liệu pixel thô và đóng gói lại thành PNG
        const rawData = await sharp(buffer, { failOnError: false })
          .ensureAlpha()
          .raw()
          .toBuffer({ resolveWithObject: true });

        convertedBuffer = await sharp(rawData.data, {
          raw: {
            width: rawData.info.width,
            height: rawData.info.height,
            channels: rawData.info.channels,
          },
        })
          .png()
          .toBuffer();
      } else {
        convertedBuffer = await sharp(buffer, { failOnError: false })
          .toFormat(strategy.format, { quality: 95 })
          .toBuffer();
      }

      logger.info(`[Format] Giải mã AVIF thành công qua ${strategy.name}`);
      return { buffer: convertedBuffer, wasPassthrough: false };
    } catch (error) {
      logger.warn(`[Format] Chiến lược ${strategy.name} không tương thích:`, error.message);
      if (strategy === strategies[strategies.length - 1]) {
        throw createImageProcessingError(
          IMAGE_ERRORS.DECODE_FAILED.code,
          "Không thể giải mã tệp AVIF. Vui lòng sử dụng định dạng phổ biến hơn (JPG/PNG).",
          error,
          false,
        );
      }
    }
  }
};

/**
 * Chuyển đổi Buffer sang định dạng đích với cấu hình chất lượng tối ưu.
 *
 * @param {Buffer} buffer - Dữ liệu ảnh đầu vào.
 * @param {string} format - Định dạng đích (webp, jpeg, png, avif).
 * @param {number} quality - Mức chất lượng (1-100).
 * @param {string[]} [fallbackFormats=[]] - Các định dạng dự phòng nếu định dạng chính thất bại.
 * @returns {Promise<Object>} Buffer ảnh kết quả và định dạng thực tế đã sử dụng.
 */
export const convertToFormat = async (
  buffer,
  format,
  quality,
  fallbackFormats = [],
) => {
  const formats = [format, ...fallbackFormats];

  for (const fmt of formats) {
    try {
      let pipeline = sharp(buffer);

      switch (fmt.toLowerCase()) {
        case "avif":
          pipeline = pipeline.avif({
            quality,
            effort: 4, // Cân bằng giữa tốc độ nén và dung lượng
            chromaSubsampling: "4:2:0",
          });
          break;
        case "webp":
          pipeline = pipeline.webp({
            quality,
            effort: 4,
            smartSubsample: true,
          });
          break;
        case "jpeg":
        case "jpg":
          pipeline = pipeline.jpeg({
            quality,
            mozjpeg: true, // Sử dụng MozJPEG để tối ưu dung lượng tốt hơn 10-15%
            chromaSubsampling: "4:2:0",
          });
          break;
        case "png":
          pipeline = pipeline.png({
            quality,
            compressionLevel: 9, // Nén PNG tối đa vì là định dạng lossless
            adaptiveFiltering: true,
          });
          break;
        default:
          pipeline = pipeline.webp({ quality });
      }

      const outputBuffer = await pipeline.toBuffer();
      logger.info(`[Format] Hoàn tất chuyển đổi sang ${fmt} (Chất lượng: ${quality}%)`);

      return { buffer: outputBuffer, format: fmt };
    } catch (error) {
      logger.warn(`[Format] Định dạng ${fmt} gặp lỗi, đang thử giải pháp dự phòng tiếp theo:`, error.message);
      if (fmt === formats[formats.length - 1]) {
        throw createImageProcessingError(
          IMAGE_ERRORS.CONVERT_FAILED.code,
          IMAGE_ERRORS.CONVERT_FAILED.message,
          error,
          false,
        );
      }
    }
  }
};

