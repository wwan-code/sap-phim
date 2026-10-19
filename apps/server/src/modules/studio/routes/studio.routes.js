/**
 * @file studio.routes.js
 * @module Routes_Studio
 * @description Định nghĩa các route cho module hãng sản xuất (Studio).
 */

import express from "express";
import { studioController } from "../controllers/studio.controller.js";
import { validate } from "../../../middlewares/validator.middleware.js";
import { studioValidator } from "../validators/studio.validator.js";
import { verifyToken, hasPermission } from "../../../middlewares/auth.middleware.js";

const router = express.Router();

// ════════════════════════════════════════
// ADMIN ROUTES (Protected)
// ════════════════════════════════════════

/**
 * @route POST /api/admin/studios
 * @description Tạo mới hãng sản xuất
 * @access Admin
 * @permission studios.manage
 */
router.post(
  "/admin/studios",
  verifyToken,
  hasPermission("studios.manage"),
  validate(studioValidator.create),
  studioController.create
);

/**
 * @route GET /api/admin/studios
 * @description Lấy danh sách hãng sản xuất (đầy đủ)
 * @access Admin
 * @permission studios.manage
 */
router.get(
  "/admin/studios",
  verifyToken,
  hasPermission("studios.manage"),
  validate(studioValidator.getList, "query"),
  studioController.getAll
);

/**
 * @route GET /api/admin/studios/:id
 * @description Lấy thông tin hãng sản xuất theo ID
 * @access Admin
 * @permission studios.manage
 */
router.get(
  "/admin/studios/:id",
  verifyToken,
  hasPermission("studios.manage"),
  studioController.getById
);

/**
 * @route PATCH /api/admin/studios/:id
 * @description Cập nhật hãng sản xuất
 * @access Admin
 * @permission studios.manage
 */
router.patch(
  "/admin/studios/:id",
  verifyToken,
  hasPermission("studios.manage"),
  validate(studioValidator.update),
  studioController.update
);

/**
 * @route DELETE /api/admin/studios/bulk
 * @description Xóa mềm hàng loạt hãng sản xuất
 * @access Admin
 * @permission studios.manage
 */
router.delete(
  "/admin/studios/bulk",
  verifyToken,
  hasPermission("studios.manage"),
  validate(studioValidator.bulkDelete),
  studioController.bulkDelete
);

/**
 * @route POST /api/admin/studios/bulk-restore
 * @description Khôi phục hàng loạt hãng sản xuất đã bị xóa mềm
 * @access Admin
 * @permission studios.manage
 */
router.post(
  "/admin/studios/bulk-restore",
  verifyToken,
  hasPermission("studios.manage"),
  validate(studioValidator.bulkRestore),
  studioController.bulkRestore
);

/**
 * @route DELETE /api/admin/studios/empty-trash
 * @description Dọn sạch toàn bộ thùng rác hãng sản xuất
 * @access Admin
 * @permission studios.manage
 */
router.delete(
  "/admin/studios/empty-trash",
  verifyToken,
  hasPermission("studios.manage"),
  studioController.emptyTrash
);

/**
 * @route POST /api/admin/studios/bulk-force-delete
 * @description Xóa vĩnh viễn hàng loạt hãng sản xuất
 * @access Admin
 * @permission studios.manage
 */
router.post(
  "/admin/studios/bulk-force-delete",
  verifyToken,
  hasPermission("studios.manage"),
  validate(studioValidator.bulkDelete),
  studioController.bulkForceDelete
);

/**
 * @route DELETE /api/admin/studios/:id/force
 * @description Xóa vĩnh viễn hãng sản xuất
 * @access Admin
 * @permission studios.manage
 */
router.delete(
  "/admin/studios/:id/force",
  verifyToken,
  hasPermission("studios.manage"),
  studioController.forceDelete
);

/**
 * @route POST /api/admin/studios/:id/restore
 * @description Khôi phục hãng sản xuất đã bị xóa mềm
 * @access Admin
 * @permission studios.manage
 */
router.post(
  "/admin/studios/:id/restore",
  verifyToken,
  hasPermission("studios.manage"),
  studioController.restore
);

/**
 * @route DELETE /api/admin/studios/:id
 * @description Xóa mềm hãng sản xuất
 * @access Admin
 * @permission studios.manage
 */
router.delete(
  "/admin/studios/:id",
  verifyToken,
  hasPermission("studios.manage"),
  studioController.delete
);

// ════════════════════════════════════════
// PUBLIC ROUTES (No Authentication)
// ════════════════════════════════════════

/**
 * @route GET /api/studios
 * @description Lấy danh sách hãng sản xuất công khai (chỉ active)
 * @access Public
 */
router.get(
  "/studios",
  validate(studioValidator.getList, "query"),
  studioController.listPublic
);

/**
 * @route GET /api/studios/:slug
 * @description Lấy hãng sản xuất theo slug (chỉ active)
 * @access Public
 */
router.get(
  "/studios/:slug",
  studioController.getBySlug
);

export default router;
