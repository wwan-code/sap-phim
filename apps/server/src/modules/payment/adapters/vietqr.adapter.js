/**
 * @file vietqr.adapter.js
 * @module Modules_Payment_Adapters
 * @description Adapter tạo mã VietQR động cho chuyển khoản ngân hàng Việt Nam.
 */

import { BasePaymentAdapter } from "./base-payment.adapter.js";

// Thông tin ngân hàng mặc định của hệ thống
export const DEFAULT_BANK_CONFIG = {
  BANK_ID: "MB", // MBBank
  BANK_NAME: "Ngân hàng TMCP Quân Đội (MBBank)",
  ACCOUNT_NUMBER: "9999999999",
  ACCOUNT_HOLDER: "SAP ANIME MEDIA CO LTD",
};

export class VietQRAdapter extends BasePaymentAdapter {
  constructor(bankConfig = DEFAULT_BANK_CONFIG) {
    super("VietQR");
    this.bankConfig = bankConfig;
  }

  /**
   * Tạo đường dẫn ảnh VietQR động chuẩn hóa dựa trên VietQR API Spec
   * @param {Object} params
   * @param {number} params.amount - Số tiền VND
   * @param {string} params.transactionCode - Mã nội dung chuyển khoản
   * @returns {Promise<Object>}
   */
  async createPaymentUrl({ amount, transactionCode }) {
    const { BANK_ID, ACCOUNT_NUMBER, ACCOUNT_HOLDER, BANK_NAME } = this.bankConfig;

    // URL format theo chuẩn VietQR Image Service (compact2)
    const encodedHolder = encodeURIComponent(ACCOUNT_HOLDER);
    const encodedMemo = encodeURIComponent(transactionCode);
    const qrCodeUrl = `https://img.vietqr.io/image/${BANK_ID}-${ACCOUNT_NUMBER}-compact2.png?amount=${amount}&addInfo=${encodedMemo}&accountName=${encodedHolder}`;

    return {
      gateway: "VietQR",
      qr_code_url: qrCodeUrl,
      bank_id: BANK_ID,
      bank_name: BANK_NAME,
      account_number: ACCOUNT_NUMBER,
      account_holder: ACCOUNT_HOLDER,
      transaction_code: transactionCode,
    };
  }

  /**
   * VietQR ngân hàng thường nhận đối soát qua hệ thống ngân hàng hoặc Webhook SePAY/Casso.
   */
  verifyWebhook(payload) {
    return true;
  }
}

export const vietQRAdapter = new VietQRAdapter();
export default vietQRAdapter;
