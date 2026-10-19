/**
 * Cấu hình Sequelize CLI (Sequelize CLI Configuration)
 *
 * @name sequelize.cjs
 * @module Config
 * @description Tệp cấu hình dành riêng cho Sequelize-CLI để thực thi Migrations
 * và Seeders. Sử dụng định dạng CommonJS để tương thích với công cụ CLI.
 */

require('dotenv').config();

module.exports = {
  /**
   * Môi trường Phát triển (Local Development)
   */
  development: {
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'sap_phim',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    dialect: 'postgres',
    logging: console.log,
    define: {
      timestamps: true,
      underscored: true
    }
  },

  /**
   * Môi trường Kiểm thử (Automated Tests)
   */
  test: {
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME ? `${process.env.DB_NAME}_test` : 'lo_phim_test',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    dialect: 'postgres',
    logging: false
  },

  /**
   * Môi trường Production (Sản xuất)
   */
  production: {
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432', 10),
    dialect: 'postgres',
    logging: false,
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false
      }
    },
    pool: {
      max: 20,
      min: 5,
      acquire: 60000,
      idle: 10000
    }
  }
};

