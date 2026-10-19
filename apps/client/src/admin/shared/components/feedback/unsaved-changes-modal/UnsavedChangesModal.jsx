/**
 * @file UnsavedChangesModal.jsx
 * @module Admin/Shared/Components/Feedback/UnsavedChangesModal
 * @description Hộp thoại xác nhận rời trang khi có thay đổi chưa lưu (Unsaved Changes Dialog) chuẩn Material 3 Expressive.
 */

import React, { memo } from 'react';
import PropTypes from 'prop-types';
import { AlertTriangle, LogOut, ArrowLeft } from 'lucide-react';

import Modal, { ModalBody, ModalFooter, ModalHeader } from '@/shared/components/ui/modal/Modal';
import Button from '@/shared/components/ui/button/Button';

import './unsaved-changes-modal.scss';

const UnsavedChangesModal = ({
  isOpen,
  onConfirm,
  onCancel,
  isJobRunning = false,
  title,
  description,
}) => {
  const modalTitle = title || (isJobRunning ? 'Tiến trình nền đang xử lý!' : 'Bạn có thay đổi chưa lưu!');
  const modalDescription =
    description ||
    (isJobRunning
      ? 'Hệ thống đang tải lên và tối ưu hóa hình ảnh cho phim trong nền. Nếu bạn rời khỏi trang lúc này, tiến trình có thể bị gián đoạn.'
      : 'Dữ liệu vừa cập nhật (hoặc áp dụng từ gợi ý AI) chưa được lưu lên hệ thống. Nếu bạn rời khỏi trang bây giờ, mọi thay đổi chưa lưu sẽ bị mất.');

  return (
    <Modal
      open={isOpen}
      onClose={onCancel}
      size="small"
      variant="elevated"
      className="sp-unsaved-modal"
    >
      <ModalHeader showCloseButton onClose={onCancel}>
        <div className="sp-unsaved-modal__header-content">
          <div className="sp-unsaved-modal__icon-badge">
            <AlertTriangle size={22} />
          </div>
          <div className="sp-unsaved-modal__title-group">
            <h3 className="sp-unsaved-modal__title">{modalTitle}</h3>
            <span className="sp-unsaved-modal__tag">Cảnh báo</span>
          </div>
        </div>
      </ModalHeader>

      <ModalBody>
        <p className="sp-unsaved-modal__desc">{modalDescription}</p>
      </ModalBody>

      <ModalFooter align="end">
        <Button
          type="button"
          variant="tonal"
          startIcon={<ArrowLeft size={16} />}
          onClick={onCancel}
        >
          Ở lại trang
        </Button>
        <Button
          type="button"
          variant="filled"
          color="error"
          startIcon={<LogOut size={16} />}
          onClick={onConfirm}
        >
          Rời khỏi trang
        </Button>
      </ModalFooter>
    </Modal>
  );
};

UnsavedChangesModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onConfirm: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
  isJobRunning: PropTypes.bool,
  title: PropTypes.string,
  description: PropTypes.string,
};

export default memo(UnsavedChangesModal);
