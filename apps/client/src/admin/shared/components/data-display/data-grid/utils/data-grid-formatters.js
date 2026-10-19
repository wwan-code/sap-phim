/**
 * @file data-grid-formatters.js
 * @module Admin/Shared/Components/DataDisplay/DataGrid/Utils/Formatters
 * @description Các hàm tiện ích định dạng dữ liệu mặc định (Số, Tiền tệ, Ngày tháng, Dung lượng...) cho DataGrid.
 */

/**
 * Định dạng số nguyên hoặc số thực theo chuẩn Tiếng Việt (1.000.000)
 * @param {number|string} val - Giá trị số
 * @param {number} [decimals=0] - Số chữ số sau dấu thập phân
 * @returns {string}
 */
export const formatNumber = (val, decimals = 0) => {
  if (val === null || val === undefined || val === '') return '—';
  const num = Number(val);
  if (Number.isNaN(num)) return String(val);
  return new Intl.NumberFormat('vi-VN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num);
};

/**
 * Định dạng tiền tệ VND (100.000 ₫)
 * @param {number|string} val - Giá trị tiền tệ
 * @returns {string}
 */
export const formatCurrency = (val) => {
  if (val === null || val === undefined || val === '') return '—';
  const num = Number(val);
  if (Number.isNaN(num)) return String(val);
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
  }).format(num);
};

/**
 * Định dạng ngày tháng năm (dd/MM/yyyy hoặc dd/MM/yyyy HH:mm)
 * @param {string|number|Date} dateVal - Giá trị ngày tháng
 * @param {boolean} [includeTime=false] - Kèm theo giờ phút
 * @returns {string}
 */
export const formatDate = (dateVal, includeTime = false) => {
  if (!dateVal) return '—';
  try {
    const d = new Date(dateVal);
    if (Number.isNaN(d.getTime())) return String(dateVal);

    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();

    if (!includeTime) {
      return `${day}/${month}/${year}`;
    }

    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  } catch {
    return String(dateVal);
  }
};

/**
 * Định dạng dung lượng tệp tin (KB, MB, GB)
 * @param {number} bytes - Kích thước tính theo byte
 * @returns {string}
 */
export const formatFileSize = (bytes) => {
  if (bytes === null || bytes === undefined || Number.isNaN(bytes)) return '—';
  const numBytes = Number(bytes);
  if (numBytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(numBytes) / Math.log(k));
  return `${parseFloat((numBytes / (k ** i)).toFixed(1))} ${sizes[i]}`;
};

/**
 * Định dạng phần trăm (98.5%)
 * @param {number} val - Giá trị thập phân (0.985) hoặc phần trăm (98.5)
 * @param {boolean} [isFraction=true] - Nếu true, 0.5 sẽ thành 50%
 * @returns {string}
 */
export const formatPercent = (val, isFraction = true) => {
  if (val === null || val === undefined || val === '') return '—';
  const num = Number(val);
  if (Number.isNaN(num)) return String(val);
  const percent = isFraction ? num * 100 : num;
  return `${percent.toFixed(1)}%`;
};
