/**
 * @file file-upload-zone.constants.js
 * @module Components/UI/FileUploadZone/Constants
 * @description Định nghĩa các hằng số, cấu hình mặc định, variants, sizes và trạng thái cho FileUploadZone.
 */

/**
 * Các biến thể layout hiển thị của FileUploadZone
 */
export const FILE_UPLOAD_VARIANTS = Object.freeze({
  STANDARD: 'standard',
  COMPACT: 'compact',
  AVATAR: 'avatar',
});

/**
 * Các kích thước chuẩn của FileUploadZone
 */
export const FILE_UPLOAD_SIZES = Object.freeze({
  SMALL: 'small',
  MEDIUM: 'medium',
  LARGE: 'large',
});

/**
 * Các trạng thái vận hành của FileUploadZone
 */
export const FILE_UPLOAD_STATUS = Object.freeze({
  IDLE: 'idle',
  UPLOADING: 'uploading',
  SUCCESS: 'success',
  ERROR: 'error',
});

/**
 * Kích thước tệp tối đa mặc định (10 MB tính theo bytes)
 */
export const DEFAULT_MAX_FILE_SIZE = 10 * 1024 * 1024;

/**
 * Giới hạn số lượng tệp tối đa mặc định khi multiple = true
 */
export const DEFAULT_MAX_FILES = 10;

/**
 * Tỷ lệ khung hình mặc định khi không chỉ định
 */
export const DEFAULT_ASPECT_RATIO = null;

/**
 * Mapping kích thước icon tương ứng theo size prop
 */
export const ICON_SIZE_MAP = Object.freeze({
  small: 24,
  medium: 32,
  large: 40,
  avatar: 28,
});
