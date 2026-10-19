/**
 * @file ai-job.model.js
 * @module Models_AIJob
 * @description Bản ghi chuẩn cho yêu cầu AI, quyền sở hữu, tiến trình và kết quả có thể khôi phục.
 */

import { DataTypes, Op } from 'sequelize';

import { sequelize } from '../config/database.config.js';

const AIJob = sequelize.define('AIJob', {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  job_id: { type: DataTypes.STRING(100), allowNull: false, unique: true },
  request_id: { type: DataTypes.UUID, allowNull: false },
  user_id: { type: DataTypes.UUID, allowNull: false, references: { model: 'users', key: 'id' }, onDelete: 'CASCADE' },
  target: { type: DataTypes.JSONB, allowNull: false },
  fingerprint: { type: DataTypes.STRING(64), allowNull: false },
  request_payload: { type: DataTypes.JSONB, allowNull: false },
  status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'queued' },
  stage: { type: DataTypes.STRING(64), allowNull: false, defaultValue: 'QUEUED' },
  progress: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
  attempt: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  sequence: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  provider_request_count: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  provider_pass_count: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  result: { type: DataTypes.JSONB, allowNull: true },
  error: { type: DataTypes.JSONB, allowNull: true },
  review: { type: DataTypes.JSONB, allowNull: true },
  started_at: { type: DataTypes.DATE, allowNull: true },
  completed_at: { type: DataTypes.DATE, allowNull: true },
}, {
  tableName: 'ai_jobs',
  underscored: true,
  indexes: [
    { unique: true, fields: ['user_id', 'request_id'], name: 'ai_jobs_owner_request_unique' },
    {
      unique: true, fields: ['user_id', 'fingerprint'], name: 'ai_jobs_active_fingerprint_unique',
      where: { status: { [Op.in]: ['queued', 'processing'] } },
    },
    { fields: ['user_id', 'created_at'] },
  ],
});

export default AIJob;
