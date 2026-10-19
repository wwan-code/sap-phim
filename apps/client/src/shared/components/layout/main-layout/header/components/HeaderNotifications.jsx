/**
 * @file HeaderNotifications.jsx
 * @module Components/Layout/Header/Components/HeaderNotifications
 * @component HeaderNotifications
 * @description Subcomponent nút chuông thông báo và menu popover danh sách thông báo theo chuẩn Material 3 Expressive, kết nối trực tiếp TanStack Query, Mutation Hooks và Router Navigation.
 */

import React, { memo, useCallback } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { Bell, CheckCheck, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import IconButton from '@/shared/components/ui/icon-button/IconButton';
import { useFloatingDropdown } from '@/hooks/ui/use-floating-dropdown';
import {
  useNotificationUnreadCountQuery,
  useInfiniteNotificationsQuery,
} from '@/hooks/queries/use-notification.queries';
import {
  useMarkAsReadMutation,
  useMarkAllAsReadMutation,
} from '@/hooks/mutations/use-notification.mutations';

/**
 * Format thời gian hiển thị thân thiện
 */
const formatRelativeTime = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMinutes < 1) return 'Vừa xong';
  if (diffMinutes < 60) return `${diffMinutes} phút trước`;
  if (diffHours < 24) return `${diffHours} giờ trước`;
  if (diffDays < 7) return `${diffDays} ngày trước`;
  return date.toLocaleDateString('vi-VN');
};

/**
 * @component HeaderNotifications
 * @description Nút hiển thị danh sách thông báo người dùng kết nối TanStack Query
 */
const HeaderNotifications = memo(({
  notifications: propsNotifications,
  unreadCount: propsUnreadCount,
  isLoading: propsIsLoading,
  isOpen = false,
  onOpen,
  onClose,
  onMarkAllRead: propsOnMarkAllRead,
}) => {
  const navigate = useNavigate();

  // 1. TanStack Query: Unread Count
  const { data: queryUnreadCount = 0 } = useNotificationUnreadCountQuery();
  const resolvedUnreadCount =
    typeof propsUnreadCount === 'number' ? propsUnreadCount : queryUnreadCount;

  // 2. TanStack Query: Infinite Notifications List (khi mở popover)
  const {
    data: infiniteData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: isQueryLoading,
  } = useInfiniteNotificationsQuery({ limit: 15 }, { enabled: isOpen });

  const queryNotifications =
    infiniteData?.pages?.flatMap((page) => page.items || []) || [];
  const resolvedNotifications =
    Array.isArray(propsNotifications) && propsNotifications.length > 0
      ? propsNotifications
      : queryNotifications;
  const resolvedLoading = propsIsLoading ?? (isOpen && isQueryLoading);

  // 3. TanStack Mutations
  const { mutate: markAsRead } = useMarkAsReadMutation();
  const { mutate: markAllAsRead, isPending: isMarkingAll } = useMarkAllAsReadMutation();

  const handleMarkAllRead = useCallback(() => {
    if (propsOnMarkAllRead) {
      propsOnMarkAllRead();
    } else {
      markAllAsRead();
    }
  }, [propsOnMarkAllRead, markAllAsRead]);

  const handleItemClick = useCallback(
    (item) => {
      if (!item) return;

      if (!item.is_read) {
        markAsRead(item.id);
      }

      if (item.action_url) {
        onClose?.();
        navigate(item.action_url);
      }
    },
    [markAsRead, navigate, onClose],
  );

  const dropdown = useFloatingDropdown({
    placement: 'bottom-end',
    isOpen,
    onOpenChange: (open) => (open ? onOpen?.() : onClose?.()),
    offset: 12,
    adaptToDevice: true,
  });

  const {
    isMounted,
    floatingStyles,
    refs,
    context,
    getReferenceProps,
    getFloatingProps,
    FloatingPortal,
    FloatingFocusManager,
    portalId,
  } = dropdown;

  return (
    <div className="app-header__notifications-wrapper">
      <IconButton
        ref={refs.setReference}
        variant="tonal"
        size="medium"
        {...getReferenceProps()}
        aria-label={`Thông báo (${resolvedUnreadCount} chưa đọc)`}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        className={classNames('app-header__action-btn app-header__notifications-btn', {
          'app-header__action-btn--active': isOpen,
        })}
      >
        <Bell size={18} />
        {resolvedUnreadCount > 0 && (
          <span className="app-header__notification-badge" aria-hidden="true">
            {resolvedUnreadCount > 99 ? '99+' : resolvedUnreadCount}
          </span>
        )}
      </IconButton>

      {isMounted && (
        <FloatingPortal id={portalId}>
          <FloatingFocusManager context={context} modal={false}>
            <div
              ref={refs.setFloating}
              style={floatingStyles}
              {...getFloatingProps({
                className: 'app-header__notifications-popover',
                role: 'dialog',
                'aria-label': 'Danh sách thông báo',
              })}
            >
              <div className="app-header__notifications-header">
                <h3 className="app-header__notifications-title">Thông báo</h3>
                {resolvedNotifications.length > 0 && (
                  <button
                    type="button"
                    className="app-header__notifications-read-all"
                    onClick={handleMarkAllRead}
                    disabled={isMarkingAll || resolvedUnreadCount === 0}
                  >
                    <CheckCheck size={14} />
                    <span>Đã đọc tất cả</span>
                  </button>
                )}
              </div>

              <div className="app-header__notifications-body">
                {resolvedLoading ? (
                  <div className="app-header__notifications-state">
                    <Loader2 size={20} className="app-header__notifications-spinner" />
                    <span>Đang tải thông báo...</span>
                  </div>
                ) : resolvedNotifications.length > 0 ? (
                  <>
                    <ul className="app-header__notifications-list" role="list">
                      {resolvedNotifications.map((item, idx) => {
                        const actorAvatar = item.actor?.avatar_url;
                        const actorName = item.actor?.username || 'Avatar';

                        return (
                          <li
                            key={item.id || idx}
                            onClick={() => handleItemClick(item)}
                            className={classNames('app-header__notification-item', {
                              'app-header__notification-item--unread': !item.is_read,
                            })}
                          >
                            <div className="app-header__notification-avatar-container">
                              {actorAvatar ? (
                                <img
                                  src={actorAvatar}
                                  alt={actorName}
                                  className="app-header__notification-avatar"
                                  loading="lazy"
                                />
                              ) : item.icon && typeof item.icon === 'string' ? (
                                <span className="app-header__notification-icon" aria-hidden="true">
                                  {item.icon}
                                </span>
                              ) : (
                                <Bell size={16} aria-hidden="true" />
                              )}
                            </div>

                            <div className="app-header__notification-content">
                              <div className="app-header__notification-item-header">
                                <p className="app-header__notification-item-title">{item.title}</p>
                                {!item.is_read && (
                                  <span
                                    className="app-header__notification-item-dot"
                                    aria-label="Chưa đọc"
                                  />
                                )}
                              </div>
                              {item.message && (
                                <p className="app-header__notification-item-msg">{item.message}</p>
                              )}
                              {item.created_at && (
                                <span className="app-header__notification-item-time">
                                  {formatRelativeTime(item.created_at)}
                                </span>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>

                    {hasNextPage && (
                      <div className="app-header__notifications-footer">
                        <button
                          type="button"
                          onClick={() => fetchNextPage()}
                          disabled={isFetchingNextPage}
                          className="app-header__notifications-load-more"
                        >
                          {isFetchingNextPage ? (
                            <>
                              <Loader2 size={14} className="app-header__notifications-spinner" />
                              <span>Đang tải thêm...</span>
                            </>
                          ) : (
                            <span>Xem thêm thông báo</span>
                          )}
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="app-header__notifications-state">
                    <Bell size={28} className="app-header__notifications-empty-icon" />
                    <span>Bạn không có thông báo mới nào</span>
                  </div>
                )}
              </div>
            </div>
          </FloatingFocusManager>
        </FloatingPortal>
      )}
    </div>
  );
});

HeaderNotifications.displayName = 'HeaderNotifications';

HeaderNotifications.propTypes = {
  notifications: PropTypes.array,
  unreadCount: PropTypes.number,
  isLoading: PropTypes.bool,
  isOpen: PropTypes.bool,
  onOpen: PropTypes.func,
  onClose: PropTypes.func,
  onMarkAllRead: PropTypes.func,
};

export default HeaderNotifications;