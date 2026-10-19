/**
 * @file comment.model.js
 * @module Model_Comment
 * @description Model Sequelize cho bảng comments.
 */

import { DataTypes } from "sequelize";

import { sequelize } from "../config/database.config.js";

const Comment = sequelize.define(
  "Comment",
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
    parent_id: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    is_spoiler: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    like_count: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    status: {
      type: DataTypes.ENUM("visible", "hidden", "deleted", "pending"),
      allowNull: false,
      defaultValue: "visible",
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
    },
  },
  {
    tableName: "comments",
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ["movie_id", "created_at"] },
      { fields: ["episode_id", "created_at"] },
      { fields: ["user_id"] },
      { fields: ["parent_id"] },
      { fields: ["status"] },
    ],
  },
);

export default Comment;
