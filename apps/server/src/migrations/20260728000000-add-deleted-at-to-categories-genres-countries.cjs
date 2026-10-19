/**
 * @file 20260728000000-add-deleted-at-to-categories-genres-countries.cjs
 * @module Migrations
 * @description Bổ sung cột deleted_at vào các bảng categories, genres, countries để hỗ trợ Soft Delete (paranoid mode).
 */

'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    try {
      await queryInterface.sequelize.query(`
        ALTER TABLE categories ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
        ALTER TABLE genres ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
        ALTER TABLE countries ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

        CREATE INDEX IF NOT EXISTS idx_categories_deleted_at ON categories(deleted_at);
        CREATE INDEX IF NOT EXISTS idx_genres_deleted_at ON genres(deleted_at);
        CREATE INDEX IF NOT EXISTS idx_countries_deleted_at ON countries(deleted_at);
      `);
      console.log('[Migration] Successfully added deleted_at column to categories, genres, and countries tables');
    } catch (error) {
      console.error('[Migration] Failed to add deleted_at column to categories, genres, and countries tables:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    try {
      await queryInterface.sequelize.query(`
        DROP INDEX IF EXISTS idx_categories_deleted_at;
        DROP INDEX IF EXISTS idx_genres_deleted_at;
        DROP INDEX IF EXISTS idx_countries_deleted_at;

        ALTER TABLE categories DROP COLUMN IF EXISTS deleted_at;
        ALTER TABLE genres DROP COLUMN IF EXISTS deleted_at;
        ALTER TABLE countries DROP COLUMN IF EXISTS deleted_at;
      `);
    } catch (error) {
      console.error('[Migration] Failed to remove deleted_at column from categories, genres, and countries tables:', error);
    }
  }
};
