/**
 * @file socket-rooms.constants.js
 * @module Constants/SocketRooms
 * @description Định nghĩa các cấu trúc tên Room Socket.IO đồng bộ với Backend.
 */

export const SOCKET_ROOMS = {
  /** Room cá nhân user — nhận notification, force logout, permissions update */
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

export default SOCKET_ROOMS;
