/**
 * @file cache.constant.js
 * @module Constants_Cache
 * @description Cache TTL values and Redis key prefixes used across the backend.
 */

/**
 * Thời gian sống của dữ liệu trong Cache (TTL)
 */
export const CACHE_TTL = Object.freeze({
  TICK: 5, // Tín hiệu duy trì (Heartbeat), dữ liệu thay đổi liên tục
  FAST: 60, // 1 phút
  MOMENT: 300, // 5 phút
  STANDARD: 3600, // 1 giờ
  SESSION: 7200, // 2 giờ
  LONG: 86400, // 1 ngày
  STABLE: 604800, // 1 tuần
  PERMANENT: 2592000, // 30 ngày (Dữ liệu tĩnh)

  AUTH_TOKEN: 604800, // 7 ngày (Refresh Token)
  OTP: 300, // 5 phút (Mã xác thực một lần)
  PROGRESS: 86400, // 24 giờ (Tiến trình xem phim)
  STATS: 1800, // 30 phút (Số liệu thống kê)
});

/**
 * Tiền tố của các khóa trong Cache (Key Prefixes)
 */
export const CACHE_PREFIX = Object.freeze({
  USER: "u:", // Thông tin người dùng
  MOVIE: "m:", // Dữ liệu phim
  LIST: "l:", // Danh sách phim
  WATCH_HISTORY: "wh:", // Lịch sử xem
  TOKEN_BLACKLIST: "bl:", // Danh sách Token bị thu hồi
  ADMIN_LOGS: "al:", // Nhật ký quản trị
});


