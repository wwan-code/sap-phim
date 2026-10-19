/**
 * @file NotificationToast.jsx
 * @module Components/UI/NotificationToast
 * @description Component hiển thị Toast thông báo tương tác thời gian thực chuẩn Material 3 Expressive, hỗ trợ Avatar người tương tác và click điều hướng.
 */

import React, { memo } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { Bell, X } from 'lucide-react';

import './notification-toast.scss';

/**
 * @component NotificationToast
 * @description Toast thông báo nổi tương tác (Dumb UI)
 */
export const NotificationToast = memo(({
  notification,
  visible = true,
  onClick,
  onClose,
}) => {
  if (!notification) return null;

  const hasAction = Boolean(notification.action_url);
  const actorAvatar = notification.actor?.avatar_url;
  const actorName = notification.actor?.username || notification.actor?.name;

  return (
    <div
      role="alert"
      aria-live="polite"
      className={classNames('sp-notif-toast', {
        'sp-notif-toast--enter': visible,
        'sp-notif-toast--exit': !visible,
        'sp-notif-toast--interactive': hasAction,
      })}
      onClick={onClick}
    >
      <div className="sp-notif-toast__icon-container">
        {actorAvatar ? (
          <img
            src={actorAvatar}
            alt={actorName || 'Avatar'}
            className="sp-notif-toast__avatar"
            loading="lazy"
          />
        ) : notification.icon && typeof notification.icon === 'string' ? (
          <span aria-hidden="true">{notification.icon}</span>
        ) : (
          <Bell size={18} aria-hidden="true" />
        )}
      </div>

      <div className="sp-notif-toast__content">
        <span className="sp-notif-toast__title">{notification.title}</span>
        {notification.message && (
          <p className="sp-notif-toast__message">{notification.message}</p>
        )}
      </div>

      {onClose && (
        <button
          type="button"
          className="sp-notif-toast__close"
          aria-label="Đóng thông báo"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
        >
          <X size={14} aria-hidden="true" />
        </button>
      )}
    </div>
  );
});

NotificationToast.displayName = 'NotificationToast';

NotificationToast.propTypes = {
  notification: PropTypes.shape({
    id: PropTypes.string,
    title: PropTypes.string,
    message: PropTypes.string,
    icon: PropTypes.any,
    action_url: PropTypes.string,
    actor: PropTypes.shape({
      avatar_url: PropTypes.string,
      username: PropTypes.string,
      name: PropTypes.string,
    }),
  }),
  visible: PropTypes.bool,
  onClick: PropTypes.func,
  onClose: PropTypes.func,
};

export default NotificationToast;
