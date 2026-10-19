/**
 * @file user-session.model.js
 * @module Model_UserSession
 * @description Model Sequelize cho bảng user_sessions.
 */

import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.config.js';

const UserSession = sequelize.define('UserSession', {
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
    }
  },
  token_family: {
    type: DataTypes.UUID,
    field: 'refresh_token_family',
    allowNull: false,
    comment: 'Định danh nhóm token (dùng để thu hồi toàn bộ khi phát hiện replay attack)',
  },
  token_hash: {
    type: DataTypes.STRING(255),
    field: 'refresh_token_hash',
    allowNull: true,
    comment: 'Bản hash của refresh token hiện tại đang active trong family này',
  },
  ip_address: {
    type: DataTypes.STRING(45),
    allowNull: true,
  },
  user_agent: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  device_info: {
    type: DataTypes.JSONB,
    allowNull: true,
  },
  expires_at: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  is_revoked: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    allowNull: false,
  },
  revoked_reason: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: 'Lý do thu hồi phiên đăng nhập (logout, rotated, reuse_detected, password_change, v.v.)',
  },
  revoked_at: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Thời điểm thu hồi phiên đăng nhập',
  },
  risk_score: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    allowNull: false,
    comment: 'Điểm rủi ro của phiên đăng nhập (0-100)',
  },
  anomaly_flags: {
    type: DataTypes.JSONB,
    defaultValue: [],
    allowNull: false,
    comment: 'Các cờ bất thường được hệ thống phát hiện',
  },
  last_used_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  }
}, {
  tableName: 'user_sessions',
  timestamps: true,
  underscored: true,
  freezeTableName: true,
  indexes: [
    { fields: ['user_id'] },
    { fields: ['refresh_token_family'] }
  ]
});

export default UserSession;
