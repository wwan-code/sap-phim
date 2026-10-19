/**
 * @file SessionRevokeModal.jsx
 * @module Admin/Modules/Sessions/Components/SessionRevokeModal
 * @description Dialog xác nhận thu hồi phiên đăng nhập đơn lẻ hoặc cưỡng chế đăng xuất tất cả thiết bị của tài khoản.
 */

import React, { useState, useEffect, memo } from 'react';
import PropTypes from 'prop-types';
import {
  AlertTriangle,
  LogOut,
  ShieldAlert,
  Smartphone,
  Laptop,
  Globe,
} from 'lucide-react';
import ConfirmModal from '@/shared/components/ui/modal/ConfirmModal';
import TextField from '@/shared/components/ui/text-field';
import Badge from '@/shared/components/ui/badge';
import {
  formatBrowserName,
  formatOsName,
  getDeviceCategory,
} from '../utils/session-format';

export const SessionRevokeModal = memo(({
  open = false,
  onClose,
  mode = 'single', // 'single' | 'all'
  session = null,
  user = null,
  isCurrentSession = false,
  onConfirm,
  isSubmitting = false,
}) => {
  const [reason, setReason] = useState('Tài khoản có dấu hiệu truy cập bất thường');
  const [reasonError, setReasonError] = useState('');

  useEffect(() => {
    if (open) {
      setReason('Tài khoản có dấu hiệu truy cập bất thường');
      setReasonError('');
    }
  }, [open]);

  const targetUser = user || session?.user;
  const username = targetUser?.username || 'Ẩn danh';
  const roleName = targetUser?.role?.name || targetUser?.role?.slug || 'Thành viên';
  const device = session?.device_info || {};
  const deviceCategory = getDeviceCategory(device);
  const isMobile = deviceCategory === 'mobile';

  const handleConfirm = () => {
    if (mode === 'all') {
      if (!reason.trim() || reason.trim().length < 3) {
        setReasonError('Vui lòng nhập lý do thu hồi (ít nhất 3 ký tự)');
        return;
      }
      onConfirm?.({ userId: targetUser?.id, reason: reason.trim() });
    } else {
      onConfirm?.({ sessionId: session?.id });
    }
  };

  const title =
    mode === 'all'
      ? `Cưỡng Chế Đăng Xuất Tài Khoản: ${username}`
      : `Thu Hồi Phiên Đăng Nhập Của: ${username}`;

  return (
    <ConfirmModal
      open={open}
      onClose={onClose}
      onConfirm={handleConfirm}
      title={title}
      confirmText={
        mode === 'all'
          ? 'Đăng Xuất Mọi Thiết Bị'
          : isCurrentSession
          ? 'Đăng Xuất Chính Mình'
          : 'Thu Hồi Phiên Này'
      }
      cancelText="Hủy bỏ"
      type="danger"
      loading={isSubmitting}
      size="medium"
    >
      <div className="session-revoke-modal-content">
        {isCurrentSession && (
          <div className="session-revoke-modal-content__current-alert">
            <AlertTriangle size={18} />
            <div>
              <strong>Cảnh Báo: Đây là phiên đăng nhập hiện tại của bạn!</strong>
              <p>
                Nếu bạn thu hồi phiên này, bạn sẽ bị đăng xuất khỏi hệ thống ngay lập tức và phải đăng nhập lại.
              </p>
            </div>
          </div>
        )}

        <div className="session-revoke-modal-content__target-card">
          <div className="session-revoke-modal-content__user-info">
            <span className="session-revoke-modal-content__user-name">{username}</span>
            <Badge variant="primary" size="small">
              {roleName}
            </Badge>
          </div>
          {targetUser?.email && (
            <span className="session-revoke-modal-content__user-email">{targetUser.email}</span>
          )}
        </div>

        {mode === 'single' && session && (
          <div className="session-revoke-modal-content__device-details">
            <div className="session-revoke-modal-content__detail-item">
              <span className="session-revoke-modal-content__detail-label">Thiết bị & OS:</span>
              <span className="session-revoke-modal-content__detail-val">
                {isMobile ? <Smartphone size={14} /> : <Laptop size={14} />}
                {formatBrowserName(device.browser)} • {formatOsName(device.os)}
              </span>
            </div>
            <div className="session-revoke-modal-content__detail-item">
              <span className="session-revoke-modal-content__detail-label">Địa chỉ IP:</span>
              <span className="session-revoke-modal-content__detail-val">
                <Globe size={14} />
                <code>{session.ip_address || 'N/A'}</code>
              </span>
            </div>
            <div className="session-revoke-modal-content__detail-item">
              <span className="session-revoke-modal-content__detail-label">Thời điểm hết hạn:</span>
              <span className="session-revoke-modal-content__detail-val">
                {new Date(session.expires_at).toLocaleString('vi-VN')}
              </span>
            </div>
          </div>
        )}

        {mode === 'all' && (
          <div className="session-revoke-modal-content__reason-field">
            <div className="session-revoke-modal-content__all-warning">
              <ShieldAlert size={18} />
              <span>
                Toàn bộ các phiên đang hoạt động của tài khoản này sẽ bị thu hồi. Người dùng sẽ bị văng khỏi hệ thống qua WebSocket ngay tức thì.
              </span>
            </div>
            <TextField
              label="Lý do thu hồi (Ghi vào Nhật ký Bảo mật)"
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                if (reasonError) setReasonError('');
              }}
              error={reasonError}
              placeholder="VD: Nghi ngờ lộ mật khẩu, phát hiện đăng nhập từ IP lạ..."
              fullWidth
              required
            />
          </div>
        )}
      </div>
    </ConfirmModal>
  );
});

SessionRevokeModal.propTypes = {
  open: PropTypes.bool,
  onClose: PropTypes.func,
  mode: PropTypes.oneOf(['single', 'all']),
  session: PropTypes.object,
  user: PropTypes.object,
  isCurrentSession: PropTypes.bool,
  onConfirm: PropTypes.func,
  isSubmitting: PropTypes.bool,
};

export default SessionRevokeModal;
