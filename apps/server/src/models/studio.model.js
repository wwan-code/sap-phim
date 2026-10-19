/**
 * @file studio.model.js
 * @module Model_Studio
 * @description Model Sequelize cho bảng studios.
 */

import { DataTypes } from "sequelize";
import { sequelize } from "../config/database.config.js";

const Studio = sequelize.define(
  "Studio",
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    slug: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    logo_url: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    country: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    created_by: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: "users",
        key: "id",
      },
    },
    updated_by: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: "users",
        key: "id",
      },
    },
  },
  {
    tableName: "studios",
    timestamps: true,
    underscored: true,
    paranoid: true,
    deletedAt: "deleted_at",
    freezeTableName: true,
    indexes: [
      { fields: ["slug"], name: "idx_studios_slug" },
      { fields: ["name"], name: "idx_studios_name" },
      { fields: ["country"], name: "idx_studios_country" },
      { fields: ["is_active"], name: "idx_studios_is_active" },
      { fields: ["deleted_at"], name: "idx_studios_deleted_at" },
    ],
  },
);

export default Studio;
