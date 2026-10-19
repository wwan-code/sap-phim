/**
 * @file movie.model.js
 * @module Model_Movie
 * @description Model Sequelize cho bảng movies cấp Production-ready: tối ưu toàn diện các trường hiện tại, B-Tree + Composite + GIN Indexes, Streaming Metadata, Engagement Counters và Virtual Getters.
 */

import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.config.js';

const Movie = sequelize.define(
  'Movie',
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    titles: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
      comment: 'Mảng tiêu đề: [{"type": "default", "title": "..."}]',
    },
    slug: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
      comment: 'Đường dẫn SEO duy nhất',
    },
    series_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'series',
        key: 'id',
      },
      comment: 'Liên kết đến bộ phim (series)',
    },
    country_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'countries',
        key: 'id',
      },
      comment: 'Quốc gia sản xuất chính',
    },
    category_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'categories',
        key: 'id',
      },
      comment: 'Danh mục phân loại chính',
    },
    studio_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'studios',
        key: 'id',
      },
      comment: 'Studio sản xuất chính',
    },
    type: {
      type: DataTypes.STRING(30),
      defaultValue: 'series',
      allowNull: false,
      validate: {
        isIn: [['movie', 'series', 'special', 'ova', 'ona', 'tv']],
      },
      comment: 'Loại hình: movie, series, special, ova, ona, tv',
    },
    status: {
      type: DataTypes.STRING(30),
      defaultValue: 'ongoing',
      allowNull: false,
      validate: {
        isIn: [['ongoing', 'completed', 'upcoming', 'cancelled', 'hiatus']],
      },
      comment: 'Trạng thái: ongoing, completed, upcoming, cancelled, hiatus',
    },
    is_published: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
      comment: 'Trạng thái xuất bản',
    },
    is_premium: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
      comment: 'Phim yêu cầu gói VIP',
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Mô tả nội dung tóm tắt',
    },
    images: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: { poster: null, banner: null, cover: null, logo: null },
      comment: 'Các loại ảnh: poster, banner, cover, logo',
    },
    trailer_url: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Đường dẫn trailer',
    },
    release_date: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      comment: 'Ngày công chiếu',
    },
    release_year: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: {
        min: 1900,
        max: 2100,
      },
      comment: 'Năm phát hành chính thức (phục vụ lọc nhanh)',
    },
    duration: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: {
        min: 0,
      },
      comment: 'Thời lượng (phút)',
    },
    quality: {
      type: DataTypes.STRING(20),
      defaultValue: 'FHD',
      allowNull: false,
      validate: {
        isIn: [['HD', 'FHD', '2K', '4K', 'HDR', 'CAM']],
      },
      comment: 'Chất lượng hình ảnh cao nhất: HD, FHD, 2K, 4K, HDR, CAM',
    },
    sub_dub_type: {
      type: DataTypes.STRING(20),
      defaultValue: 'sub',
      allowNull: false,
      validate: {
        isIn: [['sub', 'dub', 'both', 'raw']],
      },
      comment: 'Định dạng ngôn ngữ: sub (Vietsub), dub (Thuyết minh/Lồng tiếng), both, raw',
    },
    source_type: {
      type: DataTypes.STRING(30),
      allowNull: true,
      validate: {
        isIn: [['manga', 'light_novel', 'original', 'game', 'visual_novel', 'novel', 'other']],
      },
      comment: 'Nguồn gốc chuyển thể: manga, light_novel, original, game, visual_novel...',
    },
    imdb_id: {
      type: DataTypes.STRING(20),
      allowNull: true,
      comment: 'ID trên IMDb',
    },
    tmdb_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'ID trên TMDB',
    },
    mal_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'ID trên MyAnimeList',
    },
    anilist_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'ID trên AniList',
    },
    imdb_rating: {
      type: DataTypes.DECIMAL(3, 1),
      allowNull: true,
      validate: {
        min: 0,
        max: 10,
      },
      comment: 'Điểm đánh giá trên IMDb (thang 10)',
    },
    age_rating: {
      type: DataTypes.STRING(10),
      defaultValue: 'PG-13',
      allowNull: false,
      validate: {
        isIn: [['G', 'PG', 'PG-13', 'R', 'R+', '13+', '16+', '18+', 'P']],
      },
      comment: 'Xếp hạng độ tuổi xem',
    },
    director: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: 'Đạo diễn',
    },
    season: {
      type: DataTypes.STRING(20),
      allowNull: true,
      validate: {
        isIn: [['spring', 'summer', 'fall', 'winter']],
      },
      comment: 'Mùa phát sóng: spring, summer, fall, winter',
    },
    season_number: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: null,
      validate: {
        min: 1,
      },
      comment: 'Mùa/Phần thứ bao nhiêu (null nếu là phim lẻ/không chia phần)',
    },
    total_episodes: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false,
      validate: {
        min: 0,
      },
      comment: 'Tổng số tập dự kiến',
    },
    total_views: {
      type: DataTypes.BIGINT,
      defaultValue: 0,
      allowNull: false,
      validate: {
        min: 0,
      },
      comment: 'Tổng số lượt xem mọi thời đại',
    },
    daily_views: {
      type: DataTypes.BIGINT,
      defaultValue: 0,
      allowNull: false,
      validate: {
        min: 0,
      },
      comment: 'Lượt xem trong ngày hôm nay',
    },
    weekly_views: {
      type: DataTypes.BIGINT,
      defaultValue: 0,
      allowNull: false,
      validate: {
        min: 0,
      },
      comment: 'Lượt xem trong tuần này',
    },
    monthly_views: {
      type: DataTypes.BIGINT,
      defaultValue: 0,
      allowNull: false,
      validate: {
        min: 0,
      },
      comment: 'Lượt xem trong tháng này',
    },
    favorite_count: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false,
      validate: {
        min: 0,
      },
      comment: 'Số người dùng đánh dấu yêu thích / watchlist',
    },
    comment_count: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false,
      validate: {
        min: 0,
      },
      comment: 'Tổng số bình luận',
    },
    trending_score: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0.0,
      allowNull: false,
      validate: {
        min: 0,
      },
      comment: 'Điểm xu hướng tổng hợp để xếp hạng trending',
    },
    rating_average: {
      type: DataTypes.DECIMAL(4, 2),
      defaultValue: 0.0,
      allowNull: false,
      validate: {
        min: 0,
        max: 10,
      },
      comment: 'Điểm đánh giá trung bình (0.00 - 10.00)',
    },
    rating_count: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false,
      validate: {
        min: 0,
      },
      comment: 'Tổng số lượt đánh giá từ người dùng',
    },
    tags: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: [],
      comment: 'Tags phân loại bổ sung',
    },
    marketing_content: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {
        story_summary: '',
        marketing_points: [],
      },
      comment: 'Nội dung marketing và tóm tắt kịch bản',
    },
    seo_keywords: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: [],
      comment: '@deprecated - Sử dụng meta_keywords và tags thay thế',
    },
    meta_title: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: 'Tiêu đề SEO',
    },
    meta_description: {
      type: DataTypes.STRING(500),
      allowNull: true,
      comment: 'Mô tả SEO',
    },
    meta_keywords: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: true,
      comment: 'Từ khóa SEO (mảng string)',
    },
    created_by: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id',
      },
      comment: 'ID Quản trị viên tạo bản ghi',
    },
    updated_by: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id',
      },
      comment: 'ID Quản trị viên cập nhật sau cùng',
    },
    search_vector: {
      type: DataTypes.TSVECTOR,
      allowNull: true,
      comment: 'PostgreSQL TSVECTOR phục vụ Full-Text Search',
    },

    // ──────────────────────────────────────────
    // VIRTUAL GETTERS (Tối ưu hóa hiển thị nhanh)
    // ──────────────────────────────────────────
    primary_title: {
      type: DataTypes.VIRTUAL,
      get() {
        const titles = this.getDataValue('titles');
        if (!Array.isArray(titles) || titles.length === 0) return '';
        const defaultTitle = titles.find((t) => t?.type === 'default' || t?.is_default);
        return defaultTitle?.title || titles[0]?.title || '';
      },
    },
    poster_url: {
      type: DataTypes.VIRTUAL,
      get() {
        const images = this.getDataValue('images');
        if (!images?.poster) return null;
        return typeof images.poster === 'string' ? images.poster : images.poster?.url || null;
      },
    },
    banner_url: {
      type: DataTypes.VIRTUAL,
      get() {
        const images = this.getDataValue('images');
        const target = images?.banner || images?.backdrop || images?.cover;
        if (!target) return null;
        return typeof target === 'string' ? target : target?.url || null;
      },
    },
  },
  {
    tableName: 'movies',
    timestamps: true,
    paranoid: true,
    underscored: true,
    freezeTableName: true,
    indexes: [
      { fields: ['slug'], unique: true, name: 'idx_movies_slug' },
      { fields: ['category_id'], name: 'idx_movies_category_id' },
      { fields: ['country_id'], name: 'idx_movies_country_id' },
      { fields: ['studio_id'], name: 'idx_movies_studio_id' },
      { fields: ['series_id'], name: 'idx_movies_series_id' },
      { fields: ['status'], name: 'idx_movies_status' },
      { fields: ['type'], name: 'idx_movies_type' },
      { fields: ['is_published'], name: 'idx_movies_is_published' },
      { fields: ['is_premium'], name: 'idx_movies_is_premium' },
      { fields: ['release_year'], name: 'idx_movies_release_year' },
      { fields: ['season'], name: 'idx_movies_season' },
      { fields: ['quality'], name: 'idx_movies_quality' },
      { fields: ['sub_dub_type'], name: 'idx_movies_sub_dub_type' },
      { fields: ['deleted_at'], name: 'idx_movies_deleted_at' },
      // Composite Indexes for Ranking / Feeds / Queries
      {
        name: 'idx_movies_published_trending',
        fields: ['is_published', { attribute: 'trending_score', order: 'DESC' }],
      },
      {
        name: 'idx_movies_published_daily_views',
        fields: ['is_published', { attribute: 'daily_views', order: 'DESC' }],
      },
      {
        name: 'idx_movies_published_weekly_views',
        fields: ['is_published', { attribute: 'weekly_views', order: 'DESC' }],
      },
      {
        name: 'idx_movies_published_monthly_views',
        fields: ['is_published', { attribute: 'monthly_views', order: 'DESC' }],
      },
      {
        name: 'idx_movies_published_rating',
        fields: ['is_published', { attribute: 'rating_average', order: 'DESC' }],
      },
      {
        name: 'idx_movies_published_release_date',
        fields: ['is_published', { attribute: 'release_date', order: 'DESC' }],
      },
      // GIN Full-Text Search Index
      {
        name: 'idx_movies_search_vector',
        using: 'GIN',
        fields: ['search_vector'],
      },
    ],
  }
);

// ──────────────────────────────────────────
// SEQUELIZE LIFECYCLE HOOKS
// ──────────────────────────────────────────

/**
 * Hook tự động tính release_year từ release_date nếu chưa được cung cấp
 */
Movie.addHook('beforeValidate', (movie) => {
  if (movie.release_date && !movie.release_year) {
    const parsedYear = new Date(movie.release_date).getFullYear();
    if (!isNaN(parsedYear)) {
      movie.release_year = parsedYear;
    }
  }
});

/**
 * Hook tự động sinh PostgreSQL TSVector cho search_vector khi thông tin tìm kiếm thay đổi
 */
Movie.addHook('beforeSave', (movie) => {
  if (
    movie.isNewRecord ||
    movie.changed('titles') ||
    movie.changed('description') ||
    movie.changed('director') ||
    movie.changed('tags')
  ) {
    const titlesText = Array.isArray(movie.titles)
      ? movie.titles.map((item) => item?.title || '').join(' ')
      : '';
    const directorText = movie.director || '';
    const tagsText = Array.isArray(movie.tags) ? movie.tags.join(' ') : '';
    const descText = movie.description || '';
    const combined = `${titlesText} ${directorText} ${tagsText} ${descText}`.trim();

    if (combined) {
      movie.search_vector = sequelize.fn('to_tsvector', 'simple', combined);
    }
  }
});

export default Movie;
