/**
 * @file 20260901000001-add-research-fields-to-ai-audit-logs.cjs
 * @module Migrations
 * @description Bổ sung các cột conflicts, flags và confidence_breakdown vào bảng ai_audit_logs cho AI Movie Research Assistant.
 */

'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    try {
      await queryInterface.sequelize.query(`
        ALTER TABLE ai_audit_logs
        ADD COLUMN IF NOT EXISTS confidence_breakdown JSONB DEFAULT '{}'::jsonb,
        ADD COLUMN IF NOT EXISTS conflicts JSONB DEFAULT '[]'::jsonb,
        ADD COLUMN IF NOT EXISTS flags JSONB DEFAULT '[]'::jsonb;
      `);
      console.log('[Migration] Successfully added research assistant columns to ai_audit_logs table');
    } catch (error) {
      console.error('[Migration] Failed to add research assistant columns:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    try {
      await queryInterface.sequelize.query(`
        ALTER TABLE ai_audit_logs
        DROP COLUMN IF EXISTS confidence_breakdown,
        DROP COLUMN IF EXISTS conflicts,
        DROP COLUMN IF EXISTS flags;
      `);
      console.log('[Migration] Successfully rolled back research assistant columns');
    } catch (error) {
      console.error('[Migration] Failed to rollback research assistant columns:', error);
    }
  }
};
