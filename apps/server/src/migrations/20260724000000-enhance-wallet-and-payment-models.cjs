/**
 * @file 20260724000000-enhance-wallet-and-payment-models.cjs
 * @module Migrations_Wallet_Payment
 * @description Migration bổ sung các thuộc tính và mở rộng ENUM cho 3 Database Models: Wallet, WalletTransaction, PaymentRequest.
 */

"use strict";

const tableExists = async (queryInterface, tableName) => {
  try {
    await queryInterface.describeTable(tableName);
    return true;
  } catch {
    return false;
  }
};

const columnExists = async (queryInterface, tableName, columnName) => {
  try {
    const table = await queryInterface.describeTable(tableName);
    return !!table[columnName];
  } catch {
    return false;
  }
};

const addColumnIfMissing = async (queryInterface, tableName, columnName, definition) => {
  if (await tableExists(queryInterface, tableName) && !(await columnExists(queryInterface, tableName, columnName))) {
    await queryInterface.addColumn(tableName, columnName, definition);
  }
};

const removeColumnIfExists = async (queryInterface, tableName, columnName) => {
  if (await tableExists(queryInterface, tableName) && (await columnExists(queryInterface, tableName, columnName))) {
    await queryInterface.removeColumn(tableName, columnName);
  }
};

module.exports = {
  async up(queryInterface, Sequelize) {
    const { DataTypes } = Sequelize;

    // ─────────────────────────────────────────────────────────────
    // 1. Cập nhật bảng 'wallets'
    // Bổ sung: hold_balance, total_withdrawn
    // ─────────────────────────────────────────────────────────────
    await addColumnIfMissing(queryInterface, "wallets", "hold_balance", {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: "Số dư S-Coin tạm giữ cho giao dịch/rút tiền",
    });

    await addColumnIfMissing(queryInterface, "wallets", "total_withdrawn", {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: "Tổng số S-Coin đã rút thành công",
    });

    // ─────────────────────────────────────────────────────────────
    // 2. Cập nhật bảng 'wallet_transactions'
    // Bổ sung: hold_balance_before, hold_balance_after
    // Mở rộng Enum 'type' thêm withdrawal_hold, withdrawal_complete, withdrawal_refund
    // ─────────────────────────────────────────────────────────────
    await addColumnIfMissing(queryInterface, "wallet_transactions", "hold_balance_before", {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: "Số dư tạm giữ trước khi giao dịch",
    });

    await addColumnIfMissing(queryInterface, "wallet_transactions", "hold_balance_after", {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: "Số dư tạm giữ sau khi giao dịch",
    });

    // Cập nhật Postgres Enum values nếu dùng PostgreSQL
    try {
      await queryInterface.sequelize.query(
        "ALTER TYPE enum_wallet_transactions_type ADD VALUE IF NOT EXISTS 'withdrawal_hold';"
      );
      await queryInterface.sequelize.query(
        "ALTER TYPE enum_wallet_transactions_type ADD VALUE IF NOT EXISTS 'withdrawal_complete';"
      );
      await queryInterface.sequelize.query(
        "ALTER TYPE enum_wallet_transactions_type ADD VALUE IF NOT EXISTS 'withdrawal_refund';"
      );
    } catch (err) {
      // Bỏ qua lỗi nếu database không phải PostgreSQL hoặc Enum đã được cập nhật
    }

    // ─────────────────────────────────────────────────────────────
    // 3. Cập nhật bảng 'payment_requests'
    // Bổ sung: type ('topup', 'withdrawal'), lcoin_amount
    // ─────────────────────────────────────────────────────────────
    if (!(await columnExists(queryInterface, "payment_requests", "type"))) {
      try {
        await queryInterface.sequelize.query(
          "CREATE TYPE enum_payment_requests_type AS ENUM ('topup', 'withdrawal');"
        );
      } catch (err) {
        // Type may already exist
      }

      await queryInterface.sequelize.query(
        'ALTER TABLE "payment_requests" ADD COLUMN "type" enum_payment_requests_type NOT NULL DEFAULT \'topup\';'
      );
    }

    await addColumnIfMissing(queryInterface, "payment_requests", "lcoin_amount", {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: "Số lượng S-Coin quy đổi",
    });
  },

  async down(queryInterface) {
    // Hoàn tác các thay đổi trên payment_requests
    await removeColumnIfExists(queryInterface, "payment_requests", "lcoin_amount");
    await removeColumnIfExists(queryInterface, "payment_requests", "type");

    // Hoàn tác các thay đổi trên wallet_transactions
    await removeColumnIfExists(queryInterface, "wallet_transactions", "hold_balance_after");
    await removeColumnIfExists(queryInterface, "wallet_transactions", "hold_balance_before");

    // Hoàn tác các thay đổi trên wallets
    await removeColumnIfExists(queryInterface, "wallets", "total_withdrawn");
    await removeColumnIfExists(queryInterface, "wallets", "hold_balance");
  },
};
