/**
 * @file genre.model.js
 * @module Model_Genre
 * @description Model Sequelize cho bảng genres.
 */

import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.config.js';

const Genre = sequelize.define('Genre', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4,
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true,
  },
  slug: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true,
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    allowNull: false,
  },
  movies_count: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    allowNull: false,
  },
}, {
  tableName: 'genres',
  timestamps: true,
  underscored: true,
  paranoid: true,
  deletedAt: "deleted_at",
  freezeTableName: true,
  indexes: [
    { fields: ["slug"], name: "idx_genres_slug" },
    { fields: ["name"], name: "idx_genres_name" },
    { fields: ["is_active"], name: "idx_genres_is_active" },
    { fields: ["deleted_at"], name: "idx_genres_deleted_at" },
  ],
});

export default Genre;
