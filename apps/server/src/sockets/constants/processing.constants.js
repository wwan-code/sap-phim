/**
 * @file processing.constants.js
 * @module Sockets_Constants
 * @description Định nghĩa các hằng số liên quan đến tiến trình xử lý video/audio
 */

/**
 * Nhãn hiển thị cho các giai đoạn xử lý Video
 */
export const PROCESSING_STAGE_LABELS = {
  analyzing: "Đang phân tích video",
  transcoding_video: "Đang mã hóa HLS Video",
  transcoding_audio: "Đang mã hóa Audio",
  thumbnails_sprites: "Đang tạo Thumbnail & Sprite",
  finalizing: "Đang hoàn thiện...",
};

/**
 * Khoảng tỷ lệ phần trăm tiến độ tương ứng với từng giai đoạn
 */
export const PROCESSING_STAGE_RANGES = {
  analyzing: { min: 0, max: 2 },
  transcoding_video: { min: 2, max: 75 },
  transcoding_audio: { min: 75, max: 85 },
  thumbnails_sprites: { min: 85, max: 95 },
  finalizing: { min: 95, max: 100 },
};
