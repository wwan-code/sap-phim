/**
 * @file release-rule.model.js
 * @module Model_ReleaseRule
 * @description Model Sequelize cho bảng release_rules (Quy tắc phát sóng).
 */

import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.config.js';

const ReleaseRule = sequelize.define('ReleaseRule', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4,
  },
  schedule_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  type: {
    type: DataTypes.STRING(30),
    allowNull: false,
    defaultValue: 'weekly',
    validate: {
      isIn: [['weekly', 'specific_date', 'daily']],
    },
  },
  day_of_week: {
    type: DataTypes.INTEGER, // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    allowNull: true,
  },
  release_time: {
    type: DataTypes.TIME, // 'HH:mm:ss'
    allowNull: true,
  },
  specific_date: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  rrule_string: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'RFC 5545 RRULE string (e.g., FREQ=WEEKLY;BYDAY=FR;COUNT=12)',
  },
  dtstart: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'DTSTART anchor date for RRULE expansion',
  },
  description: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: 'Human-readable rule description',
  },
}, {
  tableName: 'release_rules',
  timestamps: true,
  underscored: true,
  freezeTableName: true,
});

export default ReleaseRule;
