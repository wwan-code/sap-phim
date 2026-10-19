/**
 * @file PaymentRequestDetailDrawer.jsx
 * @module Admin/Modules/PaymentRequests/Components/PaymentRequestDetailDrawer
 * @description Drawer hiển thị chi tiết Yêu cầu Thanh toán, hồ sơ hội viên, ngân hàng thụ hưởng, mã QR đối soát và cụm hành động phê duyệt / từ chối chuẩn Material 3 Expressive & Obsidian Cinema.
 */

import React, { memo, useCallback } from 'react';
import PropTypes from 'prop-types';
import {
  ArrowDownRight,
  ArrowUpRight,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  Copy,
  CreditCard,
  Crown,
  ExternalLink,
  QrCode,
  ShieldAlert,
  User,
  XCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';

import OffCanvas from '@/shared/components/ui/off-canvas';
import Button from '@/shared/components/ui/button';
import Badge from '@/shared/components/ui/badge';
import Tooltip from '@/shared/components/ui/tooltip';
import { formatDate } from '@/admin/shared/components/data-display/data-grid';

import './payment-request-detail-drawer.scss';

/**
 * Format tiền tệ VND
 * @param {number|string} vnd 
 * @returns {string}
 */
const formatVnd = (vnd) => {
  const num = Number(vnd) || 0;
  return `${new Intl.NumberFormat('vi-VN').format(num)} ₫`;
};

/**
 * Format số xu S-Coin
 * @param {number|string} coins 
 * @returns {string}
 */
const formatCoin = (coins) => {
  const num = Number(coins) || 0;
  return new Intl.NumberFormat('vi-VN').format(num);
};

export const PaymentRequestDetailDrawer = memo(({
  open = false,
  request = null,
  onClose,
  onApprove,
  onReject,
  isProcessing = false,
}) => {
  const handleCopy = useCallback((text, label) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    toast.success(`Đã sao chép ${label}!`);
  }, []);

  if (!request) return null;

  const user = request.user || {};
  const displayName = user.full_name || user.username || 'Thành viên ẩn danh';
  const isTopup = request.type === 'topup';
  const isPending = request.status === 'pending' || request.status === 'created';
  const isApproved = request.status === 'approved';
  const isRejected = request.status === 'rejected' || request.status === 'cancelled';
  const isExpired = request.status === 'expired';

  // Trạng thái badge
  const statusBadgeVariant = isApproved
    ? 'success'
    : isRejected
    ? 'error'
    : isExpired
    ? 'neutral'
    : 'warning';

  const statusLabel = isApproved
    ? 'Đã phê duyệt'
    : isRejected
    ? 'Đã từ chối'
    : isExpired
    ? 'Đã hết hạn'
    : 'Chờ đối soát';

  return (
    <OffCanvas
      open={open}
      onClose={onClose}
      placement="right"
      size="large"
      variant="tonal"
      className="payment-request-detail-drawer"
    >
      <OffCanvas.Header
        title="Chi Tiết Yêu Cầu Thanh Toán"
        subtitle={`Mã giao dịch: ${request.transaction_code || request.id}`}
        onClose={onClose}
        showCloseButton
      />

      <OffCanvas.Body className="payment-request-detail-drawer__body">
        {/* ── 1. Thẻ Loại Giao Dịch & Trạng Thái ── */}
        <div className="payment-detail-card payment-detail-card--status">
          <div className="payment-detail-card__header">
            <div className="type-badge-wrap">
              <span className={`type-indicator type-indicator--${request.type}`}>
                {isTopup ? <ArrowDownRight size={18} /> : <ArrowUpRight size={18} />}
              </span>
              <div>
                <h4 className="type-title">
                  {isTopup ? 'Nạp tiền vào Ví S-Coin' : 'Rút tiền về Ngân hàng'}
                </h4>
                <span className="type-code">
                  Mã: <code>{request.transaction_code || request.id}</code>
                </span>
              </div>
            </div>
            <Badge variant={statusBadgeVariant} size="medium">
              {statusLabel}
            </Badge>
          </div>

          <div className="payment-amount-box">
            <div className="amount-col">
              <span className="amount-label">Số tiền thực tế</span>
              <span className={`amount-value amount-value--${isTopup ? 'topup' : 'withdrawal'}`}>
                {isTopup ? '+' : '-'}{formatVnd(request.amount)}
              </span>
            </div>
            <div className="amount-divider" />
            <div className="amount-col">
              <span className="amount-label">Quy đổi S-Coin (1:1,000)</span>
              <span className="coin-value">
                {formatCoin(request.lcoin_amount || Math.floor(Number(request.amount || 0) / 1000))} S-Coin
              </span>
            </div>
          </div>

          {request.plan && (
            <div className="plan-attachment">
              <Crown size={15} className="plan-icon" />
              <span>Gói đăng ký kèm theo: <strong>{request.plan.name}</strong></span>
            </div>
          )}
        </div>

        {/* ── 2. Thẻ Thông Tin Hội Viên ── */}
        <div className="payment-detail-card">
          <h4 className="payment-detail-card__section-title">
            <User size={16} />
            Hồ Sơ Thành Viên Yêu Cầu
          </h4>
          <div className="user-profile-row">
            <div className="user-avatar-wrap">
              {user.avatar_url ? (
                <img src={user.avatar_url} alt={displayName} className="user-avatar" />
              ) : (
                <div className="user-avatar-fallback">
                  {displayName.slice(0, 2).toUpperCase()}
                </div>
              )}
            </div>
            <div className="user-profile-info">
              <div className="name-wrap">
                <span className="user-name">{displayName}</span>
                {user.username && (
                  <span className="user-handle">@{user.username}</span>
                )}
              </div>
              <span className="user-email">{user.email || 'Chưa cập nhật email'}</span>
              <div className="user-id-row">
                <span className="user-id-text">UID: {user.id || request.user_id}</span>
                <Tooltip content="Sao chép UID" placement="top">
                  <button
                    type="button"
                    className="copy-btn"
                    onClick={() => handleCopy(user.id || request.user_id, 'Mã UID')}
                    aria-label="Sao chép UID"
                  >
                    <Copy size={12} />
                  </button>
                </Tooltip>
              </div>
            </div>
          </div>
        </div>

        {/* ── 3. Chi Tiết Tài Khoản Ngân Hàng & Đối Soát ── */}
        <div className="payment-detail-card">
          <h4 className="payment-detail-card__section-title">
            <Building2 size={16} />
            Thông Tin Ngân Hàng Thụ Hưởng
          </h4>

          <div className="bank-info-grid">
            <div className="bank-info-item">
              <span className="bank-info-item__label">Ngân hàng</span>
              <span className="bank-info-item__val font-semibold">
                {request.bank_name || request.bank_id || 'Chưa có thông tin'}
              </span>
            </div>

            <div className="bank-info-item">
              <span className="bank-info-item__label">Chủ tài khoản</span>
              <span className="bank-info-item__val text-uppercase font-semibold">
                {request.account_holder || displayName}
              </span>
            </div>

            <div className="bank-info-item bank-info-item--full">
              <span className="bank-info-item__label">Số tài khoản (STK)</span>
              <div className="account-number-box">
                <code className="account-number">{request.account_number || 'N/A'}</code>
                {request.account_number && (
                  <Tooltip content="Sao chép STK" placement="top">
                    <button
                      type="button"
                      className="copy-btn copy-btn--highlight"
                      onClick={() => handleCopy(request.account_number, 'Số tài khoản')}
                      aria-label="Sao chép STK"
                    >
                      <Copy size={14} />
                      <span>Sao chép</span>
                    </button>
                  </Tooltip>
                )}
              </div>
            </div>

            <div className="bank-info-item bank-info-item--full">
              <span className="bank-info-item__label">Nội dung chuyển khoản / Đối soát</span>
              <div className="account-number-box">
                <code className="account-number font-mono">{request.transaction_code || request.id}</code>
                <Tooltip content="Sao chép mã đối soát" placement="top">
                  <button
                    type="button"
                    className="copy-btn"
                    onClick={() => handleCopy(request.transaction_code || request.id, 'Mã đối soát')}
                    aria-label="Sao chép mã đối soát"
                  >
                    <Copy size={14} />
                  </button>
                </Tooltip>
              </div>
            </div>
          </div>

          {/* QR Code đối soát nếu có */}
          {request.qr_code_url && (
            <div className="qr-preview-box">
              <div className="qr-preview-box__title">
                <QrCode size={16} />
                <span>Mã QR VietQR Đối Soát Nhanh</span>
              </div>
              <div className="qr-preview-box__image-wrapper">
                <img
                  src={request.qr_code_url}
                  alt="VietQR Code"
                  className="qr-image"
                  loading="lazy"
                />
              </div>
              <a
                href={request.qr_code_url}
                target="_blank"
                rel="noreferrer"
                className="qr-external-link"
              >
                <ExternalLink size={13} />
                <span>Mở ảnh QR gốc trong tab mới</span>
              </a>
            </div>
          )}
        </div>

        {/* ── 4. Lịch Sử Duyệt & Nhật Ký Kiểm Soát ── */}
        <div className="payment-detail-card">
          <h4 className="payment-detail-card__section-title">
            <Clock size={16} />
            Nhật Ký & Mốc Thời Gian
          </h4>

          <div className="timeline-list">
            <div className="timeline-item">
              <div className="timeline-item__bullet" />
              <div className="timeline-item__content">
                <span className="time-title">Khởi tạo yêu cầu</span>
                <span className="time-val">{formatDate(request.created_at)}</span>
              </div>
            </div>

            {request.expires_at && (
              <div className="timeline-item">
                <div className={`timeline-item__bullet ${isExpired ? 'timeline-item__bullet--expired' : ''}`} />
                <div className="timeline-item__content">
                  <span className="time-title">Thời hạn hiệu lực</span>
                  <span className="time-val">{formatDate(request.expires_at)}</span>
                </div>
              </div>
            )}

            {isApproved && (
              <div className="timeline-item">
                <div className="timeline-item__bullet timeline-item__bullet--approved" />
                <div className="timeline-item__content">
                  <span className="time-title">Đã phê duyệt bởi Admin</span>
                  <span className="time-val">
                    {formatDate(request.approved_at)}
                    {request.approver && ` (Bởi: ${request.approver.full_name || request.approver.username})`}
                  </span>
                </div>
              </div>
            )}

            {isRejected && (
              <div className="timeline-item">
                <div className="timeline-item__bullet timeline-item__bullet--rejected" />
                <div className="timeline-item__content">
                  <span className="time-title">Đã từ chối bởi Admin</span>
                  <span className="time-val">
                    {formatDate(request.approved_at || request.updated_at)}
                    {request.approver && ` (Bởi: ${request.approver.full_name || request.approver.username})`}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Lý do từ chối nếu có */}
          {isRejected && request.rejection_reason && (
            <div className="rejection-reason-box">
              <div className="rejection-reason-box__header">
                <ShieldAlert size={16} />
                <span>Lý do từ chối của Quản trị viên:</span>
              </div>
              <p className="rejection-reason-box__content">
                "{request.rejection_reason}"
              </p>
            </div>
          )}
        </div>
      </OffCanvas.Body>

      <OffCanvas.Footer className="payment-request-detail-drawer__footer">
        {isPending ? (
          <div className="footer-action-group">
            <Button
              variant="outlined"
              color="error"
              onClick={() => onReject?.(request)}
              disabled={isProcessing}
              startIcon={<XCircle size={16} />}
            >
              Từ Chối Lệnh
            </Button>
            <Button
              variant="filled"
              color="primary"
              onClick={() => onApprove?.(request)}
              loading={isProcessing}
              startIcon={<CheckCircle2 size={16} />}
            >
              Phê Duyệt Lệnh
            </Button>
          </div>
        ) : (
          <Button variant="outlined" color="secondary" onClick={onClose}>
            Đóng bảng chi tiết
          </Button>
        )}
      </OffCanvas.Footer>
    </OffCanvas>
  );
});

PaymentRequestDetailDrawer.displayName = 'PaymentRequestDetailDrawer';

PaymentRequestDetailDrawer.propTypes = {
  open: PropTypes.bool,
  request: PropTypes.object,
  onClose: PropTypes.func.isRequired,
  onApprove: PropTypes.func,
  onReject: PropTypes.func,
  isProcessing: PropTypes.bool,
};

export default PaymentRequestDetailDrawer;
