/**
 * @file trusted-device.model.js
 * @module Model_TrustedDevice
 * @description Model Sequelize cho bảng trusted_devices.
 */

import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.config.js';

const TrustedDevice = sequelize.define('TrustedDevice', {
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
  device_fingerprint: {
    type: DataTypes.STRING(255),
    allowNull: false,
    comment: 'Bản hash fingerprint duy nhất đại diện cho thiết bị',
  },
  device_name: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: 'Tên thiết bị thân thiện (ví dụ: Chrome trên Windows)',
  },
  last_used_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  is_trusted: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    allowNull: false,
  },
}, {
  tableName: 'trusted_devices',
  timestamps: true,
  underscored: true,
  freezeTableName: true,
  indexes: [
    { fields: ['user_id'] },
    { fields: ['user_id', 'device_fingerprint'], unique: true },
  ]
});

export default TrustedDevice;
