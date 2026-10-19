/**
 * @file edit-media-modal.constants.js
 * @module Components/Common/EditMediaModal/EditMediaModalConstants
 * @description Định nghĩa các hằng số cấu hình, giới hạn zoom, presets tỷ lệ và options mặc định cho EditMediaModal.
 */

/** Giới hạn zoom */
export const ZOOM_LIMITS = Object.freeze({
  MIN: 1,
  MAX: 3,
  STEP: 0.1,
});

/** Bước nhảy khi dùng phím tắt bàn phím */
export const KEYBOARD_STEP = 0.1;

/** Presets tỷ lệ khung hình */
export const ASPECT_RATIO_PRESETS = Object.freeze({
  SQUARE: 1,
  BANNER: 16 / 9,
  POSTER: 2 / 3,
  FREE: null,
});

/** Cấu hình xuất file mặc định */
export const DEFAULT_MEDIA_OPTIONS = Object.freeze({
  outputType: 'image/jpeg',
  quality: 0.92,
  filename: 'cropped-image.jpeg',
  aspectRatio: 1,
});

/** Hằng số tương thích ngược */
export const EDIT_MEDIA_CONSTANTS = Object.freeze({
  ZOOM_MIN: ZOOM_LIMITS.MIN,
  ZOOM_MAX: ZOOM_LIMITS.MAX,
  ZOOM_STEP: ZOOM_LIMITS.STEP,
  DEFAULT_ASPECT_RATIO: DEFAULT_MEDIA_OPTIONS.aspectRatio,
  DEFAULT_OUTPUT_TYPE: DEFAULT_MEDIA_OPTIONS.outputType,
  DEFAULT_OUTPUT_QUALITY: DEFAULT_MEDIA_OPTIONS.quality,
  DEFAULT_FILENAME: DEFAULT_MEDIA_OPTIONS.filename,
});
