/**
 * Thông báo Constants
 * Định nghĩa các loại thông báo, đối tượng liên quan và các mẫu template (VND).
 * Hệ thống sử dụng cơ chế nội suy (interpolation) để tạo thông điệp động từ template.
 */

/**
 * Các loại thông báo trong hệ thống
 */
export const NOTIFICATION_TYPES = {
  // Mạng xã hội (Social)
  NEW_FOLLOWER: "new_follower",
  COMMENT_REPLY: "comment_reply",
  COMMENT_LIKE: "comment_like",
  COMMENT_MENTION: "comment_mention",
  COMMENT_REJECTED: "comment_rejected",

  // Bạn bè (Friend)
  FRIEND_REQUEST_RECEIVED: "friend_request_received",
  FRIEND_REQUEST_ACCEPTED: "friend_request_accepted",

  // Phim (Movie)
  MOVIE_NEW: "movie_new",
  MOVIE_UPDATE: "movie_update",
  MOVIE_NEW_EPISODE: "movie_new_episode",

  // Hệ thống (System)
  SYSTEM: "system",
  ADMIN: "admin",
  WELCOME: "welcome",
  ACCOUNT_SECURITY: "account_security",

  // Gói cước (Subscription)
  SUBSCRIPTION_EXPIRED: "subscription_expired",
  SUBSCRIPTION_EXPIRING: "subscription_expiring",

  // Thanh toán (Payment)
  PAYMENT_REQUEST_PENDING: "payment_request_pending",
  PAYMENT_APPROVED: "payment_approved",
  PAYMENT_REJECTED: "payment_rejected",
  PAYMENT_REFUNDED: "payment_refunded",
};

/**
 * Danh sách giá trị hợp lệ để validation (Joi)
 */
export const NOTIFICATION_TYPE_VALUES = Object.values(NOTIFICATION_TYPES);

/**
 * Các loại thực thể có thể gắn kèm thông báo
 */
export const ENTITY_TYPES = {
  MOVIE: "movie",
  USER: "user",
  COMMENT: "comment",
  EPISODE: "episode",
  SUBSCRIPTION: "subscription",
  PAYMENT_REQUEST: "payment_request",
};

/**
 * Danh sách thực thể hợp lệ
 */
export const ENTITY_TYPE_VALUES = Object.values(ENTITY_TYPES);

/**
 * Mức độ ưu tiên của thông báo
 */
export const NOTIFICATION_PRIORITY = {
  LOW: "low",
  NORMAL: "normal",
  HIGH: "high",
  CRITICAL: "critical",
};

/**
 * Danh sách mức độ ưu tiên hợp lệ
 */
export const NOTIFICATION_PRIORITY_VALUES = Object.values(
  NOTIFICATION_PRIORITY,
);

/**
 * Mẫu nội dung thông báo cho từng loại
 * Sử dụng {key} để nội suy dữ liệu động từ database hoặc logic.
 */
export const NOTIFICATION_TEMPLATES = {
  [NOTIFICATION_TYPES.NEW_FOLLOWER]: {
    title: "Người theo dõi mới",
    message: "{actorName} đã theo dõi bạn",
    icon: "👤",
    priority: NOTIFICATION_PRIORITY.NORMAL,
  },
  [NOTIFICATION_TYPES.COMMENT_REPLY]: {
    title: "Phản hồi bình luận",
    message: "{actorName} đã trả lời bình luận của bạn",
    icon: "💬",
    priority: NOTIFICATION_PRIORITY.NORMAL,
  },
  [NOTIFICATION_TYPES.COMMENT_LIKE]: {
    title: "Thích bình luận",
    message: "{actorName} đã thích bình luận của bạn",
    icon: "❤️",
    priority: NOTIFICATION_PRIORITY.LOW,
  },
  [NOTIFICATION_TYPES.COMMENT_MENTION]: {
    title: "Nhắc đến bạn",
    message: "{actorName} đã nhắc đến bạn trong một bình luận",
    icon: "📢",
    priority: NOTIFICATION_PRIORITY.NORMAL,
  },
  [NOTIFICATION_TYPES.COMMENT_REJECTED]: {
    title: "Bình luận bị từ chối",
    message: "{message}",
    icon: "🚫",
    priority: NOTIFICATION_PRIORITY.HIGH,
  },
  [NOTIFICATION_TYPES.FRIEND_REQUEST_RECEIVED]: {
    title: "Lời mời kết bạn",
    message: "{actorName} đã gửi lời mời kết bạn cho bạn",
    icon: "👤",
    priority: NOTIFICATION_PRIORITY.NORMAL,
  },
  [NOTIFICATION_TYPES.FRIEND_REQUEST_ACCEPTED]: {
    title: "Chấp nhận kết bạn",
    message: "{actorName} đã chấp nhận lời mời kết bạn",
    icon: "🤝",
    priority: NOTIFICATION_PRIORITY.NORMAL,
  },
  [NOTIFICATION_TYPES.MOVIE_NEW]: {
    title: "Phim mới",
    message: 'Phim "{entityName}" vừa được thêm vào hệ thống',
    icon: "🎥",
    priority: NOTIFICATION_PRIORITY.NORMAL,
  },
  [NOTIFICATION_TYPES.MOVIE_UPDATE]: {
    title: "Cập nhật phim",
    message: 'Phim "{entityName}" đã được cập nhật',
    icon: "🔄",
    priority: NOTIFICATION_PRIORITY.LOW,
  },
  [NOTIFICATION_TYPES.MOVIE_NEW_EPISODE]: {
    title: "Tập phim mới",
    message: 'Phim "{entityName}" có tập mới',
    icon: "📺",
    priority: NOTIFICATION_PRIORITY.HIGH,
  },
  [NOTIFICATION_TYPES.SYSTEM]: {
    title: "Thông báo hệ thống",
    message: "{message}",
    icon: "🔔",
    priority: NOTIFICATION_PRIORITY.NORMAL,
  },
  [NOTIFICATION_TYPES.ADMIN]: {
    title: "Thông báo từ Admin",
    message: "{message}",
    icon: "📣",
    priority: NOTIFICATION_PRIORITY.HIGH,
  },
  [NOTIFICATION_TYPES.WELCOME]: {
    title: "Chào mừng!",
    message: "Chào mừng {actorName} đến với Sạp Phim! 🎉",
    icon: "🎉",
    priority: NOTIFICATION_PRIORITY.NORMAL,
  },
  [NOTIFICATION_TYPES.ACCOUNT_SECURITY]: {
    title: "Bảo mật tài khoản",
    message: "{message}",
    icon: "🔒",
    priority: NOTIFICATION_PRIORITY.CRITICAL,
  },
  [NOTIFICATION_TYPES.PAYMENT_REQUEST_PENDING]: {
    title: "Yêu cầu nạp tiền mới",
    message: "Người dùng {actorName} đã gửi yêu cầu nạp {amountVnd} VND",
    icon: "💳",
    priority: NOTIFICATION_PRIORITY.HIGH,
  },
  [NOTIFICATION_TYPES.PAYMENT_APPROVED]: {
    title: "Nạp Rap-coin thành công",
    message: "{message}",
    icon: "💰",
    priority: NOTIFICATION_PRIORITY.HIGH,
  },
  [NOTIFICATION_TYPES.PAYMENT_REJECTED]: {
    title: "Từ chối nạp tiền",
    message: "{message}",
    icon: "❌",
    priority: NOTIFICATION_PRIORITY.HIGH,
  },
  [NOTIFICATION_TYPES.PAYMENT_REFUNDED]: {
    title: "Hoàn tiền thành công",
    message: "{message}",
    icon: "💸",
    priority: NOTIFICATION_PRIORITY.HIGH,
  },
  [NOTIFICATION_TYPES.SUBSCRIPTION_EXPIRED]: {
    title: "Gói VIP đã hết hạn",
    message: 'Gói "{entityName}" của bạn đã hết hạn. Gia hạn ngay để không gián đoạn trải nghiệm!',
    icon: "⌛",
    priority: NOTIFICATION_PRIORITY.HIGH,
  },
  [NOTIFICATION_TYPES.SUBSCRIPTION_EXPIRING]: {
    title: "Sắp hết hạn gói VIP",
    message: 'Gói "{entityName}" của bạn sẽ hết hạn trong {daysLeft} ngày tới.',
    icon: "⚠️",
    priority: NOTIFICATION_PRIORITY.NORMAL,
  },
};

/**
 * Cấu hình cache cho thông báo
 */
export const NOTIFICATION_CACHE = {
  prefix: "notif:",
  unreadCount: (userId) => `notif:unread:${userId}`,
  stats: (userId) => `notif:stats:${userId}`,
  ttl: 300, // 5 phút
};

/**
 * Map các loại thực thể sang URL tương ứng trên frontend
 */
export const ENTITY_URL_MAP = {
  [ENTITY_TYPES.MOVIE]: (id, slug) => (slug ? `/phim/${slug}` : `/phim/${id}`),
  [ENTITY_TYPES.USER]: (id) => `/nguoi-dung/${id}`,
  [ENTITY_TYPES.COMMENT]: () => null, // Thường sẽ link đến phim chứa comment
  [ENTITY_TYPES.EPISODE]: () => null, // Link đến trang xem phim tương ứng
  [ENTITY_TYPES.SUBSCRIPTION]: () => "/tai-khoan/goi-vip",
  [ENTITY_TYPES.PAYMENT_REQUEST]: (id) => (id ? `/admin/dashboard/payments/${id}` : null),
};

/**
 * Tạo URL từ loại thực thể và ID.
 *
 * @param {string} entityType - Loại thực thể (ENTITY_TYPES)
 * @param {string} entityId - UUID của thực thể
 * @param {string} [entitySlug] - Slug để tạo URL thân thiện SEO
 * @returns {string|null} Đường dẫn URL hoặc null nếu không hỗ trợ
 */
export const getEntityUrl = (entityType, entityId, entitySlug) => {
  if (!entityType || !entityId) return null;
  const builder = ENTITY_URL_MAP[entityType];
  return builder ? builder(entityId, entitySlug) : null;
};

// ════════════════════════════════════════
// TIỆN ÍCH: XỬ LÝ NỘI SUY TEMPLATE
// ════════════════════════════════════════

const INTERPOLATE_FALLBACKS = {
  actorName: "Ai đó",
  entityName: "Không rõ",
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const normalizeEntityId = (entityId, actionData) => {
  if (!entityId) {
    return { entityId: null, actionData: actionData || null };
  }

  if (UUID_PATTERN.test(String(entityId))) {
    return { entityId, actionData: actionData || null };
  }

  return {
    entityId: null,
    actionData: {
      ...(actionData || {}),
      entityId,
    },
  };
};

/**
 * Thay thế các tag {key} trong chuỗi bằng dữ liệu thực tế
 * 
 * @param {string} template - Chuỗi mẫu chứa các tag {key}
 * @param {Object} data - Đối tượng chứa dữ liệu để thay thế
 * @returns {string} Chuỗi sau khi đã nội suy
 */
const interpolate = (template, data = {}) => {
  if (!template) return "";
  return template.replace(/\{(\w+)\}/g, (_, key) => {
    if (data[key] !== undefined && data[key] !== null) return data[key];
    return INTERPOLATE_FALLBACKS[key] ?? "";
  });
};

/**
 * Xây dựng payload thông báo hoàn chỉnh từ template và dữ liệu động.
 * Tự động tạo action_url nếu không được cung cấp thủ công.
 *
 * @param {string} type - Loại thông báo (NOTIFICATION_TYPES)
 * @param {object} data - Dữ liệu động đi kèm
 * @returns {object} Payload sẵn sàng để lưu vào database
 * @throws {Error} Nếu thiếu userId hoặc loại thông báo không tồn tại
 */
export const buildNotification = (type, data = {}) => {
  const template = NOTIFICATION_TEMPLATES[type];
  if (!template) {
    throw new Error(`Loại thông báo không hợp lệ: ${type}`);
  }

  if (!data.userId) {
    throw new Error("buildNotification yêu cầu cung cấp data.userId");
  }

  // Tự động tạo URL hành động từ thông tin thực thể nếu chưa có
  const actionUrl =
    data.actionUrl ||
    getEntityUrl(data.entityType, data.entityId, data.entitySlug) ||
    null;
  const normalizedEntity = normalizeEntityId(data.entityId, data.actionData);

  return {
    user_id: data.userId,
    type,
    title: data.title || interpolate(template.title, data),
    message: data.message
      ? interpolate(data.message, data)
      : interpolate(template.message, data),
    icon: data.icon || template.icon,
    priority: data.priority || template.priority,
    action_url: actionUrl,
    action_data: normalizedEntity.actionData,
    entity_type: data.entityType || null,
    entity_id: normalizedEntity.entityId,
    actor_id: data.actorId || null,
    group_key: data.groupKey || null,
    expires_at: data.expiresAt || null,
  };
};
