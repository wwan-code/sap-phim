/**
 * @file 20261019000000-create-ai-jobs.cjs
 * @module Migrations_AIJobs
 * @description Bổ sung lưu trữ job AI và ràng buộc chống trùng mà không sửa các audit hiện có.
 */

'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.createTable('ai_jobs', {
        id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
        job_id: { type: Sequelize.STRING(100), allowNull: false, unique: true },
        request_id: { type: Sequelize.UUID, allowNull: false },
        user_id: {
          type: Sequelize.UUID, allowNull: false,
          references: { model: 'users', key: 'id' }, onDelete: 'CASCADE',
        },
        target: { type: Sequelize.JSONB, allowNull: false },
        fingerprint: { type: Sequelize.STRING(64), allowNull: false },
        request_payload: { type: Sequelize.JSONB, allowNull: false },
        status: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'queued' },
        stage: { type: Sequelize.STRING(64), allowNull: false, defaultValue: 'QUEUED' },
        progress: { type: Sequelize.FLOAT, allowNull: false, defaultValue: 0 },
        attempt: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
        sequence: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
        provider_request_count: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
        provider_pass_count: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
        result: { type: Sequelize.JSONB, allowNull: true },
        error: { type: Sequelize.JSONB, allowNull: true },
        review: { type: Sequelize.JSONB, allowNull: true },
        started_at: { type: Sequelize.DATE, allowNull: true },
        completed_at: { type: Sequelize.DATE, allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: false },
        updated_at: { type: Sequelize.DATE, allowNull: false },
      }, { transaction });
      // sequelize.sync ở môi trường dev có thể đã tạo bảng trước khi CLI ghi migration.
      const columns = await queryInterface.describeTable('ai_jobs', { transaction });
      if (!columns.review) await queryInterface.addColumn('ai_jobs', 'review', { type: Sequelize.JSONB, allowNull: true }, { transaction });
      const references = await queryInterface.getForeignKeyReferencesForTable('ai_jobs', { transaction });
      if (!references.some((reference) => reference.columnName === 'user_id' && reference.referencedTableName === 'users')) {
        await queryInterface.addConstraint('ai_jobs', { fields: ['user_id'], type: 'foreign key', name: 'ai_jobs_user_id_fkey',
          references: { table: 'users', field: 'id' }, onDelete: 'CASCADE', transaction });
      }
      const indexes = new Set((await queryInterface.showIndex('ai_jobs', { transaction })).map((index) => index.name));
      if (!indexes.has('ai_jobs_owner_request_unique')) await queryInterface.addIndex('ai_jobs', ['user_id', 'request_id'], {
        unique: true, name: 'ai_jobs_owner_request_unique', transaction,
      });
      if (!indexes.has('ai_jobs_active_fingerprint_unique')) await queryInterface.addIndex('ai_jobs', ['user_id', 'fingerprint'], {
        unique: true, name: 'ai_jobs_active_fingerprint_unique',
        where: { status: { [Sequelize.Op.in]: ['queued', 'processing'] } }, transaction,
      });
      if (!indexes.has('ai_jobs_user_id_created_at')) await queryInterface.addIndex('ai_jobs', ['user_id', 'created_at'], { transaction });
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('ai_jobs');
  },
};
