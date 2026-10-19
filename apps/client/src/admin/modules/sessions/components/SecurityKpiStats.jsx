/**
 * @file SecurityKpiStats.jsx
 * @module Admin/Modules/Sessions/Components/SecurityKpiStats
 * @description Khối thẻ thống kê KPI an ninh mạng và phiên đăng nhập chuẩn Material 3 Expressive.
 */

import React, { memo } from 'react';
import PropTypes from 'prop-types';
import {
  Users,
  ShieldAlert,
  KeyRound,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';
import IconButton from '@/shared/components/ui/icon-button';

export const SecurityKpiStats = memo(({
  sessionStats = {},
  auditStats = {},
  isLoading = false,
  onRefresh,
}) => {
  const totalActive = sessionStats.total_active ?? 0;
  const highRisk = sessionStats.high_risk ?? 0;
  const totalRevoked = sessionStats.total_revoked ?? 0;
  const failedLogins24h =
    auditStats.failed_logins_24h ?? sessionStats.failed_logins_24h ?? 0;
  const securityEvents = auditStats.security_events ?? 0;
  const criticalEvents = auditStats.critical_events ?? 0;

  const kpis = [
    {
      id: 'active-sessions',
      title: 'Phiên Hoạt Động',
      value: totalActive.toLocaleString(),
      subtitle: `${totalRevoked.toLocaleString()} phiên đã bị thu hồi`,
      icon: Users,
      accent: 'var(--sp-color-status-success, #10b981)',
      bgGlow: 'rgba(16, 185, 129, 0.12)',
    },
    {
      id: 'high-risk',
      title: 'Phiên Rủi Ro Cao',
      value: highRisk.toLocaleString(),
      subtitle: 'Điểm rủi ro cảnh báo ≥ 50',
      icon: ShieldAlert,
      accent: highRisk > 0 ? 'var(--sp-color-status-error, #ef4444)' : 'var(--sp-color-status-success, #10b981)',
      bgGlow: highRisk > 0 ? 'rgba(239, 68, 68, 0.12)' : 'rgba(16, 185, 129, 0.12)',
    },
    {
      id: 'failed-logins',
      title: 'Đăng Nhập Thất Bại (24h)',
      value: failedLogins24h.toLocaleString(),
      subtitle: 'Dấu hiệu dò mật khẩu / brute force',
      icon: KeyRound,
      accent: failedLogins24h > 10 ? 'var(--sp-color-status-warning, #f59e0b)' : 'var(--sp-color-status-info, #3b82f6)',
      bgGlow: 'rgba(245, 158, 11, 0.12)',
    },
    {
      id: 'security-events',
      title: 'Sự Kiện Bảo Mật & Lỗi',
      value: securityEvents.toLocaleString(),
      subtitle: `${criticalEvents} sự kiện mức độ nguy cấp`,
      icon: ShieldCheck,
      accent: 'var(--sp-color-brand-accent, #7c5dfa)',
      bgGlow: 'rgba(124, 93, 250, 0.15)',
    },
  ];

  return (
    <div className="security-kpi-container">
      <div className="security-kpi-grid">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div
              key={kpi.id}
              className={`security-kpi-card ${isLoading ? 'security-kpi-card--loading' : ''}`}
              // Dynamic tonal accent via CSS custom properties (not inline styles)
              // eslint-disable-next-line react/no-unknown-property
              {...{ style: { '--kpi-accent': kpi.accent, '--kpi-bg': kpi.bgGlow } }}
            >
              <div className="security-kpi-card__icon-wrapper">
                <Icon size={22} />
              </div>
              <div className="security-kpi-card__content">
                <span className="security-kpi-card__title">{kpi.title}</span>
                <span className="security-kpi-card__value">
                  {isLoading ? '...' : kpi.value}
                </span>
                <span className="security-kpi-card__subtitle">{kpi.subtitle}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});

SecurityKpiStats.propTypes = {
  sessionStats: PropTypes.object,
  auditStats: PropTypes.object,
  isLoading: PropTypes.bool,
  onRefresh: PropTypes.func,
};

export default SecurityKpiStats;
