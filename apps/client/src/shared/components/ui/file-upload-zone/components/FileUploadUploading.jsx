/**
 * @file FileUploadUploading.jsx
 * @module Components/UI/FileUploadZone/Components/FileUploadUploading
 * @component FileUploadUploading
 * @description Subcomponent hiển thị giao diện tiến trình tải tệp lên hệ thống chuẩn Material 3 Expressive & Neural Ambient Glow.
 */

import React, { memo } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { motion } from 'framer-motion';
import { Loader2, Sparkles } from 'lucide-react';

import { FILE_UPLOAD_VARIANTS } from '../file-upload-zone.constants';

/**
 * @component FileUploadUploading
 * @description Trạng thái đang thực thi tải tệp lên server với tiến trình trực quan.
 */
const FileUploadUploading = ({
  fileName,
  fileSizeText,
  progress = 0,
  variant = FILE_UPLOAD_VARIANTS.STANDARD,
}) => {
  const isAvatar = variant === FILE_UPLOAD_VARIANTS.AVATAR;
  const isCompact = variant === FILE_UPLOAD_VARIANTS.COMPACT;
  const clampedProgress = Math.min(100, Math.max(0, Math.round(progress)));

  return (
    <motion.div
      key="uploading"
      className={classNames('file-upload-zone__uploading-view', {
        'file-upload-zone__uploading-view--compact': isCompact,
        'file-upload-zone__uploading-view--avatar': isAvatar,
      })}
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
    >
      {!isAvatar ? (
        <div className="file-upload-zone__uploading-content">
          <div className="file-upload-zone__uploading-header">
            <Sparkles size={16} className="file-upload-zone__uploading-sparkle" aria-hidden="true" />
            <span className="file-upload-zone__filename" title={fileName}>
              {fileName || 'Đang tải tệp...'}
            </span>
            {fileSizeText && (
              <span className="file-upload-zone__filesize">({fileSizeText})</span>
            )}
          </div>

          <div className="file-upload-zone__progress-container">
            <div className="file-upload-zone__linear-progress">
              <div
                className="file-upload-zone__linear-progress-indicator"
                style={{ width: `${clampedProgress}%` }}
                role="progressbar"
                aria-valuenow={clampedProgress}
                aria-valuemin="0"
                aria-valuemax="100"
                aria-label={`Tiến trình tải lên: ${clampedProgress}%`}
              />
            </div>

            <span className="file-upload-zone__percent-text">{clampedProgress}%</span>
          </div>

          <p className="file-upload-zone__uploading-text">
            Đang tải lên & tối ưu hóa...
          </p>
        </div>
      ) : (
        <div className="file-upload-zone__avatar-uploading-spinner">
          <Loader2 size={28} className="file-upload-zone__spinner-icon" aria-hidden="true" />
          <span className="file-upload-zone__percent-text">{clampedProgress}%</span>
        </div>
      )}
    </motion.div>
  );
};

FileUploadUploading.propTypes = {
  fileName: PropTypes.string,
  fileSizeText: PropTypes.string,
  progress: PropTypes.number,
  variant: PropTypes.oneOf(['standard', 'compact', 'avatar']),
};

export default memo(FileUploadUploading);
