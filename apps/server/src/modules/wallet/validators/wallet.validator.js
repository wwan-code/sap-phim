/**
 * @file wallet.validator.js
 * @module Modules_Wallet_Validators
 * @description Validator Joi cho các yêu cầu liên quan đến Ví tiền (Wallet).
 */

import Joi from "joi";

export const requestWithdrawalSchema = Joi.object({
  lcoin_amount: Joi.number().integer().min(10).max(100000).required().messages({
    "number.base": "Số S-Coin phải là một số nguyên",
    "number.integer": "Số S-Coin phải là số nguyên",
    "number.min": "Số S-Coin rút tối thiểu là 10 S-Coin (10,000 VND)",
    "number.max": "Số S-Coin rút tối đa mỗi lần là 100,000 S-Coin",
    "any.required": "Vui lòng nhập số S-Coin cần rút",
  }),
  bank_id: Joi.string().trim().max(30).required().messages({
    "string.empty": "Vui lòng chọn ngân hàng nhận tiền",
    "any.required": "Mã ngân hàng là bắt buộc",
  }),
  bank_name: Joi.string().trim().max(100).required().messages({
    "string.empty": "Tên ngân hàng không được để trống",
    "any.required": "Tên ngân hàng là bắt buộc",
  }),
  account_number: Joi.string().trim().min(4).max(50).required().messages({
    "string.empty": "Vui lòng nhập số tài khoản ngân hàng",
    "any.required": "Số tài khoản là bắt buộc",
  }),
  account_holder: Joi.string().trim().min(2).max(100).required().messages({
    "string.empty": "Vui lòng nhập tên chủ tài khoản",
    "any.required": "Tên chủ tài khoản là bắt buộc",
  }),
});

export const adminAdjustBalanceSchema = Joi.object({
  user_id: Joi.string().uuid().optional(),
  userId: Joi.string().uuid().optional(),
  amount: Joi.number().integer().not(0).required().messages({
    "number.base": "Số S-Coin điều chỉnh phải là số",
    "number.not": "Số S-Coin điều chỉnh phải khác 0",
    "any.required": "Số S-Coin điều chỉnh là bắt buộc",
  }),
  type: Joi.string().valid("admin_credit", "admin_debit", "bonus").required().messages({
    "any.only": "Loại điều chỉnh phải là admin_credit, admin_debit hoặc bonus",
    "any.required": "Loại điều chỉnh là bắt buộc",
  }),
  description: Joi.string().trim().max(500),
  reason: Joi.string().trim().max(500),
})
  .or("user_id", "userId")
  .or("description", "reason")
  .messages({
    "object.missing": "Vui lòng cung cấp đầy đủ ID người dùng và lý do điều chỉnh",
  });

export const adminLockWalletSchema = Joi.object({
  reason: Joi.string().trim().max(500).required().messages({
    "string.empty": "Vui lòng nhập lý do khoá ví tiền",
    "any.required": "Lý do khoá ví là bắt buộc",
  }),
});
