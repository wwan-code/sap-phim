/**
 * @file payment-request.validator.js
 * @module Modules_Payment_Validators
 * @description Validator Joi cho các yêu cầu thanh toán (PaymentRequest).
 */

import Joi from "joi";

export const createTopupRequestSchema = Joi.object({
  lcoin_amount: Joi.number().integer().min(10).max(1000000).required().messages({
    "number.base": "Số S-Coin nạp phải là số nguyên",
    "number.min": "Số S-Coin nạp tối thiểu là 10 S-Coin (10,000 VND)",
    "number.max": "Số S-Coin nạp tối đa mỗi lần là 1,000,000 S-Coin",
    "any.required": "Vui lòng nhập số S-Coin muốn nạp",
  }),
  gateway: Joi.string().valid("VietQR", "MoMo", "VNPay").default("VietQR"),
  plan_id: Joi.string().uuid().optional().allow(null, ""),
});

export const adminProcessPaymentRequestSchema = Joi.object({
  status: Joi.string().valid("approved", "rejected").required().messages({
    "any.only": "Trạng thái xử lý phải là approved hoặc rejected",
    "any.required": "Trạng thái xử lý là bắt buộc",
  }),
  rejection_reason: Joi.string().trim().max(500).when("status", {
    is: "rejected",
    then: Joi.required().messages({
      "string.empty": "Vui lòng nhập lý do từ chối yêu cầu thanh toán",
      "any.required": "Lý do từ chối là bắt buộc khi không phê duyệt",
    }),
    otherwise: Joi.optional().allow(null, ""),
  }),
});
