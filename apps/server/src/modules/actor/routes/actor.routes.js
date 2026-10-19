/**
 * @file actor.routes.js
 * @module Routes_Actor
 * @description Định nghĩa các route cho module diễn viên (Actor).
 */

import express from "express";
import { actorController } from "../controllers/actor.controller.js";
import { validate } from "../../../middlewares/validator.middleware.js";
import { actorValidator } from "../validators/actor.validator.js";
import { verifyToken, hasPermission } from "../../../middlewares/auth.middleware.js";

const router = express.Router();

// ════════════════════════════════════════
// ADMIN ROUTES (Protected)
// ════════════════════════════════════════

/**
 * @route POST /api/admin/actors
 * @description Tạo mới diễn viên
 * @access Admin
 * @permission actors.manage
 */
router.post(
  "/admin/actors",
  verifyToken,
  hasPermission("actors.manage"),
  validate(actorValidator.create),
  actorController.create
);

/**
 * @route GET /api/admin/actors
 * @description Lấy danh sách diễn viên đầy đủ
 * @access Admin
 * @permission actors.manage
 */
router.get(
  "/admin/actors",
  verifyToken,
  hasPermission("actors.manage"),
  validate(actorValidator.getList, "query"),
  actorController.getAll
);

/**
 * @route GET /api/admin/actors/:id
 * @description Lấy chi tiết diễn viên theo ID
 * @access Admin
 * @permission actors.manage
 */
router.get(
  "/admin/actors/:id",
  verifyToken,
  hasPermission("actors.manage"),
  actorController.getById
);

/**
 * @route PATCH /api/admin/actors/:id
 * @description Cập nhật thông tin diễn viên
 * @access Admin
 * @permission actors.manage
 */
router.patch(
  "/admin/actors/:id",
  verifyToken,
  hasPermission("actors.manage"),
  validate(actorValidator.update),
  actorController.update
);

/**
 * @route DELETE /api/admin/actors/bulk
 * @description Xóa mềm hàng loạt diễn viên
 * @access Admin
 * @permission actors.manage
 */
router.delete(
  "/admin/actors/bulk",
  verifyToken,
  hasPermission("actors.manage"),
  validate(actorValidator.bulkDelete),
  actorController.bulkDelete
);

/**
 * @route POST /api/admin/actors/bulk-restore
 * @description Khôi phục hàng loạt diễn viên đã bị xóa mềm
 * @access Admin
 * @permission actors.manage
 */
router.post(
  "/admin/actors/bulk-restore",
  verifyToken,
  hasPermission("actors.manage"),
  validate(actorValidator.bulkRestore),
  actorController.bulkRestore
);

/**
 * @route DELETE /api/admin/actors/empty-trash
 * @description Dọn sạch toàn bộ thùng rác diễn viên
 * @access Admin
 * @permission actors.manage
 */
router.delete(
  "/admin/actors/empty-trash",
  verifyToken,
  hasPermission("actors.manage"),
  actorController.emptyTrash
);

/**
 * @route POST /api/admin/actors/bulk-force-delete
 * @description Xóa vĩnh viễn hàng loạt diễn viên
 * @access Admin
 * @permission actors.manage
 */
router.post(
  "/admin/actors/bulk-force-delete",
  verifyToken,
  hasPermission("actors.manage"),
  validate(actorValidator.bulkDelete),
  actorController.bulkForceDelete
);

/**
 * @route DELETE /api/admin/actors/:id/force
 * @description Xóa vĩnh viễn diễn viên
 * @access Admin
 * @permission actors.manage
 */
router.delete(
  "/admin/actors/:id/force",
  verifyToken,
  hasPermission("actors.manage"),
  actorController.forceDelete
);

/**
 * @route POST /api/admin/actors/:id/restore
 * @description Khôi phục diễn viên đã bị xóa mềm
 * @access Admin
 * @permission actors.manage
 */
router.post(
  "/admin/actors/:id/restore",
  verifyToken,
  hasPermission("actors.manage"),
  actorController.restore
);

/**
 * @route DELETE /api/admin/actors/:id
 * @description Xóa mềm diễn viên
 * @access Admin
 * @permission actors.manage
 */
router.delete(
  "/admin/actors/:id",
  verifyToken,
  hasPermission("actors.manage"),
  actorController.delete
);

// ════════════════════════════════════════
// PUBLIC ROUTES (No Authentication)
// ════════════════════════════════════════

/**
 * @route GET /api/actors
 * @description Lấy danh sách diễn viên công khai (chỉ active)
 * @access Public
 */
router.get(
  "/actors",
  validate(actorValidator.getList, "query"),
  actorController.listPublic
);

/**
 * @route GET /api/actors/:slug
 * @description Lấy chi tiết diễn viên theo slug (chỉ active)
 * @access Public
 */
router.get(
  "/actors/:slug",
  actorController.getBySlug
);

export default router;
