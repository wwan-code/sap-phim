/**
 * @file watchlist.model.js
 * @module Model_Watchlist
 * @description Model Sequelize cho bảng watchlists.
 */

import { DataTypes } from "sequelize";

import { sequelize } from "../config/database.config.js";

const Watchlist = sequelize.define(
  "Watchlist",
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
    status: {
      type: DataTypes.ENUM("planned", "watching", "completed", "favorite"),
      allowNull: false,
      defaultValue: "planned",
    },
    is_public: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    note: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    sort_order: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
  },
  {
    tableName: "watchlists",
    timestamps: true,
    underscored: true,
    indexes: [
      { unique: true, fields: ["user_id", "movie_id"] },
      { fields: ["user_id", "status"] },
      { fields: ["movie_id"] },
      { fields: ["is_public"] },
    ],
  },
);

export default Watchlist;
