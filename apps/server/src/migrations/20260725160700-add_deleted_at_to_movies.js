/**
 * @file 20260725160700-add_deleted_at_to_movies.js
 * @module Migrations_Movie
 * @description Migration dự phòng cho cột deleted_at của movies (đã được xử lý bởi 20260725000000).
 */

export async function up(queryInterface, Sequelize) {
  // Cột deleted_at và index đã được tạo trong 20260725000000-add-deleted-at-to-movies.cjs
}

export async function down(queryInterface, Sequelize) {
  // No-op
}

export default {
  up,
  down,
};
