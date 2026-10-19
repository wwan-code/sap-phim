/**
 * @file wallet-transaction.model.js
 * @module Model_WalletTransaction
 * @description Model Sequelize cho bảng wallet_transactions.
 */

import { DataTypes } from "sequelize";
import sequelize from "../config/database.config.js";

/**
 * @model WalletTransaction
 *
 * @property {UUID} id - ID duy nhất của giao dịch
 * @property {UUID} wallet_id - ID ví thực hiện giao dịch
 * @property {UUID} user_id - ID người dùng sở hữu ví
 * @property {string} type - Loại giao dịch (deposit, purchase, refund...)
 * @property {number} amount - Số lượng S-Coin giao dịch
 * @property {number} balance_before - Số dư ví trước khi thực hiện
 * @property {number} balance_after - Số dư ví sau khi thực hiện
 * @property {string} status - Trạng thái (pending, completed, failed...)
 * @property {string} description - Mô tả nội dung giao dịch
 * @property {string} reference_type - Loại thực thể tham chiếu
 * @property {UUID} reference_id - ID thực thể tham chiếu
 * @property {number} vnd_amount - Giá trị VND tương ứng (cho nạp tiền)
 * @property {UUID} performed_by - ID Admin thực hiện thao tác
 * @property {JSONB} metadata - Dữ liệu bổ sung
 */
const WalletTransaction = sequelize.define(
  "WalletTransaction",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    wallet_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: "wallets",
        key: "id",
      },
      comment: "Ví thực hiện giao dịch",
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: "users",
        key: "id",
      },
      comment: "Người dùng sở hữu giao dịch",
    },

    // Phân loại giao dịch
    type: {
      type: DataTypes.ENUM(
        "deposit",
        "purchase",
        "refund",
        "bonus",
        "admin_credit",
        "admin_debit",
        "withdrawal_hold",
        "withdrawal_complete",
        "withdrawal_refund"
      ),
      allowNull: false,
      comment: "Hướng biến động: Nạp, Mua, Hoàn, Thưởng, Admin điều chỉnh, Giữ xu rút, Rút thành công, Hoàn xu rút",
    },

    // Số tiền và kiểm soát số dư
    amount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "Số lượng S-Coin biến động",
    },
    balance_before: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "Số dư ví trước khi giao dịch (snapshot)",
    },
    balance_after: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "Số dư ví sau khi giao dịch (snapshot)",
    },
    hold_balance_before: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false,
      comment: "Số dư tạm giữ trước khi giao dịch",
    },
    hold_balance_after: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false,
      comment: "Số dư tạm giữ sau khi giao dịch",
    },

    // Trạng thái và mô tả
    status: {
      type: DataTypes.ENUM("pending", "completed", "failed", "cancelled"),
      defaultValue: "completed",
      comment: "Trạng thái hiện tại của giao dịch",
    },
    description: {
      type: DataTypes.STRING(500),
      allowNull: true,
      comment: "Mô tả chi tiết nội dung giao dịch",
    },

    // Tham chiếu nguồn gốc
    reference_type: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: "Loại đối tượng liên quan (Ví dụ: subscription)",
    },
    reference_id: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: "ID đối tượng liên quan",
    },

    // Thông tin đối soát tài chính
    vnd_amount: {
      type: DataTypes.DECIMAL(15, 0),
      allowNull: true,
      comment: "Giá trị tiền mặt tương đương tại thời điểm nạp",
    },
    performed_by: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: "Quản trị viên thực hiện (nếu có)",
    },

    // Dữ liệu mở rộng
    metadata: {
      type: DataTypes.JSONB,
      defaultValue: {},
      comment: "Thông tin kỹ thuật bổ sung",
    },
  },
  {
    tableName: "wallet_transactions",
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ["wallet_id"] },
      { fields: ["user_id"] },
      { fields: ["type"] },
      { fields: ["status"] },
      { fields: ["reference_type", "reference_id"] },
      { fields: ["created_at"] },
    ],
  },
);

export default WalletTransaction;

