/**
 * @file file-upload-zone.util.js
 * @module Components/UI/FileUploadZone/Utils
 * @description Các hàm tiện ích xử lý định dạng tệp, xác thực MIME, phân loại tệp và tính toán dung lượng cho FileUploadZone.
 */

/**
 * Định dạng dung lượng byte sang chuỗi hiển thị dễ đọc (B, KB, MB, GB).
 *
 * @param {number} bytes - Kích thước tệp tính bằng bytes.
 * @param {number} [decimals=1] - Số chữ số sau dấu phẩy.
 * @returns {string} Chuỗi định dạng dung lượng (ví dụ: "2.4 MB").
 */
export const formatFileSize = (bytes, decimals = 1) => {
  if (typeof bytes !== 'number' || isNaN(bytes) || bytes <= 0) {
    return '0 B';
  }

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const safeIndex = Math.min(i, sizes.length - 1);

  return `${parseFloat((bytes / Math.pow(k, safeIndex)).toFixed(dm))} ${sizes[safeIndex]}`;
};

/**
 * Xác thực tệp theo chuỗi định dạng chấp nhận (MIME types hoặc phần mở rộng mở rộng).
 *
 * @param {File} file - Đối tượng tệp cần xác thực.
 * @param {string} [accept] - Chuỗi quy tắc accept (ví dụ: "image/*,.pdf,video/mp4").
 * @returns {boolean} True nếu tệp hợp lệ, False nếu không khớp quy tắc.
 */
export const validateFileType = (file, accept) => {
  if (!accept || typeof accept !== 'string') {
    return true;
  }

  const rules = accept
    .split(',')
    .map((rule) => rule.trim().toLowerCase())
    .filter(Boolean);

  if (rules.length === 0) {
    return true;
  }

  const fileType = (file.type || '').toLowerCase();
  const fileName = (file.name || '').toLowerCase();

  return rules.some((rule) => {
    if (rule.startsWith('.')) {
      return fileName.endsWith(rule);
    }

    if (rule.endsWith('/*')) {
      const baseType = rule.slice(0, -2);
      return fileType.startsWith(`${baseType}/`);
    }

    return fileType === rule;
  });
};

/**
 * Phân loại tệp ngữ nghĩa để hiển thị biểu tượng phù hợp.
 *
 * @param {File|object} file - Đối tượng tệp hoặc thông tin tệp.
 * @returns {'image'|'video'|'audio'|'code'|'archive'|'spreadsheet'|'text'|'generic'} Phân loại tệp.
 */
export const getFileCategory = (file) => {
  if (!file) return 'generic';

  const type = (file.type || '').toLowerCase();
  const name = (file.name || '').toLowerCase();

  if (type.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|svg|avif|bmp|ico)$/.test(name)) {
    return 'image';
  }

  if (type.startsWith('video/') || /\.(mp4|mkv|webm|mov|avi|flv|wmv)$/.test(name)) {
    return 'video';
  }

  if (type.startsWith('audio/') || /\.(mp3|wav|ogg|flac|m4a|aac)$/.test(name)) {
    return 'audio';
  }

  if (
    type.includes('zip') ||
    type.includes('compressed') ||
    type.includes('tar') ||
    type.includes('rar') ||
    type.includes('7z') ||
    /\.(zip|rar|7z|tar|gz|bz2)$/.test(name)
  ) {
    return 'archive';
  }

  if (
    type.includes('spreadsheet') ||
    type.includes('excel') ||
    type.includes('csv') ||
    /\.(xls|xlsx|csv)$/.test(name)
  ) {
    return 'spreadsheet';
  }

  if (
    type.includes('javascript') ||
    type.includes('json') ||
    type.includes('html') ||
    type.includes('css') ||
    type.includes('typescript') ||
    /\.(js|jsx|ts|tsx|json|html|css|scss|md|py|sh|sql)$/.test(name)
  ) {
    return 'code';
  }

  if (
    type.startsWith('text/') ||
    type.includes('pdf') ||
    type.includes('word') ||
    type.includes('document') ||
    /\.(pdf|doc|docx|txt|rtf)$/.test(name)
  ) {
    return 'text';
  }

  return 'generic';
};

/**
 * Chuẩn hóa giá trị Aspect Ratio cho CSS và Component.
 *
 * @param {string|number|null} aspectRatio - Giá trị truyền vào (16/9, "16/9", "16:9", 1.77).
 * @returns {string|undefined} Giá trị CSS aspect-ratio hợp lệ.
 */
export const normalizeAspectRatio = (aspectRatio) => {
  if (!aspectRatio) return undefined;

  if (typeof aspectRatio === 'number') {
    return `${aspectRatio}`;
  }

  if (typeof aspectRatio === 'string') {
    return aspectRatio.replace(':', '/');
  }

  return undefined;
};
