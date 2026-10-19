/**
 * @file use-notification-sync.js
 * @module Hooks/Socket/UseNotificationSync
 * @description Hook đồng bộ thời gian thực cho hệ thống Notification qua Socket.IO: khử trùng lặp qua eventId, cập nhật trực tiếp cache TanStack Query, đồng bộ Redux store và hiển thị Toast thông báo tương tác.
 */

import React, { useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useDispatch, useSelector } from "react-redux";
import toast from "react-hot-toast";

import socketClient from "@/shared/lib/socket-client";
import NotificationToast from "@/shared/components/ui/notification-toast/NotificationToast";
import { SOCKET_EVENTS } from "@/shared/constants/socket-events.constants";
import {
  NOTIFICATION_QUERY_KEYS,
  ADMIN_NOTIFICATION_QUERY_KEYS,
} from "@/hooks/queries/use-notification.queries";
import { selectIsAuthenticated } from "@/store/slices/auth.slice";
import {
  addNotification,
  setUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
  removeNotification,
  clearNotifications,
  incrementUnread,
  decrementUnread,
  resetUnread,
} from "@/store/slices/notification.slice";

/**
 * @hook useNotificationSync
 * @description Hook lắng nghe và đồng bộ toàn bộ sự kiện Socket.IO liên quan đến Notification
 * @param {Object} [options={}] Tùy chọn cấu hình thêm (enableToast = true)
 */
export function useNotificationSync(options = {}) {
  const { enableToast = true } = options;
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const queryClient = useQueryClient();
  const isAuthenticated = useSelector(selectIsAuthenticated);

  // ────────────────────────────────────────────────────────────────
  // 1. XỬ LÝ KHI CÓ THÔNG BÁO MỚI (NOTIFICATION_NEW)
  // ────────────────────────────────────────────────────────────────
  const handleNewNotification = useCallback(
    (payload) => {
      if (!payload) return;

      // 1. Khử trùng lặp qua eventId
      if (payload.eventId && !socketClient.trackEventId(payload.eventId)) {
        return;
      }

      const notif = {
        id: payload.id,
        type: payload.type,
        title: payload.title || "Thông báo mới",
        message: payload.message || "",
        icon: payload.icon || null,
        action_url: payload.action_url || payload.actionUrl || null,
        action_data: payload.action_data || payload.actionData || null,
        is_read: Boolean(payload.is_read),
        read_at: payload.read_at || null,
        created_at: payload.created_at || payload.createdAt || new Date().toISOString(),
        actor: payload.actor || null,
      };

      // 2. Chèn notification vào đầu Standard Lists Cache
      queryClient.setQueriesData(
        { queryKey: NOTIFICATION_QUERY_KEYS.lists() },
        (oldData) => {
          if (!oldData) return oldData;
          const currentItems = oldData.items || [];
          const exists = currentItems.some((item) => item.id === notif.id);
          if (exists) {
            return {
              ...oldData,
              items: currentItems.map((item) =>
                item.id === notif.id ? { ...item, ...notif } : item,
              ),
            };
          }
          return {
            ...oldData,
            items: [notif, ...currentItems],
            total: (oldData.total || 0) + 1,
          };
        },
      );

      // 3. Chèn notification vào đầu Infinite Queries Cache
      queryClient.setQueriesData(
        { queryKey: NOTIFICATION_QUERY_KEYS.infinites() },
        (oldData) => {
          if (!oldData?.pages || oldData.pages.length === 0) return oldData;
          const firstPage = oldData.pages[0];
          const currentItems = firstPage.items || [];
          const exists = currentItems.some((item) => item.id === notif.id);

          const updatedFirstPage = exists
            ? {
                ...firstPage,
                items: currentItems.map((item) =>
                  item.id === notif.id ? { ...item, ...notif } : item,
                ),
              }
            : {
                ...firstPage,
                items: [notif, ...currentItems],
                total: (firstPage.total || 0) + 1,
              };

          return {
            ...oldData,
            pages: [updatedFirstPage, ...oldData.pages.slice(1)],
          };
        },
      );

      // 4. Cập nhật Unread Count Cache & Redux
      const count =
        typeof payload.unreadCount === "number"
          ? payload.unreadCount
          : typeof payload.count === "number"
            ? payload.count
            : null;

      if (count !== null) {
        queryClient.setQueryData(NOTIFICATION_QUERY_KEYS.unreadCount(), count);
        dispatch(setUnreadCount(count));
      } else {
        queryClient.setQueryData(
          NOTIFICATION_QUERY_KEYS.unreadCount(),
          (old) => {
            const current = typeof old === "number" ? old : old?.unread || 0;
            return current + 1;
          },
        );
        dispatch(incrementUnread());
      }

      // 5. Cập nhật Stats Cache
      queryClient.setQueryData(NOTIFICATION_QUERY_KEYS.stats(), (old) => {
        if (!old) return old;
        return {
          ...old,
          total: (old.total || 0) + 1,
          unread: (old.unread || 0) + 1,
        };
      });

      // 6. Cập nhật Redux Store entities
      dispatch(addNotification(notif));

      // 7. Hiển thị Interactive Toast Thông Báo (Dumb UI component, không dùng inline styles)
      if (enableToast) {
        toast.custom(
          (t) =>
            React.createElement(NotificationToast, {
              notification: notif,
              visible: t.visible,
              onClick: () => {
                toast.dismiss(t.id);
                if (notif.action_url) {
                  navigate(notif.action_url);
                }
              },
              onClose: () => toast.dismiss(t.id),
            }),
          {
            id: `notif-toast-${notif.id}`,
            duration: 5000,
            position: "top-right",
          },
        );
      }
    },
    [dispatch, queryClient, navigate, enableToast],
  );

  // ────────────────────────────────────────────────────────────────
  // 2. XỬ LÝ CẬP NHẬT TRẠNG THÁI (READ / UNREAD / ALL_READ)
  // ────────────────────────────────────────────────────────────────
  const handleNotificationRead = useCallback(
    (payload) => {
      if (!payload?.id) return;
      const { id, count, unreadCount } = payload;

      const updateItem = (item) =>
        item.id === id
          ? { ...item, is_read: true, read_at: new Date().toISOString() }
          : item;

      queryClient.setQueriesData(
        { queryKey: NOTIFICATION_QUERY_KEYS.lists() },
        (oldData) => {
          if (!oldData?.items) return oldData;
          return { ...oldData, items: oldData.items.map(updateItem) };
        },
      );

      queryClient.setQueriesData(
        { queryKey: NOTIFICATION_QUERY_KEYS.infinites() },
        (oldData) => {
          if (!oldData?.pages) return oldData;
          return {
            ...oldData,
            pages: oldData.pages.map((p) => ({
              ...p,
              items: (p.items || []).map(updateItem),
            })),
          };
        },
      );

      const resolvedCount = unreadCount ?? count;
      if (typeof resolvedCount === "number") {
        queryClient.setQueryData(NOTIFICATION_QUERY_KEYS.unreadCount(), resolvedCount);
        dispatch(setUnreadCount(resolvedCount));
      } else {
        dispatch(decrementUnread());
      }

      dispatch(markNotificationRead(id));
    },
    [dispatch, queryClient],
  );

  const handleNotificationUnread = useCallback(
    (payload) => {
      if (!payload?.id) return;
      const { id, count, unreadCount } = payload;

      const updateItem = (item) =>
        item.id === id ? { ...item, is_read: false, read_at: null } : item;

      queryClient.setQueriesData(
        { queryKey: NOTIFICATION_QUERY_KEYS.lists() },
        (oldData) => {
          if (!oldData?.items) return oldData;
          return { ...oldData, items: oldData.items.map(updateItem) };
        },
      );

      queryClient.setQueriesData(
        { queryKey: NOTIFICATION_QUERY_KEYS.infinites() },
        (oldData) => {
          if (!oldData?.pages) return oldData;
          return {
            ...oldData,
            pages: oldData.pages.map((p) => ({
              ...p,
              items: (p.items || []).map(updateItem),
            })),
          };
        },
      );

      const resolvedCount = unreadCount ?? count;
      if (typeof resolvedCount === "number") {
        queryClient.setQueryData(NOTIFICATION_QUERY_KEYS.unreadCount(), resolvedCount);
        dispatch(setUnreadCount(resolvedCount));
      } else {
        dispatch(incrementUnread());
      }
    },
    [dispatch, queryClient],
  );

  const handleNotificationAllRead = useCallback(() => {
    const now = new Date().toISOString();

    queryClient.setQueriesData(
      { queryKey: NOTIFICATION_QUERY_KEYS.lists() },
      (oldData) => {
        if (!oldData?.items) return oldData;
        return {
          ...oldData,
          items: oldData.items.map((item) => ({
            ...item,
            is_read: true,
            read_at: now,
          })),
        };
      },
    );

    queryClient.setQueriesData(
      { queryKey: NOTIFICATION_QUERY_KEYS.infinites() },
      (oldData) => {
        if (!oldData?.pages) return oldData;
        return {
          ...oldData,
          pages: oldData.pages.map((p) => ({
            ...p,
            items: (p.items || []).map((item) => ({
              ...item,
              is_read: true,
              read_at: now,
            })),
          })),
        };
      },
    );

    queryClient.setQueryData(NOTIFICATION_QUERY_KEYS.unreadCount(), 0);
    dispatch(resetUnread());
    dispatch(markAllNotificationsRead());
  }, [dispatch, queryClient]);

  // ────────────────────────────────────────────────────────────────
  // 3. XỬ LÝ SỰ KIỆN XÓA (DELETED / ALL_DELETED)
  // ────────────────────────────────────────────────────────────────
  const handleNotificationDeleted = useCallback(
    (payload) => {
      if (!payload?.id) return;
      const { id, count, unreadCount } = payload;

      queryClient.setQueriesData(
        { queryKey: NOTIFICATION_QUERY_KEYS.lists() },
        (oldData) => {
          if (!oldData?.items) return oldData;
          return {
            ...oldData,
            items: oldData.items.filter((item) => item.id !== id),
            total: Math.max(0, (oldData.total || 0) - 1),
          };
        },
      );

      queryClient.setQueriesData(
        { queryKey: NOTIFICATION_QUERY_KEYS.infinites() },
        (oldData) => {
          if (!oldData?.pages) return oldData;
          return {
            ...oldData,
            pages: oldData.pages.map((p) => ({
              ...p,
              items: (p.items || []).filter((item) => item.id !== id),
              total: Math.max(0, (p.total || 0) - 1),
            })),
          };
        },
      );

      const resolvedCount = unreadCount ?? count;
      if (typeof resolvedCount === "number") {
        queryClient.setQueryData(NOTIFICATION_QUERY_KEYS.unreadCount(), resolvedCount);
        dispatch(setUnreadCount(resolvedCount));
      }

      dispatch(removeNotification(id));
    },
    [dispatch, queryClient],
  );

  const handleNotificationAllDeleted = useCallback(() => {
    queryClient.setQueriesData(
      { queryKey: NOTIFICATION_QUERY_KEYS.lists() },
      (oldData) => ({
        ...oldData,
        items: [],
        total: 0,
      }),
    );

    queryClient.setQueriesData(
      { queryKey: NOTIFICATION_QUERY_KEYS.infinites() },
      (oldData) => {
        if (!oldData?.pages) return oldData;
        return {
          ...oldData,
          pages: [{ items: [], total: 0, page: 1, limit: 15, totalPages: 0, hasNextPage: false, hasPrevPage: false }],
        };
      },
    );

    queryClient.setQueryData(NOTIFICATION_QUERY_KEYS.unreadCount(), 0);
    dispatch(clearNotifications());
  }, [dispatch, queryClient]);

  // ────────────────────────────────────────────────────────────────
  // 4. XỬ LÝ COUNT, STATS & ADMIN EVENTS
  // ────────────────────────────────────────────────────────────────
  const handleNotificationCount = useCallback(
    (payload) => {
      const count =
        typeof payload?.unreadCount === "number"
          ? payload.unreadCount
          : typeof payload?.count === "number"
            ? payload.count
            : typeof payload?.unread === "number"
              ? payload.unread
              : null;

      if (count !== null) {
        queryClient.setQueryData(NOTIFICATION_QUERY_KEYS.unreadCount(), count);
        dispatch(setUnreadCount(count));
      }
    },
    [dispatch, queryClient],
  );

  const handleNotificationStats = useCallback(
    (payload) => {
      if (payload) {
        queryClient.setQueryData(NOTIFICATION_QUERY_KEYS.stats(), payload);
      }
    },
    [queryClient],
  );

  const handleAdminNotification = useCallback(() => {
    queryClient.invalidateQueries({
      queryKey: ADMIN_NOTIFICATION_QUERY_KEYS.all,
    });
  }, [queryClient]);

  // ────────────────────────────────────────────────────────────────
  // 5. ĐĂNG KÝ CORE SOCKET LISTENERS
  // ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isAuthenticated) return;

    const unsubNew = socketClient.on(
      SOCKET_EVENTS.NOTIFICATION_NEW,
      handleNewNotification,
    );
    const unsubRead = socketClient.on(
      SOCKET_EVENTS.NOTIFICATION_READ,
      handleNotificationRead,
    );
    const unsubUnread = socketClient.on(
      SOCKET_EVENTS.NOTIFICATION_UNREAD,
      handleNotificationUnread,
    );
    const unsubAllRead = socketClient.on(
      SOCKET_EVENTS.NOTIFICATION_ALL_READ,
      handleNotificationAllRead,
    );
    const unsubDeleted = socketClient.on(
      SOCKET_EVENTS.NOTIFICATION_DELETED,
      handleNotificationDeleted,
    );
    const unsubAllDeleted = socketClient.on(
      SOCKET_EVENTS.NOTIFICATION_ALL_DELETED,
      handleNotificationAllDeleted,
    );
    const unsubCount = socketClient.on(
      SOCKET_EVENTS.NOTIFICATION_COUNT,
      handleNotificationCount,
    );
    const unsubStats = socketClient.on(
      SOCKET_EVENTS.NOTIFICATION_STATS,
      handleNotificationStats,
    );
    const unsubAdmin = socketClient.on(
      SOCKET_EVENTS.ADMIN_NOTIFICATION,
      handleAdminNotification,
    );

    return () => {
      unsubNew();
      unsubRead();
      unsubUnread();
      unsubAllRead();
      unsubDeleted();
      unsubAllDeleted();
      unsubCount();
      unsubStats();
      unsubAdmin();
    };
  }, [
    isAuthenticated,
    handleNewNotification,
    handleNotificationRead,
    handleNotificationUnread,
    handleNotificationAllRead,
    handleNotificationDeleted,
    handleNotificationAllDeleted,
    handleNotificationCount,
    handleNotificationStats,
    handleAdminNotification,
  ]);
}

export default useNotificationSync;
