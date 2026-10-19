/**
 * @file EditMediaFooter.jsx
 * @module Components/Common/EditMediaModal/Components/EditMediaFooter
 * @component EditMediaFooter
 * @description Subcomponent footer cho EditMediaModal (thanh trượt Zoom, nút Reset và nút Hủy).
 */

import React, { memo, useCallback, useRef } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';

import Button from '@/shared/components/ui/button';
import IconButton from '@/shared/components/ui/icon-button';
import Slider from '@/shared/components/ui/slider';

import './edit-media-footer.scss';

/**
 * EditMediaFooter
 *
 * @param {object} props
 * @param {number} props.zoom - Giá trị zoom hiện tại (1-3)
 * @param {Function} props.onZoomChange - Callback thay đổi zoom
 * @param {Function} props.onClose - Callback đóng modal
 * @param {Function} [props.onResetZoom] - Callback reset zoom về 1
 * @param {boolean} [props.isProcessing=false] - Trạng thái đang xử lý
 * @param {boolean} [props.showReset=true] - Hiển thị nút reset zoom
 * @param {string} [props.ariaLabel] - ARIA label cho footer
 * @param {number} [props.minZoom=1] - Mức zoom tối thiểu
 * @param {number} [props.maxZoom=3] - Mức zoom tối đa
 * @param {number} [props.step=0.1] - Bước nhảy zoom
 */
const EditMediaFooter = memo(
  ({
    ariaLabel = 'Công cụ chỉnh sửa hình ảnh',
    isProcessing = false,
    maxZoom = 3,
    minZoom = 1,
    onClose,
    onResetZoom,
    onZoomChange,
    showReset = true,
    step = 0.1,
    zoom,
  }) => {
    const sliderRef = useRef(null);

    const handleKeyDown = useCallback(
      (e) => {
        let newZoom = null;

        switch (e.key) {
          case 'ArrowRight':
          case 'ArrowUp':
            e.preventDefault();
            newZoom = Math.min(zoom + step, maxZoom);
            break;
          case 'ArrowLeft':
          case 'ArrowDown':
            e.preventDefault();
            newZoom = Math.max(zoom - step, minZoom);
            break;
          case 'Home':
            e.preventDefault();
            newZoom = minZoom;
            break;
          case 'End':
            e.preventDefault();
            newZoom = maxZoom;
            break;
          default:
            return;
        }

        if (newZoom !== null) {
          onZoomChange(newZoom);
          sliderRef.current?.focus();
        }
      },
      [zoom, step, maxZoom, minZoom, onZoomChange]
    );

    const handleResetZoom = useCallback(() => {
      onZoomChange(1);
      onResetZoom?.();
      sliderRef.current?.focus();
    }, [onZoomChange, onResetZoom]);

    const handleClose = useCallback(() => onClose?.(), [onClose]);

    const zoomPercent = Math.round(zoom * 100);

    return (
      <footer
        className={classNames('edit-media-modal__footer', {
          'edit-media-modal__footer--processing': isProcessing,
        })}
        role="contentinfo"
        aria-label={ariaLabel}
      >
        <div className="edit-media-modal__zoom-control">
          <div className="edit-media-modal__zoom-label" id="zoom-label">
            <ZoomOut size={16} aria-hidden="true" className="edit-media-modal__zoom-icon" />
            <span className="edit-media-modal__zoom-text">Zoom</span>
            <span
              className="edit-media-modal__zoom-value"
              aria-live="polite"
              aria-atomic="true"
            >
              {zoomPercent}%
            </span>
            <ZoomIn size={16} aria-hidden="true" className="edit-media-modal__zoom-icon" />
          </div>

          <div className="edit-media-modal__slider-wrapper">
            <Slider
              ref={sliderRef}
              value={zoom}
              min={minZoom}
              max={maxZoom}
              step={step}
              onChange={onZoomChange}
              onKeyDown={handleKeyDown}
              disabled={isProcessing}
              aria-label="Điều chỉnh mức độ zoom"
              className="edit-media-modal__slider"
              id="zoom-slider"
            />
          </div>

          {showReset && zoom !== 1 && (
            <IconButton
              variant="standard"
              size="small"
              onClick={handleResetZoom}
              disabled={isProcessing}
              aria-label="Đặt lại mức thu phóng về 100%"
              title="Đặt lại zoom (100%)"
            >
              <RotateCcw size={16} aria-hidden="true" />
            </IconButton>
          )}
        </div>

        <div className="edit-media-modal__actions">
          <Button
            variant="outlined"
            size="small"
            onClick={handleClose}
            disabled={isProcessing}
          >
            Hủy
          </Button>
        </div>
      </footer>
    );
  }
);

EditMediaFooter.displayName = 'EditMediaFooter';

EditMediaFooter.propTypes = {
  /** ARIA label */
  ariaLabel: PropTypes.string,
  /** Trạng thái đang xử lý */
  isProcessing: PropTypes.bool,
  /** Mức zoom tối đa */
  maxZoom: PropTypes.number,
  /** Mức zoom tối thiểu */
  minZoom: PropTypes.number,
  /** Callback đóng modal */
  onClose: PropTypes.func.isRequired,
  /** Callback reset zoom */
  onResetZoom: PropTypes.func,
  /** Callback thay đổi zoom */
  onZoomChange: PropTypes.func.isRequired,
  /** Hiển thị nút reset zoom */
  showReset: PropTypes.bool,
  /** Bước nhảy zoom */
  step: PropTypes.number,
  /** Giá trị zoom hiện tại */
  zoom: PropTypes.number.isRequired,
};

export default EditMediaFooter;
