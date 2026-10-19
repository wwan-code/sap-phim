/**
 * @file admin-payment-request.routes.js
 * @module Modules_Payment_Routes
 * @description Định tuyến API quản lý Yêu cầu Thanh toán cho Admin Dashboard. Tinh chỉnh phân quyền RBAC.
 */

import express from "express";
import {
  getPaymentRequestsAdmin,
  processPaymentRequestAdmin,
  getPaymentRequestStatsAdmin,
} from "../controllers/admin-payment-request.controller.js";
import { verifyToken, hasPermission } from "../../../middlewares/auth.middleware.js";
import { validate } from "../../../middlewares/validator.middleware.js";
import { adminProcessPaymentRequestSchema } from "../validators/payment-request.validator.js";

const router = express.Router();

router.use("/admin/payment-requests", verifyToken, hasPermission("admin.access"));

// Thống kê tài chính yêu cầu thanh toán (Moderator, Admin, Boss)
router.get("/admin/payment-requests/stats", hasPermission("payment.view"), getPaymentRequestStatsAdmin);

// Xem danh sách yêu cầu thanh toán (Moderator, Admin, Boss)
router.get("/admin/payment-requests", hasPermission("payment.view"), getPaymentRequestsAdmin);

// Xử lý Phê duyệt / Từ chối thanh toán (Admin, Boss)
router.post("/admin/payment-requests/:id/process", hasPermission("payment.approve"), validate(adminProcessPaymentRequestSchema), processPaymentRequestAdmin);

export default router;
