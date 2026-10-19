/**
 * @file actor.model.js
 * @module Model_Actor
 * @description Model Sequelize cho bảng actors.
 */

import { DataTypes } from "sequelize";
import { sequelize } from "../config/database.config.js";

const Actor = sequelize.define(
  "Actor",
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
    image_url: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    gender: {
      type: DataTypes.STRING(20),
      allowNull: true,
      validate: {
        isIn: [["male", "female", "other", "unknown"]],
      },
    },
    birth_date: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    nationality: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    biography: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    aliases: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
    },
    popularity_score: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    movies_count: {
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
    tableName: "actors",
    timestamps: true,
    underscored: true,
    paranoid: true,
    deletedAt: "deleted_at",
    freezeTableName: true,
    indexes: [
      { fields: ["slug"], name: "idx_actors_slug" },
      { fields: ["name"], name: "idx_actors_name" },
      { fields: ["nationality"], name: "idx_actors_nationality" },
      { fields: ["gender"], name: "idx_actors_gender" },
      { fields: ["is_active"], name: "idx_actors_is_active" },
      { fields: ["popularity_score"], name: "idx_actors_popularity_score" },
      { fields: ["deleted_at"], name: "idx_actors_deleted_at" },
    ],
  },
);

export default Actor;
