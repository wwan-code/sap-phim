/**
 * @file broadcast-calendar.model.js
 * @module Model_BroadcastCalendar
 * @description Model Sequelize cho bảng broadcast_calendars (Lịch cụ thể từng tập).
 */

import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.config.js';

const BroadcastCalendar = sequelize.define('BroadcastCalendar', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4,
  },
  schedule_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  episode_id: {
    type: DataTypes.UUID,
    allowNull: true, // Có thể null nếu tập chưa được tạo (lịch dự kiến)
  },
  episode_number: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  release_time: {
    type: DataTypes.DATE, // UTC timestamp tuyệt đối
    allowNull: false,
  },
  status: {
    type: DataTypes.STRING(30),
    defaultValue: 'upcoming',
    allowNull: false,
    validate: {
      isIn: [['upcoming', 'delayed', 'released', 'cancelled']],
    },
  },
  delay_reason: {
    type: DataTypes.STRING(500),
    allowNull: true,
    comment: 'Lý do hoãn chiếu (khi status = delayed hoặc cancelled)',
  },
  is_exception: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    allowNull: false,
    comment: 'Đánh dấu nếu bị admin sửa đổi thủ công (override)',
  },
  rule_id: {
    type: DataTypes.UUID,
    allowNull: true,
    comment: 'Liên kết đến ReleaseRule đã sinh ra entry này',
  },
  bullmq_job_id: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: 'BullMQ delayed job ID cho auto-publish',
  },
}, {
  tableName: 'broadcast_calendars',
  timestamps: true,
  underscored: true,
  freezeTableName: true,
  indexes: [
    {
      unique: true,
      fields: ['schedule_id', 'episode_number'],
    },
    {
      fields: ['release_time'],
    },
    {
      fields: ['status'],
    },
  ],
});

export default BroadcastCalendar;
