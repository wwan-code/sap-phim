/**
 * @file episode.model.js
 * @module Model_Episode
 * @description Model Sequelize cho bảng episodes.
 */

import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.config.js';

const Episode = sequelize.define('Episode', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4,
  },
  movie_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  episode_number: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  title: {
    type: DataTypes.STRING(500),
    allowNull: true,
  },
  duration: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: null,
  },
  video_sources: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: [],
  },
  thumbnail_url: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  sprite_url: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  vtt_url: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  subtitle_sources: {
    type: DataTypes.JSONB,
    allowNull: true,
    defaultValue: [],
  },
  audio_tracks: {
    type: DataTypes.JSONB,
    allowNull: true,
    defaultValue: [],
  },
  status: {
    type: DataTypes.STRING(30),
    defaultValue: 'pending',
    allowNull: false,
    validate: {
      isIn: [['ready', 'processing', 'pending', 'failed', 'uploading', 'uploaded']],
    },
  },
  is_premium: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    allowNull: false,
  },
  view_count: {
    type: DataTypes.BIGINT,
    defaultValue: 0,
    allowNull: false,
  },
  publish_state: {
    type: DataTypes.STRING(20),
    defaultValue: 'draft',
    allowNull: false,
    validate: {
      isIn: [['draft', 'published', 'private']],
    },
  },
  published_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  scheduled_at: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '@deprecated - Sử dụng BroadcastCalendar.release_time làm Single Source of Truth',
  },
  job_id: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: '@deprecated - Sử dụng BroadcastCalendar.bullmq_job_id làm Single Source of Truth',
  },
  processing_error: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  retry_count: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    allowNull: false,
  },
  upload_progress: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    allowNull: false,
  },
  processing_progress: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    allowNull: false,
  },
  processing_stage: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
}, {
  tableName: 'episodes',
  timestamps: true,
  underscored: true,
  paranoid: true,
  deletedAt: 'deleted_at',
  freezeTableName: true,
  indexes: [
    {
      unique: true,
      fields: ['movie_id', 'episode_number'],
    },
    {
      fields: ['movie_id'],
    },
    {
      fields: ['status'],
    },
    {
      fields: ['publish_state'],
    },
    {
      fields: ['deleted_at'],
    },
  ],
});

export default Episode;