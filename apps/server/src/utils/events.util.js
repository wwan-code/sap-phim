/**
 * @file events.util.js
 * @module Utils
 * @description Triển khai cơ chế phát/sự kiện toàn cục bằng EventEmitter và Redis Pub/Sub.
 */

import { EventEmitter } from 'events';
import Redis from 'ioredis';
import { env } from '../config/env.config.js';
import { logger } from './logger.js';

// Cấu hình Redis Pub/Sub cho cụm Cluster (ngăn trượt sự kiện trên nhiều Instance)
let pubClient = null;
let subClient = null;

const CLUSTER_EVENTS = [
  'auth.logout_all',
  'auth.password_changed',
  'auth.permissions_updated'
];

/**
 * AppEmitter
 *
 * @description Lớp mở rộng từ EventEmitter để quản lý sự kiện toàn cục trong hệ thống.
 * Tích hợp sẵn Redis Pub/Sub để phát tán sự kiện liên Instance.
 */
class AppEmitter extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(50);
    this.initRedis();
  }

  /**
   * Khởi tạo kết nối Redis Pub/Sub
   */
  initRedis() {
    try {
      const options = {
        host: env.redis.host,
        port: env.redis.port,
        password: env.redis.password || undefined,
        db: env.redis.db || 0,
        ...(env.redis.tls && { tls: { rejectUnauthorized: false } }),
        retryStrategy: (times) => Math.min(times * 1000, 15000),
      };

      pubClient = new Redis(options);
      subClient = new Redis(options);

      subClient.subscribe("sap_anime_auth_events", (err) => {
        if (err) {
          logger.warn(`[EventsUtil] Đăng ký kênh Redis thất bại: ${err.message}`);
        }
      });

      subClient.on("message", (channel, message) => {
        if (channel === "sap_anime_auth_events") {
          try {
            const { event, data } = JSON.parse(message);
            logger.debug(`[EventsUtil] Nhận sự kiện Cluster từ Redis: ${event}`);
            super.emit(event, data);
          } catch (err) {
            logger.error(`[EventsUtil] Lỗi parse sự kiện từ Redis: ${err.message}`);
          }
        }
      });
    } catch (err) {
      logger.warn(`[EventsUtil] Khởi tạo Redis Pub/Sub không thành công: ${err.message}`);
    }
  }

  /**
   * Phát sự kiện toàn cục (phát tại local và đồng bộ lên Redis Pub/Sub)
   */
  emit(event, data) {
    logger.debug(`[EventsUtil] Đang phát sự kiện Local: ${event}`);
    
    // 1. Kích hoạt local listeners
    const result = super.emit(event, data);

    // 2. Nếu là sự kiện cần đồng bộ cụm và Redis sẵn sàng, phát lên Redis
    if (CLUSTER_EVENTS.includes(event) && pubClient && pubClient.status === "ready") {
      pubClient.publish("sap_anime_auth_events", JSON.stringify({ event, data }))
        .catch((err) => logger.warn(`[EventsUtil] Đồng bộ Cluster event thất bại: ${err.message}`));
    }

    return result;
  }

  /**
   * Chỉ phát sự kiện tại local (dùng để tránh lặp vòng lặp vô tận khi nhận từ Redis)
   */
  emitLocal(event, data) {
    return super.emit(event, data);
  }
}

/** Thực thể phát sự kiện Singleton cho toàn bộ ứng dụng */
const events = new AppEmitter();

// ════════════════════════════════════════
// DANH MỤC SỰ KIỆN (EVENT CATALOG)
// ════════════════════════════════════════

/**
 * Danh mục hằng số sự kiện toàn hệ thống.
 * Giúp quản lý tập trung, tránh lỗi chính tả và dễ dàng truy vết logic.
 */
export const EVENTS = {
  /** Xác thực & Tài khoản */
  AUTH: {
    LOGIN: 'auth.login',
    REGISTER: 'auth.register',
    EMAIL_VERIFIED: 'auth.email_verified',
    PASSWORD_CHANGED: 'auth.password_changed',
    PASSWORD_RESET: 'auth.password_reset',
    LOGOUT_ALL: 'auth.logout_all',
    PERMISSIONS_UPDATED: 'auth.permissions_updated',
  },

  /** Người dùng & Hồ sơ */
  USER: {
    PROFILE_UPDATED: 'user.profile_updated',
    LEVEL_UP: 'user.level_up',
    EXP_GAINED: 'user.exp_gained',
    FOLLOWED: 'user.followed',
    UNFOLLOWED: 'user.unfollowed',
    DELETED: 'user.deleted',
  },

  /** Nội dung Phim */
  MOVIE: {
    CREATED: 'movie.created',
    DELETED: 'movie.deleted',
    VIEW_INCREMENTED: 'movie.view_incremented',
  },

  /** Lịch sử xem */
  WATCH_HISTORY: {
    COMPLETED: 'watch_history.completed',
  },

  /** Tập phim & Xử lý */
  EPISODE: {
    PROCESSED: 'episode.processed',
    FAILED: 'episode.failed',
  },

  /** Tương tác & Bình luận */
  COMMENT: {
    CREATED: 'comment.created',
    REPLY_CREATED: 'comment.reply_created',
    LIKED: 'comment.liked',
    REPORTED: 'comment.reported',
    MODERATED: 'comment.moderated',
    DELETED: 'comment.deleted',
  },

  /** Tài chính & Ví */
  WALLET: {
    CREDITED: 'wallet.credited',
    DEBITED: 'wallet.debited',
    DEPOSIT_SUCCESS: 'wallet.deposit_success',
    PURCHASE_SUCCESS: 'wallet.purchase_success',
  },

  /** Gói thành viên */
  SUBSCRIPTION: {
    CREATED: 'subscription.created',
    EXPIRED: 'subscription.expired',
  },
};

export default events;

