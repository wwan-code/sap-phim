import { notificationService } from "../services/notification.service.js";
import { notificationQueueService } from "../services/notification-queue.service.js";
import { responseUtil } from "../../../utils/response.util.js";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const normalizeEntityForStorage = (entityId, actionData) => {
  if (!entityId) return { entityId: null, actionData: actionData || null };
  if (UUID_PATTERN.test(String(entityId))) return { entityId, actionData: actionData || null };

  return {
    entityId: null,
    actionData: {
      ...(actionData || {}),
      entityId,
    },
  };
};

const buildPayloadFromBody = (body = {}) => {
  const entity = normalizeEntityForStorage(body.entityId, body.actionData);

  return {
    type: body.type,
    title: body.title,
    message: body.message,
    action_url: body.actionUrl || null,
    action_data: entity.actionData,
    icon: body.icon || null,
    entity_type: body.entityType || null,
    entity_id: entity.entityId,
    actor_id: body.actorId || null,
    priority: body.priority || "normal",
    group_key: body.groupKey || null,
    expires_at: body.expiresAt || null,
  };
};

export const notificationController = {
  async getAll(req, res, next) {
    try {
      const result = await notificationService.getAll(
        req.user.id,
        req.validatedQuery || req.query,
      );
      return responseUtil.success(res, result);
    } catch (error) {
      next(error);
    }
  },

  async getUnreadCount(req, res, next) {
    try {
      const result = await notificationService.getUnreadCount(req.user.id);
      return responseUtil.success(res, result);
    } catch (error) {
      next(error);
    }
  },

  async getStats(req, res, next) {
    try {
      const result = await notificationService.getStats(req.user.id);
      return responseUtil.success(res, result);
    } catch (error) {
      next(error);
    }
  },

  async markAsRead(req, res, next) {
    try {
      const id = req.validatedParams?.id || req.params.id;
      const result = await notificationService.markAsRead(id, req.user.id);
      return responseUtil.success(res, result, "Notification marked as read");
    } catch (error) {
      next(error);
    }
  },

  async markAsUnread(req, res, next) {
    try {
      const id = req.validatedParams?.id || req.params.id;
      const result = await notificationService.markAsUnread(id, req.user.id);
      return responseUtil.success(res, result, "Notification marked as unread");
    } catch (error) {
      next(error);
    }
  },

  async markAllAsRead(req, res, next) {
    try {
      const result = await notificationService.markAllAsRead(req.user.id);
      return responseUtil.success(res, result, "All notifications marked as read");
    } catch (error) {
      next(error);
    }
  },

  async delete(req, res, next) {
    try {
      const id = req.validatedParams?.id || req.params.id;
      const result = await notificationService.delete(id, req.user.id);
      return responseUtil.success(res, result, "Notification deleted");
    } catch (error) {
      next(error);
    }
  },

  async deleteAll(req, res, next) {
    try {
      const result = await notificationService.deleteAll(req.user.id);
      return responseUtil.success(res, result, "All notifications deleted");
    } catch (error) {
      next(error);
    }
  },

  async create(req, res, next) {
    try {
      const { userId, targetType = "all", targetRole, ...notifData } = req.body;
      const payload = buildPayloadFromBody(notifData);

      if (targetType === "user" || (userId && targetType !== "all" && targetType !== "role")) {
        if (!userId) {
          const err = new Error("Cần cung cấp userId khi chọn gửi cho người dùng cụ thể");
          err.statusCode = 422;
          err.isOperational = true;
          throw err;
        }
        payload.user_id = userId;
        const result = await notificationService.createNotification(payload);
        return responseUtil.success(res, result, "Notification created", 201);
      }

      if (targetType === "role") {
        if (!targetRole) {
          const err = new Error("Cần chọn vai trò người nhận");
          err.statusCode = 422;
          err.isOperational = true;
          throw err;
        }
        const result = await notificationService.broadcastToRole(targetRole, payload);
        return responseUtil.success(res, result, `Notification sent to role ${targetRole}`, 201);
      }

      // targetType === "all"
      const result = await notificationQueueService.enqueueBroadcast(payload);
      return responseUtil.success(res, result, "Notification broadcast queued", 202);
    } catch (error) {
      next(error);
    }
  },

  async adminGetStats(req, res, next) {
    try {
      const result = await notificationService.adminGetStats();
      return responseUtil.success(res, result);
    } catch (error) {
      next(error);
    }
  },

  async adminGetAll(req, res, next) {
    try {
      const query = req.validatedQuery || req.query;
      const result = await notificationService.adminGetAll(query);
      return responseUtil.success(res, result);
    } catch (error) {
      next(error);
    }
  },

  async adminDelete(req, res, next) {
    try {
      const id = req.params.id;
      const result = await notificationService.adminDelete(id);
      return responseUtil.success(res, result, "Notification deleted by admin");
    } catch (error) {
      next(error);
    }
  },

  async adminBulkDelete(req, res, next) {
    try {
      const { ids } = req.body;
      const result = await notificationService.adminBulkDelete(ids);
      return responseUtil.success(res, result, `Đã xóa ${result.deleted} thông báo thành công`);
    } catch (error) {
      next(error);
    }
  },
};

export default notificationController;
