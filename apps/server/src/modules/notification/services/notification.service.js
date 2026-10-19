import { createHash, randomUUID } from "crypto";
import { Op, QueryTypes } from "sequelize";
import { Notification, User, Role, sequelize } from "../../../models/index.js";
import { logger } from "../../../utils/logger.js";
import { cacheHelper } from "../../../config/redis.config.js";
import { emitToUser, safeEmitToRoom } from "../../../sockets/services/emit.service.js";
import { SOCKET_EVENTS } from "../../../sockets/constants/socket-events.constants.js";
import { SOCKET_ROOMS } from "../../../sockets/constants/socket-rooms.constants.js";
import {
  NOTIFICATION_CACHE,
  buildNotification,
} from "../constants/notification.constant.js";
import { formatNotificationDTO, formatAdminNotificationDTO } from "../helpers/notification.helper.js";

const BROADCAST_BATCH_SIZE =
  Number.parseInt(process.env.NOTIFICATION_BROADCAST_BATCH_SIZE, 10) || 500;
const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 20;

const ACTOR_INCLUDE = {
  model: User,
  as: "actor",
  attributes: ["id", "username", "avatar_url"],
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const buildNotExpiredWhere = () => ({
  [Op.or]: [
    { expires_at: null },
    { expires_at: { [Op.gt]: new Date() } },
  ],
});

const toPlain = (record) => {
  if (!record) return null;
  return typeof record.get === "function" ? record.get({ plain: true }) : record;
};

const createEventMeta = (event) => ({
  eventId: `${event}:${Date.now()}:${randomUUID()}`,
  emittedAt: new Date().toISOString(),
});

const safeEmitToUser = (userId, event, data) => {
  try {
    emitToUser(userId, event, data);
  } catch (error) {
    logger.debug(`[NotificationService] skip socket emit ${event} for ${userId}: ${error.message}`);
  }
};

const emitAdminNotification = (actionType, data = {}) => {
  try {
    safeEmitToRoom(SOCKET_ROOMS.admin(), SOCKET_EVENTS.ADMIN_NOTIFICATION, {
      actionType,
      ...data,
      ...createEventMeta(SOCKET_EVENTS.ADMIN_NOTIFICATION),
    });
  } catch (error) {
    logger.debug(`[NotificationService] skip admin socket emit: ${error.message}`);
  }
};

const nullable = (value) => {
  if (value === undefined || value === "") return null;
  return value;
};

const normalizeActionData = (value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value;
};

const normalizeEntity = (entityId, actionData) => {
  const normalizedEntityId = nullable(entityId);
  const normalizedActionData = normalizeActionData(actionData);

  if (!normalizedEntityId) {
    return { entity_id: null, action_data: normalizedActionData };
  }

  if (UUID_PATTERN.test(String(normalizedEntityId))) {
    return { entity_id: normalizedEntityId, action_data: normalizedActionData };
  }

  return {
    entity_id: null,
    action_data: {
      ...(normalizedActionData || {}),
      entityId: normalizedEntityId,
    },
  };
};

const normalizeNotificationPayload = (data = {}) => {
  const entity = normalizeEntity(data.entity_id ?? data.entityId, data.action_data ?? data.actionData);
  const isRead = data.is_read === true || data.isRead === true;

  return {
    user_id: data.user_id ?? data.userId,
    type: data.type,
    title: data.title,
    message: data.message,
    icon: nullable(data.icon),
    action_url: nullable(data.action_url ?? data.actionUrl),
    action_data: entity.action_data,
    entity_type: nullable(data.entity_type ?? data.entityType),
    entity_id: entity.entity_id,
    actor_id: nullable(data.actor_id ?? data.actorId),
    priority: data.priority || "normal",
    group_key: nullable(data.group_key ?? data.groupKey),
    is_read: isRead,
    read_at: isRead ? data.read_at || new Date() : null,
    expires_at: nullable(data.expires_at ?? data.expiresAt),
  };
};

const buildExistingUpdatePayload = (payload) => ({
  title: payload.title,
  message: payload.message,
  icon: payload.icon,
  action_url: payload.action_url,
  action_data: payload.action_data,
  entity_type: payload.entity_type,
  entity_id: payload.entity_id,
  actor_id: payload.actor_id,
  priority: payload.priority,
  expires_at: payload.expires_at,
  is_read: false,
  read_at: null,
});

const invalidateStatsCache = async (userId) => {
  await cacheHelper.del(NOTIFICATION_CACHE.stats(userId));
};

const invalidateAllNotificationCache = async (userId) => {
  await Promise.allSettled([
    cacheHelper.del(NOTIFICATION_CACHE.unreadCount(userId)),
    invalidateStatsCache(userId),
  ]);
};

const countUnreadFromDb = async (userId) => Notification.count({
  where: {
    [Op.and]: [
      { user_id: userId, is_read: false },
      buildNotExpiredWhere(),
    ],
  },
});

const getCachedUnreadCount = async (userId) => {
  const cacheKey = NOTIFICATION_CACHE.unreadCount(userId);
  const cached = await cacheHelper.get(cacheKey);
  if (cached !== null && cached !== undefined) return Number(cached) || 0;

  const count = await countUnreadFromDb(userId);
  await cacheHelper.set(cacheKey, count, NOTIFICATION_CACHE.ttl);
  return count;
};

const refreshUnreadCount = async (userId) => {
  await cacheHelper.del(NOTIFICATION_CACHE.unreadCount(userId));
  const count = await countUnreadFromDb(userId);
  await cacheHelper.set(NOTIFICATION_CACHE.unreadCount(userId), count, NOTIFICATION_CACHE.ttl);
  return count;
};

const countStatsFromDb = async (userId, unreadOverride = null) => {
  const total = await Notification.count({
    where: {
      [Op.and]: [
        { user_id: userId },
        buildNotExpiredWhere(),
      ],
    },
  });
  const unread = unreadOverride === null ? await countUnreadFromDb(userId) : unreadOverride;

  return {
    total,
    unread,
    read: Math.max(0, total - unread),
  };
};

const getCachedStats = async (userId) => {
  const cacheKey = NOTIFICATION_CACHE.stats(userId);
  const cached = await cacheHelper.get(cacheKey);
  if (cached) return cached;

  const stats = await countStatsFromDb(userId);
  await cacheHelper.set(cacheKey, stats, NOTIFICATION_CACHE.ttl);
  return stats;
};

const refreshStats = async (userId, unreadOverride = null) => {
  await cacheHelper.del(NOTIFICATION_CACHE.stats(userId));
  const stats = await countStatsFromDb(userId, unreadOverride);
  await cacheHelper.set(NOTIFICATION_CACHE.stats(userId), stats, NOTIFICATION_CACHE.ttl);
  return stats;
};

const emitCount = (userId, count) => {
  safeEmitToUser(userId, SOCKET_EVENTS.NOTIFICATION_COUNT, {
    count,
    unread: count,
    unreadCount: count,
    ...createEventMeta(SOCKET_EVENTS.NOTIFICATION_COUNT),
  });
};

const emitStats = (userId, stats) => {
  safeEmitToUser(userId, SOCKET_EVENTS.NOTIFICATION_STATS, {
    ...stats,
    ...createEventMeta(SOCKET_EVENTS.NOTIFICATION_STATS),
  });
};

const publishUserState = async (userId) => {
  await invalidateStatsCache(userId);
  const count = await refreshUnreadCount(userId);
  const stats = await refreshStats(userId, count);

  emitCount(userId, count);
  emitStats(userId, stats);

  return { count, stats };
};

const emitNotificationRecord = (userId, event, notification, extras = {}) => {
  const dto = formatNotificationDTO(notification);
  if (!dto) return;

  safeEmitToUser(userId, event, {
    ...dto,
    ...extras,
    ...createEventMeta(event),
  });
};

const fetchNotificationById = (id, options = {}) => Notification.findByPk(id, {
  include: [ACTOR_INCLUDE],
  ...options,
});

const createNotFoundError = () => {
  const error = new Error("Khong tim thay thong bao");
  error.statusCode = 404;
  error.isOperational = true;
  return error;
};

const acquireGroupLock = async (payload, transaction) => {
  if (sequelize.getDialect() !== "postgres" || !payload.group_key) return;

  const digest = createHash("sha256")
    .update(`${payload.user_id}:${payload.type}:${payload.group_key}`)
    .digest();

  await sequelize.query(
    "SELECT pg_advisory_xact_lock(:lockA, :lockB)",
    {
      replacements: {
        lockA: digest.readInt32BE(0),
        lockB: digest.readInt32BE(4),
      },
      transaction,
      type: QueryTypes.SELECT,
    },
  );
};

const findReusableNotification = (payload, transaction) => Notification.findOne({
  where: {
    [Op.and]: [
      {
        user_id: payload.user_id,
        type: payload.type,
        group_key: payload.group_key,
        is_read: false,
      },
      buildNotExpiredWhere(),
    ],
  },
  order: [["created_at", "DESC"]],
  transaction,
  lock: transaction.LOCK.UPDATE,
});

const buildOrderClause = (orderByInput, sortInput) => {
  const orderBy = orderByInput || "created_at";
  const sortOrder = (sortInput || "DESC").toUpperCase() === "ASC" ? "ASC" : "DESC";

  if (orderBy === "actor") {
    return [[{ model: User, as: "actor" }, "username", sortOrder]];
  }
  if (orderBy === "user") {
    return [[{ model: User, as: "user" }, "username", sortOrder]];
  }

  const allowedSortFields = ["title", "type", "priority", "is_read", "created_at", "updated_at", "expires_at"];
  const sortField = allowedSortFields.includes(orderBy) ? orderBy : "created_at";
  return [[sortField, sortOrder]];
};

const normalizeListFilters = (filters = {}) => {
  const page = Math.max(1, Number(filters.page) || 1);
  const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(filters.limit) || DEFAULT_PAGE_SIZE));
  const isRead =
    filters.isRead === undefined || filters.isRead === null || filters.isRead === ""
      ? null
      : filters.isRead === true || filters.isRead === "true";

  return {
    page,
    limit,
    type: filters.type || null,
    isRead,
  };
};

const buildListWhere = (userId, filters = {}) => {
  const andConditions = [
    { user_id: userId },
    buildNotExpiredWhere(),
  ];

  if (filters.type) andConditions.push({ type: filters.type });
  if (filters.isRead !== null) andConditions.push({ is_read: filters.isRead });

  return { [Op.and]: andConditions };
};

export const notificationService = {
  async createNotification(data) {
    const payload = normalizeNotificationPayload(data);
    let notification = null;
    let reused = false;

    if (!payload.user_id) {
      const error = new Error("Notification requires user_id");
      error.statusCode = 422;
      error.isOperational = true;
      throw error;
    }

    await sequelize.transaction(async (transaction) => {
      if (payload.group_key && !payload.is_read) {
        await acquireGroupLock(payload, transaction);
        const existing = await findReusableNotification(payload, transaction);

        if (existing) {
          await existing.update(buildExistingUpdatePayload(payload), { transaction });
          notification = existing;
          reused = true;
          return;
        }
      }

      notification = await Notification.create(payload, { transaction });
    });

    const fullNotification = await fetchNotificationById(notification.id);
    const { count } = await publishUserState(payload.user_id);

    emitNotificationRecord(
      payload.user_id,
      SOCKET_EVENTS.NOTIFICATION_NEW,
      fullNotification,
      { count, unreadCount: count, reused },
    );

    emitAdminNotification("created", {
      id: notification.id,
      type: payload.type,
      priority: payload.priority,
    });

    logger.debug(`[NotificationService] notification ${reused ? "reused" : "created"}: ${notification.id}`);
    return fullNotification;
  },

  async createFromTemplate(type, data) {
    const payload = buildNotification(type, data);
    return this.createNotification(payload);
  },

  async createBulk(notifications) {
    if (!Array.isArray(notifications) || notifications.length === 0) return [];

    const normalized = notifications.map(normalizeNotificationPayload);
    const requiresDedup = normalized.some((item) => item.group_key);

    if (requiresDedup) {
      const results = [];
      for (const payload of normalized) {
        results.push(await this.createNotification(payload));
      }
      return results;
    }

    const created = await Notification.bulkCreate(normalized, { returning: true });
    const ids = created.map((item) => item.id);
    const fullRecords = ids.length
      ? await Notification.findAll({
          where: { id: { [Op.in]: ids } },
          include: [ACTOR_INCLUDE],
        })
      : [];

    const recordById = new Map(fullRecords.map((record) => [record.id, record]));
    const userIds = [...new Set(normalized.map((item) => item.user_id))];

    await Promise.allSettled(userIds.map(async (userId) => {
      const lastForUser = [...created].reverse().find((item) => item.user_id === userId);
      const { count } = await publishUserState(userId);

      if (lastForUser) {
        emitNotificationRecord(
          userId,
          SOCKET_EVENTS.NOTIFICATION_NEW,
          recordById.get(lastForUser.id) || lastForUser,
          { count, unreadCount: count, reused: false },
        );
      }
    }));

    logger.debug(`[NotificationService] bulk created ${created.length} notifications`);
    return fullRecords;
  },

  async broadcastNotification(data, options = {}) {
    const batchSize = Math.min(
      2000,
      Math.max(1, Number(options.batchSize) || BROADCAST_BATCH_SIZE),
    );
    let cursor = null;
    let createdCount = 0;
    let userCount = 0;

    while (true) {
      const users = await User.findAll({
        attributes: ["id"],
        where: cursor ? { id: { [Op.gt]: cursor } } : {},
        limit: batchSize,
        order: [["id", "ASC"]],
        raw: true,
      });

      if (users.length === 0) break;

      const batch = users.map((user) => ({ ...data, user_id: user.id }));
      const created = await this.createBulk(batch);

      createdCount += created.length;
      userCount += users.length;
      cursor = users[users.length - 1].id;

      if (users.length < batchSize) break;
    }

    logger.info(`[NotificationService] broadcast processed ${createdCount} notifications for ${userCount} users`);
    emitAdminNotification("broadcast", { created: createdCount, users: userCount });
    return { created: createdCount, users: userCount };
  },

  async broadcastToRole(roleSlug, data, options = {}) {
    const role = await Role.findOne({
      where: {
        slug: roleSlug,
      },
    });

    if (!role) {
      const error = new Error(`Không tìm thấy vai trò: ${roleSlug}`);
      error.statusCode = 404;
      error.isOperational = true;
      throw error;
    }

    const users = await User.findAll({
      attributes: ["id"],
      where: { role_id: role.id },
      raw: true,
    });

    if (users.length === 0) {
      logger.info(`[NotificationService] No users found with role ${roleSlug}`);
      return { created: 0, users: 0 };
    }

    const batch = users.map((user) => ({ ...data, user_id: user.id }));
    const created = await this.createBulk(batch);

    logger.info(`[NotificationService] broadcast to role ${roleSlug} processed ${created.length} notifications for ${users.length} users`);
    emitAdminNotification("broadcast_role", { role: roleSlug, created: created.length, users: users.length });
    return { created: created.length, users: users.length };
  },

  async getAll(userId, filters = {}) {
    const normalizedFilters = normalizeListFilters(filters);
    const offset = (normalizedFilters.page - 1) * normalizedFilters.limit;
    const orderClause = buildOrderClause(filters.order_by || filters.sortBy, filters.sort || filters.sortOrder);
    const { rows, count } = await Notification.findAndCountAll({
      where: buildListWhere(userId, normalizedFilters),
      include: [ACTOR_INCLUDE],
      limit: normalizedFilters.limit,
      offset,
      order: orderClause,
      distinct: true,
    });

    const totalPages = Math.ceil(count / normalizedFilters.limit);

    return {
      items: rows.map(formatNotificationDTO),
      total: count,
      page: normalizedFilters.page,
      limit: normalizedFilters.limit,
      totalPages,
      hasNextPage: normalizedFilters.page < totalPages,
      hasPrevPage: normalizedFilters.page > 1,
    };
  },

  async getUnreadCount(userId) {
    const count = await getCachedUnreadCount(userId);
    return { unread: count };
  },

  async getStats(userId) {
    return getCachedStats(userId);
  },

  async markAsRead(id, userId) {
    const [affectedCount] = await Notification.update(
      { is_read: true, read_at: new Date() },
      {
        where: { id, user_id: userId, is_read: false },
        returning: true,
      },
    );

    const notification = await fetchNotificationById(id);
    if (!notification || notification.user_id !== userId) throw createNotFoundError();

    if (affectedCount > 0) {
      const { count } = await publishUserState(userId);
      safeEmitToUser(userId, SOCKET_EVENTS.NOTIFICATION_READ, {
        id,
        count,
        unreadCount: count,
        ...createEventMeta(SOCKET_EVENTS.NOTIFICATION_READ),
      });
    }

    return notification;
  },

  async markAsUnread(id, userId) {
    const [affectedCount] = await Notification.update(
      { is_read: false, read_at: null },
      {
        where: { id, user_id: userId, is_read: true },
        returning: true,
      },
    );

    const notification = await fetchNotificationById(id);
    if (!notification || notification.user_id !== userId) throw createNotFoundError();

    if (affectedCount > 0) {
      const { count } = await publishUserState(userId);
      safeEmitToUser(userId, SOCKET_EVENTS.NOTIFICATION_UNREAD, {
        id,
        count,
        unreadCount: count,
        ...createEventMeta(SOCKET_EVENTS.NOTIFICATION_UNREAD),
      });
    }

    return notification;
  },

  async markAllAsRead(userId) {
    const [affectedCount] = await Notification.update(
      { is_read: true, read_at: new Date() },
      {
        where: {
          [Op.and]: [
            { user_id: userId, is_read: false },
            buildNotExpiredWhere(),
          ],
        },
      },
    );

    if (affectedCount > 0) {
      const { count } = await publishUserState(userId);
      safeEmitToUser(userId, SOCKET_EVENTS.NOTIFICATION_ALL_READ, {
        affected: affectedCount,
        count,
        unreadCount: count,
        ...createEventMeta(SOCKET_EVENTS.NOTIFICATION_ALL_READ),
      });
    }

    return { affected: affectedCount };
  },

  async delete(id, userId) {
    const notification = await Notification.findOne({
      where: { id, user_id: userId },
      attributes: ["id", "user_id"],
    });

    if (!notification) throw createNotFoundError();

    const deleted = await Notification.destroy({ where: { id, user_id: userId } });

    if (deleted > 0) {
      const { count } = await publishUserState(userId);
      safeEmitToUser(userId, SOCKET_EVENTS.NOTIFICATION_DELETED, {
        id,
        count,
        unreadCount: count,
        ...createEventMeta(SOCKET_EVENTS.NOTIFICATION_DELETED),
      });
    }

    return { deleted };
  },

  async deleteAll(userId) {
    const deleted = await Notification.destroy({ where: { user_id: userId } });
    const { count } = await publishUserState(userId);

    safeEmitToUser(userId, SOCKET_EVENTS.NOTIFICATION_ALL_DELETED, {
      deleted,
      count,
      unreadCount: count,
      ...createEventMeta(SOCKET_EVENTS.NOTIFICATION_ALL_DELETED),
    });

    return { deleted };
  },

  async cleanExpired() {
    const now = new Date();
    const affectedUsers = await Notification.findAll({
      attributes: ["user_id"],
      where: {
        expires_at: { [Op.lt]: now },
        is_read: false,
      },
      group: ["user_id"],
      raw: true,
    });

    const cleaned = await Notification.destroy({
      where: { expires_at: { [Op.lt]: now } },
    });

    await Promise.allSettled(
      affectedUsers.map(async ({ user_id: userId }) => {
        const { count } = await publishUserState(userId);
        safeEmitToUser(userId, SOCKET_EVENTS.NOTIFICATION_DELETED, {
          expired: true,
          count,
          unreadCount: count,
          ...createEventMeta(SOCKET_EVENTS.NOTIFICATION_DELETED),
        });
      }),
    );

    if (cleaned > 0) {
      logger.info(`[NotificationService] cleaned ${cleaned} expired notifications`);
    }

    return { cleaned };
  },

  async adminGetStats() {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [total, read, unread, critical, last24h] = await Promise.all([
      Notification.count(),
      Notification.count({ where: { is_read: true } }),
      Notification.count({ where: { is_read: false } }),
      Notification.count({
        where: {
          priority: { [Op.in]: ["high", "critical"] },
        },
      }),
      Notification.count({
        where: {
          created_at: { [Op.gte]: oneDayAgo },
        },
      }),
    ]);

    const readRate = total > 0 ? Math.round((read / total) * 100) : 0;

    return {
      total,
      read,
      unread,
      readRate,
      critical,
      last24h,
    };
  },

  async adminGetAll(query = {}) {
    const page = Math.max(1, parseInt(query.page) || 1);
    const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(query.limit) || DEFAULT_PAGE_SIZE));
    const offset = (page - 1) * limit;

    const where = {};
    if (query.type) {
      where.type = query.type;
    }
    if (query.priority) {
      where.priority = query.priority;
    }
    if (query.isRead !== undefined && query.isRead !== "") {
      where.is_read = query.isRead === "true" || query.isRead === true;
    }

    if (query.search) {
      where[Op.or] = [
        { title: { [Op.iLike]: `%${query.search}%` } },
        { message: { [Op.iLike]: `%${query.search}%` } },
      ];
    }

    const orderClause = buildOrderClause(query.order_by || query.sortBy, query.sort || query.sortOrder);

    const { count, rows } = await Notification.findAndCountAll({
      where,
      limit,
      offset,
      order: orderClause,
      include: [
        ACTOR_INCLUDE,
        {
          model: User,
          as: "user",
          attributes: ["id", "username", "avatar_url", "full_name", "email"],
        },
      ],
      distinct: true,
    });

    return {
      items: rows.map(formatAdminNotificationDTO),
      total: count,
      pagination: {
        totalItems: count,
        totalPages: Math.ceil(count / limit),
        currentPage: page,
        pageSize: limit,
      },
    };
  },

  async adminDelete(id) {
    const notification = await Notification.findByPk(id);
    if (!notification) throw createNotFoundError();

    const userId = notification.user_id;
    const deleted = await Notification.destroy({ where: { id } });

    if (deleted > 0) {
      emitAdminNotification("deleted", { id });
      const { count } = await publishUserState(userId);
      safeEmitToUser(userId, SOCKET_EVENTS.NOTIFICATION_DELETED, {
        id,
        count,
        unreadCount: count,
        ...createEventMeta(SOCKET_EVENTS.NOTIFICATION_DELETED),
      });
    }

    return { deleted };
  },

  async adminBulkDelete(ids) {
    if (!Array.isArray(ids) || ids.length === 0) {
      return { deleted: 0 };
    }

    const notifications = await Notification.findAll({
      where: { id: { [Op.in]: ids } },
      attributes: ["id", "user_id"],
      raw: true,
    });

    if (notifications.length === 0) {
      return { deleted: 0 };
    }

    const userIds = [...new Set(notifications.map((n) => n.user_id).filter(Boolean))];
    const deleted = await Notification.destroy({
      where: { id: { [Op.in]: ids } },
    });

    if (deleted > 0) {
      emitAdminNotification("bulk_deleted", { ids, count: deleted });
      await Promise.allSettled(
        userIds.map(async (userId) => {
          const { count } = await publishUserState(userId);
          safeEmitToUser(userId, SOCKET_EVENTS.NOTIFICATION_ALL_DELETED, {
            deleted,
            count,
            unreadCount: count,
            ...createEventMeta(SOCKET_EVENTS.NOTIFICATION_ALL_DELETED),
          });
        }),
      );
    }

    return { deleted };
  },

  async invalidateCache(userId) {
    await invalidateAllNotificationCache(userId);
  },
};

export default notificationService;
