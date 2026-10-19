/**
 * @file 20240101000000-init-base-schema.cjs
 * @module Migrations_Base_Schema
 * @description Migration khởi tạo toàn bộ schema nền tảng từ Sequelize Models cho cơ sở dữ liệu trống.
 */

'use strict';

module.exports = {
  /**
   * Khởi tạo các bảng nền tảng (nếu chưa tồn tại)
   */
  async up(queryInterface, Sequelize) {
    try {
      // Dynamic import các models ES Module để đồng bộ cấu trúc nền tảng
      const { sequelize } = await import('../models/index.js');
      await sequelize.sync({ alter: false });
      console.log('[Migration] Đồng bộ hóa base schema models thành công.');
    } catch (error) {
      console.error('[Migration] Lỗi khởi tạo base schema:', error);
      throw error;
    }
  },

  /**
   * Rollback không xóa bảng nền tảng để đảm bảo toàn vẹn dữ liệu
   */
  async down(queryInterface, Sequelize) {
    console.log('[Migration] Rollback base schema bị bỏ qua để bảo vệ dữ liệu.');
  }
};
