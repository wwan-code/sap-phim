/**
 * @file RelationsSection.jsx
 * @module Admin/Modules/Movies/Components/FormSections
 * @description Section 2: Danh mục chính, Quốc gia, Studio, Series cha và Thể loại tags.
 */

import React, { memo } from 'react';
import PropTypes from 'prop-types';
import { Controller, useFormContext } from 'react-hook-form';

import { SectionCard } from '@/admin/shared/components/layout/section-card/SectionCard';
import Select from '@/shared/components/ui/select/Select';

const RelationsSection = ({ metadata, isReadOnly }) => {
  const { control, watch, setValue } = useFormContext();
  const currentGenres = watch('genre_ids') || [];

  const handleToggleGenre = (genreId) => {
    if (isReadOnly) return;
    const next = currentGenres.includes(genreId)
      ? currentGenres.filter((id) => id !== genreId)
      : [...currentGenres, genreId];
    setValue('genre_ids', next, { shouldValidate: true, shouldDirty: true });
  };

  return (
    <SectionCard title="2. Phân Loại & Quan Hệ">
      <div className="sp-movie-form__section-content">
        <div className="sp-movie-form__row sp-movie-form__row--2-cols">
          <Controller
            name="category_id"
            control={control}
            render={({ field }) => (
              <Select
                label="Danh mục phát hành"
                value={field.value || ''}
                onChange={field.onChange}
                options={[
                  { value: '', label: 'Chưa chọn danh mục' },
                  ...(metadata?.categories || []).map((c) => ({
                    value: c.id,
                    label: c.name,
                  })),
                ]}
                disabled={isReadOnly}
              />
            )}
          />

          <Controller
            name="country_id"
            control={control}
            render={({ field }) => (
              <Select
                label="Quốc gia sản xuất"
                value={field.value || ''}
                onChange={field.onChange}
                options={[
                  { value: '', label: 'Chưa chọn quốc gia' },
                  ...(metadata?.countries || []).map((c) => ({
                    value: c.id,
                    label: c.name,
                  })),
                ]}
                disabled={isReadOnly}
              />
            )}
          />
        </div>

        <div className="sp-movie-form__row sp-movie-form__row--2-cols">
          <Controller
            name="studio_id"
            control={control}
            render={({ field }) => (
              <Select
                label="Studio sản xuất / Animation"
                value={field.value || ''}
                onChange={field.onChange}
                options={[
                  { value: '', label: 'Chưa chọn studio' },
                  ...(metadata?.studios || []).map((s) => ({
                    value: s.id,
                    label: s.name,
                  })),
                ]}
                disabled={isReadOnly}
              />
            )}
          />

          <Controller
            name="series_id"
            control={control}
            render={({ field }) => (
              <Select
                label="Series liên kết (Phần trước/sau)"
                value={field.value || ''}
                onChange={field.onChange}
                options={[
                  { value: '', label: 'Không thuộc series nào' },
                  ...(metadata?.series || []).map((s) => ({
                    value: s.id,
                    label: s.name,
                  })),
                ]}
                disabled={isReadOnly}
              />
            )}
          />
        </div>

        <div className="sp-movie-form__field-group">
          <label className="sp-movie-form__label">Chọn thể loại phim (Genres)</label>
          <div className="sp-movie-form__genres-grid">
            {(metadata?.genres || []).map((genre) => {
              const isSelected = currentGenres.includes(genre.id);
              return (
                <button
                  key={genre.id}
                  type="button"
                  className={`sp-movie-form__genre-chip ${
                    isSelected ? 'sp-movie-form__genre-chip--selected' : ''
                  }`}
                  onClick={() => handleToggleGenre(genre.id)}
                  disabled={isReadOnly}
                >
                  {genre.name}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </SectionCard>
  );
};

RelationsSection.propTypes = {
  metadata: PropTypes.object,
  isReadOnly: PropTypes.bool,
};

export default memo(RelationsSection);
