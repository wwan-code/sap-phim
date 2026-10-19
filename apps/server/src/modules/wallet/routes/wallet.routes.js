/**
 * @file wallet.routes.js
 * @module Modules_Wallet_Routes
 * @description Định tuyến API ví tiền cá nhân cho người dùng.
 */

import express from "express";
import { getMyWallet, getMyTransactions, requestWithdrawal } from "../controllers/wallet.controller.js";
import { verifyToken } from "../../../middlewares/auth.middleware.js";
import { validate } from "../../../middlewares/validator.middleware.js";
import { requestWithdrawalSchema } from "../validators/wallet.validator.js";

const router = express.Router();

router.use("/wallets", verifyToken);

router.get("/wallets/me", getMyWallet);
router.get("/wallets/me/transactions", getMyTransactions);
router.post("/wallets/me/withdraw", validate(requestWithdrawalSchema), requestWithdrawal);

export default router;
