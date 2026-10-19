/**
 * @file category.model.js
 * @module Model_Category
 * @description Model Sequelize cho bảng categories.
 */

import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.config.js';

const Category = sequelize.define('Category', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4,
  },
  name: {
    type: DataTypes.STRING(150),
    allowNull: false,
    unique: true,
  },
  slug: {
    type: DataTypes.STRING(150),
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
  order_num: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    allowNull: false,
  },
  movies_count: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    allowNull: false,
  },
}, {
  tableName: 'categories',
  timestamps: true,
  underscored: true,
  paranoid: true,
  deletedAt: "deleted_at",
  freezeTableName: true,
  indexes: [
    { fields: ["slug"], name: "idx_categories_slug" },
    { fields: ["name"], name: "idx_categories_name" },
    { fields: ["is_active"], name: "idx_categories_is_active" },
    { fields: ["deleted_at"], name: "idx_categories_deleted_at" },
  ],
});

export default Category;
