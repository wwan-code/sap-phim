/**
 * @file admin-notification.routes.js
 * @module Modules_Notification_Routes
 * @description Định tuyến các API dành cho Quản trị viên quản lý thông báo của toàn bộ hệ thống. Tinh chỉnh phân quyền RBAC.
 */

import express from "express";
import { notificationController } from "../controllers/notification.controller.js";
import { verifyToken, hasPermission } from "../../../middlewares/auth.middleware.js";
import { validateQuery, validate } from "../../../middlewares/validator.middleware.js";
import { notificationValidator } from "../validators/notification.validator.js";

const router = express.Router();

router.use("/admin/notifications", verifyToken, hasPermission("admin.access"));

// ── ADMIN ENDPOINTS (notifications.manage - Admin, Boss) ──
router.get(
  "/admin/notifications/stats",
  hasPermission("notifications.manage"),
  notificationController.adminGetStats,
);
router.get(
  "/admin/notifications",
  hasPermission("notifications.manage"),
  validateQuery(notificationValidator.adminGetAll),
  notificationController.adminGetAll,
);
router.post(
  "/admin/notifications/bulk-delete",
  hasPermission("notifications.manage"),
  validate(notificationValidator.adminBulkDelete),
  notificationController.adminBulkDelete,
);
router.delete("/admin/notifications/:id", hasPermission("notifications.manage"), notificationController.adminDelete);

export default router;
