/**
 * @file payment-request.model.js
 * @module Model_PaymentRequest
 * @description Model Sequelize cho bảng payment_requests.
 */

import { DataTypes } from "sequelize";
import sequelize from "../config/database.config.js";

/**
 * @model PaymentRequest
 *
 * @property {UUID} id - ID duy nhất của yêu cầu thanh toán
 * @property {UUID} user_id - ID người dùng tạo yêu cầu
 * @property {UUID} plan_id - ID gói hội viên (nếu nạp tiền để mua gói cụ thể)
 * @property {number} amount - Số tiền yêu cầu thanh toán (VND)
 * @property {string} currency - Đơn vị tiền tệ (mặc định VND)
 * @property {string} transaction_code - Mã giao dịch duy nhất dùng để đối soát chuyển khoản
 * @property {string} status - Trạng thái yêu cầu (created, pending, approved, rejected, expired)
 * @property {string} bank_id - Mã định danh ngân hàng (Snapshot)
 * @property {string} bank_name - Tên ngân hàng (Snapshot)
 * @property {string} account_number - Số tài khoản nhận tiền (Snapshot)
 * @property {string} account_holder - Chủ tài khoản nhận tiền (Snapshot)
 * @property {string} qr_code_url - Đường dẫn ảnh QR Code thanh toán
 * @property {UUID} approved_by - ID Admin thực hiện phê duyệt hoặc từ chối
 * @property {Date} approved_at - Thời điểm thực hiện phê duyệt hoặc từ chối
 * @property {string} rejection_reason - Lý do từ chối yêu cầu (nếu có)
 * @property {Date} expires_at - Thời điểm yêu cầu hết hạn thanh toán
 * @property {UUID} subscription_id - ID gói đăng ký được tạo sau khi phê duyệt (nếu có)
 * @property {Object} metadata - Dữ liệu bổ sung dưới dạng JSONB
 */
const PaymentRequest = sequelize.define(
  "PaymentRequest",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    type: {
      type: DataTypes.ENUM("topup", "withdrawal"),
      defaultValue: "topup",
      allowNull: false,
      comment: "Loại yêu cầu: Nạp tiền (topup) hoặc Rút tiền (withdrawal)",
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: "users",
        key: "id",
      },
      comment: "Người dùng thực hiện yêu cầu",
    },
    plan_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: "membership_plans",
        key: "id",
      },
      comment: "Gói hội viên muốn đăng ký (nếu có)",
    },

    // Thông tin thanh toán
    lcoin_amount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: "Số lượng S-Coin quy đổi",
    },
    amount: {
      type: DataTypes.DECIMAL(12, 0),
      allowNull: false,
      comment: "Số tiền thanh toán thực tế (VND)",
    },
    currency: {
      type: DataTypes.STRING(3),
      defaultValue: "VND",
      comment: "Đơn vị tiền tệ",
    },

    // Đối soát giao dịch
    transaction_code: {
      type: DataTypes.STRING(20),
      allowNull: false,
      unique: true,
      comment: "Mã nội dung chuyển khoản duy nhất",
    },
    status: {
      type: DataTypes.ENUM("created", "pending", "approved", "rejected", "expired"),
      defaultValue: "created",
      comment: "Trạng thái: khởi tạo, chờ duyệt, đã duyệt, từ chối, hết hạn",
    },

    // Chi tiết ngân hàng (Snapshot)
    bank_id: {
      type: DataTypes.STRING(20),
      comment: "Mã ngân hàng nhận tiền",
    },
    bank_name: {
      type: DataTypes.STRING(100),
      comment: "Tên ngân hàng nhận tiền",
    },
    account_number: {
      type: DataTypes.STRING(50),
      comment: "Số tài khoản nhận tiền",
    },
    account_holder: {
      type: DataTypes.STRING(100),
      comment: "Chủ tài khoản nhận tiền",
    },

    // Mã QR và Phê duyệt
    qr_code_url: {
      type: DataTypes.STRING(500),
      comment: "URL ảnh QR Code thanh toán",
    },
    approved_by: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: "Admin thực hiện phê duyệt",
    },
    approved_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "Thời điểm xử lý phê duyệt",
    },
    rejection_reason: {
      type: DataTypes.STRING(500),
      allowNull: true,
      comment: "Lý do từ chối nếu status = rejected",
    },

    // Thời hạn và Liên kết
    expires_at: {
      type: DataTypes.DATE,
      allowNull: false,
      comment: "Thời hạn tối đa để người dùng thực hiện chuyển khoản",
    },
    subscription_id: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: "ID đăng ký dịch vụ sau khi thanh toán thành công",
    },

    // Siêu dữ liệu
    metadata: {
      type: DataTypes.JSONB,
      defaultValue: {},
      comment: "Thông tin bổ sung liên quan đến giao dịch",
    },
  },
  {
    tableName: "payment_requests",
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ["user_id"] },
      { fields: ["status"] },
      { fields: ["transaction_code"], unique: true },
      { fields: ["expires_at"] },
    ],
  },
);

export default PaymentRequest;

