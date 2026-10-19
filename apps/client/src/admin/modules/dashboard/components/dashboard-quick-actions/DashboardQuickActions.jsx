/**
 * @file DashboardQuickActions.jsx
 * @module Admin/Modules/Dashboard/Components
 */

import React, { memo } from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import { PlusCircle, Users, CreditCard, Calendar, RefreshCw } from 'lucide-react';
import { SectionCard } from '@admin/shared/components/layout/section-card/SectionCard';
import { ROUTES } from '@shared/constants';
import './dashboard-quick-actions.scss';

export const DashboardQuickActions = memo(function DashboardQuickActions({
  onRefresh,
  isRefreshing = false,
}) {
  const actions = [
    {
      id: 'add-movie',
      label: 'Thêm phim mới',
      desc: 'Tạo hồ sơ anime/phim & tập',
      icon: PlusCircle,
      to: ROUTES.ADMIN.MOVIE,
      color: 'var(--sys-color-primary, #ff7f24)',
      bgRgb: 'var(--sys-color-primary-rgb, 255, 127, 36)',
    },
    {
      id: 'manage-users',
      label: 'Quản lý người dùng',
      desc: 'Thành viên, VIP & Phân quyền',
      icon: Users,
      to: ROUTES.ADMIN.USERS,
      color: '#0ea5e9',
      bgRgb: '14, 165, 233',
    },
    {
      id: 'approve-vip',
      label: 'Duyệt thanh toán & VIP',
      desc: 'Gói hội viên & Yêu cầu nạp',
      icon: CreditCard,
      to: '/admin/subscriptions',
      color: '#f59e0b',
      bgRgb: '245, 158, 11',
    },
    {
      id: 'broadcast-calendar',
      label: 'Lịch phát sóng',
      desc: 'Lên lịch & Phát hành tự động',
      icon: Calendar,
      to: '/admin/broadcast-schedules',
      color: '#8b5cf6',
      bgRgb: '139, 92, 246',
    },
  ];

  return (
    <SectionCard
      title="Thao Tác Nhanh"
      subtitle="Các lối tắt quản trị thường dùng nhất"
      className="dashboard-quick-actions-card"
    >
      <div className="dashboard-quick-actions">
        {actions.map((act) => {
          const Icon = act.icon;
          return (
            <Link
              key={act.id}
              to={act.to}
              className="dashboard-quick-actions__item"
              style={{
                '--act-color': act.color,
                '--act-bg-rgb': act.bgRgb,
              }}
            >
              <div
                className="dashboard-quick-actions__icon-box"
                style={{
                  color: act.color,
                  backgroundColor: `rgba(${act.bgRgb}, 0.14)`,
                  borderColor: `rgba(${act.bgRgb}, 0.25)`,
                }}
              >
                <Icon size={18} />
              </div>
              <div className="dashboard-quick-actions__text">
                <span className="dashboard-quick-actions__label">{act.label}</span>
                <span className="dashboard-quick-actions__desc">{act.desc}</span>
              </div>
            </Link>
          );
        })}

        {/* Nút Làm Mới Dữ Liệu Live */}
        <button
          type="button"
          className={`dashboard-quick-actions__item dashboard-quick-actions__item--btn ${isRefreshing ? 'dashboard-quick-actions__item--loading' : ''
            }`}
          onClick={onRefresh}
          disabled={isRefreshing}
          style={{
            '--act-color': 'var(--sys-color-primary, #ff7f24)',
            '--act-bg-rgb': 'var(--sys-color-primary-rgb, 255, 127, 36)',
          }}
        >
          <div
            className="dashboard-quick-actions__icon-box dashboard-quick-actions__icon-box--refresh"
            style={{
              color: 'var(--sys-color-primary, #ff7f24)',
              backgroundColor: 'rgba(var(--sys-color-primary-rgb, 255, 127, 36), 0.14)',
              borderColor: 'rgba(var(--sys-color-primary-rgb, 255, 127, 36), 0.25)',
            }}
          >
            <RefreshCw size={18} className={isRefreshing ? 'dashboard-quick-actions__spin' : ''} />
          </div>
          <div className="dashboard-quick-actions__text">
            <span className="dashboard-quick-actions__label">
              {isRefreshing ? 'Đang làm mới...' : 'Làm mới số liệu'}
            </span>
            <span className="dashboard-quick-actions__desc">Đồng bộ dữ liệu thời gian thực</span>
          </div>
        </button>
      </div>
    </SectionCard>
  );
});

DashboardQuickActions.propTypes = {
  onRefresh: PropTypes.func,
  isRefreshing: PropTypes.bool,
};

export default DashboardQuickActions;
