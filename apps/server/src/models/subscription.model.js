/**
 * @file subscription.model.js
 * @module Model_Subscription
 * @description Model Sequelize cho bảng subscriptions.
 */

import { DataTypes } from "sequelize";
import sequelize from "../config/database.config.js";

/**
 * @model Subscription
 *
 * @property {UUID} id - ID duy nhất của bản ghi đăng ký
 * @property {UUID} user_id - ID người dùng sở hữu gói
 * @property {UUID} plan_id - ID gói hội viên tương ứng
 * @property {string} tier - Cấp độ gói snapshot (plus, pro, ultra)
 * @property {string} billing_cycle - Chu kỳ thanh toán (monthly, yearly)
 * @property {string} status - Trạng thái (active, expired, cancelled, pending)
 * @property {number} amount - Giá gốc của gói tại thời điểm đăng ký (VND)
 * @property {number} amount_paid - Số tiền thực tế đã thanh toán (VND)
 * @property {string} currency - Đơn vị tiền tệ (mặc định VND)
 * @property {string} payment_method - Phương thức thanh toán (wallet, bank_transfer...)
 * @property {string} transaction_id - Mã giao dịch liên kết
 * @property {Date} starts_at - Thời điểm gói bắt đầu có hiệu lực
 * @property {Date} expires_at - Thời điểm gói hết hạn
 * @property {Date} cancelled_at - Thời điểm hủy gói (nếu có)
 * @property {boolean} auto_renew - Trạng thái tự động gia hạn
 * @property {Object} metadata - Dữ liệu bổ sung dưới dạng JSONB
 */
const Subscription = sequelize.define(
  "Subscription",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: "users",
        key: "id",
      },
      comment: "Chủ sở hữu gói đăng ký",
    },

    // Thông tin gói và cấp độ
    plan_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: "membership_plans",
        key: "id",
      },
      comment: "Liên kết đến gói hội viên gốc",
    },
    tier: {
      type: DataTypes.ENUM("free", "plus", "pro", "ultra"),
      allowNull: false,
      comment: "Cấp độ hội viên tại thời điểm đăng ký",
    },
    billing_cycle: {
      type: DataTypes.ENUM("monthly", "yearly"),
      defaultValue: "monthly",
      allowNull: false,
      comment: "Chu kỳ thanh toán",
    },

    // Trạng thái
    status: {
      type: DataTypes.ENUM("active", "expired", "cancelled", "grace_period", "suspended", "pending"),
      defaultValue: "active",
      allowNull: false,
      comment: "Trạng thái: đang hoạt động, hết hạn, đã hủy, gia hạn (grace_period), tạm dừng, chờ xử lý",
    },

    // Thanh toán
    amount: {
      type: DataTypes.DECIMAL(12, 0),
      allowNull: true,
      comment: "Giá gói tại thời điểm đăng ký",
    },
    amount_paid: {
      type: DataTypes.DECIMAL(14, 0),
      defaultValue: 0,
      allowNull: false,
      comment: "Tổng số tiền thực tế đã chi trả",
    },
    currency: {
      type: DataTypes.STRING(3),
      defaultValue: "VND",
    },
    payment_method: {
      type: DataTypes.ENUM(
        "wallet",
        "bank_transfer",
        "momo",
        "vnpay",
        "free",
        "admin_grant",
      ),
      allowNull: true,
      comment: "Phương thức thanh toán đã sử dụng",
    },
    transaction_id: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: "Mã giao dịch từ bên thanh toán",
    },

    // Thời gian
    starts_at: {
      type: DataTypes.DATE,
      allowNull: false,
      comment: "Thời điểm bắt đầu hiệu lực",
    },
    expires_at: {
      type: DataTypes.DATE,
      allowNull: false,
      comment: "Thời điểm hết hạn gói",
    },
    cancelled_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "Thời điểm thực hiện hủy gói",
    },

    // Cài đặt
    auto_renew: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      comment: "Đánh dấu tự động gia hạn",
    },

    // Dữ liệu bổ sung
    metadata: {
      type: DataTypes.JSONB,
      defaultValue: {},
      comment: "Thông tin kỹ thuật bổ sung",
    },
  },
  {
    tableName: "subscriptions",
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ["user_id"] },
      { fields: ["plan_id"] },
      { fields: ["status"] },
      { fields: ["tier"] },
      { fields: ["expires_at"] },
      { fields: ["user_id", "status", "expires_at"] },
    ],
  },
);

export default Subscription;

