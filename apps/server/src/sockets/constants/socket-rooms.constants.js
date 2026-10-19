/**
 * @file socket-rooms.constants.js
 * @module Sockets_Constants
 * @description Định nghĩa các cấu trúc tên room cho Socket.IO.
 * Tất cả room names PHẢI đi qua các hàm này để đảm bảo nhất quán.
 */

export const SOCKET_ROOMS = {
  /** Room cá nhân user — nhận notification, force logout */
  user: (userId) => `user:${userId}`,

  /** Room admin — nhận thông báo quản trị */
  admin: () => 'role:admin',

  /** Room theo dõi tiến độ Job */
  job: (jobId) => `job:${jobId}`,

  /** Room broadcast toàn hệ thống */
  broadcast: () => 'broadcast:all',

  /** Room theo dõi tiến độ xử lý của Episode dành cho Admin */
  adminEpisode: (episodeId) => `admin:episode:${episodeId}`,

  /** Room theo dõi lịch phát sóng theo phim */
  broadcastMovie: (movieId) => `broadcast:movie:${movieId}`,
};
