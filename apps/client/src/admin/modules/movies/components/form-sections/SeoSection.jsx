/**
 * @file SeoSection.jsx
 * @module Admin/Modules/Movies/Components/FormSections
 * @description Section 6: Tiêu đề SEO, Mô tả SEO, Từ khóa SEO và Khung xem trước Google SERP.
 */

import React, { memo } from 'react';
import PropTypes from 'prop-types';
import { Controller, useFormContext } from 'react-hook-form';
import { Globe, Search } from 'lucide-react';

import { SectionCard } from '@/admin/shared/components/layout/section-card/SectionCard';
import { TagInput } from '@/admin/shared/components/forms/tag-input/TagInput';
import TextField from '@/shared/components/ui/text-field/TextField';

const SeoSection = ({ isReadOnly }) => {
  const { control, watch, formState: { errors } } = useFormContext();

  const title = watch('title') || watch('titles.0.title');
  const slug = watch('slug');
  const metaTitle = watch('meta_title');
  const metaDescription = watch('meta_description');
  const description = watch('description');

  const previewTitle = metaTitle || (title ? `${title} - Sạp Phim` : 'Tên phim - Xem Phim Full HD Vietsub | Sạp Phim');
  const previewSlug = slug || 'duong-dan-phim';
  const previewDesc = metaDescription || description || 'Xem phim online full HD vietsub, thuyết minh chất lượng cao miễn phí tại Sạp Phim. Cập nhật tập mới liên tục mỗi ngày...';

  return (
    <SectionCard
      title="6. Tối Ưu SEO & Hiển Thị (Tìm Kiếm)"
      subtitle="Thiết lập tiêu đề, mô tả và từ khóa xuất hiện trên công cụ tìm kiếm Google."
      icon={Search}
    >
      <div className="sp-movie-form__section-content">
        {/* ── Khung Xem Trước Google SERP ── */}
        <div className="sp-movie-form__seo-preview">
          <div className="sp-movie-form__seo-preview-header">
            <div className="sp-movie-form__seo-preview-badge">
              <Globe size={13} />
              <span>Xem trước kết quả tìm kiếm Google (SERP Preview)</span>
            </div>
            <span className="sp-movie-form__seo-preview-live">Thời gian thực</span>
          </div>

          <div className="sp-movie-form__seo-serp-box">
            <div className="sp-movie-form__seo-serp-url-row">
              <div className="sp-movie-form__seo-serp-favicon">
                <Globe size={12} />
              </div>
              <div className="sp-movie-form__seo-serp-url-text">
                <span className="sp-movie-form__seo-serp-domain">sapphim.com</span>
                <span className="sp-movie-form__seo-serp-breadcrumb"> › phim › {previewSlug}</span>
              </div>
            </div>

            <h4 className="sp-movie-form__seo-serp-title">
              {previewTitle}
            </h4>

            <p className="sp-movie-form__seo-serp-desc">
              {previewDesc}
            </p>
          </div>
        </div>

        {/* ── Từ khóa tìm kiếm & SEO ── */}
        <div className="sp-movie-form__field-group">
          <label className="sp-movie-form__label">Từ khóa tìm kiếm & SEO (Tags)</label>
          <Controller
            name="seo_keywords"
            control={control}
            render={({ field }) => (
              <TagInput
                tags={field.value || []}
                onChange={field.onChange}
                placeholder={isReadOnly ? '' : "Nhập từ khóa và nhấn Enter..."}
                disabled={isReadOnly}
              />
            )}
          />
        </div>

        {/* ── Meta Title ── */}
        <Controller
          name="meta_title"
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              label="Meta Title (Tiêu đề tìm kiếm Google)"
              placeholder={`VD: ${title ? `${title} - ` : ''}Xem Phim Full HD Vietsub`}
              maxLength={70}
              error={Boolean(errors.meta_title)}
              helperText={errors.meta_title?.message || "Độ dài lý tưởng: 50 - 60 ký tự. Sẽ tự động lấy tên phim nếu để trống."}
              disabled={isReadOnly}
            />
          )}
        />

        {/* ── Meta Description ── */}
        <Controller
          name="meta_description"
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              label="Meta Description (Mô tả tìm kiếm Google)"
              multiline
              rows={3}
              placeholder="VD: Xem phim chất lượng cao 4K vietsub thuyết minh nhanh nhất tại Sạp Phim..."
              maxLength={160}
              error={Boolean(errors.meta_description)}
              helperText={errors.meta_description?.message || "Độ dài lý tưởng: 120 - 155 ký tự. Sẽ tự động lấy mô tả phim nếu để trống."}
              disabled={isReadOnly}
            />
          )}
        />
      </div>
    </SectionCard>
  );
};

SeoSection.propTypes = {
  isReadOnly: PropTypes.bool,
};

export default memo(SeoSection);
