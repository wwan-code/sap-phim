/**
 * @file admin-wallet.routes.js
 * @module Modules_Wallet_Routes
 * @description Định tuyến API quản lý ví người dùng cho Admin Dashboard. Tinh chỉnh phân quyền RBAC.
 */

import express from "express";
import {
  getWalletsAdmin,
  getWalletStatsAdmin,
  getAllTransactionsAdmin,
  getUserWalletTransactionsAdmin,
  adjustBalanceAdmin,
  lockWalletAdmin,
  unlockWalletAdmin,
} from "../controllers/admin-wallet.controller.js";
import { verifyToken, hasPermission } from "../../../middlewares/auth.middleware.js";
import { validate } from "../../../middlewares/validator.middleware.js";
import { adminAdjustBalanceSchema, adminLockWalletSchema } from "../validators/wallet.validator.js";

const router = express.Router();

router.use("/admin/wallets", verifyToken, hasPermission("admin.access"));

// Thống kê tài chính & số dư ví toàn hệ thống
router.get("/admin/wallets/stats", hasPermission("wallet.view"), getWalletStatsAdmin);

// Lịch sử giao dịch dòng tiền toàn hệ thống
router.get("/admin/wallets/transactions", hasPermission("wallet.view"), getAllTransactionsAdmin);

// Lịch sử giao dịch ví của 1 người dùng cụ thể
router.get("/admin/wallets/:userId/transactions", hasPermission("wallet.view"), getUserWalletTransactionsAdmin);

// Xem danh sách ví người dùng (Moderator, Admin, Boss)
router.get("/admin/wallets", hasPermission("wallet.view"), getWalletsAdmin);

// Thao tác cộng/trừ xu thủ công (Admin, Boss)
router.post("/admin/wallets/adjust", hasPermission("wallet.adjust"), validate(adminAdjustBalanceSchema), adjustBalanceAdmin);

// Thao tác khóa/mở khóa ví (Admin, Boss)
router.post("/admin/wallets/:userId/lock", hasPermission("wallet.lock"), validate(adminLockWalletSchema), lockWalletAdmin);
router.post("/admin/wallets/:userId/unlock", hasPermission("wallet.unlock"), unlockWalletAdmin);

export default router;
