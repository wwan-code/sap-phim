/**
 * @file momo.adapter.js
 * @module Modules_Payment_Adapters
 * @description Mock Adapter cho cổng thanh toán Ví MoMo (Sẵn sàng mở rộng tích hợp SDK/API chính thức).
 */

import { BasePaymentAdapter } from "./base-payment.adapter.js";

export class MoMoAdapter extends BasePaymentAdapter {
  constructor() {
    super("MoMo");
  }

  async createPaymentUrl({ amount, transactionCode }) {
    return {
      gateway: "MoMo",
      pay_url: `https://test-payment.momo.vn/pay/order/${transactionCode}`,
      qr_code_url: `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=MOMO_PAY_${transactionCode}`,
      transaction_code: transactionCode,
    };
  }

  verifyWebhook(payload) {
    return true;
  }
}

export const moMoAdapter = new MoMoAdapter();
export default moMoAdapter;
