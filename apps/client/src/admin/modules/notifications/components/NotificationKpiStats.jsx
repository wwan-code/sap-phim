/**
 * @file NotificationKpiStats.jsx
 * @module Admin/Modules/Notifications/Components/NotificationKpiStats
 * @description Khối thẻ thống kê KPI thông báo toàn hệ thống chuẩn Material 3 Expressive.
 */

import React, { memo } from 'react';
import PropTypes from 'prop-types';
import {
  Bell,
  CheckCheck,
  AlertTriangle,
  Clock,
} from 'lucide-react';

import './notification-kpi-stats.scss';

export const NotificationKpiStats = memo(({
  stats = {},
  isLoading = false,
}) => {
  const total = stats.total ?? 0;
  const read = stats.read ?? 0;
  const unread = stats.unread ?? 0;
  const readRate = stats.readRate ?? (total > 0 ? Math.round((read / total) * 100) : 0);
  const critical = stats.critical ?? 0;
  const last24h = stats.last24h ?? 0;

  const kpis = [
    {
      id: 'total-notifs',
      title: 'Tổng Thông Báo Đã Phát',
      value: total.toLocaleString('vi-VN'),
      subtitle: `${unread.toLocaleString('vi-VN')} thông báo đang chờ đọc`,
      icon: Bell,
      variant: 'primary',
    },
    {
      id: 'read-rate',
      title: 'Tỷ Lệ Đã Đọc',
      value: `${readRate}%`,
      subtitle: `${read.toLocaleString('vi-VN')} lượt người dùng đã mở xem`,
      icon: CheckCheck,
      variant: 'success',
      progress: readRate,
    },
    {
      id: 'critical-alerts',
      title: 'Cảnh Báo Khẩn & Cao',
      value: critical.toLocaleString('vi-VN'),
      subtitle: critical > 0 ? 'Cần theo dõi mức độ tiếp nhận' : 'Không có cảnh báo rủi ro cao',
      icon: AlertTriangle,
      variant: critical > 0 ? 'danger' : 'neutral',
    },
    {
      id: 'recent-24h',
      title: 'Phát Sinh 24 Giờ Qua',
      value: last24h.toLocaleString('vi-VN'),
      subtitle: 'Tần suất thông báo realtime gần nhất',
      icon: Clock,
      variant: 'accent',
    },
  ];

  return (
    <div className="notification-kpi-container">
      <div className="notification-kpi-grid">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div
              key={kpi.id}
              className={`notification-kpi-card notification-kpi-card--${kpi.variant} ${
                isLoading ? 'notification-kpi-card--loading' : ''
              }`}
            >
              <div className="notification-kpi-card__icon-wrapper">
                <Icon size={22} />
              </div>
              <div className="notification-kpi-card__content">
                <span className="notification-kpi-card__title">{kpi.title}</span>
                <span className="notification-kpi-card__value">
                  {isLoading ? '...' : kpi.value}
                </span>
                <span className="notification-kpi-card__subtitle">{kpi.subtitle}</span>

                {typeof kpi.progress === 'number' && (
                  <div className="notification-kpi-card__progress-bar">
                    <div
                      className="notification-kpi-card__progress-fill"
                      {...{ style: { '--progress': `${Math.min(100, Math.max(0, kpi.progress))}%` } }}
                    />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});

NotificationKpiStats.displayName = 'NotificationKpiStats';

NotificationKpiStats.propTypes = {
  isLoading: PropTypes.bool,
  stats: PropTypes.shape({
    critical: PropTypes.number,
    last24h: PropTypes.number,
    read: PropTypes.number,
    readRate: PropTypes.number,
    total: PropTypes.number,
    unread: PropTypes.number,
  }),
};

export default NotificationKpiStats;
