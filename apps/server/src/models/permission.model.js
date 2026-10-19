/**
 * @file permission.model.js
 * @module Model_Permission
 * @description Model Sequelize cho bảng permissions.
 */

import { DataTypes } from "sequelize";
import sequelize from "../config/database.config.js";

/**
 * @model Permission
 *
 * @property {UUID} id - ID duy nhất của quyền hạn
 * @property {string} name - Tên hiển thị của quyền (ví dụ: Xóa bình luận)
 * @property {string} slug - Mã định danh duy nhất (ví dụ: comments.delete)
 * @property {string} description - Mô tả chi tiết về tác vụ mà quyền này cho phép
 * @property {string} module - Phân nhóm module (movies, users, comments...)
 */
const Permission = sequelize.define(
  "Permission",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING(100),
      unique: true,
      allowNull: false,
      comment: "Tên hiển thị thân thiện của quyền",
    },
    slug: {
      type: DataTypes.STRING(100),
      unique: true,
      allowNull: false,
      comment: "Mã định danh dùng trong code để kiểm tra quyền",
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Mô tả chi tiết phạm vi của quyền",
    },
    module: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: "Phân nhóm module hệ thống",
    },
  },
  {
    tableName: "permissions",
    timestamps: true,
    underscored: true,
    updatedAt: false,
  },
);

export default Permission;

