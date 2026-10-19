/**
 * @file AdminHeaderNotifications.jsx
 * @module Admin/Layout/Header/Components/AdminHeaderNotifications
 * @component AdminHeaderNotifications
 * @description Subcomponent nút thông báo trên Admin Header kết nối dữ liệu thực từ useAdminNotificationsQuery, tích hợp Badge pulse và Dropdown Popover xem nhanh 5 thông báo mới nhất chuẩn Material 3 Expressive.
 */

import React, { memo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import {
  Bell,
  ArrowRight,
  Film,
  User,
  AlertCircle,
  CreditCard,
  MessageSquare,
  Shield,
  Loader2,
} from 'lucide-react';

import IconButton from '@/shared/components/ui/icon-button/IconButton';
import Badge from '@/shared/components/ui/badge/Badge';
import Tooltip from '@/shared/components/ui/tooltip/Tooltip';
import { ROUTES } from '@/shared/constants/routes.constants';
import { useFloatingDropdown } from '@/hooks/ui/use-floating-dropdown';
import {
  useAdminNotificationsQuery,
  useAdminNotificationStatsQuery,
} from '@/hooks/queries/use-notification.queries';

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
 * Lấy Icon tương ứng theo loại thông báo
 */
const getNotificationIcon = (type) => {
  switch (type) {
    case 'movie_new':
    case 'movie_update':
    case 'movie_new_episode':
      return Film;
    case 'payment_request_pending':
    case 'payment_approved':
    case 'payment_rejected':
    case 'payment_refunded':
      return CreditCard;
    case 'new_follower':
    case 'friend_request_received':
    case 'friend_request_accepted':
      return User;
    case 'comment_reply':
    case 'comment_like':
    case 'comment_mention':
      return MessageSquare;
    case 'account_security':
      return Shield;
    default:
      return AlertCircle;
  }
};

/**
 * @component AdminHeaderNotifications
 * @description Nút thông báo hệ thống kèm Dropdown Popover kết nối dữ liệu thực (Dumb UI)
 */
export const AdminHeaderNotifications = memo(() => {
  const navigate = useNavigate();

  // 1. TanStack Queries: Dữ liệu thực từ server
  const { data: statsData } = useAdminNotificationStatsQuery();
  const unreadCount = statsData?.unread ?? 0;

  const dropdown = useFloatingDropdown({
    placement: 'bottom-end',
    offset: 8,
    trigger: 'click',
    adaptToDevice: false,
    usePortal: true,
  });

  const {
    isOpen,
    isMounted,
    refs,
    context,
    floatingStyles,
    getReferenceProps,
    getFloatingProps,
    setIsOpen,
    FloatingPortal,
    FloatingFocusManager,
    portalId,
    focusTrap,
  } = dropdown;

  const { data: notifData, isLoading } = useAdminNotificationsQuery(
    { limit: 5 },
    { enabled: isOpen },
  );
  const notifications = notifData?.items || [];

  const handleNotificationClick = useCallback(
    (notif) => {
      setIsOpen(false);
      if (notif.action_url) {
        navigate(notif.action_url);
      } else {
        navigate(ROUTES.ADMIN.NOTIFICATIONS);
      }
    },
    [navigate, setIsOpen],
  );

  const handleViewAll = useCallback(() => {
    setIsOpen(false);
    navigate(ROUTES.ADMIN.NOTIFICATIONS);
  }, [navigate, setIsOpen]);

  return (
    <div className="admin-header-notifications">
      <Tooltip title={`Thông báo hệ thống ${unreadCount > 0 ? `(${unreadCount} mới)` : ''}`}>
        <div ref={refs.setReference} {...getReferenceProps()} className="admin-header-notifications__trigger">
          <Badge
            dot={unreadCount > 0}
            pulse={unreadCount > 0}
            variant="primary"
            placement="top-right"
            className="admin-header__notif-badge"
          >
            <IconButton
              size="medium"
              variant="tonal"
              aria-label="Xem thông báo hệ thống"
              aria-expanded={isOpen}
              aria-haspopup="true"
              className={classNames('admin-header__notif-btn', {
                'admin-header__notif-btn--active': isOpen,
              })}
            >
              <Bell size={18} />
            </IconButton>
          </Badge>
        </div>
      </Tooltip>

      {isMounted && (
        <FloatingPortal id={portalId}>
          <FloatingFocusManager context={context} modal={focusTrap}>
            <div
              ref={refs.setFloating}
              style={floatingStyles}
              {...getFloatingProps({
                className: 'admin-header-notifications__dropdown',
                role: 'dialog',
                'aria-label': 'Bảng thông báo hệ thống',
              })}
            >
              {/* Header */}
              <div className="admin-header-notifications__header">
                <div className="admin-header-notifications__title-wrap">
                  <span className="admin-header-notifications__title">Thông báo hệ thống</span>
                  {unreadCount > 0 && (
                    <Badge size="small" variant="primary" content={`${unreadCount} mới`} />
                  )}
                </div>
              </div>

              {/* Notification List */}
              <div className="admin-header-notifications__list" role="list">
                {isLoading ? (
                  <div className="admin-header-notifications__state">
                    <Loader2 size={18} className="app-header__notifications-spinner" />
                    <span>Đang tải thông báo...</span>
                  </div>
                ) : notifications.length > 0 ? (
                  notifications.map((notif) => {
                    const IconComponent = getNotificationIcon(notif.type);
                    const isUnread = !notif.is_read;

                    return (
                      <div
                        key={notif.id}
                        className={classNames('admin-header-notifications__item', {
                          'admin-header-notifications__item--unread': isUnread,
                        })}
                        role="listitem"
                        tabIndex={0}
                        onClick={() => handleNotificationClick(notif)}
                        onKeyDown={(e) =>
                          (e.key === 'Enter' || e.key === ' ') && handleNotificationClick(notif)
                        }
                      >
                        <div className="admin-header-notifications__item-icon">
                          <IconComponent size={16} aria-hidden="true" />
                        </div>
                        <div className="admin-header-notifications__item-content">
                          <div className="admin-header-notifications__item-head">
                            <span className="admin-header-notifications__item-title">
                              {notif.title}
                            </span>
                            {isUnread && <span className="admin-header-notifications__dot" />}
                          </div>
                          {notif.message && (
                            <p className="admin-header-notifications__item-message">
                              {notif.message}
                            </p>
                          )}
                          {notif.created_at && (
                            <span className="admin-header-notifications__item-time">
                              {formatRelativeTime(notif.created_at)}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="admin-header-notifications__state">
                    <Bell size={24} className="app-header__notifications-empty-icon" />
                    <span>Không có thông báo mới nào</span>
                  </div>
                )}
              </div>

              {/* Footer Link */}
              <div className="admin-header-notifications__footer">
                <button
                  type="button"
                  className="admin-header-notifications__view-all-btn"
                  onClick={handleViewAll}
                >
                  <span>Xem tất cả thông báo</span>
                  <ArrowRight size={14} aria-hidden="true" />
                </button>
              </div>
            </div>
          </FloatingFocusManager>
        </FloatingPortal>
      )}
    </div>
  );
});

AdminHeaderNotifications.displayName = 'AdminHeaderNotifications';

export default AdminHeaderNotifications;
