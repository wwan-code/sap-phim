/**
 * @file vnpay.adapter.js
 * @module Modules_Payment_Adapters
 * @description Mock Adapter cho cổng thanh toán VNPay.
 */

import { BasePaymentAdapter } from "./base-payment.adapter.js";

export class VNPayAdapter extends BasePaymentAdapter {
  constructor() {
    super("VNPay");
  }

  async createPaymentUrl({ amount, transactionCode }) {
    return {
      gateway: "VNPay",
      pay_url: `https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?vnp_TxnRef=${transactionCode}`,
      qr_code_url: `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=VNPAY_${transactionCode}`,
      transaction_code: transactionCode,
    };
  }

  verifyWebhook(payload) {
    return true;
  }
}

export const vnPayAdapter = new VNPayAdapter();
export default vnPayAdapter;
