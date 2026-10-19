/**
 * @file AuditLogDetailDrawer.jsx
 * @module Admin/Modules/Sessions/Components
 * @description Drawer trượt xem toàn bộ hồ sơ chi tiết kỹ thuật của một bản ghi Audit Log, kèm JSON Viewer và công cụ sao chép theo chuẩn Material 3 Expressive.
 */

import React, { useState, memo } from 'react';
import PropTypes from 'prop-types';
import {
  Copy,
  Check,
  AlertCircle,
  Globe,
  Clock,
  User,
  Activity,
  Layers,
} from 'lucide-react';
import toast from 'react-hot-toast';

import OffCanvas from '@/shared/components/ui/off-canvas';
import Badge from '@/shared/components/ui/badge';
import Button from '@/shared/components/ui/button';

export const AuditLogDetailDrawer = memo(({ open = false, onClose, log = null }) => {
  const [copiedKey, setCopiedKey] = useState(null);

  if (!log) return null;

  const copyToClipboard = (text, key) => {
    navigator.clipboard.writeText(typeof text === 'string' ? text : JSON.stringify(text, null, 2));
    setCopiedKey(key);
    toast.success('Đã sao chép vào bộ nhớ tạm');
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const severityVariantMap = {
    info: 'info',
    warn: 'warning',
    error: 'error',
    critical: 'error',
  };

  const statusVariantMap = {
    success: 'success',
    failure: 'error',
    blocked: 'error',
    pending: 'warning',
  };

  const metadataJson =
    log.metadata && Object.keys(log.metadata).length > 0
      ? JSON.stringify(log.metadata, null, 2)
      : '{}';

  const isFailedEvent =
    log.status === 'failure' ||
    log.status === 'blocked' ||
    Boolean(log.error_code) ||
    Boolean(log.error_message);

  return (
    <OffCanvas
      open={open}
      onClose={onClose}
      placement="right"
      size="large"
    >
      <OffCanvas.Header onClose={onClose}>
        <div className="audit-detail-drawer__header-wrap">
          <div className="audit-detail-drawer__header-left">
            <h3 className="off-canvas__title">Chi Tiết Nhật Ký Bảo Mật</h3>
            <span className="off-canvas__subtitle">
              Sự kiện #{log.id ? String(log.id).slice(0, 8) : 'N/A'} • {new Date(log.created_at).toLocaleString('vi-VN')}
            </span>
          </div>
          <div className="audit-detail-drawer__badges-row">
            <Badge
              variant={severityVariantMap[log.severity] || 'default'}
              size="small"
              radius="full"
            >
              {log.severity?.toUpperCase()}
            </Badge>
            <Badge
              variant={statusVariantMap[log.status] || 'default'}
              size="small"
              radius="full"
            >
              {log.status?.toUpperCase()}
            </Badge>
          </div>
        </div>
      </OffCanvas.Header>

      <OffCanvas.Body>
        <div className="audit-detail-drawer">
          {/* Banner Sự Cố / Lỗi (nếu có) */}
          {isFailedEvent && (
            <div className="audit-detail-drawer__section audit-detail-drawer__section--error">
              <h4 className="audit-detail-drawer__section-title">
                <AlertCircle size={16} />
                <span className="audit-detail-drawer__section-title-text--error">
                  {log.status === 'blocked' ? 'Cảnh Báo: Yêu Cầu Bị Chặn' : 'Chi Tiết Sự Cố & Mã Lỗi'}
                </span>
              </h4>
              {log.error_code && (
                <div className="audit-detail-drawer__field">
                  <span className="audit-detail-drawer__label">Mã Lỗi (Error Code):</span>
                  <code className="audit-detail-drawer__code audit-detail-drawer__code--error">
                    {log.error_code}
                  </code>
                </div>
              )}
              {log.error_message && (
                <div className="audit-detail-drawer__field audit-detail-drawer__field--spaced">
                  <span className="audit-detail-drawer__label">Thông Điệp Lỗi:</span>
                  <p className="audit-detail-drawer__error-msg">{log.error_message}</p>
                </div>
              )}
              {!log.error_code && !log.error_message && (
                <p className="audit-detail-drawer__error-msg">
                  Yêu cầu không thành công với trạng thái: {log.status?.toUpperCase()}
                </p>
              )}
            </div>
          )}

          {/* 1. Tổng quan sự kiện */}
          <div className="audit-detail-drawer__section">
            <h4 className="audit-detail-drawer__section-title">
              <Activity size={16} />
              <span>Thông Tin Sự Kiện</span>
            </h4>
            <div className="audit-detail-drawer__grid">
              <div className="audit-detail-drawer__field">
                <span className="audit-detail-drawer__label">Mã Loại Sự Kiện:</span>
                <code className="audit-detail-drawer__code">{log.event_type}</code>
              </div>
              <div className="audit-detail-drawer__field">
                <span className="audit-detail-drawer__label">Danh Mục:</span>
                <span className="audit-detail-drawer__value">{log.event_category}</span>
              </div>
              <div className="audit-detail-drawer__field">
                <span className="audit-detail-drawer__label">Thời Gian Xảy Ra:</span>
                <span className="audit-detail-drawer__value">
                  <Clock size={13} className="audit-detail-drawer__inline-icon" />
                  {new Date(log.created_at).toLocaleString('vi-VN')}
                </span>
              </div>
              <div className="audit-detail-drawer__field">
                <span className="audit-detail-drawer__label">Thời Gian Xử Lý:</span>
                <span className="audit-detail-drawer__value">
                  {log.response_time_ms ? `${log.response_time_ms} ms` : 'N/A'}
                </span>
              </div>
            </div>
            {log.description && (
              <div className="audit-detail-drawer__description">
                <span className="audit-detail-drawer__label">Mô Tả:</span>
                <p>{log.description}</p>
              </div>
            )}
          </div>

          {/* 2. Ngữ cảnh Người dùng */}
          <div className="audit-detail-drawer__section">
            <h4 className="audit-detail-drawer__section-title">
              <User size={16} />
              <span>Đối Tượng Thực Hiện (Actor)</span>
            </h4>
            <div className="audit-detail-drawer__grid">
              <div className="audit-detail-drawer__field">
                <span className="audit-detail-drawer__label">Tên Người Dùng:</span>
                <span className="audit-detail-drawer__value">
                  {log.username || log.user?.username || 'Ẩn danh'}
                </span>
              </div>
              <div className="audit-detail-drawer__field">
                <span className="audit-detail-drawer__label">Email:</span>
                <span className="audit-detail-drawer__value">
                  {log.email || log.user?.email || 'N/A'}
                </span>
              </div>
              <div className="audit-detail-drawer__field">
                <span className="audit-detail-drawer__label">Vai Trò:</span>
                <span className="audit-detail-drawer__value">
                  {log.user?.role?.name || log.user?.role?.slug || 'Thành viên'}
                </span>
              </div>
              <div className="audit-detail-drawer__field">
                <span className="audit-detail-drawer__label">Mã User ID:</span>
                <div className="audit-detail-drawer__copyable-row">
                  <code className="audit-detail-drawer__code">{log.user_id || 'N/A'}</code>
                  {log.user_id && (
                    <button
                      type="button"
                      className="audit-detail-drawer__copy-mini-btn"
                      title="Sao chép User ID"
                      onClick={() => copyToClipboard(log.user_id, 'uid')}
                    >
                      {copiedKey === 'uid' ? <Check size={12} /> : <Copy size={12} />}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 3. Ngữ cảnh Kỹ thuật & Mạng */}
          <div className="audit-detail-drawer__section">
            <h4 className="audit-detail-drawer__section-title">
              <Globe size={16} />
              <span>Thông Số Kỹ Thuật & Mạng</span>
            </h4>
            <div className="audit-detail-drawer__grid">
              <div className="audit-detail-drawer__field">
                <span className="audit-detail-drawer__label">Địa Chỉ IP:</span>
                <div className="audit-detail-drawer__copyable-row">
                  <code className="audit-detail-drawer__code">{log.ip_address || 'N/A'}</code>
                  {log.ip_address && (
                    <button
                      type="button"
                      className="audit-detail-drawer__copy-mini-btn"
                      title="Sao chép IP"
                      onClick={() => copyToClipboard(log.ip_address, 'ip')}
                    >
                      {copiedKey === 'ip' ? <Check size={12} /> : <Copy size={12} />}
                    </button>
                  )}
                </div>
              </div>
              <div className="audit-detail-drawer__field">
                <span className="audit-detail-drawer__label">Mã Request ID (Tracing):</span>
                <div className="audit-detail-drawer__copyable-row">
                  <code className="audit-detail-drawer__code">{log.request_id || 'N/A'}</code>
                  {log.request_id && (
                    <button
                      type="button"
                      className="audit-detail-drawer__copy-mini-btn"
                      title="Sao chép Request ID"
                      onClick={() => copyToClipboard(log.request_id, 'req')}
                    >
                      {copiedKey === 'req' ? <Check size={12} /> : <Copy size={12} />}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {log.device_fingerprint && (
              <div className="audit-detail-drawer__field audit-detail-drawer__field--spaced">
                <span className="audit-detail-drawer__label">Dấu Vân Tay Thiết Bị (Fingerprint):</span>
                <code className="audit-detail-drawer__code">{log.device_fingerprint}</code>
              </div>
            )}

            {log.user_agent && (
              <div className="audit-detail-drawer__field audit-detail-drawer__field--spaced">
                <span className="audit-detail-drawer__label">Chuỗi User-Agent:</span>
                <p className="audit-detail-drawer__user-agent">{log.user_agent}</p>
              </div>
            )}
          </div>

          {/* 4. Metadata JSON Viewer */}
          <div className="audit-detail-drawer__section">
            <div className="audit-detail-drawer__section-header-flex">
              <h4 className="audit-detail-drawer__section-title">
                <Layers size={16} />
                <span>Dữ Liệu Bổ Sung (Metadata JSON)</span>
              </h4>
              <Button
                variant="text"
                size="small"
                startIcon={copiedKey === 'meta' ? <Check size={13} /> : <Copy size={13} />}
                onClick={() => copyToClipboard(metadataJson, 'meta')}
              >
                <span>{copiedKey === 'meta' ? 'Đã Sao Chép' : 'Sao Chép JSON'}</span>
              </Button>
            </div>
            <pre className="audit-detail-drawer__json-viewer">
              <code>{metadataJson}</code>
            </pre>
          </div>
        </div>
      </OffCanvas.Body>

      <OffCanvas.Footer align="between">
        <Button
          variant="outlined"
          size="small"
          startIcon={copiedKey === 'all' ? <Check size={14} /> : <Copy size={14} />}
          onClick={() => copyToClipboard(log, 'all')}
        >
          <span>{copiedKey === 'all' ? 'Đã Sao Chép Log' : 'Sao Chép Toàn Bộ Log'}</span>
        </Button>
        <Button variant="filled" color="primary" size="small" onClick={onClose}>
          Đóng
        </Button>
      </OffCanvas.Footer>
    </OffCanvas>
  );
});

AuditLogDetailDrawer.propTypes = {
  open: PropTypes.bool,
  onClose: PropTypes.func,
  log: PropTypes.object,
};

export default AuditLogDetailDrawer;
