/**
 * @file upgrade-movie-model.js
 * @module Scripts_UpgradeMovieModel
 * @description Migration script an toàn nâng cấp bảng movies: thêm columns, sửa kiểu rating_average, tạo B-Tree + GIN indexes và backfill dữ liệu.
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { sequelize } from '../src/config/database.config.js';
import { logger } from '../src/utils/logger.js';

const runUpgrade = async () => {
  try {
    logger.info('=== BẮT ĐẦU NÂNG CẤP DATABASE CHO MODEL MOVIE ===');
    await sequelize.authenticate();
    logger.info('Đã kết nối PostgreSQL thành công.');

    // 1. Cập nhật kiểu dữ liệu cột hiện tại
    logger.info('1. Cập nhật kiểu dữ liệu cột hiện tại...');
    await sequelize.query(`
      ALTER TABLE movies 
      ALTER COLUMN rating_average TYPE DECIMAL(4, 2);

      ALTER TABLE movies 
      ALTER COLUMN season_number DROP NOT NULL,
      ALTER COLUMN season_number DROP DEFAULT;
    `);
    logger.info('-> Đã nâng cấp rating_average thành DECIMAL(4, 2) và season_number thành nullable.');

    // 2. Thêm các cột mới (IF NOT EXISTS)
    logger.info('2. Bổ sung các cột mới...');
    await sequelize.query(`
      ALTER TABLE movies 
      ADD COLUMN IF NOT EXISTS release_year INTEGER,
      ADD COLUMN IF NOT EXISTS quality VARCHAR(20) DEFAULT 'FHD',
      ADD COLUMN IF NOT EXISTS sub_dub_type VARCHAR(20) DEFAULT 'sub',
      ADD COLUMN IF NOT EXISTS source_type VARCHAR(30),
      ADD COLUMN IF NOT EXISTS anilist_id INTEGER,
      ADD COLUMN IF NOT EXISTS daily_views BIGINT DEFAULT 0,
      ADD COLUMN IF NOT EXISTS weekly_views BIGINT DEFAULT 0,
      ADD COLUMN IF NOT EXISTS monthly_views BIGINT DEFAULT 0,
      ADD COLUMN IF NOT EXISTS favorite_count INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS comment_count INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS trending_score DECIMAL(10, 2) DEFAULT 0.00;
    `);
    logger.info('-> Đã bổ sung thành công các cột metadata và engagement.');

    // 3. Đảm bảo Foreign Key cho series_id, created_by, updated_by
    logger.info('3. Đảm bảo Foreign Key Constraints...');
    await sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'fk_movies_series_id'
        ) THEN
          BEGIN
            ALTER TABLE movies 
            ADD CONSTRAINT fk_movies_series_id 
            FOREIGN KEY (series_id) REFERENCES series(id) ON DELETE SET NULL;
          EXCEPTION WHEN others THEN
            RAISE NOTICE 'Skipping fk_movies_series_id: %', SQLERRM;
          END;
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'fk_movies_created_by'
        ) THEN
          BEGIN
            ALTER TABLE movies 
            ADD CONSTRAINT fk_movies_created_by 
            FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
          EXCEPTION WHEN others THEN
            RAISE NOTICE 'Skipping fk_movies_created_by: %', SQLERRM;
          END;
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'fk_movies_updated_by'
        ) THEN
          BEGIN
            ALTER TABLE movies 
            ADD CONSTRAINT fk_movies_updated_by 
            FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;
          EXCEPTION WHEN others THEN
            RAISE NOTICE 'Skipping fk_movies_updated_by: %', SQLERRM;
          END;
        END IF;
      END $$;
    `);
    logger.info('-> Đã kiểm tra và cập nhật Foreign Keys.');

    // 4. Tạo hệ thống Indexes (B-Tree + Composite + GIN)
    logger.info('4. Thiết lập hệ thống Database Indexes...');
    const indexQueries = [
      'CREATE INDEX IF NOT EXISTS idx_movies_category_id ON movies(category_id);',
      'CREATE INDEX IF NOT EXISTS idx_movies_country_id ON movies(country_id);',
      'CREATE INDEX IF NOT EXISTS idx_movies_studio_id ON movies(studio_id);',
      'CREATE INDEX IF NOT EXISTS idx_movies_series_id ON movies(series_id);',
      'CREATE INDEX IF NOT EXISTS idx_movies_status ON movies(status);',
      'CREATE INDEX IF NOT EXISTS idx_movies_type ON movies(type);',
      'CREATE INDEX IF NOT EXISTS idx_movies_is_published ON movies(is_published);',
      'CREATE INDEX IF NOT EXISTS idx_movies_is_premium ON movies(is_premium);',
      'CREATE INDEX IF NOT EXISTS idx_movies_release_year ON movies(release_year);',
      'CREATE INDEX IF NOT EXISTS idx_movies_season ON movies(season);',
      'CREATE INDEX IF NOT EXISTS idx_movies_quality ON movies(quality);',
      'CREATE INDEX IF NOT EXISTS idx_movies_sub_dub_type ON movies(sub_dub_type);',
      'CREATE INDEX IF NOT EXISTS idx_movies_deleted_at ON movies(deleted_at);',
      'CREATE INDEX IF NOT EXISTS idx_movies_published_trending ON movies(is_published, trending_score DESC);',
      'CREATE INDEX IF NOT EXISTS idx_movies_published_daily_views ON movies(is_published, daily_views DESC);',
      'CREATE INDEX IF NOT EXISTS idx_movies_published_weekly_views ON movies(is_published, weekly_views DESC);',
      'CREATE INDEX IF NOT EXISTS idx_movies_published_monthly_views ON movies(is_published, monthly_views DESC);',
      'CREATE INDEX IF NOT EXISTS idx_movies_published_rating ON movies(is_published, rating_average DESC);',
      'CREATE INDEX IF NOT EXISTS idx_movies_published_release_date ON movies(is_published, release_date DESC);',
      'CREATE INDEX IF NOT EXISTS idx_movies_search_vector ON movies USING GIN(search_vector);',
    ];

    for (const sql of indexQueries) {
      await sequelize.query(sql);
    }
    logger.info('-> Đã tạo đầy đủ 20 Indexes (Foreign keys, Filters, Composite BXH, GIN Search).');

    // 5. Backfill dữ liệu cho các bản ghi hiện tại
    logger.info('5. Backfill dữ liệu release_year và search_vector...');
    const [backfillYearResult] = await sequelize.query(`
      UPDATE movies 
      SET release_year = EXTRACT(YEAR FROM release_date)::integer 
      WHERE release_year IS NULL AND release_date IS NOT NULL;
    `);
    logger.info(`-> Đã backfill release_year từ release_date.`);

    // Backfill search_vector
    await sequelize.query(`
      UPDATE movies 
      SET search_vector = to_tsvector(
        'simple', 
        COALESCE(
          (
            SELECT string_agg(elem->>'title', ' ') 
            FROM jsonb_array_elements(titles) AS elem
          ), 
          ''
        ) || ' ' || 
        COALESCE(director, '') || ' ' || 
        COALESCE(description, '')
      )
      WHERE search_vector IS NULL;
    `);
    logger.info('-> Đã backfill search_vector cho toàn bộ phim hiện hữu.');

    logger.info('=== NÂNG CẤP HOÀN TẤT THÀNH CÔNG 100% ===');
  } catch (error) {
    logger.error('Lỗi khi thực hiện nâng cấp database:', error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
};

runUpgrade();
