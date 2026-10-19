/**
 * @file user.model.js
 * @module Model_User
 * @description Model Sequelize cho bảng users.
 */

import { DataTypes } from 'sequelize';
import bcrypt from 'bcryptjs';
import * as argon2 from 'argon2';
import { sequelize } from '../config/database.config.js';
import { CRYPTO_CONFIG } from '../constants/auth.constant.js';

const User = sequelize.define('User', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4,
  },
  username: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
    validate: {
      is: /^[a-zA-Z0-9_-]{3,50}$/,
    },
  },
  email: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true,
    },
  },
  phone_number: {
    type: DataTypes.STRING(20),
    allowNull: true,
    unique: true,
  },
  password_hash: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  password_changed_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  token_version: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
    allowNull: false,
  },
  lock_count: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    allowNull: false,
  },
  level: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
    allowNull: false,
  },
  exp: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    allowNull: false,
  },
  point: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    allowNull: false,
  },
  role_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  full_name: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  avatar_url: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  cover_url: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  bio: {
    type: DataTypes.STRING(500),
    allowNull: true,
  },
  date_of_birth: {
    type: DataTypes.DATEONLY,
    allowNull: true,
  },
  gender: {
    type: DataTypes.STRING(20),
    allowNull: true,
  },
  social_links: {
    type: DataTypes.JSONB,
    allowNull: true,
  },
  country: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  city: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  location: {
    type: DataTypes.JSONB, // {"address": "", "district": "", "ward": ""}
    allowNull: true,
  },
  status: {
    type: DataTypes.STRING(20),
    defaultValue: 'pending',
    allowNull: false,
    validate: {
      isIn: [['active', 'inactive', 'banned', 'pending']],
    },
  },
  is_verified: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    allowNull: false,
  },
  is_premium: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    allowNull: false,
  },
  membership_tier: {
    type: DataTypes.STRING(20),
    defaultValue: 'free',
    allowNull: false,
    validate: {
      isIn: [['free', 'plus', 'pro', 'ultra']],
    },
  },
  is_online: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    allowNull: false,
  },
  last_online: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  preferences: {
    type: DataTypes.JSONB,
    allowNull: true,
  },
  privacy_settings: {
    type: DataTypes.JSONB,
    allowNull: true,
  },
  followers_count: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    allowNull: false,
  },
  following_count: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    allowNull: false,
  },
  movies_watched: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    allowNull: false,
  },
  // [NEW] Đếm denormalized — tham chiếu bởi account.service.js#getProfileStats và
  // profile.service.js#maskActivity (privacy: "show_activity"). Nên tăng/giảm bằng
  // increment/decrement tại nơi tạo/xóa Rating & Comment, không tính lại bằng COUNT(*)
  // mỗi request để tránh tốn hiệu năng trên trang profile công khai.
  total_ratings: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    allowNull: false,
  },
  total_comments: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    allowNull: false,
  },
  email_verified_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  last_login_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  login_attempts: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    allowNull: false,
  },
  locked_until: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  password_reset_token: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  password_reset_expires: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  verification_token: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  two_factor_enabled: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    allowNull: false,
  },
  two_factor_method: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  two_factor_secret: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  two_factor_backup_codes: {
    type: DataTypes.JSONB,
    allowNull: true,
  },
  two_factor_verified_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  login_alert: {
    type: DataTypes.JSONB,
    defaultValue: { email: true, push: false, sms: false },
    allowNull: false,
  },
}, {
  tableName: 'users',
  timestamps: true,
  underscored: true,
  freezeTableName: true,
});


/**
 * Kiểm tra xem mật khẩu nhập vào có khớp với mật khẩu đã băm không.
 * Tích hợp Seamless Migration: nếu mật khẩu đang ở dạng bcrypt ($2a$ hoặc $2b$), tự động băm lại bằng argon2id.
 * @param {string} password - Mật khẩu cần so sánh
 * @returns {Promise<boolean>} True nếu khớp
 */
User.prototype.comparePassword = async function (password) {
  // Phát hiện mật khẩu cũ dạng Bcrypt
  if (this.password_hash.startsWith('$2a$') || this.password_hash.startsWith('$2b$')) {
    const isMatch = await bcrypt.compare(password, this.password_hash);
    if (isMatch) {
      // Seamless Migration: Nâng cấp lên Argon2id và lưu lại
      this.password_hash = await argon2.hash(password, {
        type: argon2.argon2id,
        memoryCost: CRYPTO_CONFIG.ARGON2.memoryCost,
        timeCost: CRYPTO_CONFIG.ARGON2.timeCost,
        parallelism: CRYPTO_CONFIG.ARGON2.parallelism,
        hashLength: CRYPTO_CONFIG.ARGON2.hashLength,
      });
      await this.save({ hooks: false });
      return true;
    }
    return false;
  }

  // Luồng xác thực mặc định với Argon2id
  try {
    return await argon2.verify(this.password_hash, password);
  } catch (error) {
    return false;
  }
};

/**
 * Chuyển đổi đối tượng User thành JSON an toàn, loại bỏ thông tin nhạy cảm
 * và định dạng lại vai trò (roles) để tương thích với Frontend.
 * 
 * @returns {Object} Đối tượng người dùng đã loại bỏ các trường nhạy cảm
 */
User.prototype.toSafeJSON = function () {
  const safeUser = this.toJSON();

  // Loại bỏ các trường thông tin nhạy cảm
  delete safeUser.password_hash;
  delete safeUser.password_reset_token;
  delete safeUser.password_reset_expires;
  delete safeUser.verification_token;
  delete safeUser.token_version;
  delete safeUser.two_factor_secret;
  delete safeUser.two_factor_backup_codes;

  // Áp dụng định dạng 'roles' dạng mảng cho Frontend tương thích
  if (safeUser.role) {
    safeUser.roles = [safeUser.role];
    if (safeUser.role.permissions) {
      safeUser.permissions = safeUser.role.permissions.map(p => p.slug);
    } else {
      safeUser.permissions = [];
    }
  } else {
    safeUser.roles = [];
    safeUser.permissions = [];
  }

  return safeUser;
};

export default User;