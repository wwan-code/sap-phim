/**
 * @file format-time.js
 * @module Components/VideoPlayer/Utils
 * @description Các hàm tiện ích định dạng thời gian phát video và hỗ trợ đọc cho Accessibility (a11y).
 */

/**
 * Định dạng số giây thành chuỗi thời gian hiển thị (MM:SS hoặc H:MM:SS)
 * @param {number} seconds - Số giây
 * @returns {string} Chuỗi thời gian
 */
export function formatTime(seconds) {
  if (typeof seconds !== 'number' || isNaN(seconds) || !isFinite(seconds) || seconds < 0) {
    return '00:00';
  }

  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;

  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

/**
 * Định dạng số giây thành chuỗi tiếng Việt rõ ràng cho trình đọc màn hình (Screen Reader)
 * @param {number} seconds - Số giây
 * @returns {string} Chuỗi mô tả thời gian
 */
export function formatAriaTime(seconds) {
  if (typeof seconds !== 'number' || isNaN(seconds) || !isFinite(seconds) || seconds < 0) {
    return '0 giây';
  }

  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;

  const parts = [];
  if (h > 0) parts.push(`${h} giờ`);
  if (m > 0) parts.push(`${m} phút`);
  if (s > 0 || parts.length === 0) parts.push(`${s} giây`);

  return parts.join(' ');
}

export default formatTime;
