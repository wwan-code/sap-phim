/**
 * @file FileUploadIdle.jsx
 * @module Components/UI/FileUploadZone/Components/FileUploadIdle
 * @component FileUploadIdle
 * @description Subcomponent hiển thị giao diện trạng thái chờ (Idle Dropzone) của vùng tải lên tệp chuẩn Material 3 Expressive & Obsidian Cinema.
 */

import React, { memo } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { motion } from 'framer-motion';
import {
  AlertCircle,
  CheckCircle2,
  File,
  FileArchive,
  FileAudio,
  FileCode,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileVideo,
  UploadCloud,
} from 'lucide-react';

import {
  FILE_UPLOAD_SIZES,
  FILE_UPLOAD_STATUS,
  FILE_UPLOAD_VARIANTS,
} from '../file-upload-zone.constants';
import { formatFileSize, getFileCategory } from '../utils/file-upload-zone.util';

/**
 * Hiệu ứng chuyển động mượt mà cho icon trung tâm theo chuẩn Neural Motion
 */
const iconMotionVariants = {
  idle: {
    y: [0, -3, 0],
    transition: { duration: 3, repeat: Infinity, ease: 'easeInOut' },
  },
  dragging: {
    y: -6,
    scale: 1.1,
    transition: { type: 'spring', stiffness: 350, damping: 20 },
  },
  success: {
    scale: [0.85, 1.12, 1],
    transition: { type: 'spring', stiffness: 400, damping: 18 },
  },
  error: {
    x: [-4, 4, -4, 4, 0],
    transition: { duration: 0.3, ease: 'easeInOut' },
  },
};

/**
 * Lấy icon lucide tương ứng theo phân loại tệp
 */
const renderSemanticFileIcon = (file, size = 14) => {
  const category = getFileCategory(file);

  switch (category) {
    case 'image':
      return <FileImage size={size} aria-hidden="true" />;
    case 'video':
      return <FileVideo size={size} aria-hidden="true" />;
    case 'audio':
      return <FileAudio size={size} aria-hidden="true" />;
    case 'code':
      return <FileCode size={size} aria-hidden="true" />;
    case 'archive':
      return <FileArchive size={size} aria-hidden="true" />;
    case 'spreadsheet':
      return <FileSpreadsheet size={size} aria-hidden="true" />;
    case 'text':
      return <FileText size={size} aria-hidden="true" />;
    default:
      return <File size={size} aria-hidden="true" />;
  }
};

/**
 * @component FileUploadIdle
 * @description Trạng thái chờ/sẵn sàng chọn tệp hoặc kéo thả tệp.
 */
const FileUploadIdle = ({
  customIcon: CustomIcon,
  disabled = false,
  errorMessage,
  helperText,
  internalError,
  isDragging = false,
  maxSizeText,
  multiple: _multiple = false,
  openFileDialog,
  selectedFiles = [],
  size = FILE_UPLOAD_SIZES.MEDIUM,
  status = FILE_UPLOAD_STATUS.IDLE,
  variant = FILE_UPLOAD_VARIANTS.STANDARD,
}) => {
  const isError = status === FILE_UPLOAD_STATUS.ERROR || Boolean(internalError || errorMessage);
  const isSuccess = status === FILE_UPLOAD_STATUS.SUCCESS;
  const isAvatar = variant === FILE_UPLOAD_VARIANTS.AVATAR;
  const isCompact = variant === FILE_UPLOAD_VARIANTS.COMPACT || size === FILE_UPLOAD_SIZES.SMALL;
  const activeError = internalError || errorMessage;

  const iconPixelSize = isAvatar ? 24 : isCompact ? 18 : size === FILE_UPLOAD_SIZES.LARGE ? 32 : 24;

  const currentIcon = (() => {
    if (CustomIcon && status === FILE_UPLOAD_STATUS.IDLE && !isError) {
      return <CustomIcon size={iconPixelSize} />;
    }
    if (isSuccess) {
      return <CheckCircle2 size={iconPixelSize} className="file-upload-zone__icon--success" />;
    }
    if (isError) {
      return <AlertCircle size={iconPixelSize} className="file-upload-zone__icon--error" />;
    }
    return <UploadCloud size={iconPixelSize} className="file-upload-zone__icon--idle" />;
  })();

  const animationKey = isDragging ? 'dragging' : isError ? 'error' : isSuccess ? 'success' : 'idle';

  return (
    <motion.div
      key="idle"
      className={classNames('file-upload-zone__content', {
        'file-upload-zone__content--compact': isCompact,
        'file-upload-zone__content--avatar': isAvatar,
      })}
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="file-upload-zone__status-group">
        <motion.div
          className={classNames('file-upload-zone__main-icon-wrapper', {
            'file-upload-zone__main-icon-wrapper--is-success': isSuccess,
            'file-upload-zone__main-icon-wrapper--is-error': isError,
            'file-upload-zone__main-icon-wrapper--is-dragging': isDragging,
            'file-upload-zone__main-icon-wrapper--compact': isCompact,
            'file-upload-zone__main-icon-wrapper--avatar': isAvatar,
          })}
          variants={iconMotionVariants}
          animate={animationKey}
        >
          {currentIcon}
        </motion.div>

        {!isAvatar && (
          <div
            className={classNames('file-upload-zone__text-group', {
              'file-upload-zone__text-group--is-error': isError,
              'file-upload-zone__text-group--compact': isCompact,
            })}
          >
            {isSuccess ? (
              <h4 className="file-upload-zone__title">Tải lên hoàn tất!</h4>
            ) : isError ? (
              <h4 className="file-upload-zone__title">Tải lên không thành công</h4>
            ) : (
              <h4 className="file-upload-zone__title">
                {isDragging ? (
                  'Thả tệp vào đây'
                ) : (
                  <>
                    Kéo thả tệp hoặc{' '}
                    <button
                      type="button"
                      className="file-upload-zone__browse-link"
                      onClick={(e) => {
                        e.stopPropagation();
                        openFileDialog();
                      }}
                      disabled={disabled}
                    >
                      duyệt tệp
                    </button>
                  </>
                )}
              </h4>
            )}

            <p
              id="file-upload-zone-helper"
              className={classNames('file-upload-zone__helper-text', {
                'file-upload-zone__helper-text--error': isError,
                'file-upload-zone__helper-text--compact': isCompact,
              })}
              role={isError ? 'alert' : undefined}
            >
              {activeError || helperText || maxSizeText || 'Hỗ trợ kéo thả trực tiếp'}
            </p>
          </div>
        )}

        {isAvatar && (
          <p className="file-upload-zone__avatar-caption">
            {isDragging ? 'Thả ảnh vào đây' : 'Chọn ảnh đại diện'}
          </p>
        )}
      </div>

      {selectedFiles.length > 0 && !isError && !isSuccess && !isAvatar && (
        <div
          className="file-upload-zone__selected-files-list"
          onClick={(e) => e.stopPropagation()}
        >
          {selectedFiles.map((file, idx) => (
            <div key={`${file.name}-${idx}`} className="file-upload-zone__selected-file-chip">
              <span className="file-upload-zone__chip-icon">
                {renderSemanticFileIcon(file, 12)}
              </span>
              <span className="file-upload-zone__chip-text" title={file.name}>
                {file.name}
              </span>
              <span className="file-upload-zone__chip-size">
                ({formatFileSize(file.size)})
              </span>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
};

FileUploadIdle.propTypes = {
  customIcon: PropTypes.elementType,
  disabled: PropTypes.bool,
  errorMessage: PropTypes.string,
  helperText: PropTypes.string,
  internalError: PropTypes.string,
  isDragging: PropTypes.bool,
  maxSizeText: PropTypes.string,
  multiple: PropTypes.bool,
  openFileDialog: PropTypes.func.isRequired,
  selectedFiles: PropTypes.array,
  size: PropTypes.oneOf(['small', 'medium', 'large']),
  status: PropTypes.oneOf(['idle', 'uploading', 'success', 'error']),
  variant: PropTypes.oneOf(['standard', 'compact', 'avatar']),
};

export default memo(FileUploadIdle);
