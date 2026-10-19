/**
 * @file watch-history.model.js
 * @module Model_WatchHistory
 * @description Model Sequelize cho bảng watch_histories.
 */

import { DataTypes } from "sequelize";

import { sequelize } from "../config/database.config.js";

const WatchHistory = sequelize.define(
  "WatchHistory",
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    movie_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    episode_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    position_seconds: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: { min: 0 },
    },
    duration_seconds: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: { min: 0 },
    },
    progress_percent: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 0,
      validate: { min: 0, max: 100 },
    },
    completed_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    last_watched_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
    },
  },
  {
    tableName: "watch_histories",
    timestamps: true,
    underscored: true,
    indexes: [
      { unique: true, fields: ["user_id", "episode_id"] },
      { fields: ["user_id", "last_watched_at"] },
      { fields: ["movie_id"] },
      { fields: ["episode_id"] },
      { fields: ["completed_at"] },
    ],
  },
);

export default WatchHistory;
