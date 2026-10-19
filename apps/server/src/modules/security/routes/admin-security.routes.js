/**
 * @file admin-security.routes.js
 * @module Modules_Security_Routes
 * @description Tuyến đường API quản trị phiên đăng nhập và nhật ký bảo mật (Security & Audit Logs).
 */

import express from "express";
import { adminSessionController } from "../controllers/admin-session.controller.js";
import { adminAuditLogController } from "../controllers/admin-audit-log.controller.js";
import { verifyToken, hasPermission } from "../../../middlewares/auth.middleware.js";
import {
  validate,
  validateQuery,
  validateParams,
} from "../../../middlewares/validator.middleware.js";
import {
  sessionListQuerySchema,
  sessionIdParamSchema,
  userIdParamSchema,
  revokeAllUserSessionsSchema,
  auditLogQuerySchema,
  auditLogIdParamSchema,
} from "../validators/security.validator.js";

const router = express.Router();

// Tất cả endpoints quản trị bảo mật bắt buộc đăng nhập + quyền truy cập Admin Portal + quyền xem Audit Logs
router.use("/admin", verifyToken, hasPermission("admin.access"), hasPermission("admin.logs"));

// ── Quản lý Phiên đăng nhập (Session Management) ──

router.get(
  "/admin/sessions",
  validateQuery(sessionListQuerySchema),
  adminSessionController.getSessions
);

router.get(
  "/admin/sessions/stats",
  adminSessionController.getSessionStats
);

router.delete(
  "/admin/sessions/:sessionId",
  validateParams(sessionIdParamSchema),
  adminSessionController.revokeSession
);

router.post(
  "/admin/sessions/users/:userId/revoke-all",
  validateParams(userIdParamSchema),
  validate(revokeAllUserSessionsSchema),
  adminSessionController.revokeAllUserSessions
);

// ── Quản lý Nhật ký kiểm toán & Bảo mật (Audit Log Management) ──

router.get(
  "/admin/audit-logs",
  validateQuery(auditLogQuerySchema),
  adminAuditLogController.getAuditLogs
);

router.get(
  "/admin/audit-logs/stats",
  adminAuditLogController.getAuditLogStats
);

router.get(
  "/admin/audit-logs/export",
  validateQuery(auditLogQuerySchema),
  adminAuditLogController.exportAuditLogs
);

router.get(
  "/admin/audit-logs/:id",
  validateParams(auditLogIdParamSchema),
  adminAuditLogController.getAuditLogDetail
);

export default router;
