/**
 * @file role.model.js
 * @module Model_Role
 * @description Model Sequelize cho bảng roles.
 */

import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.config.js';

const Role = sequelize.define('Role', {
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
  priority: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    allowNull: false,
  },
}, {
  tableName: 'roles',
  timestamps: true,
  underscored: true,
  freezeTableName: true,
});

export default Role;
