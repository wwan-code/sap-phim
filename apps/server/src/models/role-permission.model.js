/**
 * @file role-permission.model.js
 * @module Model_RolePermission
 * @description Model Sequelize cho bảng role_permissions.
 */

import { DataTypes } from "sequelize";
import sequelize from "../config/database.config.js";

/**
 * @model RolePermission
 *
 * @property {UUID} role_id - ID của vai trò (khóa ngoại)
 * @property {UUID} permission_id - ID của quyền hạn (khóa ngoại)
 */
const RolePermission = sequelize.define(
  "RolePermission",
  {
    role_id: {
      type: DataTypes.UUID,
      allowNull: false,
      primaryKey: true,
      references: {
        model: "roles",
        key: "id",
      },
      comment: "Liên kết đến vai trò",
    },
    permission_id: {
      type: DataTypes.UUID,
      allowNull: false,
      primaryKey: true,
      references: {
        model: "permissions",
        key: "id",
      },
      comment: "Liên kết đến quyền hạn cụ thể",
    },
  },
  {
    tableName: "role_permissions",
    timestamps: false,
    underscored: true,
  },
);

export default RolePermission;

