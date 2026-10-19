/**
 * @file SubscriptionDetailDrawer.jsx
 * @module Admin/Modules/Subscriptions/Components/SubscriptionDetailDrawer
 * @description Drawer xem chi tiết thuê bao VIP, tiến trình thời hạn, thông tin thanh toán và thao tác thu hồi gói.
 */

import React, { memo } from 'react';
import PropTypes from 'prop-types';
import {
  Crown,
  Sparkles,
  Gem,
  Zap,
  Star,
  Info,
  User,
  Clock,
  Calendar,
  CreditCard,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  XCircle,
  FileText,
  Trash2,
  Lock,
} from 'lucide-react';

import OffCanvas from '@/shared/components/ui/off-canvas';
import Button from '@/shared/components/ui/button';
import Badge from '@/shared/components/ui/badge';
import Avatar from '@/shared/components/ui/avatar';
import { formatDate } from '@/admin/shared/components/data-display/data-grid';

import './subscription-detail-drawer.scss';

// ── Icon Map ──
const ICON_MAP = {
  Crown,
  Sparkles,
  Gem,
  Zap,
  Star,
  Info,
};

// ── Status Config ──
const STATUS_CONFIG = {
  active: { label: 'Đang hiệu lực', variant: 'success' },
  grace_period: { label: 'Đang ân hạn', variant: 'warning' },
  pending: { label: 'Chờ thanh toán', variant: 'default' },
  expired: { label: 'Đã hết hạn', variant: 'neutral' },
  cancelled: { label: 'Đã thu hồi / Hủy', variant: 'error' },
};

/**
 * Format tiền tệ VND
 */
const formatCurrency = (val) => {
  const num = Number(val);
  if (isNaN(num) || num <= 0) return '0 ₫';
  return `${new Intl.NumberFormat('vi-VN').format(num)} ₫`;
};

export const SubscriptionDetailDrawer = memo(({
  open = false,
  subscription = null,
  onClose,
  onRevoke,
}) => {
  if (!subscription) return null;

  const plan = subscription.plan;
  const user = subscription.user;
  const statusCfg = STATUS_CONFIG[subscription.status] || {
    label: subscription.status,
    variant: 'default',
  };

  const IconComp = ICON_MAP[plan?.icon_name] || Crown;
  const badgeColor = plan?.badge_color || '#FF6D00';

  const tier = (subscription.plan?.tier || subscription.tier || 'free').toLowerCase();

  // Tính toán thời gian còn lại
  const startDate = new Date(subscription.starts_at || subscription.created_at);
  const endDate = new Date(subscription.expires_at);
  const now = new Date();

  const totalDuration = Math.max(1, endDate.getTime() - startDate.getTime());
  const elapsed = Math.max(0, now.getTime() - startDate.getTime());
  const progressPercent = Math.min(100, Math.max(0, Math.round((elapsed / totalDuration) * 100)));

  const msRemaining = endDate.getTime() - now.getTime();
  const daysRemaining = Math.ceil(msRemaining / (1000 * 60 * 60 * 24));
  const isPermanent = tier === 'free' || daysRemaining > 3650;
  const isExpired = !isPermanent && msRemaining <= 0;
  const isUrgent = !isPermanent && !isExpired && daysRemaining <= 3;

  const canRevoke =
    tier !== 'free' && (subscription.status === 'active' || subscription.status === 'grace_period');

  return (
    <OffCanvas
      open={open}
      onClose={onClose}
      placement="right"
      size="large"
      variant="tonal"
      className="subscription-detail-drawer"
    >
      <OffCanvas.Header
        title="Chi Tiết Thuê Bao"
        subtitle={`Mã: ${subscription.id}`}
        onClose={onClose}
        showCloseButton
      />

      <OffCanvas.Body className="subscription-detail-drawer__body">
        {/* ── 1. Thẻ Gói VIP ── */}
        <div className="subscription-detail-drawer__plan-card">
          <div className="subscription-detail-drawer__plan-card-meta">
            <div
              className="subscription-detail-drawer__plan-card-icon"
              style={{ backgroundColor: `${badgeColor}18`, color: badgeColor }}
            >
              <IconComp size={22} />
            </div>
            <div className="subscription-detail-drawer__plan-card-info">
              <span className="plan-title">{plan?.name || (tier === 'free' ? 'Sạp Miễn phí' : `Gói ${tier}`)}</span>
              <span className="plan-cycle">
                Chu kỳ:{' '}
                {subscription.billing_cycle === 'yearly' ? 'Theo năm (Yearly)' : 'Theo tháng (Monthly)'}
              </span>
            </div>
          </div>

          <Badge variant={statusCfg.variant} size="medium">
            {statusCfg.label}
          </Badge>
        </div>

        {/* ── 2. Thông Tin Người Dùng ── */}
        <div>
          <div className="subscription-detail-drawer__section-title">
            <User size={15} /> Người Dùng Thuê Bao
          </div>

          <div className="subscription-detail-drawer__user-card">
            <div className="subscription-detail-drawer__user-avatar">
              {user?.avatar_url ? (
                <img
                  src={user.avatar_url}
                  alt={user.full_name || user.username}
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              ) : (
                <span className="fallback">
                  {(user?.full_name || user?.username || 'U').slice(0, 2).toUpperCase()}
                </span>
              )}
            </div>
            <div className="subscription-detail-drawer__user-card-info">
              <span className="name">{user?.full_name || user?.username || 'N/A'}</span>
              <span className="sub">
                @{user?.username} • {user?.email}
              </span>
            </div>
          </div>
        </div>

        {/* ── 3. Tiến Trình Thời Hạn ── */}
        <div>
          <div className="subscription-detail-drawer__section-title">
            <Clock size={15} /> Thời Hạn & Tiến Trình
          </div>

          <div className="subscription-detail-drawer__timeline-box">
            <div className="subscription-detail-drawer__timeline-box-header">
              <span className="label">
                {isPermanent
                  ? 'Gói không giới hạn thời gian sử dụng'
                  : `Tiến trình chu kỳ đã sử dụng (${progressPercent}%)`}
              </span>
              <span
                className={`remaining ${
                  isPermanent
                    ? 'remaining--permanent'
                    : isExpired
                    ? 'remaining--expired'
                    : isUrgent
                    ? 'remaining--urgent'
                    : ''
                }`}
              >
                {isPermanent
                  ? 'Không giới hạn'
                  : isExpired
                  ? 'Đã hết hạn'
                  : `Còn lại ${daysRemaining} ngày`}
              </span>
            </div>

            <div className="subscription-detail-drawer__timeline-box-progress-bar">
              <div
                className={`subscription-detail-drawer__timeline-box-progress-fill ${
                  isPermanent
                    ? 'subscription-detail-drawer__timeline-box-progress-fill--permanent'
                    : isExpired
                    ? 'subscription-detail-drawer__timeline-box-progress-fill--expired'
                    : isUrgent
                    ? 'subscription-detail-drawer__timeline-box-progress-fill--urgent'
                    : ''
                }`}
                style={{ width: `${isPermanent ? 100 : progressPercent}%` }}
              />
            </div>

            <div className="subscription-detail-drawer__timeline-box-dates">
              <div>
                Bắt đầu: <strong>{formatDate(subscription.starts_at || subscription.created_at, false)}</strong>
              </div>
              <div>
                Hết hạn: <strong>{isPermanent ? 'Vĩnh viễn' : formatDate(subscription.expires_at, false)}</strong>
              </div>
            </div>
          </div>
        </div>

        {/* ── 4. Chi Tiết Thanh Toán & Gia Hạn ── */}
        <div>
          <div className="subscription-detail-drawer__section-title">
            <CreditCard size={15} /> Thông Tin Thanh Toán
          </div>

          <div className="subscription-detail-drawer__info-grid">
            <div className="subscription-detail-drawer__info-item">
              <span className="label">Số tiền thanh toán</span>
              <span className="value">
                {tier === 'free' || subscription.payment_method === 'free'
                  ? 'Miễn phí'
                  : subscription.payment_method === 'admin_grant'
                  ? 'Admin Cấp (Miễn phí)'
                  : formatCurrency(subscription.amount_paid ?? subscription.amount)}
              </span>
            </div>

            <div className="subscription-detail-drawer__info-item">
              <span className="label">Phương thức thanh toán</span>
              <span className="value">
                {tier === 'free' || subscription.payment_method === 'free'
                  ? 'Gói mặc định hệ thống'
                  : subscription.payment_method === 'admin_grant'
                  ? 'Quản trị viên cấp'
                  : subscription.payment_method === 'wallet'
                  ? 'Ví S-Coin'
                  : subscription.payment_method || 'Hệ thống'}
              </span>
            </div>

            <div className="subscription-detail-drawer__info-item">
              <span className="label">Tự động gia hạn</span>
              <span className="value">{subscription.auto_renew ? 'Bật (Auto-renew)' : 'Tắt'}</span>
            </div>

            <div className="subscription-detail-drawer__info-item">
              <span className="label">Cấp độ gói (Tier)</span>
              <span className="value" style={{ textTransform: 'uppercase' }}>
                {subscription.tier}
              </span>
            </div>
          </div>
        </div>

        {/* ── 5. Metadata / Ghi Chú Audit ── */}
        {subscription.metadata && (
          <div>
            <div className="subscription-detail-drawer__section-title">
              <FileText size={15} /> Ghi Chú & Metadata
            </div>

            <div
              className={`subscription-detail-drawer__note-card ${
                subscription.status === 'cancelled'
                  ? 'subscription-detail-drawer__note-card--revoked'
                  : ''
              }`}
            >
              {subscription.metadata?.note && (
                <div>
                  <strong>Lý do cấp:</strong> {subscription.metadata.note}
                </div>
              )}
              {subscription.metadata?.revoke_reason && (
                <div>
                  <strong>Lý do thu hồi:</strong> {subscription.metadata.revoke_reason}
                </div>
              )}
              {subscription.metadata?.cancelled_reason && (
                <div>
                  <strong>Lý do hủy:</strong> {subscription.metadata.cancelled_reason}
                </div>
              )}
            </div>
          </div>
        )}
      </OffCanvas.Body>

      <OffCanvas.Footer className="subscription-detail-drawer__footer">
        <Button variant="outlined" color="default" size="medium" onClick={onClose}>
          Đóng
        </Button>

        {canRevoke && (
          <Button
            variant="filled"
            color="danger"
            size="medium"
            startIcon={<Trash2 size={16} />}
            onClick={() => onRevoke?.(subscription)}
          >
            Thu Hồi Gói VIP
          </Button>
        )}
      </OffCanvas.Footer>
    </OffCanvas>
  );
});

SubscriptionDetailDrawer.displayName = 'SubscriptionDetailDrawer';

SubscriptionDetailDrawer.propTypes = {
  open: PropTypes.bool,
  subscription: PropTypes.object,
  onClose: PropTypes.func.isRequired,
  onRevoke: PropTypes.func,
};

export default SubscriptionDetailDrawer;
