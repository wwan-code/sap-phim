/**
 * @file country.model.js
 * @module Model_Country
 * @description Model Sequelize cho bảng countries.
 */

import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.config.js';

const Country = sequelize.define('Country', {
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
  code: {
    type: DataTypes.STRING(10),
    allowNull: false,
    unique: true,
  },
  flag_url: {
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
  tableName: 'countries',
  timestamps: true,
  underscored: true,
  paranoid: true,
  deletedAt: "deleted_at",
  freezeTableName: true,
  indexes: [
    { fields: ["slug"], name: "idx_countries_slug" },
    { fields: ["name"], name: "idx_countries_name" },
    { fields: ["code"], name: "idx_countries_code" },
    { fields: ["is_active"], name: "idx_countries_is_active" },
    { fields: ["deleted_at"], name: "idx_countries_deleted_at" },
  ],
});

export default Country;
