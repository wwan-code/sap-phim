/**
 * @file collection.model.js
 * @module Model_Collection
 * @description Model Sequelize cho bảng collections.
 */

import { DataTypes } from "sequelize";
import sequelize from "../config/database.config.js";

/**
 * @model Collection
 *
 * @property {UUID} id - Định danh duy nhất của bộ sưu tập
 * @property {string} name - Tên hiển thị (ví dụ: Phim Hành Động Nổi Bật)
 * @property {string} slug - Đường dẫn SEO duy nhất
 * @property {number} style - Biến thể giao diện hiển thị (ví dụ: Carousel, Grid, List)
 * @property {string} color - Mã màu Hex cho chủ đề của bộ sưu tập
 * @property {number} order - Thứ tự hiển thị trên trang chủ
 * @property {string} filter - Chuỗi điều kiện lọc phim (DSL): Relation|Field|Value|Sort|Limit|Extras
 */
const Collection = sequelize.define(
  "Collection",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    // Thông tin hiển thị
    name: {
      type: DataTypes.STRING(200),
      allowNull: false,
      comment: "Tên hiển thị của bộ sưu tập",
    },
    slug: {
      type: DataTypes.STRING(200),
      unique: true,
      allowNull: false,
      comment: "Đường dẫn SEO duy nhất",
    },

    // Cấu hình giao diện
    style: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: "Kiểu hiển thị (0: Carousel, 1: Grid, 2: List...)",
    },
    color: {
      type: DataTypes.STRING(20),
      allowNull: true,
      comment: "Mã màu chủ đạo của bộ sưu tập",
    },
    order: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: "Thứ tự sắp xếp trên trang chủ",
    },

    // Logic truy vấn dữ liệu
    filter: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Chuỗi DSL định nghĩa bộ lọc phim",
    },
  },
  {
    tableName: "collections",
    timestamps: true,
    underscored: true,
    paranoid: true,
    deletedAt: "deleted_at",
    freezeTableName: true,
    indexes: [
      { fields: ["slug"], unique: true },
      { fields: ["order"] },
      { fields: ["deleted_at"] },
    ],
  },
);

export default Collection;

