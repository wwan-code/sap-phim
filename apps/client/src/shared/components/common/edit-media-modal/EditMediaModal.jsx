/**
 * @file EditMediaModal.jsx
 * @module Components/Common/EditMediaModal/EditMediaModal
 * @component EditMediaModal
 * @description Component Modal chỉnh sửa hình ảnh (Zoom / Crop / Rotate / Flip) tích hợp react-easy-crop, HTML5 Canvas và Material 3 Expressive.
 */

import React, { forwardRef, memo, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';

import Modal from '@/shared/components/ui/modal/Modal';
import { EditMediaBody, EditMediaFooter, EditMediaHeader } from './components';
import {
  DEFAULT_MEDIA_OPTIONS,
  ZOOM_LIMITS,
} from './edit-media-modal.constants';
import { useEditMedia } from './hooks/use-edit-media';

import './edit-media-modal.scss';

const MODAL_ID = 'edit-media-modal';

/**
 * @component EditMediaModal
 * @description Modal cho phép người dùng cắt, xoay, lật và zoom ảnh trước khi upload hoặc cập nhật profile.
 *
 * @param {object} props
 * @param {boolean} [props.open] - Trạng thái đóng/mở modal
 * @param {boolean} [props.isOpen] - Alias tương thích ngược cho open
 * @param {Function} props.onClose - Callback khi đóng modal
 * @param {string} props.imageSrc - URL ảnh cần chỉnh sửa (http/data/blob)
 * @param {number|null} [props.aspectRatio=1] - Tỷ lệ khung hình (width/height hoặc null để tự do)
 * @param {Function} props.onApply - Callback(file: File) nhận file ảnh đã cắt
 * @param {object} [props.options] - Tùy chọn xuất file
 * @param {string} [props.options.outputType='image/jpeg'] - MIME type output
 * @param {number} [props.options.quality=0.92] - Chất lượng 0-1
 * @param {string} [props.options.filename='cropped-image.jpeg'] - Tên file output
 * @param {string} [props.className] - Class CSS bổ sung
 * @param {string} [props.title='Chỉnh sửa hình ảnh'] - Tiêu đề modal
 * @param {boolean} [props.showTransformTools=true] - Hiển thị nhóm nút xoay/lật
 */
const EditMediaModal = forwardRef(
  (
    {
      aspectRatio = DEFAULT_MEDIA_OPTIONS.aspectRatio,
      className,
      imageSrc,
      isOpen,
      onApply,
      onClose,
      open,
      options = {},
      showTransformTools = true,
      title = 'Chỉnh sửa hình ảnh',
    },
    ref
  ) => {
    const isModalOpen = Boolean(open ?? isOpen);

    const hasValidImage = useMemo(
      () =>
        typeof imageSrc === 'string' &&
        imageSrc.length > 0 &&
        (imageSrc.startsWith('http') ||
          imageSrc.startsWith('data:') ||
          imageSrc.startsWith('blob:')),
      [imageSrc]
    );

    const { actions, state } = useEditMedia({
      aspectRatio,
      imageSrc,
      onApply,
      onClose,
      options,
    });

    const handleClose = useCallback(() => {
      if (!state.isProcessing) {
        actions.reset();
        onClose?.();
      }
    }, [state.isProcessing, actions, onClose]);

    if (!hasValidImage) {
      return null;
    }

    return (
      <Modal
        ref={ref}
        open={isModalOpen}
        onClose={handleClose}
        size="large"
        variant="solid"
        disableBackdropClick={state.isProcessing}
        disableEscapeKeyDown={state.isProcessing}
        keepMounted
        className={classNames('edit-media-modal', className)}
        aria-labelledby={`${MODAL_ID}-title`}
        aria-describedby={`${MODAL_ID}-desc`}
      >
        <EditMediaHeader
          title={title}
          onClose={handleClose}
          onApply={actions.apply}
          isProcessing={state.isProcessing}
          showTransformTools={showTransformTools}
          onRotateRight={actions.rotateRight}
          onRotateLeft={actions.rotateLeft}
          onToggleFlipH={actions.toggleFlipHorizontal}
          rotation={state.rotation}
          ariaLabel={`${MODAL_ID}-title`}
        />

        <EditMediaBody
          imageSrc={imageSrc}
          crop={state.crop}
          zoom={state.zoom}
          rotation={state.rotation}
          aspectRatio={state.aspectRatio}
          onCropChange={actions.setCrop}
          onCropComplete={actions.onCropComplete}
          onZoomChange={actions.setZoom}
          error={state.error}
          ariaDescribedBy={`${MODAL_ID}-desc`}
        />

        <EditMediaFooter
          zoom={state.zoom}
          onZoomChange={actions.setZoom}
          onClose={handleClose}
          isProcessing={state.isProcessing}
          minZoom={ZOOM_LIMITS.MIN}
          maxZoom={ZOOM_LIMITS.MAX}
          step={ZOOM_LIMITS.STEP}
        />
      </Modal>
    );
  }
);

EditMediaModal.displayName = 'EditMediaModal';

EditMediaModal.propTypes = {
  /** Tỷ lệ khung hình (width/height) */
  aspectRatio: PropTypes.number,
  /** Class CSS bổ sung */
  className: PropTypes.string,
  /** URL ảnh cần chỉnh sửa (http/data/blob) */
  imageSrc: PropTypes.string,
  /** Alias tương thích ngược cho open */
  isOpen: PropTypes.bool,
  /** Callback nhận file ảnh đã cắt */
  onApply: PropTypes.func.isRequired,
  /** Callback khi đóng modal */
  onClose: PropTypes.func.isRequired,
  /** Trạng thái đóng/mở modal */
  open: PropTypes.bool,
  /** Tùy chọn xuất file */
  options: PropTypes.shape({
    filename: PropTypes.string,
    outputType: PropTypes.string,
    quality: PropTypes.number,
  }),
  /** Hiển thị nhóm nút xoay/lật */
  showTransformTools: PropTypes.bool,
  /** Tiêu đề modal */
  title: PropTypes.string,
};

export default memo(EditMediaModal);
