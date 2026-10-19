/**
 * @file FileUploadPreview.jsx
 * @module Components/UI/FileUploadZone/Components/FileUploadPreview
 * @component FileUploadPreview
 * @description Subcomponent hiển thị các chế độ xem trước (Single Image, Single Document, Multiple Grid) chuẩn Material 3 Expressive & Obsidian Cinema với Floating Glass Action Bar.
 */

import React, { memo, useCallback } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { motion } from 'framer-motion';
import {
  Crop,
  File,
  FileArchive,
  FileAudio,
  FileCode,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileVideo,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from 'lucide-react';

import IconButton from '@/shared/components/ui/icon-button/IconButton';
import Tooltip from '@/shared/components/ui/tooltip/Tooltip';

import { FILE_UPLOAD_VARIANTS } from '../file-upload-zone.constants';
import { formatFileSize, getFileCategory } from '../utils/file-upload-zone.util';

/**
 * Hiển thị icon theo loại tệp
 */
const renderCategoryIcon = (category, size = 20) => {
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
 * @component FileUploadPreview
 * @description Quản lý hiển thị preview cho ảnh/tệp tin đã chọn hoặc ảnh từ server.
 */
const FileUploadPreview = ({
  disabled = false,
  editable = true,
  multiple = false,
  onClearPreview,
  onOpenEditModal,
  onRemoveFile,
  openFileDialog,
  previewUrl,
  previews = [],
  variant = FILE_UPLOAD_VARIANTS.STANDARD,
}) => {
  const isAvatar = variant === FILE_UPLOAD_VARIANTS.AVATAR;

  const handleKeyDownReplace = useCallback(
    (e) => {
      if (disabled) return;
      if (e.key === 'Enter' || e.key === ' ') {
        e.stopPropagation();
        e.preventDefault();
        openFileDialog();
      }
    },
    [disabled, openFileDialog]
  );

  const resolvedPreviewUrl =
    typeof previewUrl === 'string'
      ? previewUrl
      : previewUrl?.url || previewUrl?.path || '';

  // 1. Trường hợp có previewUrl từ bên ngoài truyền vào (Single preview)
  if (resolvedPreviewUrl && (!multiple || previews.length === 0)) {
    return (
      <motion.div
        key="external-preview"
        className={classNames('file-upload-zone__preview-view', {
          'file-upload-zone__preview-view--avatar': isAvatar,
        })}
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.98 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      >
        <img
          src={resolvedPreviewUrl}
          alt="Xem trước hình ảnh"
          className="file-upload-zone__preview-image"
          loading="lazy"
        />

        {!disabled && (
          <div
            className="file-upload-zone__preview-overlay"
            onClick={(e) => {
              e.stopPropagation();
              openFileDialog();
            }}
            role="button"
            tabIndex={0}
            onKeyDown={handleKeyDownReplace}
            aria-label="Thay đổi tệp hình ảnh"
          />
        )}

        {!disabled && (
          <div
            className="file-upload-zone__preview-controls"
            onClick={(e) => e.stopPropagation()}
          >
            {editable && onOpenEditModal && (
              <Tooltip title="Cắt & chỉnh ảnh" placement="top" arrow>
                <IconButton
                  size="small"
                  variant="filled"
                  onClick={onOpenEditModal}
                  aria-label="Cắt & chỉnh sửa hình ảnh"
                  className="file-upload-zone__control-btn"
                >
                  <Crop size={13} />
                </IconButton>
              </Tooltip>
            )}

            <Tooltip title="Đổi tệp khác" placement="top" arrow>
              <IconButton
                size="small"
                variant="filled"
                onClick={openFileDialog}
                aria-label="Đổi tệp hình ảnh"
                className="file-upload-zone__control-btn"
              >
                <RefreshCw size={13} />
              </IconButton>
            </Tooltip>

            {onClearPreview && (
              <Tooltip title="Xóa ảnh" placement="top" arrow>
                <IconButton
                  size="small"
                  variant="filled"
                  color="danger"
                  onClick={onClearPreview}
                  aria-label="Xóa hình ảnh"
                  className="file-upload-zone__control-btn file-upload-zone__control-btn--danger"
                >
                  <Trash2 size={13} />
                </IconButton>
              </Tooltip>
            )}
          </div>
        )}
      </motion.div>
    );
  }

  // 2. Trường hợp tệp cục bộ đơn lẻ (Single Local Preview)
  if (!multiple && previews.length > 0) {
    const item = previews[0];

    return (
      <motion.div
        key="single-local-preview"
        className={classNames('file-upload-zone__preview-view', {
          'file-upload-zone__preview-view--avatar': isAvatar,
        })}
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.98 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      >
        {item.isImage && item.url ? (
          <>
            <img
              src={item.url}
              alt={item.name}
              className="file-upload-zone__preview-image"
              loading="lazy"
            />
            {!disabled && (
              <div
                className="file-upload-zone__preview-overlay"
                onClick={(e) => {
                  e.stopPropagation();
                  openFileDialog();
                }}
                role="button"
                tabIndex={0}
                onKeyDown={handleKeyDownReplace}
                aria-label="Thay đổi tệp hình ảnh"
              />
            )}
          </>
        ) : (
          <div
            className="file-upload-zone__preview-doc"
            onClick={(e) => {
              e.stopPropagation();
              if (!disabled) openFileDialog();
            }}
          >
            <div className="file-upload-zone__doc-icon-wrapper">
              {renderCategoryIcon(item.category, 28)}
            </div>
            <span className="file-upload-zone__preview-doc-name" title={item.name}>
              {item.name}
            </span>
            <span className="file-upload-zone__preview-doc-size">
              {formatFileSize(item.size)}
            </span>
          </div>
        )}

        {!disabled && (
          <div
            className="file-upload-zone__preview-controls"
            onClick={(e) => e.stopPropagation()}
          >
            {item.isImage && editable && onOpenEditModal && (
              <Tooltip title="Cắt & chỉnh ảnh" placement="top" arrow>
                <IconButton
                  size="small"
                  variant="filled"
                  onClick={onOpenEditModal}
                  aria-label="Chỉnh sửa hình ảnh"
                  className="file-upload-zone__control-btn"
                >
                  <Crop size={13} />
                </IconButton>
              </Tooltip>
            )}

            <Tooltip title="Đổi tệp khác" placement="top" arrow>
              <IconButton
                size="small"
                variant="filled"
                onClick={openFileDialog}
                aria-label="Đổi tệp khác"
                className="file-upload-zone__control-btn"
              >
                <RefreshCw size={13} />
              </IconButton>
            </Tooltip>

            {onClearPreview && (
              <Tooltip title="Hủy chọn" placement="top" arrow>
                <IconButton
                  size="small"
                  variant="filled"
                  color="danger"
                  onClick={onClearPreview}
                  aria-label="Hủy chọn tệp"
                  className="file-upload-zone__control-btn file-upload-zone__control-btn--danger"
                >
                  <Trash2 size={13} />
                </IconButton>
              </Tooltip>
            )}
          </div>
        )}
      </motion.div>
    );
  }

  // 3. Trường hợp tải lên nhiều tệp (Multiple files preview grid)
  return (
    <motion.div
      key="multiple-preview-grid"
      className="file-upload-zone__multiple-view"
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="file-upload-zone__preview-grid">
        {previews.map((item, idx) => {
          const category = item.category || getFileCategory(item.file);

          return (
            <div key={`${item.name}-${idx}`} className="file-upload-zone__preview-item">
              {item.isImage && item.url ? (
                <img
                  src={item.url}
                  alt={item.name}
                  className="file-upload-zone__preview-item-image"
                  loading="lazy"
                />
              ) : (
                <div className="file-upload-zone__preview-item-doc">
                  <span className="file-upload-zone__preview-item-doc-icon">
                    {renderCategoryIcon(category, 18)}
                  </span>
                  <span
                    className="file-upload-zone__preview-item-doc-name"
                    title={item.name}
                  >
                    {item.name}
                  </span>
                  <span className="file-upload-zone__preview-item-doc-size">
                    {formatFileSize(item.size)}
                  </span>
                </div>
              )}

              {!disabled && onRemoveFile && (
                <button
                  type="button"
                  className="file-upload-zone__preview-item-remove-btn"
                  onClick={() => onRemoveFile(idx)}
                  title={`Xóa tệp ${item.name}`}
                  aria-label={`Xóa tệp ${item.name}`}
                >
                  <X size={12} aria-hidden="true" />
                </button>
              )}
            </div>
          );
        })}

        {!disabled && (
          <div
            className="file-upload-zone__preview-add-tile"
            onClick={openFileDialog}
            role="button"
            tabIndex={0}
            onKeyDown={handleKeyDownReplace}
            aria-label="Thêm tệp khác"
          >
            <Plus size={18} aria-hidden="true" />
            <span>Thêm</span>
          </div>
        )}
      </div>

      <div className="file-upload-zone__preview-bottom-actions">
        <span className="file-upload-zone__preview-count-label">
          Đã chọn {previews.length} tệp
        </span>

        {!disabled && onClearPreview && previews.length > 0 && (
          <button
            type="button"
            className="file-upload-zone__clear-all-btn"
            onClick={onClearPreview}
          >
            <Trash2 size={12} aria-hidden="true" />
            <span>Xóa tất cả</span>
          </button>
        )}
      </div>
    </motion.div>
  );
};

FileUploadPreview.propTypes = {
  disabled: PropTypes.bool,
  editable: PropTypes.bool,
  multiple: PropTypes.bool,
  onClearPreview: PropTypes.func,
  onOpenEditModal: PropTypes.func,
  onRemoveFile: PropTypes.func,
  openFileDialog: PropTypes.func.isRequired,
  previewUrl: PropTypes.oneOfType([PropTypes.string, PropTypes.object]),
  previews: PropTypes.array,
  variant: PropTypes.oneOf(['standard', 'compact', 'avatar']),
};

export default memo(FileUploadPreview);
