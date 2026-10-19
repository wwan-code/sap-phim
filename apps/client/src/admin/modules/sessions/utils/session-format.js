/**
 * @file session-format.js
 * @module Admin/Sessions/Utils
 * @description Các hàm tiện ích định dạng hiển thị thông tin thiết bị và phiên đăng nhập.
 */

/**
 * Định dạng tên trình duyệt từ chuỗi hoặc đối tượng { name, major, version }
 * @param {Object|string|null} browser
 * @returns {string}
 */
export const formatBrowserName = (browser) => {
  if (!browser) return 'Trình duyệt';
  if (typeof browser === 'string') return browser;
  if (typeof browser === 'object') {
    const parts = [browser.name, browser.major || browser.version].filter(Boolean);
    return parts.length > 0 ? parts.join(' ') : 'Trình duyệt';
  }
  return 'Trình duyệt';
};

/**
 * Định dạng tên hệ điều hành từ chuỗi hoặc đối tượng { name, version }
 * @param {Object|string|null} os
 * @returns {string}
 */
export const formatOsName = (os) => {
  if (!os) return 'Hệ điều hành';
  if (typeof os === 'string') return os;
  if (typeof os === 'object') {
    const parts = [os.name, os.version].filter(Boolean);
    return parts.length > 0 ? parts.join(' ') : 'Hệ điều hành';
  }
  return 'Hệ điều hành';
};

/**
 * Định dạng chuỗi hiển thị Thiết bị / OS
 * @param {Object|null} deviceInfo
 * @param {string} separator
 * @returns {string}
 */
export const formatDeviceDisplay = (deviceInfo, separator = ' / ') => {
  if (!deviceInfo) return `Trình duyệt${separator}Hệ điều hành`;
  const browser = formatBrowserName(deviceInfo.browser);
  const os = formatOsName(deviceInfo.os);
  return `${browser}${separator}${os}`;
};

/**
 * Xác định phân loại thiết bị (mobile, tablet, desktop)
 * @param {Object|null} deviceInfo
 * @returns {'mobile' | 'tablet' | 'desktop'}
 */
export const getDeviceCategory = (deviceInfo) => {
  if (!deviceInfo) return 'desktop';
  const type = deviceInfo.type || deviceInfo.device?.type || '';
  if (type === 'mobile') return 'mobile';
  if (type === 'tablet') return 'tablet';
  return 'desktop';
};
