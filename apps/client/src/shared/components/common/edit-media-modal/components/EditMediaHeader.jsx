/**
 * @file EditMediaHeader.jsx
 * @module Components/Common/EditMediaModal/Components/EditMediaHeader
 * @component EditMediaHeader
 * @description Subcomponent header cho EditMediaModal (tiêu đề, công cụ xoay/lật ảnh và nút xác nhận).
 */

import React, { memo, useCallback } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import {
  Check,
  FlipHorizontal,
  RotateCcw,
  RotateCw,
  X,
} from 'lucide-react';

import Button from '@/shared/components/ui/button';
import IconButton from '@/shared/components/ui/icon-button';

import './edit-media-header.scss';

/**
 * EditMediaHeader
 *
 * @param {object} props
 * @param {string} props.title - Tiêu đề modal
 * @param {Function} props.onClose - Callback đóng modal
 * @param {Function} props.onApply - Callback xác nhận áp dụng thay đổi
 * @param {Function} [props.onRotateRight] - Callback xoay ảnh sang phải 90°
 * @param {Function} [props.onRotateLeft] - Callback xoay ảnh sang trái 90°
 * @param {Function} [props.onToggleFlipH] - Callback lật ảnh ngang
 * @param {number} [props.rotation=0] - Góc xoay hiện tại
 * @param {boolean} [props.showTransformTools=true] - Hiển thị nhóm nút xoay/lật
 * @param {boolean} [props.isProcessing=false] - Trạng thái đang xử lý
 * @param {string} [props.ariaLabel] - ARIA label cho header
 */
const EditMediaHeader = memo(
  ({
    ariaLabel = 'Chỉnh sửa hình ảnh',
    isProcessing = false,
    onApply,
    onClose,
    onRotateLeft,
    onRotateRight,
    onToggleFlipH,
    rotation = 0,
    showTransformTools = true,
    title = 'Chỉnh sửa hình ảnh',
  }) => {
    const handleClose = useCallback(() => onClose?.(), [onClose]);
    const handleApply = useCallback(() => onApply?.(), [onApply]);

    return (
      <header
        className={classNames('edit-media-modal__header', {
          'edit-media-modal__header--processing': isProcessing,
        })}
        role="banner"
        aria-label={ariaLabel}
      >
        <div className="edit-media-modal__header-left">
          <IconButton
            variant="standard"
            size="small"
            onClick={handleClose}
            disabled={isProcessing}
            aria-label="Đóng modal"
          >
            <X size={20} aria-hidden="true" />
          </IconButton>

          <h2 id="edit-media-modal-title" className="edit-media-modal__title">
            {title}
          </h2>
        </div>

        <div className="edit-media-modal__header-actions">
          {showTransformTools && (
            <div className="edit-media-modal__tools-group" role="toolbar" aria-label="Công cụ xoay lật ảnh">
              {onRotateLeft && (
                <IconButton
                  variant="standard"
                  size="small"
                  onClick={onRotateLeft}
                  disabled={isProcessing}
                  aria-label="Xoay trái 90 độ"
                  title="Xoay trái 90°"
                >
                  <RotateCcw size={18} aria-hidden="true" />
                </IconButton>
              )}

              {onRotateRight && (
                <IconButton
                  variant="standard"
                  size="small"
                  onClick={onRotateRight}
                  disabled={isProcessing}
                  aria-label={`Xoay phải 90 độ (hiện tại ${rotation}°)`}
                  title={`Xoay phải 90° (${rotation}°)`}
                >
                  <RotateCw size={18} aria-hidden="true" />
                </IconButton>
              )}

              {onToggleFlipH && (
                <IconButton
                  variant="standard"
                  size="small"
                  onClick={onToggleFlipH}
                  disabled={isProcessing}
                  aria-label="Lật ảnh ngang"
                  title="Lật ảnh ngang"
                >
                  <FlipHorizontal size={18} aria-hidden="true" />
                </IconButton>
              )}
            </div>
          )}

          <Button
            variant="filled"
            color="primary"
            size="small"
            onClick={handleApply}
            disabled={isProcessing}
            loading={isProcessing}
            startIcon={!isProcessing ? <Check size={16} aria-hidden="true" /> : undefined}
          >
            Áp dụng
          </Button>
        </div>
      </header>
    );
  }
);

EditMediaHeader.displayName = 'EditMediaHeader';

EditMediaHeader.propTypes = {
  /** ARIA label */
  ariaLabel: PropTypes.string,
  /** Trạng thái đang xử lý */
  isProcessing: PropTypes.bool,
  /** Callback xác nhận áp dụng thay đổi */
  onApply: PropTypes.func.isRequired,
  /** Callback đóng modal */
  onClose: PropTypes.func.isRequired,
  /** Callback xoay ảnh sang trái */
  onRotateLeft: PropTypes.func,
  /** Callback xoay ảnh sang phải */
  onRotateRight: PropTypes.func,
  /** Callback lật ảnh ngang */
  onToggleFlipH: PropTypes.func,
  /** Góc xoay hiện tại */
  rotation: PropTypes.number,
  /** Hiển thị các nút xoay/lật */
  showTransformTools: PropTypes.bool,
  /** Tiêu đề modal */
  title: PropTypes.string.isRequired,
};

export default EditMediaHeader;
