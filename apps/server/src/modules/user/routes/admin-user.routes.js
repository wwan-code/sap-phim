/**
 * @file admin-user.routes.js
 * @module Modules_User_Routes
 * @description Định tuyến các API dành cho Quản trị viên quản lý người dùng. Tinh chỉnh phân quyền RBAC theo từng Endpoint.
 */

import express from "express";
import { adminUserController } from "../controllers/admin-user.controller.js";
import { validate, validateQuery, validateParams } from "../../../middlewares/validator.middleware.js";
import { verifyToken, hasPermission } from "../../../middlewares/auth.middleware.js";
import {
  adminCreateUserSchema,
  adminUpdateUserSchema,
  adminLevelSchema,
  adminListQuerySchema,
  userIdParamSchema,
  sessionIdParamSchema,
  walletLockSchema,
  adminSubscriptionQuerySchema,
  bulkStatusSchema,
} from "../validators/user.validator.js";

const router = express.Router();

// Tất cả Admin User endpoints đều bắt buộc đăng nhập + quyền truy cập trang quản trị
router.use("/admin/users", verifyToken, hasPermission("admin.access"));

// ── ADMIN ENDPOINTS (GRANULAR RBAC PERMISSIONS) ──

// Danh sách & Chi tiết người dùng (Yêu cầu quyền users.view - Moderator, Admin, Boss)
router.get("/admin/users", hasPermission("users.view"), validateQuery(adminListQuerySchema), adminUserController.listUsers);
router.get("/admin/users/:id", hasPermission("users.view"), validateParams(userIdParamSchema), adminUserController.getUser);

// Thao tác cấm/khóa hàng loạt (Yêu cầu quyền users.ban - Moderator, Admin, Boss)
router.post("/admin/users/bulk-status", hasPermission("users.ban"), validate(bulkStatusSchema), adminUserController.bulkUpdateStatus);

// Tạo mới, Cập nhật thông tin & Thay đổi level (Yêu cầu quyền users.edit - Admin, Boss)
router.post("/admin/users", hasPermission("users.edit"), validate(adminCreateUserSchema), adminUserController.createUser);
router.patch("/admin/users/:id", hasPermission("users.edit"), validateParams(userIdParamSchema), validate(adminUpdateUserSchema), adminUserController.updateUser);
router.patch("/admin/users/:id/level", hasPermission("users.edit"), validateParams(userIdParamSchema), validate(adminLevelSchema), adminUserController.updateLevel);
router.post("/admin/users/:id/restore", hasPermission("users.edit"), validateParams(userIdParamSchema), adminUserController.restoreUser);

// ĐẶC QUYỀN XÓA TÀI KHOẢN (Chỉ dành cho Boss - Admin bị loại trừ theo Seeder)
router.delete("/admin/users/:id", hasPermission("users.delete"), validateParams(userIdParamSchema), adminUserController.deleteUser);

// Quản lý Session
router.get("/admin/users/:id/sessions", hasPermission("users.view"), validateParams(userIdParamSchema), adminUserController.listSessions);
router.delete(
  "/admin/users/:id/sessions/:sessionId",
  hasPermission("users.ban"),
  validateParams(sessionIdParamSchema),
  adminUserController.revokeSession
);

// Quản lý Ví người dùng
router.get("/admin/users/:id/wallet", hasPermission("wallet.view"), validateParams(userIdParamSchema), adminUserController.getWallet);
router.post(
  "/admin/users/:id/wallet/lock",
  hasPermission("wallet.lock"),
  validateParams(userIdParamSchema),
  validate(walletLockSchema),
  adminUserController.lockWallet
);
router.post("/admin/users/:id/wallet/unlock", hasPermission("wallet.unlock"), validateParams(userIdParamSchema), adminUserController.unlockWallet);

// Lịch sử Đăng ký dịch vụ
router.get(
  "/admin/users/:id/subscriptions",
  hasPermission("subscriptions.view"),
  validateParams(userIdParamSchema),
  validateQuery(adminSubscriptionQuerySchema),
  adminUserController.listSubscriptions
);

export default router;