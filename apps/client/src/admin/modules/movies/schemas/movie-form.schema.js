/**
 * @file movie-form.schema.js
 * @module Admin/Modules/Movies/Schemas
 * @description Yup validation schema và default values cho thực thể Phim & Anime (Movie Form).
 */

import * as yup from 'yup';

export const movieTitleItemSchema = yup.object().shape({
  type: yup
    .string()
    .trim()
    .default('default'),
  title: yup
    .string()
    .trim()
    .max(500, 'Tên tác phẩm không được vượt quá 500 ký tự')
    .nullable()
    .transform((curr, orig) => (orig === '' ? null : curr)),
});

export const movieCastItemSchema = yup.object().shape({
  actor_id: yup.string().nullable().optional(),
  actor_name: yup.string().trim().required('Tên diễn viên không được để trống'),
  actor_image_url: yup.string().nullable().optional(),
  character_name: yup.string().trim().nullable().optional(),
  role_name: yup.string().trim().nullable().optional().default('Lồng tiếng'),
  is_main_cast: yup.boolean().default(false),
  cast_order: yup.number().integer().default(0),
  notes: yup.string().nullable().optional(),
});

export const movieSchema = yup.object().shape({
  // Basic Section
  title: yup.string().trim().nullable(),
  titles: yup
    .array()
    .of(movieTitleItemSchema)
    .min(1, 'Cần ít nhất 1 tiêu đề cho tác phẩm')
    .test(
      'has-valid-title',
      'Tiêu đề chính không được để trống',
      (titles) => Array.isArray(titles) && titles.some((t) => Boolean(t?.title?.trim()))
    )
    .default([
      { type: 'default', title: '' },
      { type: 'romaji', title: '' },
    ]),
  slug: yup
    .string()
    .trim()
    .max(255, 'Slug không được vượt quá 255 ký tự')
    .nullable()
    .transform((curr, orig) => (orig === '' ? null : curr)),
  type: yup
    .string()
    .oneOf(['movie', 'series', 'special', 'ova', 'ona', 'tv'], 'Định dạng phim không hợp lệ')
    .default('series')
    .required('Vui lòng chọn định dạng phim'),
  status: yup
    .string()
    .oneOf(['ongoing', 'completed', 'upcoming', 'cancelled', 'hiatus'], 'Trạng thái không hợp lệ')
    .default('ongoing')
    .required('Vui lòng chọn trạng thái'),
  is_published: yup.boolean().default(false),
  is_premium: yup.boolean().default(false),
  description: yup
    .string()
    .trim()
    .nullable()
    .transform((curr, orig) => (orig === '' ? null : curr)),

  // Relations Section
  category_id: yup
    .string()
    .nullable()
    .transform((curr, orig) => (orig === '' ? null : curr)),
  country_id: yup
    .string()
    .nullable()
    .transform((curr, orig) => (orig === '' ? null : curr)),
  studio_id: yup
    .string()
    .nullable()
    .transform((curr, orig) => (orig === '' ? null : curr)),
  series_id: yup
    .string()
    .nullable()
    .transform((curr, orig) => (orig === '' ? null : curr)),
  genre_ids: yup
    .array()
    .of(yup.string())
    .default([]),

  // Cast Section
  actor_cast: yup
    .array()
    .of(movieCastItemSchema)
    .default([]),

  // Metadata Section
  release_date: yup
    .string()
    .nullable()
    .transform((curr, orig) => (orig === '' ? null : curr)),
  release_year: yup
    .number()
    .typeError('Năm phát hành phải là số')
    .integer('Năm phát hành phải là số nguyên')
    .min(1900, 'Năm phát hành không hợp lệ')
    .max(2100, 'Năm phát hành không hợp lệ')
    .nullable()
    .optional()
    .transform((curr, orig) => (orig === '' || orig === null || orig === undefined ? null : curr)),
  quality: yup
    .string()
    .oneOf(['HD', 'FHD', '2K', '4K', 'HDR', 'CAM'], 'Chất lượng không hợp lệ')
    .default('FHD'),
  sub_dub_type: yup
    .string()
    .oneOf(['sub', 'dub', 'both', 'raw'], 'Ngôn ngữ không hợp lệ')
    .default('sub'),
  source_type: yup
    .string()
    .oneOf(['manga', 'light_novel', 'original', 'game', 'visual_novel', 'novel', 'other', ''], 'Nguồn chuyển thể không hợp lệ')
    .nullable()
    .optional()
    .transform((curr, orig) => (orig === '' ? null : curr)),
  duration: yup
    .number()
    .typeError('Thời lượng phải là số phút')
    .integer('Thời lượng phải là số nguyên')
    .min(0, 'Thời lượng không được âm')
    .nullable()
    .transform((curr, orig) => (orig === '' ? null : curr)),
  total_episodes: yup
    .number()
    .typeError('Tổng số tập phải là số')
    .integer('Tổng số tập phải là số nguyên')
    .min(0, 'Tổng số tập không được âm')
    .default(0)
    .nullable()
    .transform((curr, orig) => (orig === '' || orig === null || orig === undefined || isNaN(curr) ? 0 : curr)),
  season: yup
    .string()
    .oneOf(['spring', 'summer', 'fall', 'winter'], 'Mùa không hợp lệ')
    .nullable()
    .transform((curr, orig) => (orig === '' ? null : curr)),
  season_number: yup
    .number()
    .typeError('Phần/mùa phải là số')
    .integer('Phần/mùa phải là số nguyên')
    .min(1, 'Phần/mùa tối thiểu là 1')
    .nullable()
    .optional()
    .transform((curr, orig) => (orig === '' || orig === null || orig === undefined ? null : curr)),
  age_rating: yup
    .string()
    .oneOf(['G', 'PG', 'PG-13', 'R', 'R+', '13+', '16+', '18+', 'P'], 'Giới hạn độ tuổi không hợp lệ')
    .default('PG-13'),
  director: yup
    .string()
    .trim()
    .max(255, 'Tên đạo diễn không được vượt quá 255 ký tự')
    .nullable()
    .transform((curr, orig) => (orig === '' ? null : curr)),
  director_metadata: yup
    .object()
    .nullable()
    .optional()
    .default({}),
  trailer_url: yup
    .string()
    .trim()
    .nullable()
    .transform((curr, orig) => (orig === '' ? null : curr)),
  imdb_id: yup
    .string()
    .trim()
    .nullable()
    .transform((curr, orig) => (orig === '' ? null : curr)),
  tmdb_id: yup
    .number()
    .typeError('TMDB ID phải là số')
    .integer('TMDB ID phải là số nguyên')
    .min(1, 'TMDB ID không hợp lệ')
    .nullable()
    .transform((curr, orig) => (orig === '' ? null : curr)),
  mal_id: yup
    .number()
    .typeError('MAL ID phải là số')
    .integer('MAL ID phải là số nguyên')
    .min(1, 'MAL ID không hợp lệ')
    .nullable()
    .transform((curr, orig) => (orig === '' ? null : curr)),
  anilist_id: yup
    .number()
    .typeError('AniList ID phải là số')
    .integer('AniList ID phải là số nguyên')
    .min(1, 'AniList ID không hợp lệ')
    .nullable()
    .optional()
    .transform((curr, orig) => (orig === '' || orig === null || orig === undefined ? null : curr)),
  imdb_rating: yup
    .number()
    .typeError('Điểm IMDb phải là số')
    .min(0, 'Điểm IMDb không được nhỏ hơn 0')
    .max(10, 'Điểm IMDb không được lớn hơn 10')
    .nullable()
    .transform((curr, orig) => (orig === '' ? null : curr)),

  // SEO Section
  seo_keywords: yup
    .array()
    .of(yup.string().trim())
    .default([]),
  meta_title: yup
    .string()
    .trim()
    .max(255, 'Meta title không được vượt quá 255 ký tự')
    .nullable()
    .transform((curr, orig) => (orig === '' ? null : curr)),
  meta_description: yup
    .string()
    .trim()
    .max(500, 'Meta description không được vượt quá 500 ký tự')
    .nullable()
    .transform((curr, orig) => (orig === '' ? null : curr)),
});

export const movieDefaultValues = {
  title: '',
  original_title: '',
  titles: [
    { type: 'default', title: '' },
    { type: 'romaji', title: '' },
  ],
  slug: '',
  type: 'series',
  status: 'ongoing',
  is_published: false,
  is_premium: false,
  description: '',
  category_id: '',
  country_id: '',
  studio_id: '',
  series_id: '',
  genre_ids: [],
  actor_cast: [],
  release_date: '',
  release_year: '',
  quality: 'FHD',
  sub_dub_type: 'sub',
  source_type: '',
  duration: '',
  total_episodes: 0,
  season: '',
  season_number: '',
  age_rating: 'PG-13',
  director: '',
  director_metadata: {},
  trailer_url: '',
  imdb_id: '',
  tmdb_id: '',
  mal_id: '',
  anilist_id: '',
  imdb_rating: '',
  seo_keywords: [],
  meta_title: '',
  meta_description: '',
};

export default {
  movieSchema,
  movieCastItemSchema,
  movieDefaultValues,
};
