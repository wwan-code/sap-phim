/**
 * @file 20260901000000-create-ai-audit-logs.cjs
 * @module Migrations
 * @description Tạo bảng ai_audit_logs ghi vết kiểm toán, token tiêu thụ, latency và provenance của AI Platform.
 */

'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    try {
      await queryInterface.sequelize.query(`
        CREATE TABLE IF NOT EXISTS ai_audit_logs (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          job_id VARCHAR(100) NOT NULL,
          user_id UUID REFERENCES users(id) ON DELETE SET NULL,
          query_title VARCHAR(500) NOT NULL,
          query_year INTEGER DEFAULT NULL,
          query_type VARCHAR(50) DEFAULT 'all',
          provider VARCHAR(50) NOT NULL DEFAULT 'gemini',
          model VARCHAR(100) NOT NULL,
          prompt_version VARCHAR(20) NOT NULL DEFAULT 'v1.2.0',
          prompt_tokens INTEGER DEFAULT 0,
          completion_tokens INTEGER DEFAULT 0,
          total_tokens INTEGER DEFAULT 0,
          estimated_cost_usd DECIMAL(10, 6) DEFAULT 0.000000,
          latency_ms INTEGER DEFAULT 0,
          stage_timings JSONB DEFAULT '{}'::jsonb,
          status VARCHAR(20) NOT NULL DEFAULT 'pending',
          confidence_score FLOAT DEFAULT 0.0,
          field_provenance JSONB DEFAULT '{}'::jsonb,
          evidence_snapshot JSONB DEFAULT '{}'::jsonb,
          error_code VARCHAR(100) DEFAULT NULL,
          error_message TEXT DEFAULT NULL,
          circuit_breaker_tripped BOOLEAN NOT NULL DEFAULT false,
          created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_ai_audit_logs_job_id ON ai_audit_logs(job_id);
        CREATE INDEX IF NOT EXISTS idx_ai_audit_logs_user_id ON ai_audit_logs(user_id);
        CREATE INDEX IF NOT EXISTS idx_ai_audit_logs_status ON ai_audit_logs(status);
        CREATE INDEX IF NOT EXISTS idx_ai_audit_logs_created_at ON ai_audit_logs(created_at);
      `);
      console.log('[Migration] Successfully created ai_audit_logs table and indexes');
    } catch (error) {
      console.error('[Migration] Failed to create ai_audit_logs table:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    try {
      await queryInterface.sequelize.query(`
        DROP TABLE IF EXISTS ai_audit_logs CASCADE;
      `);
      console.log('[Migration] Successfully dropped ai_audit_logs table');
    } catch (error) {
      console.error('[Migration] Failed to drop ai_audit_logs table:', error);
    }
  }
};
