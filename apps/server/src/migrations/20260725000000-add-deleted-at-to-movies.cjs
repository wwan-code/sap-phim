/**
 * @file 20260725000000-add-deleted-at-to-movies.cjs
 * @module Migrations
 * @description Bổ sung cột deleted_at vào bảng movies để hỗ trợ tính năng Soft Delete (paranoid mode).
 */

'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    try {
      await queryInterface.sequelize.query(`
        ALTER TABLE movies ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
        CREATE INDEX IF NOT EXISTS idx_movies_deleted_at ON movies(deleted_at);
      `);
      console.log('Successfully added deleted_at column to movies table');
    } catch (error) {
      console.error('Failed to add deleted_at column to movies table:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    try {
      await queryInterface.sequelize.query(`
        DROP INDEX IF EXISTS idx_movies_deleted_at;
        ALTER TABLE movies DROP COLUMN IF EXISTS deleted_at;
      `);
    } catch (error) {
      console.error('Failed to remove deleted_at column from movies table:', error);
    }
  }
};
