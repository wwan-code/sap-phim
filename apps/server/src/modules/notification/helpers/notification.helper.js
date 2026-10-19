/**
 * @file notification.helper.js
 * @module Modules/Notification/Helpers
 * @description Trợ lý tạo thông báo và định dạng DTO phản hồi an toàn (Sanitized Notification DTO).
 */

import { Op } from "sequelize";
import { User, Role } from "../../../models/index.js";
import { ROLES } from "../../../constants/roles.constant.js";
import { notificationService } from "../services/notification.service.js";
import { notificationQueueService } from "../services/notification-queue.service.js";
import { NOTIFICATION_TYPES, ENTITY_TYPES } from "../constants/notification.constant.js";
import { logger } from "../../../utils/logger.js";

/**
 * Định dạng DTO thông báo an toàn gửi cho Client (Loại bỏ các trường riêng tư user_id, actor_id, expires_at, group_key...)
 * @param {object} record Record Sequelize hoặc Object Plain
 * @returns {object|null} DTO đã được lọc an toàn
 */
export const formatNotificationDTO = (record) => {
  if (!record) return null;
  const plain = typeof record.get === "function" ? record.get({ plain: true }) : record;
  if (!plain) return null;

  return {
    id: plain.id,
    type: plain.type,
    title: plain.title || null,
    message: plain.message || "",
    icon: plain.icon || null,
    action_url: plain.action_url || null,
    action_data: plain.action_data || null,
    is_read: Boolean(plain.is_read),
    read_at: plain.read_at || null,
    created_at: plain.created_at,
    actor: plain.actor
      ? {
          id: plain.actor.id,
          username: plain.actor.username,
          avatar_url: plain.actor.avatar_url,
        }
      : null,
  };
};

/**
 * Định dạng DTO thông báo cho Admin (bảo toàn thông tin người nhận user, priority, group_key, expires_at...)
 * @param {object} record Record Sequelize hoặc Object Plain
 * @returns {object|null} DTO chi tiết cho quản trị
 */
export const formatAdminNotificationDTO = (record) => {
  if (!record) return null;
  const plain = typeof record.get === "function" ? record.get({ plain: true }) : record;
  if (!plain) return null;

  return {
    id: plain.id,
    type: plain.type,
    title: plain.title || null,
    message: plain.message || "",
    icon: plain.icon || null,
    priority: plain.priority || "normal",
    group_key: plain.group_key || null,
    action_url: plain.action_url || null,
    action_data: plain.action_data || null,
    entity_type: plain.entity_type || null,
    entity_id: plain.entity_id || null,
    is_read: Boolean(plain.is_read),
    read_at: plain.read_at || null,
    expires_at: plain.expires_at || null,
    created_at: plain.created_at,
    user: plain.user
      ? {
          id: plain.user.id,
          username: plain.user.username,
          full_name: plain.user.full_name,
          email: plain.user.email,
          avatar_url: plain.user.avatar_url,
        }
      : null,
    actor: plain.actor
      ? {
          id: plain.actor.id,
          username: plain.actor.username,
          avatar_url: plain.actor.avatar_url,
        }
      : null,
  };
};

const fireAndForget = (type, data, label) => {
  notificationQueueService.enqueueFromTemplate(type, data).catch((queueError) => {
    logger.warn(`[NotifHelper] Queue ${label} failed, falling back to direct create: ${queueError.message}`);
    notificationService.createFromTemplate(type, data).catch((err) => {
      logger.error(`[NotifHelper] ${label} failed:`, err);
    });
  });
};

export const notifyNewFollower = ({ userId, actorId, actorName }) => {
  fireAndForget(
    NOTIFICATION_TYPES.NEW_FOLLOWER,
    {
      userId,
      actorId,
      actorName,
      entityType: ENTITY_TYPES.USER,
      entityId: actorId,
      groupKey: actorId ? `follow:${actorId}` : null,
    },
    "notifyNewFollower",
  );
};

export const notifyCommentReply = ({
  userId,
  actorId,
  actorName,
  commentId,
  movieTitle,
  actionUrl,
}) => {
  fireAndForget(
    NOTIFICATION_TYPES.COMMENT_REPLY,
    {
      userId,
      actorId,
      actorName,
      entityType: ENTITY_TYPES.COMMENT,
      entityId: commentId,
      entityName: movieTitle,
      actionUrl,
      groupKey: commentId ? `comment_reply:${commentId}:${actorId || "system"}` : null,
    },
    "notifyCommentReply",
  );
};

export const notifyCommentLike = ({
  userId,
  actorId,
  actorName,
  commentId,
  actionUrl,
}) => {
  fireAndForget(
    NOTIFICATION_TYPES.COMMENT_LIKE,
    {
      userId,
      actorId,
      actorName,
      entityType: ENTITY_TYPES.COMMENT,
      entityId: commentId,
      actionUrl,
      groupKey: commentId ? `comment_like:${commentId}:${actorId || "system"}` : null,
    },
    "notifyCommentLike",
  );
};

export const notifyCommentMention = ({
  userId,
  actorId,
  actorName,
  commentId,
  actionUrl,
}) => {
  fireAndForget(
    NOTIFICATION_TYPES.COMMENT_MENTION,
    {
      userId,
      actorId,
      actorName,
      entityType: ENTITY_TYPES.COMMENT,
      entityId: commentId,
      actionUrl,
      groupKey: commentId ? `comment_mention:${commentId}` : null,
    },
    "notifyCommentMention",
  );
};

export const notifyMovieNew = ({ userId, movieId, movieSlug, movieTitle }) => {
  fireAndForget(
    NOTIFICATION_TYPES.MOVIE_NEW,
    {
      userId,
      entityType: ENTITY_TYPES.MOVIE,
      entityId: movieId,
      entitySlug: movieSlug,
      entityName: movieTitle,
      groupKey: movieId ? `movie_new:${movieId}` : null,
    },
    "notifyMovieNew",
  );
};

export const notifyMovieUpdate = ({ userId, movieId, movieSlug, movieTitle }) => {
  fireAndForget(
    NOTIFICATION_TYPES.MOVIE_UPDATE,
    {
      userId,
      entityType: ENTITY_TYPES.MOVIE,
      entityId: movieId,
      entitySlug: movieSlug,
      entityName: movieTitle,
      groupKey: movieId ? `movie_update:${movieId}` : null,
    },
    "notifyMovieUpdate",
  );
};

export const notifyNewEpisode = ({ userId, movieId, movieSlug, movieTitle }) => {
  fireAndForget(
    NOTIFICATION_TYPES.MOVIE_NEW_EPISODE,
    {
      userId,
      entityType: ENTITY_TYPES.MOVIE,
      entityId: movieId,
      entitySlug: movieSlug,
      entityName: movieTitle,
      groupKey: movieId ? `movie_episode:${movieId}` : null,
    },
    "notifyNewEpisode",
  );
};

export const notifyAccountSecurity = ({ userId, message, actionUrl }) => {
  fireAndForget(
    NOTIFICATION_TYPES.ACCOUNT_SECURITY,
    {
      userId,
      message,
      actionUrl,
    },
    "notifyAccountSecurity",
  );
};

export const notifyPaymentRefunded = ({ userId, message }) => {
  fireAndForget(
    NOTIFICATION_TYPES.PAYMENT_REFUNDED,
    {
      userId,
      message,
    },
    "notifyPaymentRefunded",
  );
};

export const notifySubscriptionExpired = ({
  userId,
  subscriptionId,
  planName,
  actionUrl,
}) => {
  fireAndForget(
    NOTIFICATION_TYPES.SUBSCRIPTION_EXPIRED,
    {
      userId,
      entityType: ENTITY_TYPES.SUBSCRIPTION,
      entityId: subscriptionId,
      entityName: planName || "VIP",
      actionUrl,
      groupKey: subscriptionId ? `subscription_expired:${subscriptionId}` : null,
    },
    "notifySubscriptionExpired",
  );
};

export const notifySubscriptionExpiring = ({
  userId,
  subscriptionId,
  planName,
  daysLeft,
  actionUrl,
}) => {
  fireAndForget(
    NOTIFICATION_TYPES.SUBSCRIPTION_EXPIRING,
    {
      userId,
      entityType: ENTITY_TYPES.SUBSCRIPTION,
      entityId: subscriptionId,
      entityName: planName || "VIP",
      actionUrl,
      daysLeft,
      groupKey: subscriptionId ? `subscription_expiring:${subscriptionId}:${daysLeft}` : null,
    },
    "notifySubscriptionExpiring",
  );
};

export const notifyPaymentRequestPending = async ({
  userId,
  userName,
  userEmail,
  amountVnd,
  transactionCode,
  type = "topup",
  lcoinAmount,
}) => {
  try {
    const adminUsers = await User.findAll({
      include: [
        {
          model: Role,
          as: "role",
          where: {
            slug: { [Op.in]: [ROLES.ADMIN, ROLES.BOSS] },
          },
        },
      ],
      attributes: ["id"],
    });

    if (!adminUsers || adminUsers.length === 0) return;

    const isTopup = type === "topup";
    const actionText = isTopup ? "Nạp xu" : "Rút tiền";
    const formattedAmount = Number(amountVnd).toLocaleString("vi-VN");

    for (const admin of adminUsers) {
      fireAndForget(
        NOTIFICATION_TYPES.PAYMENT_REQUEST_PENDING,
        {
          userId: admin.id,
          actorId: userId,
          actorName: userName || "Thành viên",
          entityType: ENTITY_TYPES.PAYMENT_REQUEST,
          entityName: `${formattedAmount} VND`,
          amountVnd: formattedAmount,
          actionUrl: "/admin/payment-requests",
          message: `Người dùng ${userName || "Thành viên"} vừa khởi tạo Yêu cầu ${actionText} ${formattedAmount} VNĐ (${lcoinAmount || Math.round(amountVnd / 1000)} S-Coin). Mã CK: ${transactionCode}`,
          actionData: {
            transactionCode,
            userEmail,
            amountVnd,
            type,
          },
          groupKey: transactionCode ? `payment_request:${transactionCode}:${admin.id}` : null,
        },
        "notifyPaymentRequestPending",
      );
    }
  } catch (error) {
    logger.error("[NotifHelper] notifyPaymentRequestPending failed:", error);
  }
};

export const notifyPaymentApproved = ({
  userId,
  adminId,
  paymentRequestId,
  type,
  lcoinAmount,
  amountVnd,
}) => {
  const isTopup = type === "topup";
  fireAndForget(
    NOTIFICATION_TYPES.PAYMENT_APPROVED,
    {
      userId,
      actorId: adminId,
      entityType: ENTITY_TYPES.PAYMENT_REQUEST,
      entityId: paymentRequestId,
      actionUrl: "/wallet",
      message: `Yêu cầu ${isTopup ? "Nạp" : "Rút"} ${Number(amountVnd).toLocaleString("vi-VN")} VNĐ (${lcoinAmount} S-Coin) của bạn đã được phê duyệt thành công!`,
    },
    "notifyPaymentApproved",
  );
};

export const notifyPaymentRejected = ({
  userId,
  adminId,
  paymentRequestId,
  type,
  lcoinAmount,
  amountVnd,
  rejectionReason,
}) => {
  const isTopup = type === "topup";
  fireAndForget(
    NOTIFICATION_TYPES.PAYMENT_REJECTED,
    {
      userId,
      actorId: adminId,
      entityType: ENTITY_TYPES.PAYMENT_REQUEST,
      entityId: paymentRequestId,
      actionUrl: "/wallet",
      message: `Yêu cầu ${isTopup ? "Nạp" : "Rút"} ${Number(amountVnd).toLocaleString("vi-VN")} VNĐ (${lcoinAmount} S-Coin) bị từ chối.${rejectionReason ? ` Lý do: ${rejectionReason}` : ""}`,
    },
    "notifyPaymentRejected",
  );
};

