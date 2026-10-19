/**
 * @file ai-audit-log.model.js
 * @module Model_AIAuditLog
 * @description Model Sequelize cho bảng ai_audit_logs ghi nhận vết kiểm toán, hiệu năng và chi phí của AI DataOps.
 */

import { DataTypes } from "sequelize";
import { sequelize } from "../config/database.config.js";

/**
 * @model AIAuditLog
 * @description Lưu vết kiểm toán cho các tác vụ AI: tokens, chi phí, latency, evidence snapshot và provenance.
 */
const AIAuditLog = sequelize.define(
  "AIAuditLog",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    job_id: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: "Mã định danh Job BullMQ",
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: "users",
        key: "id",
      },
      onDelete: "SET NULL",
      comment: "ID người dùng thực hiện yêu cầu AI",
    },
    query_title: {
      type: DataTypes.STRING(500),
      allowNull: false,
      comment: "Tiêu đề tác phẩm đầu vào",
    },
    query_year: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "Năm phát hành đầu vào (nếu có)",
    },
    query_type: {
      type: DataTypes.STRING(50),
      allowNull: true,
      defaultValue: "all",
      comment: "Loại nội dung cần gợi ý (all, metadata, cast, synopsis)",
    },
    provider: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: "gemini",
      comment: "Nhà cung cấp AI thực thi (gemini, openrouter)",
    },
    model: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: "Mã model AI thực thi",
    },
    prompt_version: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "v1.2.0",
      comment: "Phiên bản Prompt template",
    },
    prompt_tokens: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0,
    },
    completion_tokens: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0,
    },
    total_tokens: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0,
    },
    estimated_cost_usd: {
      type: DataTypes.DECIMAL(10, 6),
      allowNull: true,
      defaultValue: 0.000000,
      comment: "Chi phí ước tính bằng USD",
    },
    latency_ms: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0,
      comment: "Tổng thời gian thực thi (ms)",
    },
    stage_timings: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {},
      comment: "Chi tiết độ trễ từng stage (evidence, matching, llm, audit)",
    },
    status: {
      type: DataTypes.ENUM("pending", "completed", "failed", "dlq"),
      allowNull: false,
      defaultValue: "pending",
      comment: "Trạng thái Job kiểm toán",
    },
    confidence_score: {
      type: DataTypes.FLOAT,
      allowNull: true,
      defaultValue: 0.0,
      comment: "Điểm tin cậy tổng thể (0.0 - 1.0)",
    },
    confidence_breakdown: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {},
      comment: "Chi tiết tính điểm tin cậy toán học (consensus, presence, penalty...)",
    },
    conflicts: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: [],
      comment: "Danh sách mâu thuẫn dữ liệu đa nguồn được phát hiện",
    },
    flags: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: [],
      comment: "Danh sách cờ cảnh báo kiểm toán (Heuristics & Anti-Hallucination)",
    },
    field_provenance: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {},
      comment: "Cây phả hệ nguồn gốc cho từng trường dữ liệu",
    },
    evidence_snapshot: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {},
      comment: "Ảnh chụp bằng chứng thô từ các API nguồn",
    },
    error_code: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: "Mã lỗi nếu thất bại",
    },
    error_message: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Chi tiết lỗi",
    },
    circuit_breaker_tripped: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: "Có kích hoạt Circuit Breaker chuyển nhà cung cấp không",
    },
  },
  {
    tableName: "ai_audit_logs",
    timestamps: true,
    underscored: true,
    indexes: [
      {
        fields: ["job_id"],
      },
      {
        fields: ["user_id"],
      },
      {
        fields: ["status"],
      },
      {
        fields: ["created_at"],
      },
    ],
  }
);

export default AIAuditLog;
