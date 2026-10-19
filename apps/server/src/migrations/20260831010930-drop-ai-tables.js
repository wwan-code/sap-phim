/**
 * @file 20260831010930-drop-ai-tables.js
 * @module Migrations_AI
 * @description Xóa các bảng AI cũ nếu tồn tại để dọn dẹp cấu trúc database.
 */

export async function up(queryInterface, Sequelize) {
  await queryInterface.sequelize.query(`
    DROP TABLE IF EXISTS ai_logs CASCADE;
    DROP TABLE IF EXISTS ai_prompts CASCADE;
  `);
}

export async function down(queryInterface, Sequelize) {
  // Không thể rollback thao tác xóa bảng trừ khi tái cấu trúc toàn bộ Schema.
}

export default {
  up,
  down,
};
