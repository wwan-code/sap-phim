/**
 * @file broadcast-schedule.model.js
 * @module Model_BroadcastSchedule
 * @description Model Sequelize cho bảng broadcast_schedules (Aggregate Root).
 */

import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.config.js';

const BroadcastSchedule = sequelize.define('BroadcastSchedule', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4,
  },
  movie_id: {
    type: DataTypes.UUID,
    allowNull: false,
    unique: true, // Thường 1 phim có 1 lịch phát sóng chính
  },
  timezone: {
    type: DataTypes.STRING(100),
    allowNull: false,
    defaultValue: 'UTC',
  },
  status: {
    type: DataTypes.STRING(30),
    defaultValue: 'active',
    allowNull: false,
    validate: {
      isIn: [['active', 'paused', 'completed', 'cancelled']],
    },
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  anchor_date: {
    type: DataTypes.DATEONLY,
    allowNull: true,
    comment: 'Ngày neo bắt đầu lịch phát sóng (dùng cho RRULE DTSTART fallback)',
  },
  auto_publish: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    allowNull: false,
    comment: 'Tự động publish episode khi đến giờ (qua BullMQ)',
  },
}, {
  tableName: 'broadcast_schedules',
  timestamps: true,
  underscored: true,
  freezeTableName: true,
});

export default BroadcastSchedule;
