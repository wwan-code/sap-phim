/**
 * @file ConfirmModal.jsx
 * @module Components/UI/Modal/ConfirmModal
 * @component ConfirmModal
 * @description Component Modal xác nhận hành động (Xóa, Hủy, Xác thực) chuẩn Material 3 Expressive và Semantic Tonal.
 */

import React, { memo } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  Info,
} from 'lucide-react';

import Button from '@/shared/components/ui/button';

import Modal from './Modal';

/**
 * Lấy icon mặc định theo biến thể Semantic
 */
const getDefaultIcon = (type) => {
  switch (type) {
    case 'danger':
    case 'error':
      return <AlertCircle size={24} aria-hidden="true" />;
    case 'warning':
      return <AlertTriangle size={24} aria-hidden="true" />;
    case 'success':
      return <CheckCircle2 size={24} aria-hidden="true" />;
    case 'info':
      return <Info size={24} aria-hidden="true" />;
    case 'primary':
    default:
      return <HelpCircle size={24} aria-hidden="true" />;
  }
};

/**
 * Component ConfirmModal
 */
const ConfirmModal = ({
  cancelText = 'Hủy',
  cancelVariant = 'outlined',
  children,
  className,
  confirmColor: customConfirmColor,
  confirmText = 'Xác nhận',
  confirmVariant = 'filled',
  content,
  icon,
  loading = false,
  onClose,
  onConfirm,
  open = false,
  showIcon = true,
  size = 'small',
  title,
  type = 'primary',
  variant,
  ...rest
}) => {
  const bodyContent = content || children;
  const semanticTypes = ['primary', 'danger', 'error', 'warning', 'info', 'success'];
  const effectiveType = semanticTypes.includes(variant) ? variant : type;
  const normalizedType = effectiveType === 'error' ? 'danger' : effectiveType;
  const modalVariant = variant && !semanticTypes.includes(variant) ? variant : undefined;

  const confirmColor =
    customConfirmColor ||
    (normalizedType === 'danger'
      ? 'error'
      : normalizedType === 'warning'
      ? 'warning'
      : normalizedType === 'success'
      ? 'success'
      : normalizedType === 'info'
      ? 'info'
      : 'primary');

  const resolvedIcon = icon || getDefaultIcon(normalizedType);

  return (
    <Modal
      open={open}
      onClose={loading ? undefined : onClose}
      size={size}
      placement="center"
      disableEscapeKeyDown={loading}
      disableBackdropClick={loading}
      className={classNames('confirm-modal', className)}
      role="alertdialog"
      aria-modal="true"
      variant={modalVariant}
      {...rest}
    >
      <Modal.Body>
        <div className="confirm-modal__content">
          {showIcon && (
            <div
              className={classNames(
                'confirm-modal__icon-badge',
                `confirm-modal__icon-badge--${normalizedType}`
              )}
            >
              {resolvedIcon}
            </div>
          )}

          <div className="confirm-modal__text-group">
            {title && <h3 className="confirm-modal__title">{title}</h3>}
            {bodyContent && (
              <div className="confirm-modal__description">{bodyContent}</div>
            )}
          </div>
        </div>
      </Modal.Body>

      <Modal.Footer align="end">
        {cancelText && (
          <Button
            variant={cancelVariant}
            color="neutral"
            onClick={onClose}
            disabled={loading}
          >
            {cancelText}
          </Button>
        )}
        <Button
          variant={confirmVariant}
          color={confirmColor}
          onClick={onConfirm}
          loading={loading}
          disabled={loading}
        >
          {confirmText}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

ConfirmModal.displayName = 'ConfirmModal';

ConfirmModal.propTypes = {
  /** Nhãn của nút Hủy */
  cancelText: PropTypes.node,
  /** Biến thể giao diện của nút Hủy */
  cancelVariant: PropTypes.oneOf(['outlined', 'text', 'tonal']),
  /** Nội dung mô tả (nếu không dùng prop content) */
  children: PropTypes.node,
  /** CSS class tùy biến */
  className: PropTypes.string,
  /** Màu tùy chỉnh của nút Xác nhận */
  confirmColor: PropTypes.string,
  /** Nhãn của nút Xác nhận */
  confirmText: PropTypes.node,
  /** Biến thể giao diện của nút Xác nhận */
  confirmVariant: PropTypes.oneOf(['filled', 'elevated', 'tonal', 'outlined']),
  /** Nội dung thông báo mô tả */
  content: PropTypes.node,
  /** Icon tùy biến ở đầu hộp thoại */
  icon: PropTypes.node,
  /** Trạng thái đang xử lý async (disable tương tác và hiển thị spinner) */
  loading: PropTypes.bool,
  /** Callback khi đóng/hủy */
  onClose: PropTypes.func.isRequired,
  /** Callback khi bấm xác nhận */
  onConfirm: PropTypes.func.isRequired,
  /** Trạng thái mở */
  open: PropTypes.bool,
  /** Hiển thị icon badge */
  showIcon: PropTypes.bool,
  /** 2 Kích thước chuẩn của Confirm Modal: small (400px), medium (560px) */
  size: PropTypes.oneOf(['small', 'medium']),
  /** Tiêu đề của hộp thoại xác nhận */
  title: PropTypes.node,
  /** Biến thể Semantic của hộp thoại */
  type: PropTypes.oneOf([
    'primary',
    'danger',
    'error',
    'warning',
    'info',
    'success',
  ]),
  /** Biến thể Semantic (alias của type) hoặc bề mặt Modal */
  variant: PropTypes.string,
};

export default memo(ConfirmModal);
