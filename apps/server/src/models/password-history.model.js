/**
 * @file password-history.model.js
 * @module Model_PasswordHistory
 * @description Model Sequelize cho bảng password_history.
 */

import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.config.js';

const PasswordHistory = sequelize.define('PasswordHistory', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4,
  },
  user_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id',
    },
    onDelete: 'CASCADE',
  },
  password_hash: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
}, {
  tableName: 'password_history',
  timestamps: true,
  updatedAt: false,
  underscored: true,
  freezeTableName: true,
  indexes: [
    { fields: ['user_id'] },
  ]
});

export default PasswordHistory;
