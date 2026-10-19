/**
 * @file genre.routes.js
 * @module Routes_Genre
 * @description Định nghĩa các route cho module thể loại (Genre).
 */

import express from 'express';
import { genreController } from '../controllers/genre.controller.js';
import { validate } from '../../../middlewares/validator.middleware.js';
import { genreValidator } from '../validators/genre.validator.js';
import { verifyToken, hasPermission } from '../../../middlewares/auth.middleware.js';

const router = express.Router();

// ════════════════════════════════════════
// ADMIN ROUTES (Protected)
// ════════════════════════════════════════

/**
 * @route POST /api/admin/genres
 * @description Tạo mới thể loại
 * @access Admin
 * @permission genres.manage
 */
router.post(
  '/admin/genres',
  verifyToken,
  hasPermission('genres.manage'),
  validate(genreValidator.create),
  genreController.create
);

/**
 * @route GET /api/admin/genres
 * @description Lấy danh sách thể loại (admin - đầy đủ)
 * @access Admin
 * @permission genres.manage
 */
router.get(
  '/admin/genres',
  verifyToken,
  hasPermission('genres.manage'),
  validate(genreValidator.getList, 'query'),
  genreController.getAll
);

/**
 * @route GET /api/admin/genres/:id
 * @description Lấy thể loại theo ID
 * @access Admin
 * @permission genres.manage
 */
router.get(
  '/admin/genres/:id',
  verifyToken,
  hasPermission('genres.manage'),
  genreController.getById
);

/**
 * @route PATCH /api/admin/genres/:id
 * @description Cập nhật thể loại
 * @access Admin
 * @permission genres.manage
 */
router.patch(
  '/admin/genres/:id',
  verifyToken,
  hasPermission('genres.manage'),
  validate(genreValidator.update),
  genreController.update
);

/**
 * @route DELETE /api/admin/genres/bulk
 * @description Xóa hàng loạt thể loại
 * @access Admin
 * @permission genres.manage
 */
router.delete(
  '/admin/genres/bulk',
  verifyToken,
  hasPermission('genres.manage'),
  validate(genreValidator.bulkDelete),
  genreController.bulkDelete
);

/**
 * @route POST /api/admin/genres/bulk-restore
 * @description Khôi phục hàng loạt thể loại
 * @access Admin
 * @permission genres.manage
 */
router.post(
  '/admin/genres/bulk-restore',
  verifyToken,
  hasPermission('genres.manage'),
  validate(genreValidator.bulkRestore),
  genreController.bulkRestore
);

/**
 * @route DELETE /api/admin/genres/empty-trash
 * @description Dọn sạch toàn bộ thùng rác thể loại
 * @access Admin
 * @permission genres.manage
 */
router.delete(
  '/admin/genres/empty-trash',
  verifyToken,
  hasPermission('genres.manage'),
  genreController.emptyTrash
);

/**
 * @route POST /api/admin/genres/bulk-force-delete
 * @description Xóa vĩnh viễn hàng loạt thể loại
 * @access Admin
 * @permission genres.manage
 */
router.post(
  '/admin/genres/bulk-force-delete',
  verifyToken,
  hasPermission('genres.manage'),
  validate(genreValidator.bulkDelete),
  genreController.bulkForceDelete
);

/**
 * @route DELETE /api/admin/genres/:id/force
 * @description Xóa vĩnh viễn thể loại
 * @access Admin
 * @permission genres.manage
 */
router.delete(
  '/admin/genres/:id/force',
  verifyToken,
  hasPermission('genres.manage'),
  genreController.forceDelete
);

/**
 * @route POST /api/admin/genres/:id/restore
 * @description Khôi phục thể loại bị xóa mềm
 * @access Admin
 * @permission genres.manage
 */
router.post(
  '/admin/genres/:id/restore',
  verifyToken,
  hasPermission('genres.manage'),
  genreController.restore
);

/**
 * @route DELETE /api/admin/genres/:id
 * @description Xóa thể loại
 * @access Admin
 * @permission genres.manage
 */
router.delete(
  '/admin/genres/:id',
  verifyToken,
  hasPermission('genres.manage'),
  genreController.delete
);

// ════════════════════════════════════════
// PUBLIC ROUTES (No Authentication)
// ════════════════════════════════════════

/**
 * @route GET /api/genres
 * @description Lấy danh sách thể loại công khai (chỉ active, có cache)
 * @access Public
 */
router.get(
  '/genres',
  validate(genreValidator.getList, 'query'),
  genreController.listPublic
);

/**
 * @route GET /api/genres/:slug
 * @description Lấy thể loại theo slug (SEO-friendly, có cache)
 * @access Public
 */
router.get(
  '/genres/:slug',
  genreController.getBySlug
);

export default router;
