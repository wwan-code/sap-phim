/**
 * @file use-notification.mutations.js
 * @module Hooks/Mutations/Notification
 * @description Các React Mutation Hooks phục vụ các thao tác thay đổi thông báo (Đọc, Chưa đọc, Xóa, Tạo mới) với cơ chế Optimistic Updates và Snapshot Rollback toàn diện.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import notificationService from "@/shared/services/notification.service";
import {
  NOTIFICATION_QUERY_KEYS,
  ADMIN_NOTIFICATION_QUERY_KEYS,
} from "@/hooks/queries/use-notification.queries";
import { store } from "@/store";
import {
  incrementUnread,
  decrementUnread,
  resetUnread,
  markNotificationRead,
  markAllNotificationsRead,
  removeNotification,
  clearNotifications,
} from "@/store/slices/notification.slice";

// ════════════════════════════════════════════════════════════════
// HELPER CACHE UPDATERS FOR OPTIMISTIC MUTATIONS
// ════════════════════════════════════════════════════════════════

/**
 * Cập nhật một item trong toàn bộ cache (Standard Query & Infinite Query)
 */
const updateNotificationInAllCaches = (queryClient, id, updater) => {
  // 1. Cập nhật standard queries
  queryClient.setQueriesData(
    { queryKey: NOTIFICATION_QUERY_KEYS.lists() },
    (oldData) => {
      if (!oldData?.items || !Array.isArray(oldData.items)) return oldData;
      return {
        ...oldData,
        items: oldData.items.map((item) =>
          item.id === id ? updater(item) : item,
        ),
      };
    },
  );

  // 2. Cập nhật infinite queries
  queryClient.setQueriesData(
    { queryKey: NOTIFICATION_QUERY_KEYS.infinites() },
    (oldData) => {
      if (!oldData?.pages || !Array.isArray(oldData.pages)) return oldData;
      return {
        ...oldData,
        pages: oldData.pages.map((page) => ({
          ...page,
          items: (page.items || []).map((item) =>
            item.id === id ? updater(item) : item,
          ),
        })),
      };
    },
  );
};

/**
 * Xóa một item khỏi toàn bộ cache (Standard & Infinite Queries)
 */
const removeNotificationFromAllCaches = (queryClient, id) => {
  // 1. Standard queries
  queryClient.setQueriesData(
    { queryKey: NOTIFICATION_QUERY_KEYS.lists() },
    (oldData) => {
      if (!oldData?.items || !Array.isArray(oldData.items)) return oldData;
      const filtered = oldData.items.filter((item) => item.id !== id);
      return {
        ...oldData,
        items: filtered,
        total: Math.max(0, (oldData.total || 0) - (oldData.items.length - filtered.length)),
      };
    },
  );

  // 2. Infinite queries
  queryClient.setQueriesData(
    { queryKey: NOTIFICATION_QUERY_KEYS.infinites() },
    (oldData) => {
      if (!oldData?.pages || !Array.isArray(oldData.pages)) return oldData;
      return {
        ...oldData,
        pages: oldData.pages.map((page) => {
          const filtered = (page.items || []).filter((item) => item.id !== id);
          return {
            ...page,
            items: filtered,
            total: Math.max(0, (page.total || 0) - ((page.items || []).length - filtered.length)),
          };
        }),
      };
    },
  );
};

// ════════════════════════════════════════════════════════════════
// MEMBER MUTATIONS
// ════════════════════════════════════════════════════════════════

/**
 * Mutation đánh dấu thông báo là đã đọc (Optimistic Update & Snapshot Rollback)
 * @param {Object} [options={}]
 * @returns {import('@tanstack/react-query').UseMutationResult}
 */
export function useMarkAsReadMutation(options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id) => notificationService.markAsRead(id),
    onMutate: async (id) => {
      // Hủy bỏ các refetch đang diễn ra để tránh race conditions
      await queryClient.cancelQueries({ queryKey: NOTIFICATION_QUERY_KEYS.all });

      // Lưu snapshot trạng thái trước khi thay đổi
      const previousQueries = queryClient.getQueriesData({
        queryKey: NOTIFICATION_QUERY_KEYS.all,
      });
      const previousUnread = queryClient.getQueryData(
        NOTIFICATION_QUERY_KEYS.unreadCount(),
      );
      const previousStats = queryClient.getQueryData(
        NOTIFICATION_QUERY_KEYS.stats(),
      );

      // Cập nhật Optimistic trên Cache
      updateNotificationInAllCaches(queryClient, id, (item) => ({
        ...item,
        is_read: true,
        read_at: new Date().toISOString(),
      }));

      // Giảm unreadCount trên Query Cache
      queryClient.setQueryData(
        NOTIFICATION_QUERY_KEYS.unreadCount(),
        (old) => {
          const count = typeof old === "number" ? old : old?.unread || 0;
          return Math.max(0, count - 1);
        },
      );

      // Cập nhật Stats
      queryClient.setQueryData(NOTIFICATION_QUERY_KEYS.stats(), (old) => {
        if (!old) return old;
        return {
          ...old,
          unread: Math.max(0, old.unread - 1),
          read: (old.read || 0) + 1,
        };
      });

      // Đồng bộ Redux
      store.dispatch(decrementUnread());
      store.dispatch(markNotificationRead(id));

      return { previousQueries, previousUnread, previousStats };
    },
    onError: (error, id, context) => {
      // Rollback cache về snapshot ban đầu khi có lỗi
      if (context?.previousQueries) {
        context.previousQueries.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      if (context?.previousUnread !== undefined) {
        queryClient.setQueryData(
          NOTIFICATION_QUERY_KEYS.unreadCount(),
          context.previousUnread,
        );
      }
      if (context?.previousStats) {
        queryClient.setQueryData(
          NOTIFICATION_QUERY_KEYS.stats(),
          context.previousStats,
        );
      }
      options.onError?.(error, id, context);
    },
    onSuccess: (data, id, context) => {
      options.onSuccess?.(data, id, context);
    },
    onSettled: (data, error, id, context) => {
      queryClient.invalidateQueries({
        queryKey: NOTIFICATION_QUERY_KEYS.unreadCount(),
      });
      queryClient.invalidateQueries({
        queryKey: NOTIFICATION_QUERY_KEYS.stats(),
      });
      options.onSettled?.(data, error, id, context);
    },
    ...options,
  });
}

/**
 * Mutation đánh dấu thông báo là chưa đọc (Optimistic Update & Snapshot Rollback)
 * @param {Object} [options={}]
 * @returns {import('@tanstack/react-query').UseMutationResult}
 */
export function useMarkAsUnreadMutation(options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id) => notificationService.markAsUnread(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: NOTIFICATION_QUERY_KEYS.all });

      const previousQueries = queryClient.getQueriesData({
        queryKey: NOTIFICATION_QUERY_KEYS.all,
      });
      const previousUnread = queryClient.getQueryData(
        NOTIFICATION_QUERY_KEYS.unreadCount(),
      );
      const previousStats = queryClient.getQueryData(
        NOTIFICATION_QUERY_KEYS.stats(),
      );

      // Cập nhật Optimistic trên Cache
      updateNotificationInAllCaches(queryClient, id, (item) => ({
        ...item,
        is_read: false,
        read_at: null,
      }));

      // Tăng unreadCount trên Query Cache
      queryClient.setQueryData(
        NOTIFICATION_QUERY_KEYS.unreadCount(),
        (old) => {
          const count = typeof old === "number" ? old : old?.unread || 0;
          return count + 1;
        },
      );

      // Cập nhật Stats
      queryClient.setQueryData(NOTIFICATION_QUERY_KEYS.stats(), (old) => {
        if (!old) return old;
        return {
          ...old,
          unread: old.unread + 1,
          read: Math.max(0, (old.read || 0) - 1),
        };
      });

      // Đồng bộ Redux
      store.dispatch(incrementUnread());

      return { previousQueries, previousUnread, previousStats };
    },
    onError: (error, id, context) => {
      if (context?.previousQueries) {
        context.previousQueries.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      if (context?.previousUnread !== undefined) {
        queryClient.setQueryData(
          NOTIFICATION_QUERY_KEYS.unreadCount(),
          context.previousUnread,
        );
      }
      if (context?.previousStats) {
        queryClient.setQueryData(
          NOTIFICATION_QUERY_KEYS.stats(),
          context.previousStats,
        );
      }
      options.onError?.(error, id, context);
    },
    onSuccess: (data, id, context) => {
      options.onSuccess?.(data, id, context);
    },
    onSettled: (data, error, id, context) => {
      queryClient.invalidateQueries({
        queryKey: NOTIFICATION_QUERY_KEYS.unreadCount(),
      });
      queryClient.invalidateQueries({
        queryKey: NOTIFICATION_QUERY_KEYS.stats(),
      });
      options.onSettled?.(data, error, id, context);
    },
    ...options,
  });
}

/**
 * Mutation đánh dấu tất cả thông báo là đã đọc (Optimistic Update & Snapshot Rollback)
 * @param {Object} [options={}]
 * @returns {import('@tanstack/react-query').UseMutationResult}
 */
export function useMarkAllAsReadMutation(options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => notificationService.markAllAsRead(),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: NOTIFICATION_QUERY_KEYS.all });

      const previousQueries = queryClient.getQueriesData({
        queryKey: NOTIFICATION_QUERY_KEYS.all,
      });
      const previousUnread = queryClient.getQueryData(
        NOTIFICATION_QUERY_KEYS.unreadCount(),
      );
      const previousStats = queryClient.getQueryData(
        NOTIFICATION_QUERY_KEYS.stats(),
      );

      const now = new Date().toISOString();

      // Đánh dấu tất cả items trong standard queries
      queryClient.setQueriesData(
        { queryKey: NOTIFICATION_QUERY_KEYS.lists() },
        (oldData) => {
          if (!oldData?.items || !Array.isArray(oldData.items)) return oldData;
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

      // Đánh dấu tất cả items trong infinite queries
      queryClient.setQueriesData(
        { queryKey: NOTIFICATION_QUERY_KEYS.infinites() },
        (oldData) => {
          if (!oldData?.pages || !Array.isArray(oldData.pages)) return oldData;
          return {
            ...oldData,
            pages: oldData.pages.map((page) => ({
              ...page,
              items: (page.items || []).map((item) => ({
                ...item,
                is_read: true,
                read_at: now,
              })),
            })),
          };
        },
      );

      // Reset unread count = 0
      queryClient.setQueryData(NOTIFICATION_QUERY_KEYS.unreadCount(), 0);

      // Cập nhật Stats
      queryClient.setQueryData(NOTIFICATION_QUERY_KEYS.stats(), (old) => {
        if (!old) return old;
        return {
          ...old,
          unread: 0,
          read: old.total || 0,
        };
      });

      // Đồng bộ Redux
      store.dispatch(resetUnread());
      store.dispatch(markAllNotificationsRead());

      return { previousQueries, previousUnread, previousStats };
    },
    onError: (error, variables, context) => {
      if (context?.previousQueries) {
        context.previousQueries.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      if (context?.previousUnread !== undefined) {
        queryClient.setQueryData(
          NOTIFICATION_QUERY_KEYS.unreadCount(),
          context.previousUnread,
        );
      }
      if (context?.previousStats) {
        queryClient.setQueryData(
          NOTIFICATION_QUERY_KEYS.stats(),
          context.previousStats,
        );
      }
      options.onError?.(error, variables, context);
    },
    onSuccess: (data, variables, context) => {
      options.onSuccess?.(data, variables, context);
    },
    onSettled: (data, error, variables, context) => {
      queryClient.invalidateQueries({
        queryKey: NOTIFICATION_QUERY_KEYS.unreadCount(),
      });
      queryClient.invalidateQueries({
        queryKey: NOTIFICATION_QUERY_KEYS.stats(),
      });
      options.onSettled?.(data, error, variables, context);
    },
    ...options,
  });
}

/**
 * Mutation xóa một thông báo (Optimistic Update & Snapshot Rollback)
 * @param {Object} [options={}]
 * @returns {import('@tanstack/react-query').UseMutationResult}
 */
export function useDeleteNotificationMutation(options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id) => notificationService.deleteNotification(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: NOTIFICATION_QUERY_KEYS.all });

      const previousQueries = queryClient.getQueriesData({
        queryKey: NOTIFICATION_QUERY_KEYS.all,
      });
      const previousUnread = queryClient.getQueryData(
        NOTIFICATION_QUERY_KEYS.unreadCount(),
      );

      // Xóa khỏi cache
      removeNotificationFromAllCaches(queryClient, id);

      // Đồng bộ Redux
      store.dispatch(removeNotification(id));

      return { previousQueries, previousUnread };
    },
    onError: (error, id, context) => {
      if (context?.previousQueries) {
        context.previousQueries.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      if (context?.previousUnread !== undefined) {
        queryClient.setQueryData(
          NOTIFICATION_QUERY_KEYS.unreadCount(),
          context.previousUnread,
        );
      }
      options.onError?.(error, id, context);
    },
    onSuccess: (data, id, context) => {
      options.onSuccess?.(data, id, context);
    },
    onSettled: (data, error, id, context) => {
      queryClient.invalidateQueries({
        queryKey: NOTIFICATION_QUERY_KEYS.all,
      });
      options.onSettled?.(data, error, id, context);
    },
    ...options,
  });
}

/**
 * Mutation xóa toàn bộ thông báo (Optimistic Update & Snapshot Rollback)
 * @param {Object} [options={}]
 * @returns {import('@tanstack/react-query').UseMutationResult}
 */
export function useDeleteAllNotificationsMutation(options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => notificationService.deleteAllNotifications(),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: NOTIFICATION_QUERY_KEYS.all });

      const previousQueries = queryClient.getQueriesData({
        queryKey: NOTIFICATION_QUERY_KEYS.all,
      });

      // Clear tất cả standard queries
      queryClient.setQueriesData(
        { queryKey: NOTIFICATION_QUERY_KEYS.lists() },
        (oldData) => ({
          ...oldData,
          items: [],
          total: 0,
          totalPages: 0,
          hasNextPage: false,
          hasPrevPage: false,
        }),
      );

      // Clear infinite queries
      queryClient.setQueriesData(
        { queryKey: NOTIFICATION_QUERY_KEYS.infinites() },
        (oldData) => {
          if (!oldData?.pages) return oldData;
          return {
            ...oldData,
            pages: [
              {
                items: [],
                total: 0,
                page: 1,
                limit: 15,
                totalPages: 0,
                hasNextPage: false,
                hasPrevPage: false,
              },
            ],
          };
        },
      );

      queryClient.setQueryData(NOTIFICATION_QUERY_KEYS.unreadCount(), 0);
      queryClient.setQueryData(NOTIFICATION_QUERY_KEYS.stats(), {
        total: 0,
        unread: 0,
        read: 0,
      });

      // Đồng bộ Redux
      store.dispatch(clearNotifications());

      return { previousQueries };
    },
    onError: (error, variables, context) => {
      if (context?.previousQueries) {
        context.previousQueries.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      options.onError?.(error, variables, context);
    },
    onSuccess: (data, variables, context) => {
      options.onSuccess?.(data, variables, context);
    },
    onSettled: (data, error, variables, context) => {
      queryClient.invalidateQueries({
        queryKey: NOTIFICATION_QUERY_KEYS.all,
      });
      options.onSettled?.(data, error, variables, context);
    },
    ...options,
  });
}

/**
 * Mutation tạo thông báo mới hoặc gửi broadcast
 * @param {Object} [options={}]
 * @returns {import('@tanstack/react-query').UseMutationResult}
 */
export function useCreateNotificationMutation(options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload) => notificationService.createNotification(payload),
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: NOTIFICATION_QUERY_KEYS.all });
      queryClient.invalidateQueries({ queryKey: ADMIN_NOTIFICATION_QUERY_KEYS.all });
      options.onSuccess?.(data, variables, context);
    },
    ...options,
  });
}

// ════════════════════════════════════════════════════════════════
// ADMIN MUTATIONS
// ════════════════════════════════════════════════════════════════

/**
 * Mutation xóa thông báo quản trị viên theo ID (Admin)
 * @param {Object} [options={}]
 * @returns {import('@tanstack/react-query').UseMutationResult}
 */
export function useAdminDeleteNotificationMutation(options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id) => notificationService.deleteAdminNotification(id),
    onSuccess: (data, id, context) => {
      queryClient.invalidateQueries({ queryKey: ADMIN_NOTIFICATION_QUERY_KEYS.all });
      options.onSuccess?.(data, id, context);
    },
    ...options,
  });
}

/**
 * Mutation xóa hàng loạt thông báo quản trị viên theo danh sách ID (Admin)
 * @param {Object} [options={}]
 * @returns {import('@tanstack/react-query').UseMutationResult}
 */
export function useAdminBulkDeleteNotificationsMutation(options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (ids) => notificationService.bulkDeleteAdminNotifications(ids),
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: ADMIN_NOTIFICATION_QUERY_KEYS.all });
      options.onSuccess?.(data, variables, context);
    },
    ...options,
  });
}

export default {
  useMarkAsReadMutation,
  useMarkAsUnreadMutation,
  useMarkAllAsReadMutation,
  useDeleteNotificationMutation,
  useDeleteAllNotificationsMutation,
  useCreateNotificationMutation,
  useAdminDeleteNotificationMutation,
  useAdminBulkDeleteNotificationsMutation,
};
