/**
 * @file EditMediaBody.jsx
 * @module Components/Common/EditMediaModal/Components/EditMediaBody
 * @component EditMediaBody
 * @description Subcomponent body cho EditMediaModal chứa vùng chọn cắt ảnh react-easy-crop, indicators tỷ lệ/zoom và trạng thái loading/error.
 */

import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import Cropper from 'react-easy-crop';
import { AlertTriangle, Loader2, RefreshCw } from 'lucide-react';

import Button from '@/shared/components/ui/button';

import './edit-media-body.scss';

/**
 * EditMediaBody
 *
 * @param {object} props
 * @param {string} props.imageSrc - URL ảnh gốc
 * @param {object} props.crop - Trạng thái crop {x, y}
 * @param {number} props.zoom - Mức độ zoom
 * @param {number} [props.rotation=0] - Góc xoay (degrees)
 * @param {number|null} [props.aspectRatio=1] - Tỷ lệ khung hình (null nếu tự do)
 * @param {Function} props.onCropChange - Callback cập nhật vị trí crop
 * @param {Function} props.onCropComplete - Callback khi crop hoàn tất trên UI
 * @param {Function} props.onZoomChange - Callback cập nhật mức độ zoom
 * @param {string} [props.error=null] - Lỗi hiển thị
 * @param {string} [props.ariaDescribedBy] - ARIA describedby
 */
const EditMediaBody = memo(
  ({
    ariaDescribedBy,
    aspectRatio = 1,
    crop,
    error = null,
    imageSrc,
    onCropChange,
    onCropComplete,
    onZoomChange,
    rotation = 0,
    zoom,
  }) => {
    const cropperRef = useRef(null);
    const containerRef = useRef(null);
    const [imageLoaded, setImageLoaded] = useState(false);
    const [imageError, setImageError] = useState(false);
    const [mediaKey, setMediaKey] = useState(0);
    const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 });

    const handleMediaLoaded = useCallback(({ naturalHeight, naturalWidth }) => {
      setNaturalSize({ width: naturalWidth, height: naturalHeight });
      setImageLoaded(true);
      setImageError(false);
    }, []);

    const handleImageError = useCallback(() => {
      setImageError(true);
      setImageLoaded(false);
    }, []);

    useEffect(() => {
      setImageLoaded(false);
      setImageError(false);
      setNaturalSize({ width: 0, height: 0 });
      setMediaKey((key) => key + 1);
    }, [imageSrc]);

    // Phím tắt bàn phím (+/- để zoom)
    useEffect(() => {
      const handleKeyDown = (e) => {
        if (!containerRef.current?.contains(document.activeElement)) return;

        const step = 0.1;
        let newZoom = null;

        switch (e.key) {
          case '=':
          case '+':
            e.preventDefault();
            newZoom = Math.min(zoom + step, 3);
            break;
          case '-':
          case '_':
            e.preventDefault();
            newZoom = Math.max(zoom - step, 1);
            break;
          case '0':
            e.preventDefault();
            newZoom = 1;
            break;
          default:
            return;
        }

        if (newZoom !== null) {
          onZoomChange(newZoom);
        }
      };

      const container = containerRef.current;
      if (container) {
        container.addEventListener('keydown', handleKeyDown);
        return () => container.removeEventListener('keydown', handleKeyDown);
      }
    }, [zoom, onZoomChange]);

    // Error State
    if (imageError || error) {
      return (
        <div
          className="edit-media-modal__body edit-media-modal__body--error"
          role="alert"
          aria-live="polite"
          aria-describedby={ariaDescribedBy}
          ref={containerRef}
          tabIndex={0}
        >
          <div className="edit-media-modal__error-state">
            <AlertTriangle size={48} className="edit-media-modal__error-icon" aria-hidden="true" />
            <h3 className="edit-media-modal__error-title">Không thể tải hình ảnh</h3>
            <p className="edit-media-modal__error-message">
              {error || 'Hình ảnh không hợp lệ hoặc không thể truy cập. Vui lòng thử ảnh khác.'}
            </p>
            <Button
              variant="filled"
              color="primary"
              size="small"
              onClick={() => {
                setImageError(false);
                setImageLoaded(false);
                setMediaKey((key) => key + 1);
              }}
              startIcon={<RefreshCw size={16} aria-hidden="true" />}
            >
              Thử lại
            </Button>
          </div>
        </div>
      );
    }

    // No Image State
    if (!imageSrc) {
      return (
        <div
          className="edit-media-modal__body edit-media-modal__body--loading"
          role="status"
          aria-live="polite"
          aria-describedby={ariaDescribedBy}
          ref={containerRef}
          tabIndex={0}
        >
          <div className="edit-media-modal__loading-state">
            <Loader2 size={32} className="edit-media-modal__loading-spinner spin-animation" aria-hidden="true" />
            <p className="edit-media-modal__loading-text">Đang tải hình ảnh...</p>
          </div>
        </div>
      );
    }

    return (
      <div
        className="edit-media-modal__body"
        ref={containerRef}
        tabIndex={0}
        role="application"
        aria-label="Trình chỉnh sửa hình ảnh"
        aria-describedby={ariaDescribedBy}
      >
        <div className="edit-media-modal__cropper-container">
          <Cropper
            key={mediaKey}
            ref={cropperRef}
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            rotation={rotation}
            aspect={aspectRatio || undefined}
            onCropChange={onCropChange}
            onCropComplete={onCropComplete}
            onZoomChange={onZoomChange}
            onMediaLoaded={handleMediaLoaded}
            mediaProps={{ onError: handleImageError }}
            showGrid
            restrictPosition
            zoomWithScroll
            zoomSpeed={0.1}
            minZoom={1}
            maxZoom={3}
            style={{
              width: '100%',
              height: '100%',
              touchAction: 'none',
            }}
          />

          {/* Zoom Indicator */}
          {zoom !== 1 && (
            <div className="edit-media-modal__zoom-indicator" aria-live="polite">
              <span className="edit-media-modal__badge">
                {Math.round(zoom * 100)}%
              </span>
            </div>
          )}

          {/* Rotation Indicator */}
          {rotation !== 0 && (
            <div className="edit-media-modal__rotation-indicator" aria-live="polite">
              <span className="edit-media-modal__badge">
                {rotation}°
              </span>
            </div>
          )}
        </div>

        {/* Loading Overlay */}
        {!imageLoaded && (
          <div className="edit-media-modal__loading-overlay" role="status" aria-live="polite">
            <div className="edit-media-modal__loading-state">
              <Loader2 size={32} className="edit-media-modal__loading-spinner spin-animation" aria-hidden="true" />
              <p className="edit-media-modal__loading-text">Đang chuẩn bị khung ảnh...</p>
            </div>
          </div>
        )}

        {/* Image Dimensions Info */}
        {imageLoaded && (
          <div className="edit-media-modal__image-info" aria-hidden="true">
            <span>{naturalSize.width} × {naturalSize.height} px</span>
            <span>•</span>
            <span>{aspectRatio ? (aspectRatio === 1 ? '1:1' : `${aspectRatio}:1`) : 'Tự do'}</span>
          </div>
        )}
      </div>
    );
  }
);

EditMediaBody.displayName = 'EditMediaBody';

EditMediaBody.propTypes = {
  /** ARIA describedby */
  ariaDescribedBy: PropTypes.string,
  /** Tỷ lệ khung hình */
  aspectRatio: PropTypes.number,
  /** Trạng thái crop {x, y} */
  crop: PropTypes.shape({
    x: PropTypes.number,
    y: PropTypes.number,
  }).isRequired,
  /** Lỗi hiển thị */
  error: PropTypes.string,
  /** URL ảnh gốc */
  imageSrc: PropTypes.string.isRequired,
  /** Callback cập nhật vị trí crop */
  onCropChange: PropTypes.func.isRequired,
  /** Callback khi crop hoàn tất */
  onCropComplete: PropTypes.func.isRequired,
  /** Callback cập nhật zoom */
  onZoomChange: PropTypes.func.isRequired,
  /** Góc xoay (degrees) */
  rotation: PropTypes.number,
  /** Mức độ zoom */
  zoom: PropTypes.number.isRequired,
};

export default EditMediaBody;
