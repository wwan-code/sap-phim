/**
 * @file MetadataSection.jsx
 * @module Admin/Modules/Movies/Components/FormSections
 * @description Section 5: Metadata & Phát sóng (Ngày chiếu, Năm, Mùa, Phần, Chất lượng, Sub/Dub, Nguồn gốc, Số tập, Thời lượng, Giới hạn tuổi, Đạo diễn, IMDb/TMDB/MAL/AniList ID).
 */

import React, { memo } from 'react';
import PropTypes from 'prop-types';
import { Controller, useFormContext } from 'react-hook-form';

import { SectionCard } from '@/admin/shared/components/layout/section-card/SectionCard';
import TextField from '@/shared/components/ui/text-field/TextField';
import Select from '@/shared/components/ui/select/Select';

const SEASON_OPTIONS = [
  { value: '', label: 'Chưa chọn mùa' },
  { value: 'spring', label: 'Mùa Xuân (Spring)' },
  { value: 'summer', label: 'Mùa Hạ (Summer)' },
  { value: 'fall', label: 'Mùa Thu (Fall)' },
  { value: 'winter', label: 'Mùa Đông (Winter)' },
];

const QUALITY_OPTIONS = [
  { value: 'FHD', label: 'FHD (1080p)' },
  { value: 'HD', label: 'HD (720p)' },
  { value: '2K', label: '2K (1440p)' },
  { value: '4K', label: '4K Ultra HD (2160p)' },
  { value: 'HDR', label: 'HDR / Dolby Vision' },
  { value: 'CAM', label: 'Bản quay rạp (CAM)' },
];

const SUB_DUB_OPTIONS = [
  { value: 'sub', label: 'Phụ đề (Vietsub)' },
  { value: 'dub', label: 'Lồng tiếng / Thuyết minh' },
  { value: 'both', label: 'Đa ngôn ngữ (Cả Sub & Dub)' },
  { value: 'raw', label: 'Bản gốc chưa dịch (Raw)' },
];

const SOURCE_TYPE_OPTIONS = [
  { value: '', label: 'Chưa chọn nguồn gốc' },
  { value: 'manga', label: 'Chuyển thể Manga' },
  { value: 'light_novel', label: 'Chuyển thể Light Novel' },
  { value: 'original', label: 'Kịch bản gốc (Original)' },
  { value: 'game', label: 'Chuyển thể Game' },
  { value: 'visual_novel', label: 'Visual Novel' },
  { value: 'novel', label: 'Tiểu thuyết (Novel)' },
  { value: 'other', label: 'Nguồn khác' },
];

const AGE_RATING_OPTIONS = [
  { value: 'G', label: 'G - Mọi lứa tuổi (All)' },
  { value: 'PG', label: 'PG - Khuyến cáo có phụ huynh' },
  { value: 'PG-13', label: 'PG-13 - Khuyên dùng trên 13 tuổi' },
  { value: '13+', label: '13+ - Phù hợp từ 13 tuổi trở lên' },
  { value: '16+', label: '16+ - Phù hợp từ 16 tuổi trở lên' },
  { value: '18+', label: '18+ - Dành riêng cho người lớn (18+)' },
  { value: 'P', label: 'P - Phổ biến rộng rãi' },
  { value: 'R', label: 'R - Hạn chế khán giả dưới 17 tuổi' },
  { value: 'R+', label: 'R+ - Hạn chế độ tuổi nghiêm ngặt' },
];

const MetadataSection = ({ isReadOnly }) => {
  const { control, formState: { errors } } = useFormContext();

  return (
    <SectionCard title="5. Metadata & Thông Số Phát Hành">
      <div className="sp-movie-form__section-content">
        
        {/* Hàng 1: Thời gian phát hành & Mùa chiếu */}
        <div className="sp-movie-form__row sp-movie-form__row--4-cols">
          <Controller
            name="release_date"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="Ngày khởi chiếu"
                type="date"
                error={Boolean(errors.release_date)}
                helperText={errors.release_date?.message}
                disabled={isReadOnly}
              />
            )}
          />

          <Controller
            name="release_year"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="Năm phát hành"
                type="number"
                placeholder="VD: 2024"
                error={Boolean(errors.release_year)}
                helperText={errors.release_year?.message || 'Tự động tính từ ngày chiếu'}
                disabled={isReadOnly}
              />
            )}
          />

          <Controller
            name="season"
            control={control}
            render={({ field }) => (
              <Select
                label="Mùa phát sóng"
                value={field.value || ''}
                onChange={field.onChange}
                options={SEASON_OPTIONS}
                disabled={isReadOnly}
              />
            )}
          />
          
          <Controller
            name="season_number"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="Phần (Season)"
                type="number"
                placeholder="VD: 1"
                error={Boolean(errors.season_number)}
                helperText={errors.season_number?.message || 'Để trống nếu là phim lẻ'}
                disabled={isReadOnly}
              />
            )}
          />
        </div>

        {/* Hàng 2: Chuẩn phát sóng & Định dạng streaming */}
        <div className="sp-movie-form__row sp-movie-form__row--3-cols">
          <Controller
            name="quality"
            control={control}
            render={({ field }) => (
              <Select
                label="Chất lượng hình ảnh"
                value={field.value || 'FHD'}
                onChange={field.onChange}
                options={QUALITY_OPTIONS}
                error={Boolean(errors.quality)}
                helperText={errors.quality?.message}
                disabled={isReadOnly}
              />
            )}
          />

          <Controller
            name="sub_dub_type"
            control={control}
            render={({ field }) => (
              <Select
                label="Bản dịch / Ngôn ngữ"
                value={field.value || 'sub'}
                onChange={field.onChange}
                options={SUB_DUB_OPTIONS}
                error={Boolean(errors.sub_dub_type)}
                helperText={errors.sub_dub_type?.message}
                disabled={isReadOnly}
              />
            )}
          />

          <Controller
            name="source_type"
            control={control}
            render={({ field }) => (
              <Select
                label="Nguồn gốc chuyển thể"
                value={field.value || ''}
                onChange={field.onChange}
                options={SOURCE_TYPE_OPTIONS}
                error={Boolean(errors.source_type)}
                helperText={errors.source_type?.message}
                disabled={isReadOnly}
              />
            )}
          />
        </div>

        {/* Hàng 3: Thời lượng, Số tập, Giới hạn tuổi & Đạo diễn */}
        <div className="sp-movie-form__row sp-movie-form__row--4-cols">
          <Controller
            name="total_episodes"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="Tổng số tập"
                type="number"
                placeholder="VD: 12"
                error={Boolean(errors.total_episodes)}
                helperText={errors.total_episodes?.message}
                disabled={isReadOnly}
              />
            )}
          />

          <Controller
            name="duration"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="Thời lượng (Phút)"
                type="number"
                placeholder="VD: 24"
                error={Boolean(errors.duration)}
                helperText={errors.duration?.message}
                disabled={isReadOnly}
              />
            )}
          />

          <Controller
            name="age_rating"
            control={control}
            render={({ field }) => (
              <Select
                label="Giới hạn độ tuổi"
                value={field.value || 'PG-13'}
                onChange={field.onChange}
                options={AGE_RATING_OPTIONS}
                disabled={isReadOnly}
              />
            )}
          />

          <Controller
            name="director"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="Đạo diễn chính"
                placeholder="VD: Shunsuke Nakashige"
                error={Boolean(errors.director)}
                helperText={errors.director?.message}
                disabled={isReadOnly}
              />
            )}
          />
        </div>

        {/* Hàng 4: Liên kết cơ sở dữ liệu điện ảnh & Anime */}
        <div className="sp-movie-form__row sp-movie-form__row--4-cols">
          <Controller
            name="imdb_id"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="IMDb ID"
                placeholder="VD: tt1234567"
                error={Boolean(errors.imdb_id)}
                helperText={errors.imdb_id?.message}
                disabled={isReadOnly}
              />
            )}
          />
          
          <Controller
            name="imdb_rating"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="Điểm IMDb"
                type="number"
                step="0.1"
                min="0"
                max="10"
                placeholder="VD: 8.5"
                error={Boolean(errors.imdb_rating)}
                helperText={errors.imdb_rating?.message}
                disabled={isReadOnly}
              />
            )}
          />

          <Controller
            name="tmdb_id"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="TMDB ID"
                type="number"
                placeholder="VD: 12345"
                error={Boolean(errors.tmdb_id)}
                helperText={errors.tmdb_id?.message}
                disabled={isReadOnly}
              />
            )}
          />

          <Controller
            name="mal_id"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="MyAnimeList ID"
                type="number"
                placeholder="VD: 5114"
                error={Boolean(errors.mal_id)}
                helperText={errors.mal_id?.message}
                disabled={isReadOnly}
              />
            )}
          />
        </div>

        {/* Hàng 5: AniList ID */}
        <div className="sp-movie-form__row sp-movie-form__row--2-cols">
          <Controller
            name="anilist_id"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="AniList ID"
                type="number"
                placeholder="VD: 142838"
                error={Boolean(errors.anilist_id)}
                helperText={errors.anilist_id?.message || 'Mã định danh tác phẩm trên AniList'}
                disabled={isReadOnly}
              />
            )}
          />
        </div>
      </div>
    </SectionCard>
  );
};

MetadataSection.propTypes = {
  isReadOnly: PropTypes.bool,
};

export default memo(MetadataSection);
