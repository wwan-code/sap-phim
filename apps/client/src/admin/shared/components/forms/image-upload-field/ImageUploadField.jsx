/**
 * @file ImageUploadField.jsx
 * @module Admin/Shared/Components/Forms/ImageUploadField
 * @component ImageUploadField
 * @description Component nhập liệu hình ảnh Hybrid (Upload file lên CDN/Cloud + Dán URL trực tiếp) kèm ảnh xem trước và tiến trình tải lên chuẩn Material 3 Expressive.
 */

import React, { useState, useRef, memo } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { Upload, Link2, Trash2, Loader2, Image as ImageIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import { useUploadImageMutation } from '@/hooks/mutations/use-upload.mutations';
import Button from '@/shared/components/ui/button';
import TextField from '@/shared/components/ui/text-field';
import IconButton from '@/shared/components/ui/icon-button';
import './image-upload-field.scss';

export const ImageUploadField = memo(({
  value = '',
  onChange,
  label = 'Hình ảnh',
  aspectRatio = 'square', // 'square' (1:1) | 'poster' (2:3) | 'landscape' (16:9) | 'banner' (21:9)
  placeholder = 'Nhập link ảnh hoặc tải lên...',
  helperText,
  error,
  disabled = false,
  className = '',
}) => {
  const [activeMode, setActiveMode] = useState('upload'); // 'upload' | 'url'
  const [urlInput, setUrlInput] = useState(value || '');
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef(null);

  const { mutate: uploadImage, isPending: isUploading } = useUploadImageMutation({
    onProgress: (progressEvent) => {
      if (progressEvent.total) {
        const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        setUploadProgress(percent);
      }
    },
    onSuccess: (data) => {
      const uploadedUrl = data?.url || data?.secure_url || data?.path;
      if (uploadedUrl) {
        onChange?.(uploadedUrl);
        setUrlInput(uploadedUrl);
        toast.success('Tải ảnh lên thành công!');
      }
      setUploadProgress(0);
    },
    onError: (err) => {
      setUploadProgress(0);
      toast.error(err?.message || 'Lỗi khi tải ảnh lên');
    },
  });

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Dung lượng tệp vượt quá giới hạn cho phép (Tối đa 5MB)');
      return;
    }

    const formData = new FormData();
    formData.append('image', file);
    formData.append('type', 'image');
    uploadImage(formData);

    // Reset native input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleApplyUrl = () => {
    if (urlInput.trim()) {
      onChange?.(urlInput.trim());
    }
  };

  const handleClearImage = () => {
    onChange?.('');
    setUrlInput('');
  };

  return (
    <div
      className={classNames(
        'image-upload-field',
        `image-upload-field--ratio-${aspectRatio}`,
        {
          'image-upload-field--has-image': Boolean(value),
          'image-upload-field--disabled': disabled,
          'image-upload-field--error': Boolean(error),
        },
        className
      )}
    >
      {label && <label className="image-upload-field__label">{label}</label>}

      <div className="image-upload-field__main">
        {/* 1. Preview Container */}
        <div className="image-upload-field__preview-box">
          {value ? (
            <div className="image-upload-field__preview-inner">
              <img src={value} alt="Preview" className="image-upload-field__img" />
              {!disabled && (
                <div className="image-upload-field__preview-overlay">
                  <IconButton
                    type="button"
                    size="small"
                    variant="filled"
                    color="danger"
                    onClick={handleClearImage}
                    aria-label="Xóa ảnh này"
                  >
                    <Trash2 size={16} />
                  </IconButton>
                </div>
              )}
            </div>
          ) : (
            <div className="image-upload-field__placeholder">
              {isUploading ? (
                <div className="image-upload-field__loading-indicator">
                  <Loader2 size={24} className="image-upload-field__spinner" />
                  <span className="image-upload-field__percent">{uploadProgress}%</span>
                </div>
              ) : (
                <div className="image-upload-field__no-image">
                  <ImageIcon size={28} className="image-upload-field__icon" />
                  <span className="image-upload-field__no-image-text">Chưa có ảnh</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 2. Control Tabs & Inputs */}
        <div className="image-upload-field__controls">
          <div className="image-upload-field__tabs">
            <button
              type="button"
              className={classNames('image-upload-field__tab', {
                'image-upload-field__tab--active': activeMode === 'upload',
              })}
              onClick={() => setActiveMode('upload')}
              disabled={disabled || isUploading}
            >
              <Upload size={14} />
              <span>Tải tệp</span>
            </button>

            <button
              type="button"
              className={classNames('image-upload-field__tab', {
                'image-upload-field__tab--active': activeMode === 'url',
              })}
              onClick={() => setActiveMode('url')}
              disabled={disabled || isUploading}
            >
              <Link2 size={14} />
              <span>Dán link URL</span>
            </button>
          </div>

          <div className="image-upload-field__input-zone">
            {activeMode === 'upload' ? (
              <div className="image-upload-field__file-action">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="image-upload-field__hidden-file"
                  onChange={handleFileChange}
                  disabled={disabled || isUploading}
                />
                <Button
                  type="button"
                  variant="outlined"
                  size="small"
                  startIcon={isUploading ? <Loader2 size={14} className="image-upload-field__spinner" /> : <Upload size={14} />}
                  onClick={() => fileInputRef.current?.click()}
                  disabled={disabled || isUploading}
                >
                  {isUploading ? `Đang tải lên ${uploadProgress}%...` : value ? 'Đổi ảnh khác' : 'Chọn ảnh từ máy tính'}
                </Button>
                <span className="image-upload-field__file-hint">PNG, JPG, WEBP (Tối đa 5MB)</span>
              </div>
            ) : (
              <div className="image-upload-field__url-action">
                <TextField
                  size="small"
                  variant="outlined"
                  placeholder={placeholder}
                  value={urlInput}
                  disabled={disabled}
                  onChange={(e) => setUrlInput(e.target.value)}
                  onBlur={handleApplyUrl}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleApplyUrl();
                    }
                  }}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {(error || helperText) && (
        <p className={classNames('image-upload-field__helper', { 'image-upload-field__helper--error': Boolean(error) })}>
          {typeof error === 'string' ? error : helperText}
        </p>
      )}
    </div>
  );
});

ImageUploadField.displayName = 'ImageUploadField';

ImageUploadField.propTypes = {
  value: PropTypes.string,
  onChange: PropTypes.func,
  label: PropTypes.node,
  aspectRatio: PropTypes.oneOf(['square', 'poster', 'landscape', 'banner']),
  placeholder: PropTypes.string,
  helperText: PropTypes.node,
  error: PropTypes.oneOfType([PropTypes.bool, PropTypes.string]),
  disabled: PropTypes.bool,
  className: PropTypes.string,
};

export default ImageUploadField;
