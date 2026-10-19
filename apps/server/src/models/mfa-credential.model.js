/**
 * @file mfa-credential.model.js
 * @module Model_MfaCredential
 * @description Model Sequelize cho bảng mfa_credentials.
 */

import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.config.js';

const MfaCredential = sequelize.define('MfaCredential', {
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
  type: {
    type: DataTypes.STRING(50),
    defaultValue: 'totp',
    allowNull: false,
    comment: 'Loại MFA (totp, webauthn, email_otp, v.v.)',
  },
  secret: {
    type: DataTypes.TEXT,
    allowNull: false,
    comment: 'Mã bí mật (Secret Key) đã được mã hóa bằng AES-256-GCM',
  },
  iv: {
    type: DataTypes.STRING(255),
    allowNull: false,
    comment: 'Vector khởi tạo dùng để giải mã secret',
  },
  auth_tag: {
    type: DataTypes.STRING(255),
    allowNull: false,
    comment: 'Thẻ xác thực mã hóa AES-256-GCM',
  },
  backup_codes_hashed: {
    type: DataTypes.JSONB,
    allowNull: true,
    defaultValue: [],
    comment: 'Danh sách các mã khôi phục dự phòng đã băm bằng Argon2id',
  },
  verified_at: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Thời điểm MFA được kích hoạt thành công',
  },
}, {
  tableName: 'mfa_credentials',
  timestamps: true,
  underscored: true,
  freezeTableName: true,
  indexes: [
    { fields: ['user_id'] },
  ]
});

export default MfaCredential;
