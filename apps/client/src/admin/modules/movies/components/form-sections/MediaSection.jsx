/**
 * @file MediaSection.jsx
 * @module Admin/Modules/Movies/Components/FormSections
 * @description Section 4: Khu vực tải ảnh (Poster chính + 3 hàng compact cho Banner, Cover, Logo) chuẩn Material 3 Expressive.
 */

import React, { useRef, useState, useMemo, useCallback, memo } from 'react';
import PropTypes from 'prop-types';
import { UploadCloud, Image as ImageIcon, Trash2, CheckCircle2, Crop } from 'lucide-react';

import { SectionCard } from '@/admin/shared/components/layout/section-card/SectionCard';
import FileUploadZone from '@/shared/components/ui/file-upload-zone/FileUploadZone';
import EditMediaModal from '@/shared/components/common/edit-media-modal/EditMediaModal';
import Button from '@/shared/components/ui/button/Button';
import IconButton from '@/shared/components/ui/icon-button/IconButton';
import Tooltip from '@/shared/components/ui/tooltip/Tooltip';

const SECONDARY_MEDIA_CONFIG = [
  {
    key: 'cover',
    label: 'Cover ngang (Backdrop)',
    ratio: '16:9',
    aspectRatio: '16/9',
    aspectRatioValue: 16 / 9,
    hint: 'Trang chi tiết & Backdrop phim',
    accept: 'image/*',
  },
  {
    key: 'banner',
    label: 'Banner siêu rộng (Hero)',
    ratio: '21:9',
    aspectRatio: '21/9',
    aspectRatioValue: 21 / 9,
    hint: 'Hero Carousel trang chủ & Header',
    accept: 'image/*',
  },
  {
    key: 'logo',
    label: 'Logo tên phim',
    ratio: '3:1',
    aspectRatio: '3/1',
    aspectRatioValue: 3 / 1,
    hint: 'Logo PNG trong suốt',
    accept: 'image/png,image/webp',
  },
];

const EDIT_MODAL_INITIAL = { isOpen: false, imageSrc: null, key: null, aspectRatio: 1 };

/**
 * @component MediaSection
 * @description Section tải & chỉnh sửa ảnh media cho form phim: Poster (2:3) + 3 hàng compact với tích hợp Crop/Edit.
 */
const MediaSection = ({ imagePreviews, handleImageFileChange, handleClearImage, isReadOnly }) => {
  const bannerInputRef = useRef(null);
  const coverInputRef = useRef(null);
  const logoInputRef = useRef(null);

  const [editModalState, setEditModalState] = useState(EDIT_MODAL_INITIAL);

  const fileInputRefs = useMemo(
    () => ({
      banner: bannerInputRef,
      cover: coverInputRef,
      logo: logoInputRef,
    }),
    []
  );

  const handleTriggerFileInput = (key) => {
    if (isReadOnly) return;
    fileInputRefs[key]?.current?.click();
  };

  const handleNativeFileChange = (key, event) => {
    const file = event.target.files?.[0];
    if (file) {
      handleImageFileChange(key, file);
    }
    // Reset input value để cho phép chọn lại cùng 1 file
    event.target.value = '';
  };

  const handleRowDrop = (key, event) => {
    event.preventDefault();
    if (isReadOnly) return;
    const file = event.dataTransfer?.files?.[0];
    if (file && file.type.startsWith('image/')) {
      handleImageFileChange(key, file);
    }
  };

  const handleRowDragOver = (event) => {
    event.preventDefault();
  };

  const handlePosterChange = useCallback(
    (file) => {
      handleImageFileChange('poster', file);
    },
    [handleImageFileChange]
  );

  const handlePosterClear = useCallback(() => {
    handleClearImage('poster');
  }, [handleClearImage]);

  /** Mở EditMediaModal cho một hàng secondary cụ thể */
  const handleOpenEditModal = useCallback(
    (key, preview, aspectRatioValue) => {
      if (isReadOnly || !preview) return;
      setEditModalState({ isOpen: true, imageSrc: preview, key, aspectRatio: aspectRatioValue });
    },
    [isReadOnly]
  );

  /** Đóng EditMediaModal */
  const handleCloseEditModal = useCallback(() => {
    setEditModalState(EDIT_MODAL_INITIAL);
  }, []);

  /** Áp dụng kết quả crop — giống như tải ảnh mới */
  const handleEditApply = useCallback(
    (croppedFile) => {
      if (editModalState.key) {
        handleImageFileChange(editModalState.key, croppedFile);
      }
      setEditModalState(EDIT_MODAL_INITIAL);
    },
    [editModalState.key, handleImageFileChange]
  );

  return (
    <SectionCard
      title="Hình Ảnh & Media"
      subtitle="Tải lên tệp ảnh kéo thả, cắt chỉnh tỷ lệ và nén WebP tự động."
    >
      <div className="sp-movie-form__media-container">
        {/* ── TẦNG 1: HERO POSTER (2:3) ── */}
        <div className="sp-movie-form__media-hero">
          <div className="sp-movie-form__upload-label">
            <span className="sp-movie-form__media-hero-title">Poster chính (Đại diện)</span>
            <span className="sp-movie-form__upload-ratio-tag">2:3</span>
          </div>

          <div className="sp-movie-form__media-hero-zone">
            <FileUploadZone
              accept="image/*"
              aspectRatio="2/3"
              size="medium"
              previewUrl={imagePreviews.poster}
              helperText="Kéo thả hoặc chọn ảnh Poster chuẩn 2:3"
              onChange={handlePosterChange}
              onClearPreview={handlePosterClear}
              onEditPreview={handlePosterChange}
              disabled={isReadOnly}
            />
          </div>
        </div>

        {/* ── TẦNG 2: 3 HÀNG COMPACT (Banner, Cover, Logo) ── */}
        <div className="sp-movie-form__media-secondary">
          <div className="sp-movie-form__media-secondary-header">
            <span className="sp-movie-form__media-secondary-title">Ảnh bổ sung & Đồ họa</span>
            <span className="sp-movie-form__media-secondary-count">3 tỷ lệ</span>
          </div>

          <div className="sp-movie-form__media-list">
            {SECONDARY_MEDIA_CONFIG.map((config) => {
              const preview = imagePreviews[config.key];
              const hasImage = Boolean(preview);

              return (
                <div
                  key={config.key}
                  className={`sp-movie-form__media-row ${hasImage ? 'sp-movie-form__media-row--has-image' : ''}`}
                  onDrop={(e) => handleRowDrop(config.key, e)}
                  onDragOver={handleRowDragOver}
                >
                  {/* Hidden Input */}
                  <input
                    ref={fileInputRefs[config.key]}
                    type="file"
                    accept={config.accept}
                    className="sp-movie-form__media-hidden-input"
                    onChange={(e) => handleNativeFileChange(config.key, e)}
                    disabled={isReadOnly}
                  />

                  {/* Thumbnail */}
                  <div
                    className="sp-movie-form__media-thumb"
                    style={{ aspectRatio: config.aspectRatio }}
                    onClick={() => !hasImage && handleTriggerFileInput(config.key)}
                  >
                    {hasImage ? (
                      <img
                        src={preview}
                        alt={config.label}
                        className={`sp-movie-form__media-thumb-img ${config.key === 'logo' ? 'sp-movie-form__media-thumb-img--contain' : ''}`}
                      />
                    ) : (
                      <div className="sp-movie-form__media-thumb-placeholder">
                        <ImageIcon size={16} />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="sp-movie-form__media-info">
                    <div className="sp-movie-form__media-info-top">
                      <span className="sp-movie-form__media-name">{config.label}</span>
                      <span className="sp-movie-form__upload-ratio-tag">{config.ratio}</span>
                    </div>
                    <div className="sp-movie-form__media-info-bottom">
                      {hasImage ? (
                        <span className="sp-movie-form__media-status sp-movie-form__media-status--uploaded">
                          <CheckCircle2 size={12} /> Đã tải lên
                        </span>
                      ) : (
                        <span className="sp-movie-form__media-hint">{config.hint}</span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="sp-movie-form__media-actions">
                    {!hasImage ? (
                      <Button
                        type="button"
                        variant="tonal"
                        size="small"
                        startIcon={<UploadCloud size={14} />}
                        onClick={() => handleTriggerFileInput(config.key)}
                        disabled={isReadOnly}
                        className="sp-movie-form__media-upload-btn"
                      >
                        Tải lên
                      </Button>
                    ) : (
                      <>
                        <Tooltip title="Thay đổi ảnh" placement="top" arrow>
                          <IconButton
                            type="button"
                            size="small"
                            variant="standard"
                            onClick={() => handleTriggerFileInput(config.key)}
                            disabled={isReadOnly}
                            aria-label={`Thay đổi ${config.label}`}
                          >
                            <UploadCloud size={15} />
                          </IconButton>
                        </Tooltip>

                        <Tooltip title="Cắt & chỉnh sửa ảnh" placement="top" arrow>
                          <IconButton
                            type="button"
                            size="small"
                            variant="standard"
                            onClick={() => handleOpenEditModal(config.key, preview, config.aspectRatioValue)}
                            disabled={isReadOnly}
                            aria-label={`Cắt & chỉnh sửa ${config.label}`}
                          >
                            <Crop size={15} />
                          </IconButton>
                        </Tooltip>

                        <Tooltip title="Xóa ảnh" placement="top" arrow>
                          <IconButton
                            type="button"
                            size="small"
                            variant="standard"
                            color="danger"
                            onClick={() => handleClearImage(config.key)}
                            disabled={isReadOnly}
                            aria-label={`Xóa ${config.label}`}
                          >
                            <Trash2 size={15} />
                          </IconButton>
                        </Tooltip>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* EditMediaModal — render một lần bên ngoài vòng .map() */}
      <EditMediaModal
        open={editModalState.isOpen}
        imageSrc={editModalState.imageSrc}
        aspectRatio={editModalState.aspectRatio}
        title="Cắt & chỉnh sửa ảnh"
        onClose={handleCloseEditModal}
        onApply={handleEditApply}
        options={{
          outputType: 'image/webp',
          quality: 0.92,
          filename: `${editModalState.key ?? 'media'}-cropped.webp`,
        }}
      />
    </SectionCard>
  );
};

MediaSection.propTypes = {
  imagePreviews: PropTypes.shape({
    poster: PropTypes.string,
    banner: PropTypes.string,
    cover: PropTypes.string,
    logo: PropTypes.string,
  }).isRequired,
  handleImageFileChange: PropTypes.func.isRequired,
  handleClearImage: PropTypes.func.isRequired,
  isReadOnly: PropTypes.bool,
};

export default memo(MediaSection);
