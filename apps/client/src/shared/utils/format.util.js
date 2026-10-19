/**
 * @file format.util.js
 * @module Utils/FormatUtil
 * @description Hàm định dạng dữ liệu hiển thị (Tiền tệ, Ngày tháng, Thời gian, Dung lượng).
 */

/**
 * Định dạng số thành chuỗi tiền tệ (mặc định là VNĐ)
 * 
 * @param {number} amount - Số tiền cần định dạng
 * @param {string} [locale="vi-VN"] - Mã ngôn ngữ
 * @param {string} [currency="VND"] - Mã tiền tệ
 * @returns {string} Chuỗi tiền tệ đã định dạng (VD: "199.000 ₫")
 */
export const formatCurrency = (amount, locale = "vi-VN", currency = "VND") => {
  if (amount === undefined || amount === null) return "0 ₫";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currency,
  }).format(amount);
};

/**
 * Định dạng ngày giờ đầy đủ
 * 
 * @param {string|Date} dateString - Chuỗi ngày hoặc đối tượng Date
 * @param {string} [locale="vi-VN"] - Mã ngôn ngữ
 * @returns {string} Chuỗi ngày giờ (VD: "01/05/2026, 13:26")
 */
export const formatDateTime = (dateString, locale = "vi-VN") => {
  if (!dateString) return "";
  try {
    return new Intl.DateTimeFormat(locale, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(dateString));
  } catch (e) {
    return String(dateString);
  }
};

/**
 * Định dạng chỉ giờ phút (HH:mm)
 * 
 * @param {string|Date} dateString - Chuỗi ngày hoặc đối tượng Date
 * @returns {string} Chuỗi giờ phút (VD: "13:26")
 */
export const formatTimeHHmm = (dateString) => {
  if (!dateString) return "";
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return String(dateString);
  return d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", hour12: false });
};

/**
 * Định dạng giờ phút và ngày ngắn gọn (HH:mm DD/MM)
 * 
 * @param {string|Date} dateString - Chuỗi ngày hoặc đối tượng Date
 * @returns {string} Chuỗi giờ phút ngày (VD: "13:26 01/05")
 */
export const formatShortDateTime = (dateString) => {
  if (!dateString) return "";
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return String(dateString);
  
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const DD = String(d.getDate()).padStart(2, "0");
  const MM = String(d.getMonth() + 1).padStart(2, "0");
  
  return `${hh}:${mm} ${DD}/${MM}`;
};

/**
 * Định dạng thời gian (giây) sang dạng h:m:s
 * 
 * @param {number} seconds - Tổng số giây
 * @returns {string} Chuỗi thời gian (VD: "1h30m45s")
 */
export const formatTime = (seconds) => {
  if (!seconds || seconds < 0) return "0s";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  const parts = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0 || hours > 0) parts.push(`${minutes}m`);
  parts.push(`${secs}s`);

  return parts.join("");
};

/**
 * Định dạng ngày (không kèm giờ)
 * 
 * @param {string|Date} dateString - Chuỗi ngày hoặc đối tượng Date
 * @param {string} [locale="vi-VN"] - Mã ngôn ngữ
 * @returns {string} Chuỗi ngày (VD: "01/05/2026")
 */
export const formatDate = (dateString, locale = "vi-VN") => {
  if (!dateString) return "";
  try {
    return new Intl.DateTimeFormat(locale, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(dateString));
  } catch (e) {
    return String(dateString);
  }
};

/**
 * Định dạng khoảng cách thời gian từ quá khứ đến hiện tại (Rút gọn)
 * 
 * @param {string|Date} dateStr - Mốc thời gian quá khứ
 * @returns {string} Chuỗi mô tả (VD: "5 phút trước")
 */
export const formatTimeAgo = (dateStr) => {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const now = Date.now();
  const diff = now - d.getTime();

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (minutes < 1) return "Vừa xong";
  if (minutes < 60) return `${minutes} phút trước`;
  if (hours < 24) return `${hours} giờ trước`;
  if (days < 7) return `${days} ngày trước`;

  return d.toLocaleDateString("vi-VN");
};

/**
 * Tính khoảng cách thời gian chi tiết đến hiện tại
 * 
 * @param {Date|string|number} date - Mốc thời gian
 * @param {Object} [options={}] - Tùy chọn
 * @param {boolean} [options.addSuffix=true] - Thêm hậu tố "trước"
 * @returns {string} Chuỗi mô tả khoảng cách thời gian
 */
export const formatDistanceToNow = (date, options = {}) => {
  const { addSuffix = true } = options;
  if (!date) return "";

  const d = new Date(date);
  if (isNaN(d.getTime())) return "";

  const now = new Date();
  const diffInSeconds = Math.floor((now - d) / 1000);

  if (diffInSeconds < 0) return "Trong tương lai";
  if (diffInSeconds < 60) return "Vừa xong";

  const suffix = addSuffix ? " trước" : "";
  const minutes = Math.floor(diffInSeconds / 60);

  if (minutes < 60) return `${minutes} phút${suffix}`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} giờ${suffix}`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} ngày${suffix}`;

  const months = Math.floor(days / 30);
  if (months < 12) return `${months} tháng${suffix}`;

  const years = Math.floor(days / 365);
  return `${years} năm${suffix}`;
};

/**
 * Định dạng số thành dạng rút gọn (K, M)
 * 
 * @param {number} n - Số cần định dạng
 * @returns {string|null} Chuỗi rút gọn (VD: 1.2K, 1M)
 */
export const formatCount = (n) => {
  if (n === undefined || n === null || n < 0) return null;
  if (n === 0) return "0";
  if (n >= 1_000_000)
    return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return String(n);
};

export default {
  formatCurrency,
  formatDateTime,
  formatTime,
  formatDate,
  formatTimeAgo,
  formatDistanceToNow,
  formatCount,
  formatTimeHHmm,
  formatShortDateTime,
};
