/**
 * @file notification.constants.js
 * @module Constants/Notification
 * @description Định nghĩa các hằng số loại thông báo, đối tượng liên quan, mức độ ưu tiên và icon tương ứng trên Client.
 */

/**
 * Các loại thông báo trong hệ thống
 */
export const NOTIFICATION_TYPES = {
  // Mạng xã hội (Social)
  NEW_FOLLOWER: 'new_follower',
  COMMENT_REPLY: 'comment_reply',
  COMMENT_LIKE: 'comment_like',
  COMMENT_MENTION: 'comment_mention',
  COMMENT_REJECTED: 'comment_rejected',

  // Bạn bè (Friend)
  FRIEND_REQUEST_RECEIVED: 'friend_request_received',
  FRIEND_REQUEST_ACCEPTED: 'friend_request_accepted',

  // Phim (Movie)
  MOVIE_NEW: 'movie_new',
  MOVIE_UPDATE: 'movie_update',
  MOVIE_NEW_EPISODE: 'movie_new_episode',

  // Hệ thống (System)
  SYSTEM: 'system',
  ADMIN: 'admin',
  WELCOME: 'welcome',
  ACCOUNT_SECURITY: 'account_security',

  // Gói cước (Subscription)
  SUBSCRIPTION_EXPIRED: 'subscription_expired',
  SUBSCRIPTION_EXPIRING: 'subscription_expiring',

  // Thanh toán (Payment)
  PAYMENT_REQUEST_PENDING: 'payment_request_pending',
  PAYMENT_APPROVED: 'payment_approved',
  PAYMENT_REJECTED: 'payment_rejected',
  PAYMENT_REFUNDED: 'payment_refunded',
};

/**
 * Danh sách giá trị hợp lệ của loại thông báo
 */
export const NOTIFICATION_TYPE_VALUES = Object.values(NOTIFICATION_TYPES);

/**
 * Các loại thực thể có thể gắn kèm thông báo
 */
export const ENTITY_TYPES = {
  MOVIE: 'movie',
  USER: 'user',
  COMMENT: 'comment',
  EPISODE: 'episode',
  SUBSCRIPTION: 'subscription',
  PAYMENT_REQUEST: 'payment_request',
};

/**
 * Danh sách thực thể hợp lệ
 */
export const ENTITY_TYPE_VALUES = Object.values(ENTITY_TYPES);

/**
 * Mức độ ưu tiên của thông báo
 */
export const NOTIFICATION_PRIORITY = {
  LOW: 'low',
  NORMAL: 'normal',
  HIGH: 'high',
  CRITICAL: 'critical',
};

/**
 * Danh sách mức độ ưu tiên hợp lệ
 */
export const NOTIFICATION_PRIORITY_VALUES = Object.values(NOTIFICATION_PRIORITY);

/**
 * Bản đồ icon tương ứng cho từng loại thông báo
 */
export const NOTIFICATION_TYPE_ICONS = {
  [NOTIFICATION_TYPES.NEW_FOLLOWER]: '👤',
  [NOTIFICATION_TYPES.COMMENT_REPLY]: '💬',
  [NOTIFICATION_TYPES.COMMENT_LIKE]: '❤️',
  [NOTIFICATION_TYPES.COMMENT_MENTION]: '📢',
  [NOTIFICATION_TYPES.COMMENT_REJECTED]: '🚫',
  [NOTIFICATION_TYPES.FRIEND_REQUEST_RECEIVED]: '👤',
  [NOTIFICATION_TYPES.FRIEND_REQUEST_ACCEPTED]: '🤝',
  [NOTIFICATION_TYPES.MOVIE_NEW]: '🎥',
  [NOTIFICATION_TYPES.MOVIE_UPDATE]: '🔄',
  [NOTIFICATION_TYPES.MOVIE_NEW_EPISODE]: '📺',
  [NOTIFICATION_TYPES.SYSTEM]: '🔔',
  [NOTIFICATION_TYPES.ADMIN]: '📣',
  [NOTIFICATION_TYPES.WELCOME]: '🎉',
  [NOTIFICATION_TYPES.ACCOUNT_SECURITY]: '🔒',
  [NOTIFICATION_TYPES.PAYMENT_REQUEST_PENDING]: '💳',
  [NOTIFICATION_TYPES.PAYMENT_APPROVED]: '💰',
  [NOTIFICATION_TYPES.PAYMENT_REJECTED]: '❌',
  [NOTIFICATION_TYPES.PAYMENT_REFUNDED]: '💸',
  [NOTIFICATION_TYPES.SUBSCRIPTION_EXPIRED]: '⌛',
  [NOTIFICATION_TYPES.SUBSCRIPTION_EXPIRING]: '⚠️',
};

export default {
  NOTIFICATION_TYPES,
  NOTIFICATION_TYPE_VALUES,
  ENTITY_TYPES,
  ENTITY_TYPE_VALUES,
  NOTIFICATION_PRIORITY,
  NOTIFICATION_PRIORITY_VALUES,
  NOTIFICATION_TYPE_ICONS,
};
