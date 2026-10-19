/**
 * @file wallet.model.js
 * @module Model_Wallet
 * @description Model Sequelize cho bảng wallets.
 */

import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.config.js';

const Wallet = sequelize.define('Wallet', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4,
  },
  user_id: {
    type: DataTypes.UUID,
    allowNull: false,
    unique: true,
  },
  balance: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    allowNull: false,
    validate: {
      min: 0,
    },
  },
  hold_balance: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    allowNull: false,
    validate: {
      min: 0,
    },
  },
  total_deposited: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    allowNull: false,
    validate: {
      min: 0,
    },
  },
  total_spent: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    allowNull: false,
    validate: {
      min: 0,
    },
  },
  total_received: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    allowNull: false,
    validate: {
      min: 0,
    },
  },
  total_withdrawn: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    allowNull: false,
    validate: {
      min: 0,
    },
  },
  is_locked: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    allowNull: false,
  },
  locked_reason: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  locked_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  locked_by: {
    type: DataTypes.UUID,
    allowNull: true,
  },
}, {
  tableName: "wallets",
  timestamps: true,
  underscored: true,
  freezeTableName: true,
});

export default Wallet;
