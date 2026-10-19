/**
 * @file socket-events.constants.js
 * @module Sockets_Constants
 * @description Định nghĩa tất cả các event names, error codes, và cấu hình
 * được sử dụng trong hệ thống Socket.IO.
 */

export const SOCKET_EVENTS = {
  // ── Connection Lifecycle ──────────────────
  CONNECT:             'connect',
  DISCONNECT:          'disconnect',
  CONNECT_ERROR:       'connect_error',
  ERROR:               'error',

  // ── Authentication ────────────────────────
  AUTH_SUCCESS:        'auth:success',
  AUTH_ERROR:          'auth:error',
  AUTH_GUEST:          'auth:guest',
  FORCE_LOGOUT:        'auth:force_logout',
  TOKEN_REFRESH:       'auth:token_refresh',
  PERMISSIONS_UPDATED: 'auth:permissions_updated',

  // ── System ────────────────────────────────
  WELCOME:             'system:welcome',
  SERVER_ERROR:        'server:error',
  HEARTBEAT:           'heartbeat',
  HEARTBEAT_ACK:       'heartbeat:ack',

  // ── Presence (Trạng thái Online) ──────────
  USER_ONLINE:         'presence:online',
  USER_OFFLINE:        'presence:offline',
  PRESENCE_QUERY:      'presence:query',
  PRESENCE_SYNC:       'presence:sync',

  // ── Notification ──────────────────────────
  NOTIFICATION_NEW:    'notification:new',
  NOTIFICATION_READ:   'notification:read',
  NOTIFICATION_UNREAD: 'notification:unread',
  NOTIFICATION_COUNT:  'notification:count',
  NOTIFICATION_DELETED: 'notification:deleted',
  NOTIFICATION_ALL_READ: 'notification:all_read',
  NOTIFICATION_ALL_DELETED: 'notification:all_deleted',
  NOTIFICATION_STATS:  'notification:stats',
  ADMIN_NOTIFICATION:  'admin:notification',
  USER_LEVEL_UPDATED:  'user:level_updated',

  // ── Financial & Payment ────────────────────
  WALLET_BALANCE_UPDATED: 'wallet:balance_updated',
  WALLET_LOCKED:          'wallet:locked',
  PAYMENT_STATUS_CHANGED: 'payment:status_changed',
  PAYMENT_EXPIRED:        'payment:expired',
  SUBSCRIPTION_UPDATED:   'subscription:updated',
  SUBSCRIPTION_EXPIRED:   'subscription:expired',
  SUBSCRIPTION_CANCELLED: 'subscription:cancelled',

  // ── Progress (Tiến độ xử lý) ─────────────
  EPISODE_PROGRESS:    'episode:progress',
  EPISODE_COMPLETED:   'episode:completed',
  EPISODE_FAILED:      'episode:failed',

  // ── Job System (Anime Creation/Update) ────
  JOB_SUBSCRIBE:       'job:subscribe',
  JOB_UNSUBSCRIBE:     'job:unsubscribe',
  JOB_SUBSCRIBED:      'job:subscribed',
  JOB_UNSUBSCRIBED:    'job:unsubscribed',
  JOB_STATUS:          'job:status',
  JOB_SYNC:            'jobs:sync',
  JOB_SYNCED:          'jobs:synced',
  JOB_PROGRESS:        'job:progress',

  // ── Friend System ─────────────────────────
  FRIEND_REQUEST_NEW:       'friend:request_new',
  FRIEND_REQUEST_ACCEPTED:  'friend:request_accepted',
  FRIEND_REQUEST_REJECTED:  'friend:request_rejected',
  FRIEND_REQUEST_CANCELLED: 'friend:request_cancelled',
  FRIEND_UNFRIENDED:        'friend:unfriended',

  // ── Broadcast System ──────────────────────
  BROADCAST_EPISODE_RELEASED: 'broadcast:episode_released',
  BROADCAST_SCHEDULE_UPDATED: 'broadcast:schedule_updated',
  BROADCAST_CALENDAR_CHANGED: 'broadcast:calendar_changed',

  // ── Room Management ───────────────────────
  ROOM_JOINED:         'room:joined',
  ROOM_LEFT:           'room:left',
};

/**
 * Trạng thái kết nối Socket
 */
export const CONNECTION_STATUS = {
  CONNECTING:    'connecting',
  CONNECTED:     'connected',
  AUTHENTICATED: 'authenticated',
  GUEST:         'guest',
  RECONNECTING:  'reconnecting',
  DISCONNECTED:  'disconnected',
  ERROR:         'error',
};

/**
 * Mã lỗi chuẩn hóa cho Socket system
 * @enum {string}
 */
export const SOCKET_ERROR_CODES = {
  TOKEN_EXPIRED:        'TOKEN_EXPIRED',
  TOKEN_INVALID:        'TOKEN_INVALID',
  TOKEN_REVOKED:        'TOKEN_REVOKED',
  USER_NOT_FOUND:       'USER_NOT_FOUND',
  USER_INACTIVE:        'USER_INACTIVE',
  DEVICE_LIMIT:         'DEVICE_LIMIT',
  AUTH_INTERNAL_ERROR:  'AUTH_INTERNAL_ERROR',
  UNAUTHORIZED:         'UNAUTHORIZED',
  FORBIDDEN:            'FORBIDDEN',
  RATE_LIMITED:         'RATE_LIMITED',
  INVALID_PAYLOAD:      'INVALID_PAYLOAD',
  JOB_NOT_FOUND:        'JOB_NOT_FOUND',
  INTERNAL_ERROR:       'INTERNAL_ERROR',
};

export const TERMINAL_JOB_STATUSES = new Set([
  'cancelled',
  'completed',
  'partial_failure',
  'failed',
  'error',
]);

/**
 * Độ ưu tiên của sự kiện (Priority)
 */
export const EVENT_PRIORITY = {
  CRITICAL: 3,
  HIGH: 2,
  NORMAL: 1,
  LOW: 0,
};
