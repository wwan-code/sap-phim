/**
 * @file BasicSection.jsx
 * @module Admin/Modules/Movies/Components/FormSections
 * @description Section 1: Tiêu đề đa ngôn ngữ, Slug SEO, Định dạng, Trạng thái, Trạng thái xuất bản, VIP và Tóm tắt.
 */

import React, { memo } from 'react';
import PropTypes from 'prop-types';
import { Controller, useFormContext } from 'react-hook-form';
import { Film, Globe, Crown } from 'lucide-react';

import { SectionCard } from '@/admin/shared/components/layout/section-card/SectionCard';
import TextField from '@/shared/components/ui/text-field/TextField';
import Select from '@/shared/components/ui/select/Select';
import Switch from '@/shared/components/ui/switch/Switch';

import TitleRow from '../title-row';
import { slugify } from '@/admin/shared/utils/slug.util';

const TYPE_OPTIONS = [
  { value: 'series', label: 'Phim bộ (Series / TV Anime)' },
  { value: 'movie', label: 'Phim lẻ (Movie / Theatrical)' },
  { value: 'ova', label: 'OVA (Original Video Anime)' },
  { value: 'ona', label: 'ONA (Original Net Anime)' },
  { value: 'tv', label: 'TV Series / Chương trình TV' },
  { value: 'special', label: 'Special / Ngoại truyện' },
];

const STATUS_OPTIONS = [
  { value: 'ongoing', label: 'Đang phát sóng (Ongoing)' },
  { value: 'completed', label: 'Hoàn thành (Completed)' },
  { value: 'upcoming', label: 'Sắp ra mắt (Upcoming)' },
  { value: 'hiatus', label: 'Tạm ngưng (On Hiatus)' },
  { value: 'cancelled', label: 'Đã hủy (Cancelled)' },
];

const BasicSection = ({ slugManuallyEdited, isReadOnly }) => {
  const { control, formState: { errors }, setValue, watch } = useFormContext();
  const currentTitle = watch('title') || watch('titles.0.title');

  const handleTitleBlur = (val) => {
    if (val) {
      setValue('title', val, { shouldValidate: true, shouldDirty: true });
      if (!slugManuallyEdited.current) {
        const generatedSlug = slugify(val);
        setValue('slug', generatedSlug, { shouldValidate: true, shouldDirty: true });
      }
    }
  };

  return (
    <SectionCard title="1. Tiêu Đề & Thông Tin Cơ Bản" icon={Film}>
      <div className="sp-movie-form__section-content">
        {/* Tiêu đề đa ngôn ngữ */}
        <TitleRow
          onTitleBlur={handleTitleBlur}
          disabled={isReadOnly}
        />

        <div className="sp-movie-form__row sp-movie-form__row--2-cols">
          <Controller
            name="slug"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="Đường dẫn SEO (Slug URL)"
                placeholder="VD: solo-leveling-arise"
                error={Boolean(errors.slug)}
                helperText={errors.slug?.message || 'Tự động tạo từ tiêu đề chính nếu để trống.'}
                disabled={isReadOnly}
                onChange={(e) => {
                  field.onChange(e);
                  const val = e.target.value;
                  if (!val || !val.trim()) {
                    slugManuallyEdited.current = false;
                    if (currentTitle) {
                      const gen = slugify(currentTitle);
                      setValue('slug', gen, { shouldValidate: false, shouldDirty: true });
                    }
                  } else {
                    slugManuallyEdited.current = true;
                  }
                }}
              />
            )}
          />

          <Controller
            name="type"
            control={control}
            render={({ field }) => (
              <Select
                label="Định dạng phim"
                required
                value={field.value}
                onChange={field.onChange}
                options={TYPE_OPTIONS}
                error={Boolean(errors.type)}
                helperText={errors.type?.message}
                disabled={isReadOnly}
              />
            )}
          />
        </div>

        <div className="sp-movie-form__row sp-movie-form__row--2-cols">
          <Controller
            name="status"
            control={control}
            render={({ field }) => (
              <Select
                label="Trạng thái"
                required
                value={field.value}
                onChange={field.onChange}
                options={STATUS_OPTIONS}
                error={Boolean(errors.status)}
                helperText={errors.status?.message}
                disabled={isReadOnly}
              />
            )}
          />

          <div className="sp-movie-form__switches-card">
            <div className="sp-movie-form__switch-item-box">
              <div className="sp-movie-form__switch-item-info">
                <Globe size={18} className="sp-movie-form__switch-icon" />
                <div className="sp-movie-form__switch-item-text">
                  <span className="sp-movie-form__switch-item-title">Xuất bản</span>
                  <span className="sp-movie-form__switch-item-desc">Công khai phim</span>
                </div>
              </div>
              <Controller
                name="is_published"
                control={control}
                render={({ field }) => (
                  <Switch
                    checked={field.value}
                    onChange={(e) => field.onChange(e.target.checked)}
                    disabled={isReadOnly}
                    aria-label="Xuất bản (Hiển thị public)"
                  />
                )}
              />
            </div>

            <div className="sp-movie-form__switch-divider" />

            <div className="sp-movie-form__switch-item-box">
              <div className="sp-movie-form__switch-item-info">
                <Crown size={18} className="sp-movie-form__switch-icon sp-movie-form__switch-icon--vip" />
                <div className="sp-movie-form__switch-item-text">
                  <span className="sp-movie-form__switch-item-title">Phim VIP</span>
                  <span className="sp-movie-form__switch-item-desc">Yêu cầu trả phí</span>
                </div>
              </div>
              <Controller
                name="is_premium"
                control={control}
                render={({ field }) => (
                  <Switch
                    checked={field.value}
                    onChange={(e) => field.onChange(e.target.checked)}
                    disabled={isReadOnly}
                    aria-label="Phim VIP (Trả phí)"
                  />
                )}
              />
            </div>
          </div>
        </div>

        <Controller
          name="description"
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              label="Mô tả tóm tắt nội dung tác phẩm"
              multiline
              rows={4}
              placeholder="Nhập tóm tắt cốt truyện, thông điệp và nội dung chính của tác phẩm..."
              error={Boolean(errors.description)}
              helperText={errors.description?.message}
              disabled={isReadOnly}
            />
          )}
        />
      </div>
    </SectionCard>
  );
};

BasicSection.propTypes = {
  slugManuallyEdited: PropTypes.object.isRequired,
  isReadOnly: PropTypes.bool,
};

export default memo(BasicSection);
