/**
 * @file series.routes.js
 * @module Routes_Series
 * @description Định nghĩa các route cho module thương hiệu phim (Series).
 */

import express from "express";
import { seriesController } from "../controllers/series.controller.js";
import { validate } from "../../../middlewares/validator.middleware.js";
import { seriesValidator } from "../validators/series.validator.js";
import { verifyToken, hasPermission } from "../../../middlewares/auth.middleware.js";

const router = express.Router();

// ════════════════════════════════════════
// ADMIN ROUTES (Protected)
// ════════════════════════════════════════

/**
 * @route POST /api/admin/series
 * @description Tạo mới thương hiệu phim
 * @access Admin
 * @permission series.create
 */
router.post(
  "/admin/series",
  verifyToken,
  hasPermission("series.create"),
  validate(seriesValidator.create),
  seriesController.create
);

/**
 * @route GET /api/admin/series
 * @description Lấy danh sách thương hiệu phim (đầy đủ)
 * @access Admin
 * @permission series.edit
 */
router.get(
  "/admin/series",
  verifyToken,
  hasPermission("series.edit"),
  validate(seriesValidator.getList, "query"),
  seriesController.getAll
);

/**
 * @route GET /api/admin/series/:id
 * @description Lấy thông tin thương hiệu phim theo ID
 * @access Admin
 * @permission series.edit
 */
router.get(
  "/admin/series/:id",
  verifyToken,
  hasPermission("series.edit"),
  seriesController.getById
);

/**
 * @route PATCH /api/admin/series/:id
 * @description Cập nhật thương hiệu phim
 * @access Admin
 * @permission series.edit
 */
router.patch(
  "/admin/series/:id",
  verifyToken,
  hasPermission("series.edit"),
  validate(seriesValidator.update),
  seriesController.update
);

/**
 * @route DELETE /api/admin/series/bulk
 * @description Xóa mềm hàng loạt thương hiệu phim
 * @access Admin
 * @permission series.delete
 */
router.delete(
  "/admin/series/bulk",
  verifyToken,
  hasPermission("series.delete"),
  validate(seriesValidator.bulkDelete),
  seriesController.bulkDelete
);

/**
 * @route POST /api/admin/series/bulk-restore
 * @description Khôi phục hàng loạt thương hiệu phim đã bị xóa mềm
 * @access Admin
 * @permission series.delete
 */
router.post(
  "/admin/series/bulk-restore",
  verifyToken,
  hasPermission("series.delete"),
  validate(seriesValidator.bulkRestore),
  seriesController.bulkRestore
);

/**
 * @route DELETE /api/admin/series/empty-trash
 * @description Dọn sạch toàn bộ thùng rác thương hiệu phim
 * @access Admin
 * @permission series.delete
 */
router.delete(
  "/admin/series/empty-trash",
  verifyToken,
  hasPermission("series.delete"),
  seriesController.emptyTrash
);

/**
 * @route POST /api/admin/series/bulk-force-delete
 * @description Xóa vĩnh viễn hàng loạt thương hiệu phim
 * @access Admin
 * @permission series.delete
 */
router.post(
  "/admin/series/bulk-force-delete",
  verifyToken,
  hasPermission("series.delete"),
  validate(seriesValidator.bulkDelete),
  seriesController.bulkForceDelete
);

/**
 * @route DELETE /api/admin/series/:id/force
 * @description Xóa vĩnh viễn thương hiệu phim
 * @access Admin
 * @permission series.delete
 */
router.delete(
  "/admin/series/:id/force",
  verifyToken,
  hasPermission("series.delete"),
  seriesController.forceDelete
);

/**
 * @route POST /api/admin/series/:id/restore
 * @description Khôi phục thương hiệu phim đã bị xóa mềm
 * @access Admin
 * @permission series.delete
 */
router.post(
  "/admin/series/:id/restore",
  verifyToken,
  hasPermission("series.delete"),
  seriesController.restore
);

/**
 * @route DELETE /api/admin/series/:id
 * @description Xóa mềm thương hiệu phim
 * @access Admin
 * @permission series.delete
 */
router.delete(
  "/admin/series/:id",
  verifyToken,
  hasPermission("series.delete"),
  seriesController.delete
);

// ════════════════════════════════════════
// PUBLIC ROUTES (No Authentication)
// ════════════════════════════════════════

/**
 * @route GET /api/series
 * @description Lấy danh sách thương hiệu phim công khai (chỉ active)
 * @access Public
 */
router.get(
  "/series",
  validate(seriesValidator.getList, "query"),
  seriesController.listPublic
);

/**
 * @route GET /api/series/:slug
 * @description Lấy thương hiệu phim theo slug (chỉ active)
 * @access Public
 */
router.get(
  "/series/:slug",
  seriesController.getBySlug
);

export default router;
