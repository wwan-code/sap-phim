/**
 * @file base-payment.adapter.js
 * @module Modules_Payment_Adapters
 * @description Lớp cơ sở (Base Adapter) định nghĩa giao diện chung cho tất cả các cổng thanh toán.
 */

export class BasePaymentAdapter {
  constructor(gatewayName) {
    this.gatewayName = gatewayName;
  }

  /**
   * Tạo URL/Thông tin thanh toán cho khách hàng
   * @param {Object} params - Thông tin giao dịch
   * @returns {Promise<Object>} Object chứa qr_code_url, pay_url, v.v.
   */
  async createPaymentUrl(params) {
    throw new Error(`[Adapter][${this.gatewayName}] createPaymentUrl chưa được triển khai.`);
  }

  /**
   * Xác thực Chữ ký / Webhook payload từ cổng thanh toán
   * @param {Object} payload - Dữ liệu webhook gửi về
   * @returns {boolean}
   */
  verifyWebhook(payload) {
    throw new Error(`[Adapter][${this.gatewayName}] verifyWebhook chưa được triển khai.`);
  }
}

export default BasePaymentAdapter;
