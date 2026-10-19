/**
 * @file series.model.js
 * @module Model_Series
 * @description Model Sequelize cho bảng series.
 */

import { DataTypes } from "sequelize";
import { sequelize } from "../config/database.config.js";

const Series = sequelize.define(
  "Series",
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
    total_movies: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
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
    tableName: "series",
    timestamps: true,
    underscored: true,
    paranoid: true,
    deletedAt: "deleted_at",
    freezeTableName: true,
    indexes: [
      { fields: ["slug"], name: "idx_series_slug" },
      { fields: ["name"], name: "idx_series_name" },
      { fields: ["is_active"], name: "idx_series_is_active" },
      { fields: ["deleted_at"], name: "idx_series_deleted_at" },
    ],
  },
);

export default Series;
