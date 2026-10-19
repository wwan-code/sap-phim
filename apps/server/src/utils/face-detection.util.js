/**
 * @file face-detection.util.js
 * @module Utils
 * @description Cung cấp các thuật toán nhận diện khuôn mặt và vùng quan trọng để hỗ trợ cắt ảnh chính xác.
 */

import sharp from "sharp";
import { logger } from "./logger.js";

// ════════════════════════════════════════
// CẤU HÌNH NHẬN DIỆN (CONFIG)
// ════════════════════════════════════════

/**
 * Cấu hình tham số cho hệ thống nhận diện khuôn mặt.
 */
export const FACE_DETECTION_CONFIG = {
  methods: ["attention", "entropy", "center"],

  earlyExit: true, // Thoát sớm nếu tìm thấy khuôn mặt bằng phương pháp ưu tiên để tiết kiệm tài nguyên.
  aggressiveDetection: false,

  minFaceSize: 50,
  maxFaces: 10,

  facePadding: 0.15, // Vùng đệm mở rộng xung quanh khuôn mặt.
  centerWeight: 0.7,

  saliencyThreshold: 0.6,

  banner: {
    preferredFacePosition: 0.5, // Vị trí khuôn mặt lý tưởng trong khung hình (0.5 = chính giữa).
    horizontalBias: 0.5,
    minFaceRatio: 0.08, // Tỷ lệ diện tích khuôn mặt tối thiểu.
    maxFaceRatio: 0.7,  // Tỷ lệ diện tích khuôn mặt tối đa để tránh nhận diện nhầm phông nền.
  },

  anime: {
    enabled: true,
    eyeContrastThreshold: 0.35,
    flatColorRatio: 0.4,
    hairSaturationMin: 25,
    minEyeRatio: 0.04,
    maxEyeRatio: 0.25,
    gridSize: 8,
    characterCenterWeight: 1.2,
  },
};

// ════════════════════════════════════════
// LỚP HỖ TRỢ (HELPER CLASSES)
// ════════════════════════════════════════

/**
 * Lớp đại diện cho một vùng khuôn mặt phát hiện được.
 */
class FaceRegion {
  /**
   * @param {number} x - Tọa độ X.
   * @param {number} y - Tọa độ Y.
   * @param {number} width - Chiều rộng vùng.
   * @param {number} height - Chiều cao vùng.
   * @param {number} [confidence=1.0] - Độ tin cậy của kết quả.
   */
  constructor(x, y, width, height, confidence = 1.0) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.confidence = confidence;
    this.centerX = x + width / 2;
    this.centerY = y + height / 2;
    this.area = width * height;
  }

  /**
   * Kiểm tra mức độ chồng lấp với một vùng khác.
   * @param {FaceRegion} other - Vùng đối chiếu.
   * @param {number} [threshold=0.5] - Ngưỡng chồng lấp.
   * @returns {boolean}
   */
  overlaps(other, threshold = 0.5) {
    const overlapX = Math.max(0, Math.min(this.x + this.width, other.x + other.width) - Math.max(this.x, other.x));
    const overlapY = Math.max(0, Math.min(this.y + this.height, other.y + other.height) - Math.max(this.y, other.y));
    const overlapArea = overlapX * overlapY;
    const minArea = Math.min(this.area, other.area);

    return overlapArea / minArea > threshold;
  }

  /**
   * Hợp nhất hai vùng có sự chồng lấp cao.
   * @param {FaceRegion} other - Vùng cần hợp nhất.
   * @returns {FaceRegion} Vùng mới bao phủ cả hai.
   */
  merge(other) {
    const x1 = Math.min(this.x, other.x);
    const y1 = Math.min(this.y, other.y);
    const x2 = Math.max(this.x + this.width, other.x + other.width);
    const y2 = Math.max(this.y + this.height, other.y + other.height);

    return new FaceRegion(x1, y1, x2 - x1, y2 - y1, Math.max(this.confidence, other.confidence));
  }

  /**
   * Mở rộng vùng nhận diện với các thông số đệm.
   * @param {number} padding - Tỷ lệ đệm.
   * @param {number} maxWidth - Giới hạn chiều rộng ảnh.
   * @param {number} maxHeight - Giới hạn chiều cao ảnh.
   */
  expand(padding, maxWidth, maxHeight) {
    const padX = this.width * padding;
    const padY = this.height * padding;

    return new FaceRegion(
      Math.max(0, this.x - padX),
      Math.max(0, this.y - padY),
      Math.min(maxWidth, this.width + 2 * padX),
      Math.min(maxHeight, this.height + 2 * padY),
      this.confidence,
    );
  }
}

// ════════════════════════════════════════
// CHIẾN LƯỢC NHẬN DIỆN (STRATEGIES)
// ════════════════════════════════════════

/**
 * Nhận diện nhân vật Anime dựa trên phân tích điểm ảnh thô (Raw Pixel).
 *
 * @description Thuật toán tìm kiếm các cặp mắt (vùng tương phản cao, đối xứng)
 * và vùng tóc (vùng bão hòa màu cao) để định vị khuôn mặt nhân vật.
 * @param {Buffer} buffer - Buffer ảnh đầu vào.
 * @param {boolean} [isAnime=true] - Cờ xác định nội dung Anime.
 * @returns {Promise<Object>} Kết quả nhận diện (vùng mặt, phương pháp, thông số kỹ thuật).
 */
export const detectAnimeFaces = async (buffer, isAnime = true) => {
  if (!FACE_DETECTION_CONFIG.anime.enabled || !isAnime) {
    return { faces: [], method: "anime", skipped: true };
  }

  try {
    const { data: rawPixels, info: rawInfo } = await sharp(buffer)
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const { width, height } = rawInfo;
    const channels = rawInfo.channels;
    const config = FACE_DETECTION_CONFIG.anime;

    logger.info("[FaceDetect] Bắt đầu nhận diện nhân vật Anime (Heuristic Analysis)...");

    const faces = [];
    const allCells = [];
    const hairRegions = [];

    const gridSize = config.gridSize;
    const cellWidth = Math.floor(width / gridSize);
    const cellHeight = Math.floor(height / gridSize);

    /**
     * Tính toán thống kê màu sắc cho từng ô lưới.
     * @private
     */
    function cellStats(x, y, w, h) {
      const s = Array.from({ length: channels }, () => ({ sum: 0, sumSq: 0, n: 0 }));
      for (let py = y; py < y + h; py++) {
        for (let px = x; px < x + w; px++) {
          const base = (py * width + px) * channels;
          for (let c = 0; c < channels; c++) {
            const v = rawPixels[base + c];
            s[c].sum += v;
            s[c].sumSq += v * v;
            s[c].n++;
          }
        }
      }
      return s.map(({ sum, sumSq, n }) => {
        const mean = n > 0 ? sum / n : 0;
        const stdev = n > 1 ? Math.sqrt(Math.max(0, sumSq / n - mean * mean)) : 0;
        return { mean, stdev };
      });
    }

    // Phân tích lưới điểm ảnh để tìm kiếm đặc trưng
    for (let row = 0; row < gridSize; row++) {
      for (let col = 0; col < gridSize; col++) {
        const x = col * cellWidth;
        const y = row * cellHeight;
        const w = Math.min(cellWidth, width - x);
        const h = Math.min(cellHeight, height - y);

        try {
          const region = cellStats(x, y, w, h);
          const contrast = region[0]?.stdev || 0;
          const saturation = Math.max(region[1]?.stdev || 0, region[2]?.stdev || 0);
          const brightness = region[0]?.mean || 128;
          const eyeScore = contrast / 40;

          allCells.push({
            col, row, x, y, width: cellWidth, height: cellHeight,
            score: eyeScore, contrast, brightness, saturation,
          });

          // Nhận diện vùng tóc Anime (Màu sắc bão hòa mạnh hoặc mảng đen tuyền)
          const isColoredHair = saturation > config.hairSaturationMin;
          const isDarkHair = brightness < 60 && contrast < 30;

          if ((isColoredHair || isDarkHair) && row < gridSize * 0.6) {
            hairRegions.push({
              x, y, width: cellWidth, height: cellHeight,
              score: isColoredHair ? saturation / 50 : 0.7,
              type: "hair",
            });
          }
        } catch (err) {}
      }
    }

    // Lọc các vùng tiềm năng ở trung tâm khung hình
    const middleCells = allCells.filter(cell => cell.row >= 2 && cell.row <= gridSize - 2);
    const sortedCells = middleCells.sort((a, b) => b.score - a.score);
    const topK = Math.min(8, Math.floor(middleCells.length * 0.2));
    const eyeRegions = sortedCells.slice(0, topK);

    // Ghép cặp các vùng "mắt" dựa trên đối xứng chiều ngang
    const usedEyes = new Set();
    for (let i = 0; i < eyeRegions.length; i++) {
      if (usedEyes.has(i)) continue;
      const eye1 = eyeRegions[i];

      for (let j = i + 1; j < eyeRegions.length; j++) {
        if (usedEyes.has(j)) continue;
        const eye2 = eyeRegions[j];

        const yDiff = Math.abs(eye1.row - eye2.row);
        const xDiff = Math.abs(eye1.col - eye2.col);

        // Mắt Anime thường cách nhau 2-4 ô lưới và nằm ở các cột trung tâm
        const isEdgeCell = eye1.col === 0 || eye1.col === gridSize - 1 || eye2.col === 0 || eye2.col === gridSize - 1;

        if (yDiff <= 1 && xDiff >= 2 && xDiff <= 4 && !isEdgeCell) {
          usedEyes.add(i);
          usedEyes.add(j);

          const eyeDistance = Math.abs(eye1.x - eye2.x) + cellWidth;
          const faceWidth = eyeDistance * 1.0;
          const faceHeight = faceWidth * 1.0;

          const eyeCenterX = (eye1.x + eye2.x) / 2 + cellWidth / 2;
          const faceX = eyeCenterX - faceWidth / 2;

          const eyeCenterY = eye1.y + cellHeight / 2;
          const faceY = eyeCenterY - faceHeight * 0.4; // Đặt khung lên phía trên để bao phủ tóc

          const confidence = Math.min(1.0, ((eye1.score + eye2.score) / 2) * config.characterCenterWeight);

          faces.push(new FaceRegion(
            Math.max(0, faceX), Math.max(0, faceY),
            Math.min(faceWidth, width - Math.max(0, faceX)),
            Math.min(faceHeight, height - Math.max(0, faceY)),
            confidence,
          ));
          break;
        }
      }
      if (faces.length > 0) break;
    }

    // Dự phòng: Nếu không ghép được cặp mắt, dùng ô có điểm cao nhất làm tâm điểm khuôn mặt
    if (faces.length === 0 && eyeRegions.length > 0) {
      const bestEye = eyeRegions[0];
      const faceWidth = cellWidth * 3;
      const faceHeight = faceWidth * 1.3;
      const faceX = bestEye.x - cellWidth;
      const faceY = bestEye.y - cellHeight * 1.5;

      faces.push(new FaceRegion(
        Math.max(0, faceX), Math.max(0, faceY),
        Math.min(faceWidth, width - Math.max(0, faceX)),
        Math.min(faceHeight, height - Math.max(0, faceY)),
        bestEye.score * 0.7,
      ));
    }

    const merged = mergeFaceRegions(faces);
    const filtered = merged.filter(face => {
      const ratio = face.area / (width * height);
      return ratio >= FACE_DETECTION_CONFIG.banner.minFaceRatio && ratio <= FACE_DETECTION_CONFIG.banner.maxFaceRatio;
    });

    logger.info(`[FaceDetect] Đã phát hiện ${filtered.length} vùng nhân vật tiềm năng.`);

    return {
      faces: filtered, method: "anime", eyeRegions: eyeRegions.length,
      hairRegions: hairRegions.length, imageWidth: width, imageHeight: height,
    };
  } catch (error) {
    logger.warn(`[FaceDetect] Lỗi nhận diện Anime: ${error.message}`);
    return { faces: [], method: "anime", error: error.message };
  }
};

/**
 * Nhận diện vùng quan trọng dựa trên độ tương phản và entropy (Attention).
 *
 * @param {Buffer} buffer - Buffer ảnh đầu vào.
 * @returns {Promise<Object>} Danh sách các vùng quan trọng.
 */
export const detectFacesWithAttention = async (buffer) => {
  try {
    const image = sharp(buffer);
    const metadata = await image.metadata();
    const { width, height } = metadata;

    logger.info("[FaceDetect] Đang phân tích vùng thu hút chú ý (Attention/Saliency)...");

    const stats = await image.stats();
    const faces = [];

    if (stats.entropy && stats.entropy > 6.0) {
      const gridSize = 8;
      const cellWidth = Math.floor(width / gridSize);
      const cellHeight = Math.floor(height / gridSize);

      for (let row = 0; row < gridSize; row++) {
        for (let col = 0; col < gridSize; col++) {
          const x = col * cellWidth;
          const y = row * cellHeight;

          try {
            const region = await image.clone().extract({
              left: x, top: y,
              width: Math.min(cellWidth, width - x),
              height: Math.min(cellHeight, height - y),
            }).stats();

            const score = ((region.entropy || 0) * (region.channels?.[0]?.stdev || 1)) / 50;

            if (score > FACE_DETECTION_CONFIG.saliencyThreshold) {
              faces.push(new FaceRegion(x, y, cellWidth, cellHeight, Math.min(1.0, score)));
            }
          } catch (err) {}
        }
      }
    }

    const merged = mergeFaceRegions(faces);
    const filtered = merged.filter(face => {
      const ratio = face.area / (width * height);
      return ratio >= FACE_DETECTION_CONFIG.banner.minFaceRatio && ratio <= FACE_DETECTION_CONFIG.banner.maxFaceRatio;
    });

    return { faces: filtered, method: "attention", imageWidth: width, imageHeight: height };
  } catch (error) {
    logger.warn(`[FaceDetect] Lỗi Attention: ${error.message}`);
    return { faces: [], method: "attention", error: error.message };
  }
};

/**
 * Nhận diện dựa trên mật độ cạnh (Edge detection).
 * @param {Buffer} buffer - Buffer ảnh đầu vào.
 */
export const detectFacesWithEdges = async (buffer) => {
  try {
    const image = sharp(buffer);
    const metadata = await image.metadata();
    const { width, height } = metadata;

    logger.info("[FaceDetect] Đang phân tích mật độ chi tiết cạnh (Edges)...");

    const edgeBuffer = await image.clone().grayscale().normalise().convolve({
      width: 3, height: 3,
      kernel: [-1, -1, -1, -1, 8, -1, -1, -1, -1],
    }).toBuffer({ resolveWithObject: true });

    const gridSize = 6;
    const cellWidth = Math.floor(width / gridSize);
    const cellHeight = Math.floor(height / gridSize);
    const faces = [];

    for (let row = 0; row < gridSize; row++) {
      for (let col = 0; col < gridSize; col++) {
        const x = col * cellWidth;
        const y = row * cellHeight;

        try {
          const region = await sharp(edgeBuffer.data, { raw: edgeBuffer.info }).extract({
            left: x, top: y,
            width: Math.min(cellWidth, width - x),
            height: Math.min(cellHeight, height - y),
          }).stats();

          const edgeDensity = (region.channels?.[0]?.mean || 0) / 255;
          if (edgeDensity > 0.3) {
            faces.push(new FaceRegion(x, y, cellWidth, cellHeight, edgeDensity));
          }
        } catch (err) {}
      }
    }

    const merged = mergeFaceRegions(faces);
    return { faces: merged, method: "edge", imageWidth: width, imageHeight: height };
  } catch (error) {
    logger.warn(`[FaceDetect] Lỗi Edge-based: ${error.message}`);
    return { faces: [], method: "edge", error: error.message };
  }
};

/**
 * Nhận diện khuôn mặt dựa trên tông màu da (Skin-tone) trong không gian màu LAB.
 * @param {Buffer} buffer - Buffer ảnh đầu vào.
 */
export const detectFacesWithSkinTone = async (buffer) => {
  try {
    const image = sharp(buffer);
    const metadata = await image.metadata();
    const { width, height } = metadata;

    logger.info("[FaceDetect] Đang phân tích tông màu da thực tế (Skin-tone)...");

    const labBuffer = await image.clone().toColourspace("lab").raw().toBuffer({ resolveWithObject: true });
    const { data } = labBuffer;
    const faces = [];

    const gridSize = 8;
    const cellWidth = Math.floor(width / gridSize);
    const cellHeight = Math.floor(height / gridSize);

    for (let row = 0; row < gridSize; row++) {
      for (let col = 0; col < gridSize; col++) {
        const x = col * cellWidth;
        const y = row * cellHeight;

        let skinPixels = 0;
        let totalPixels = 0;

        for (let py = y; py < Math.min(y + cellHeight, height); py += 4) {
          for (let px = x; px < Math.min(x + cellWidth, width); px += 4) {
            const idx = (py * width + px) * 3;
            const l = data[idx];
            const a = data[idx + 1];
            const b = data[idx + 2];

            // Tọa độ LAB cho các nhóm màu da người phổ biến
            const isLightSkin = l >= 65 && l <= 95 && a >= 5 && a <= 20 && b >= 10 && b <= 30;
            const isMediumSkin = l >= 45 && l <= 70 && a >= 10 && a <= 30 && b >= 15 && b <= 40;
            const isDarkSkin = l >= 20 && l <= 50 && a >= 5 && a <= 25 && b >= 5 && b <= 30;

            if (isLightSkin || isMediumSkin || isDarkSkin) skinPixels++;
            totalPixels++;
          }
        }

        const skinRatio = totalPixels > 0 ? skinPixels / totalPixels : 0;
        if (skinRatio > 0.2) faces.push(new FaceRegion(x, y, cellWidth, cellHeight, skinRatio));
      }
    }

    const merged = mergeFaceRegions(faces);
    return { faces: merged, method: "skin-tone", imageWidth: width, imageHeight: height };
  } catch (error) {
    logger.warn(`[FaceDetect] Lỗi Skin-tone: ${error.message}`);
    return { faces: [], method: "skin-tone", error: error.message };
  }
};

/**
 * Hợp nhất các vùng phát hiện có sự chồng lấn cao.
 * @private
 */
const mergeFaceRegions = (faces) => {
  if (faces.length === 0) return [];
  const sorted = [...faces].sort((a, b) => b.confidence - a.confidence);
  const merged = [];

  for (const face of sorted) {
    let didMerge = false;
    for (let i = 0; i < merged.length; i++) {
      if (face.overlaps(merged[i], 0.3)) {
        merged[i] = merged[i].merge(face);
        didMerge = true;
        break;
      }
    }
    if (!didMerge) merged.push(face);
  }
  return merged;
};

// ════════════════════════════════════════
// ĐIỀU PHỐI VÀ TÍNH TOÁN CẮT ẢNH (ORCHESTRATION)
// ════════════════════════════════════════

/**
 * Điều phối nhận diện đa phương thức với cơ chế dự phòng (Fallback).
 *
 * @param {Buffer} buffer - Buffer ảnh.
 * @param {string} [preferredMethod="auto"] - Phương pháp ưu tiên.
 * @param {boolean} [aggressiveDetection=false] - Chế độ nhận diện mạnh mẽ (tốn tài nguyên hơn).
 * @param {boolean} [isAnime=false] - Cờ nội dung Anime.
 * @returns {Promise<Object>} Kết quả nhận diện tốt nhất tìm được.
 */
export const detectFaces = async (
  buffer,
  preferredMethod = "auto",
  aggressiveDetection = false,
  isAnime = false,
) => {
  const methods = {
    anime: (buf) => detectAnimeFaces(buf, true),
    attention: detectFacesWithAttention,
    edge: detectFacesWithEdges,
    "skin-tone": detectFacesWithSkinTone,
  };

  if (preferredMethod === "auto") {
    const methodNames = isAnime
      ? ["anime", "attention", "edge"]
      : ["attention", "edge", "skin-tone"];

    for (let i = 0; i < methodNames.length; i++) {
      const methodName = methodNames[i];
      const fn = methods[methodName];

      try {
        const result = await fn(buffer);
        if (result.faces && result.faces.length > 0) {
          logger.info(`[FaceDetect] Thành công bằng ${methodName} (${result.faces.length} vùng)`);
          return result;
        }

        // Tối ưu: Nếu phương pháp đầu tiên thất bại và không ở chế độ "aggressive", dừng để tránh quá tải.
        if (i === 0 && (!result.faces || result.faces.length === 0) && !aggressiveDetection) {
          logger.info(`[FaceDetect] Không tìm thấy vùng quan trọng bằng ${methodName}. Kết thúc tìm kiếm sớm.`);
          return { faces: [], method: methodName, skippedMethods: methodNames.slice(i + 1) };
        }
      } catch (error) {
        logger.warn(`[FaceDetect] Phương pháp ${methodName} thất bại: ${error.message}`);
      }
    }
    return { faces: [], method: "none" };
  }

  const fn = methods[preferredMethod];
  if (!fn) throw new Error(`Phương pháp nhận diện không hợp lệ: ${preferredMethod}`);
  return await fn(buffer);
};

/**
 * Tính toán tọa độ cắt tối ưu (Crop coordinates) cho Banner.
 *
 * @param {FaceRegion[]} faces - Danh sách vùng mặt đã nhận diện.
 * @param {number} imageWidth - Chiều rộng gốc.
 * @param {number} imageHeight - Chiều cao gốc.
 * @param {number} targetRatio - Tỷ lệ khung hình đích.
 * @returns {Object} Thông tin tọa độ cắt và mức độ bao phủ khuôn mặt.
 */
export const calculateBannerCrop = (faces, imageWidth, imageHeight, targetRatio) => {
  const targetWidth = imageWidth;
  const targetHeight = Math.round(imageWidth / targetRatio);

  if (faces.length === 0) {
    logger.info("[FaceDetect] Không tìm thấy chủ thể, thực hiện cắt giữa (Center Crop).");
    return {
      left: 0,
      top: Math.max(0, Math.floor((imageHeight - targetHeight) / 2)),
      width: targetWidth,
      height: Math.min(targetHeight, imageHeight),
      strategy: "center",
      facesIncluded: 0,
    };
  }

  // Tính toán khung bao phủ toàn bộ các chủ thể
  const minX = Math.min(...faces.map(f => f.x));
  const minY = Math.min(...faces.map(f => f.y));
  const maxX = Math.max(...faces.map(f => f.x + f.width));
  const maxY = Math.max(...faces.map(f => f.y + f.height));

  const facesBBox = {
    x: minX, y: minY, width: maxX - minX, height: maxY - minY,
    centerX: (minX + maxX) / 2, centerY: (minY + maxY) / 2,
  };

  const facePositionInCrop = 0.4; // Đặt chủ thể ở vị trí 40% chiều dọc để chừa chỗ cho bối cảnh bên trên.
  let cropY = Math.round(facesBBox.centerY - targetHeight * facePositionInCrop);
  cropY = Math.max(0, Math.min(cropY, imageHeight - targetHeight));

  // Kiểm soát để không cắt mất phần đầu hoặc chân của nhóm chủ thể
  const faceTop = facesBBox.y;
  const faceBottom = facesBBox.y + facesBBox.height;
  const cropBottom = cropY + targetHeight;

  if (faceTop < cropY) cropY = Math.max(0, faceTop - 20);
  if (faceBottom > cropBottom) cropY = Math.min(imageHeight - targetHeight, Math.round(faceBottom - targetHeight + 20));

  cropY = Math.max(0, Math.min(cropY, imageHeight - targetHeight));

  const cropRegion = {
    left: 0, top: Math.round(cropY),
    width: Math.round(targetWidth),
    height: Math.round(Math.min(targetHeight, imageHeight - cropY)),
  };

  // Đếm số lượng khuôn mặt được bảo vệ trong khung hình mới
  const facesIncluded = faces.filter(face => {
    const overlapTop = Math.max(face.y, cropY);
    const overlapBottom = Math.min(face.y + face.height, cropY + cropRegion.height);
    const overlapHeight = Math.max(0, overlapBottom - overlapTop);
    return (overlapHeight / face.height) >= 0.5;
  }).length;

  return {
    ...cropRegion, strategy: "face-aware", facesIncluded, totalFaces: faces.length,
    facesCoverage: faces.length > 0 ? facesIncluded / faces.length : 0,
  };
};

/**
 * Điểm vào chính thực hiện cắt Banner thông minh.
 *
 * @param {Buffer} buffer - Buffer ảnh gốc.
 * @param {{width: number, height: number}} targetAspectRatio - Tỷ lệ khung hình đích.
 * @param {Object} [options] - Cấu hình loại ảnh.
 */
export const smartBannerCrop = async (buffer, targetAspectRatio, options = {}) => {
  const { isAnime = false } = options;

  try {
    if (!targetAspectRatio || typeof targetAspectRatio.width !== "number" || typeof targetAspectRatio.height !== "number") {
      throw new Error("Tỷ lệ khung hình đích không hợp lệ.");
    }

    const metadata = await sharp(buffer).metadata();
    const { width, height } = metadata;

    if (!width || !height) throw new Error("Không thể đọc kích thước ảnh.");

    const targetRatio = targetAspectRatio.width / targetAspectRatio.height;
    const currentRatio = width / height;

    // Nếu ảnh đã đúng tỷ lệ, bỏ qua bước xử lý AI để tối ưu
    if (Math.abs(currentRatio - targetRatio) < 0.02) {
      return { buffer, cropInfo: { strategy: "none", facesIncluded: 0, totalFaces: 0 } };
    }

    const detection = await detectFaces(buffer, "auto", FACE_DETECTION_CONFIG.aggressiveDetection, isAnime);
    const cropRegion = calculateBannerCrop(detection.faces, width, height, targetRatio);

    const croppedBuffer = await sharp(buffer).extract({
      left: cropRegion.left, top: cropRegion.top,
      width: cropRegion.width, height: cropRegion.height,
    }).toBuffer();

    return {
      buffer: croppedBuffer,
      cropInfo: { ...cropRegion, detectionMethod: detection.method, originalSize: { width, height } },
    };
  } catch (error) {
    logger.error(`[FaceDetect] Cắt ảnh thông minh thất bại: ${error.message}`);
    throw error;
  }
};

export default {
  detectFaces, detectAnimeFaces, detectFacesWithAttention,
  detectFacesWithEdges, detectFacesWithSkinTone,
  calculateBannerCrop, smartBannerCrop, FACE_DETECTION_CONFIG,
};

