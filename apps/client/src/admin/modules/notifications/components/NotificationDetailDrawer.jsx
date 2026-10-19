/**
 * @file NotificationDetailDrawer.jsx
 * @module Admin/Modules/Notifications/Components/NotificationDetailDrawer
 * @description Drawer hiển thị chi tiết thông tin, người nhận, tác nhân và payload của thông báo hệ thống.
 */

import React, { memo } from 'react';
import PropTypes from 'prop-types';
import {
  Bell,
  User,
  Clock,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Trash2,
  Calendar,
  Layers,
  Code2,
} from 'lucide-react';

import OffCanvas from '@/shared/components/ui/off-canvas';
import Button from '@/shared/components/ui/button';
import Badge from '@/shared/components/ui/badge';
import Avatar from '@/shared/components/ui/avatar';
import { formatDate } from '@/admin/shared/components/data-display/data-grid';

import './notification-detail-drawer.scss';

export const NotificationDetailDrawer = memo(({
  open = false,
  notification = null,
  onClose,
  onDelete,
}) => {
  if (!notification) return null;

  const isRead = Boolean(notification.is_read);
  const user = notification.user;
  const actor = notification.actor;

  const priorityVariant = {
    critical: 'danger',
    high: 'warning',
    normal: 'primary',
    low: 'neutral',
  }[notification.priority] || 'primary';

  return (
    <OffCanvas
      open={open}
      onClose={onClose}
      placement="right"
      size="large"
      variant="tonal"
      className="notif-detail-drawer"
    >
      <OffCanvas.Header
        title="Chi Tiết Thông Báo Hệ Thống"
        subtitle={`ID: ${notification.id}`}
        onClose={onClose}
        showCloseButton
      />

      <OffCanvas.Body className="notif-detail-drawer__body">
        {/* ── 1. Header Overview Card ── */}
        <div className="notif-detail-drawer__card">
          <div className="notif-detail-drawer__title-row">
            <span className="notif-detail-drawer__icon">
              {notification.icon || '🔔'}
            </span>
            <div className="notif-detail-drawer__title-group">
              <h3 className="notif-detail-drawer__title">
                {notification.title || 'Không có tiêu đề'}
              </h3>
              <div className="notif-detail-drawer__meta-badges">
                <Badge variant={priorityVariant} size="sm">
                  Ưu tiên: {notification.priority || 'normal'}
                </Badge>
                <Badge variant="neutral" size="sm">
                  Loại: {notification.type || 'system'}
                </Badge>
                <Badge variant={isRead ? 'success' : 'warning'} size="sm">
                  {isRead ? 'Đã đọc' : 'Chưa đọc'}
                </Badge>
              </div>
            </div>
          </div>

          <div className="notif-detail-drawer__message-box">
            <span className="notif-detail-drawer__label">Nội dung thông báo:</span>
            <p className="notif-detail-drawer__message">
              {notification.message}
            </p>
          </div>

          {notification.action_url && (
            <div className="notif-detail-drawer__action-url">
              <span className="notif-detail-drawer__label">Đường dẫn hành động:</span>
              <a
                href={notification.action_url}
                target="_blank"
                rel="noreferrer"
                className="notif-detail-drawer__link"
              >
                <ExternalLink size={14} />
                <span>{notification.action_url}</span>
              </a>
            </div>
          )}
        </div>

        {/* ── 2. Recipient & Actor Info ── */}
        <div className="notif-detail-drawer__grid">
          {/* Recipient */}
          <div className="notif-detail-drawer__card notif-detail-drawer__card--sub">
            <div className="notif-detail-drawer__card-header">
              <User size={16} />
              <span>Người Nhận (Recipient)</span>
            </div>
            {user ? (
              <div className="notif-detail-drawer__person">
                <Avatar
                  src={user.avatar_url}
                  name={user.username || user.full_name}
                  size="md"
                />
                <div className="notif-detail-drawer__person-info">
                  <span className="notif-detail-drawer__person-name">
                    {user.full_name || user.username}
                  </span>
                  {user.email && (
                    <span className="notif-detail-drawer__person-sub">
                      {user.email}
                    </span>
                  )}
                  <span className="notif-detail-drawer__person-id">
                    ID: {user.id}
                  </span>
                </div>
              </div>
            ) : (
              <div className="notif-detail-drawer__empty-state">
                <Layers size={18} />
                <span>Toàn bộ người dùng hệ thống (Broadcast All)</span>
              </div>
            )}
          </div>

          {/* Actor */}
          <div className="notif-detail-drawer__card notif-detail-drawer__card--sub">
            <div className="notif-detail-drawer__card-header">
              <Bell size={16} />
              <span>Tác Nhân Khởi Tạo (Actor)</span>
            </div>
            {actor ? (
              <div className="notif-detail-drawer__person">
                <Avatar
                  src={actor.avatar_url}
                  name={actor.username}
                  size="md"
                />
                <div className="notif-detail-drawer__person-info">
                  <span className="notif-detail-drawer__person-name">
                    {actor.username}
                  </span>
                  <span className="notif-detail-drawer__person-id">
                    ID: {actor.id}
                  </span>
                </div>
              </div>
            ) : (
              <div className="notif-detail-drawer__empty-state">
                <CheckCircle2 size={18} />
                <span>Hệ thống tự động / Quản trị viên (System Event)</span>
              </div>
            )}
          </div>
        </div>

        {/* ── 3. Lifecycle & Timing ── */}
        <div className="notif-detail-drawer__card">
          <div className="notif-detail-drawer__card-header">
            <Clock size={16} />
            <span>Thời Gian & Vòng Đời</span>
          </div>

          <div className="notif-detail-drawer__timeline">
            <div className="notif-detail-drawer__timeline-item">
              <span className="notif-detail-drawer__timeline-label">Thời gian phát sóng:</span>
              <span className="notif-detail-drawer__timeline-val">
                {notification.created_at ? formatDate(notification.created_at, 'HH:mm - DD/MM/YYYY') : '—'}
              </span>
            </div>

            <div className="notif-detail-drawer__timeline-item">
              <span className="notif-detail-drawer__timeline-label">Trạng thái đọc:</span>
              <span className="notif-detail-drawer__timeline-val">
                {isRead
                  ? `Đã đọc lúc ${notification.read_at ? formatDate(notification.read_at, 'HH:mm - DD/MM/YYYY') : '—'}`
                  : 'Chưa đọc'}
              </span>
            </div>

            <div className="notif-detail-drawer__timeline-item">
              <span className="notif-detail-drawer__timeline-label">Thời hạn hiệu lực:</span>
              <span className="notif-detail-drawer__timeline-val">
                {notification.expires_at ? formatDate(notification.expires_at, 'HH:mm - DD/MM/YYYY') : 'Không thời hạn (Vĩnh viễn)'}
              </span>
            </div>

            {notification.group_key && (
              <div className="notif-detail-drawer__timeline-item">
                <span className="notif-detail-drawer__timeline-label">Khóa phân nhóm (Group Key):</span>
                <code className="notif-detail-drawer__code">{notification.group_key}</code>
              </div>
            )}
          </div>
        </div>

        {/* ── 4. Action Data / Payload JSON ── */}
        {notification.action_data && (
          <div className="notif-detail-drawer__card">
            <div className="notif-detail-drawer__card-header">
              <Code2 size={16} />
              <span>Dữ Liệu Bổ Sung (Action Data JSON)</span>
            </div>
            <pre className="notif-detail-drawer__json-block">
              {JSON.stringify(notification.action_data, null, 2)}
            </pre>
          </div>
        )}
      </OffCanvas.Body>

      <OffCanvas.Footer align="between" className="notif-detail-drawer__footer">
        {onDelete && (
          <Button
            type="button"
            variant="tonal"
            icon={Trash2}
            onClick={() => onDelete(notification)}
            className="notif-detail-drawer__delete-btn"
          >
            Xóa thông báo này
          </Button>
        )}

        <Button
          type="button"
          variant="filled"
          onClick={onClose}
        >
          Đóng
        </Button>
      </OffCanvas.Footer>
    </OffCanvas>
  );
});

NotificationDetailDrawer.displayName = 'NotificationDetailDrawer';

NotificationDetailDrawer.propTypes = {
  notification: PropTypes.shape({
    action_data: PropTypes.object,
    action_url: PropTypes.string,
    actor: PropTypes.object,
    created_at: PropTypes.string,
    expires_at: PropTypes.string,
    group_key: PropTypes.string,
    icon: PropTypes.string,
    id: PropTypes.string,
    is_read: PropTypes.bool,
    message: PropTypes.string,
    priority: PropTypes.string,
    read_at: PropTypes.string,
    title: PropTypes.string,
    type: PropTypes.string,
    user: PropTypes.object,
  }),
  onClose: PropTypes.func,
  onDelete: PropTypes.func,
  open: PropTypes.bool,
};

export default NotificationDetailDrawer;
