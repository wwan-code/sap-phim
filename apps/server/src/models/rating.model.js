/**
 * @file rating.model.js
 * @module Model_Rating
 * @description Model Sequelize cho bảng ratings.
 */

import { DataTypes } from "sequelize";

import { sequelize } from "../config/database.config.js";

const Rating = sequelize.define(
  "Rating",
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
      allowNull: true,
    },
    score: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: { min: 1, max: 10 },
    },
    review: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    is_spoiler: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
  },
  {
    tableName: "ratings",
    timestamps: true,
    underscored: true,
    indexes: [
      { unique: true, fields: ["user_id", "movie_id", "episode_id"] },
      { fields: ["movie_id"] },
      { fields: ["episode_id"] },
      { fields: ["score"] },
    ],
  },
);

export default Rating;
