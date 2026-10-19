/**
 * @file membership-plan.model.js
 * @module Model_MembershipPlan
 * @description Model Sequelize cho bảng membership_plans.
 */

import { DataTypes } from "sequelize";
import sequelize from "../config/database.config.js";

/**
 * @model MembershipPlan
 *
 * @property {UUID} id - ID duy nhất của gói thành viên
 * @property {string} tier - Cấp bậc gói (plus, pro, ultra)
 * @property {number} tier_level - Thứ tự cấp bậc (1, 2, 3)
 * @property {string} name - Tên hiển thị của gói (ví dụ: Lọ Pro)
 * @property {string} slug - Đường dẫn SEO duy nhất
 * @property {string} description - Mô tả chi tiết tính năng của gói
 * @property {string} tagline - Câu khẩu hiệu ngắn gọn quảng bá cho gói
 * @property {number} price_monthly - Giá thuê mỗi tháng (VND)
 * @property {number} price_yearly - Giá thuê mỗi năm (VND)
 * @property {string} currency - Đơn vị tiền tệ (mặc định VND)
 * @property {Object} features - Cấu hình tính năng và giới hạn (JSONB)
 * @property {number} display_order - Thứ tự ưu tiên hiển thị trên giao diện
 * @property {string} badge_color - Mã màu hiển thị trên huy hiệu gói
 * @property {string} icon_name - Tên icon đại diện cho gói
 * @property {boolean} is_popular - Đánh dấu gói nổi bật hoặc phổ biến nhất
 * @property {boolean} is_active - Trạng thái hoạt động của gói
 */
const MembershipPlan = sequelize.define(
  "MembershipPlan",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    // Định danh cấp độ
    tier: {
      type: DataTypes.ENUM("free", "plus", "pro", "ultra"),
      allowNull: false,
      unique: true,
      comment: "Cấp bậc gói: free (miễn phí) → plus (cơ bản) → pro (nâng cao) → ultra (cao cấp)",
    },
    tier_level: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "Thứ tự cấp bậc: plus=1, pro=2, ultra=3",
    },
    name: {
      type: DataTypes.STRING(100),
      unique: true,
      allowNull: false,
      comment: "Tên hiển thị gói hội viên",
    },
    slug: {
      type: DataTypes.STRING(100),
      unique: true,
      allowNull: false,
      comment: "Đường dẫn SEO duy nhất",
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Mô tả chi tiết quyền lợi",
    },
    tagline: {
      type: DataTypes.STRING(200),
      allowNull: true,
      comment: "Câu khẩu hiệu ngắn gọn",
    },

    // Cấu trúc giá (Monthly + Yearly)
    price_monthly: {
      type: DataTypes.DECIMAL(12, 0),
      allowNull: false,
      comment: "Giá thuê theo tháng (VND)",
    },
    price_yearly: {
      type: DataTypes.DECIMAL(12, 0),
      allowNull: true,
      comment: "Giá thuê theo năm (VND)",
    },
    currency: {
      type: DataTypes.STRING(3),
      defaultValue: "VND",
      comment: "Đơn vị tiền tệ",
    },

    // Tính năng và giới hạn
    features: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
      comment: "Cấu hình tính năng chi tiết (Chất lượng video, số thiết bị...)",
    },

    // Hiển thị và trạng thái
    display_order: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: "Thứ tự sắp xếp hiển thị",
    },
    badge_color: {
      type: DataTypes.STRING(20),
      allowNull: true,
      comment: "Màu huy hiệu hiển thị",
    },
    icon_name: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: "Tên icon đại diện",
    },
    is_popular: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: "Đánh dấu gói hội viên phổ biến",
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      comment: "Trạng thái kinh doanh của gói",
    },
  },
  {
    tableName: "membership_plans",
    timestamps: true,
    underscored: true,
    paranoid: true,
    deletedAt: "deleted_at",
    freezeTableName: true,
    indexes: [
      { fields: ["slug"], unique: true },
      { fields: ["tier"], unique: true },
      { fields: ["is_active", "tier_level"] },
      { fields: ["deleted_at"] },
    ],
  },
);

export default MembershipPlan;

