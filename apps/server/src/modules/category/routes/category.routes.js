/**
 * @file category.routes.js
 * @module Routes_Category
 * @description Định nghĩa các route cho module danh mục (Category).
 */

import express from 'express';
import { categoryController } from '../controllers/category.controller.js';
import { validate } from '../../../middlewares/validator.middleware.js';
import { categoryValidator } from '../validators/category.validator.js';
import { verifyToken, hasPermission } from '../../../middlewares/auth.middleware.js';

const router = express.Router();

// ════════════════════════════════════════
// ADMIN ROUTES (Protected)
// ════════════════════════════════════════

/**
 * @route POST /api/admin/categories
 * @description Tạo mới danh mục
 * @access Admin
 * @permission categories.manage
 */
router.post(
  '/admin/categories',
  verifyToken,
  hasPermission('categories.manage'),
  validate(categoryValidator.create),
  categoryController.create
);

/**
 * @route GET /api/admin/categories
 * @description Lấy danh sách danh mục (admin - đầy đủ)
 * @access Admin
 * @permission categories.manage
 */
router.get(
  '/admin/categories',
  verifyToken,
  hasPermission('categories.manage'),
  validate(categoryValidator.getList, 'query'),
  categoryController.getAll
);

/**
 * @route GET /api/admin/categories/:id
 * @description Lấy danh mục theo ID
 * @access Admin
 * @permission categories.manage
 */
router.get(
  '/admin/categories/:id',
  verifyToken,
  hasPermission('categories.manage'),
  categoryController.getById
);

/**
 * @route PATCH /api/admin/categories/:id
 * @description Cập nhật danh mục
 * @access Admin
 * @permission categories.manage
 */
router.patch(
  '/admin/categories/:id',
  verifyToken,
  hasPermission('categories.manage'),
  validate(categoryValidator.update),
  categoryController.update
);

/**
 * @route DELETE /api/admin/categories/bulk
 * @description Xóa hàng loạt danh mục
 * @access Admin
 * @permission categories.manage
 */
router.delete(
  '/admin/categories/bulk',
  verifyToken,
  hasPermission('categories.manage'),
  validate(categoryValidator.bulkDelete),
  categoryController.bulkDelete
);

/**
 * @route POST /api/admin/categories/bulk-restore
 * @description Khôi phục hàng loạt danh mục
 * @access Admin
 * @permission categories.manage
 */
router.post(
  '/admin/categories/bulk-restore',
  verifyToken,
  hasPermission('categories.manage'),
  validate(categoryValidator.bulkRestore),
  categoryController.bulkRestore
);

/**
 * @route DELETE /api/admin/categories/empty-trash
 * @description Dọn sạch toàn bộ thùng rác danh mục
 * @access Admin
 * @permission categories.manage
 */
router.delete(
  '/admin/categories/empty-trash',
  verifyToken,
  hasPermission('categories.manage'),
  categoryController.emptyTrash
);

/**
 * @route POST /api/admin/categories/bulk-force-delete
 * @description Xóa vĩnh viễn hàng loạt danh mục
 * @access Admin
 * @permission categories.manage
 */
router.post(
  '/admin/categories/bulk-force-delete',
  verifyToken,
  hasPermission('categories.manage'),
  validate(categoryValidator.bulkDelete),
  categoryController.bulkForceDelete
);

/**
 * @route DELETE /api/admin/categories/:id/force
 * @description Xóa vĩnh viễn danh mục
 * @access Admin
 * @permission categories.manage
 */
router.delete(
  '/admin/categories/:id/force',
  verifyToken,
  hasPermission('categories.manage'),
  categoryController.forceDelete
);

/**
 * @route POST /api/admin/categories/:id/restore
 * @description Khôi phục danh mục bị xóa mềm
 * @access Admin
 * @permission categories.manage
 */
router.post(
  '/admin/categories/:id/restore',
  verifyToken,
  hasPermission('categories.manage'),
  categoryController.restore
);

/**
 * @route DELETE /api/admin/categories/:id
 * @description Xóa danh mục
 * @access Admin
 * @permission categories.manage
 */
router.delete(
  '/admin/categories/:id',
  verifyToken,
  hasPermission('categories.manage'),
  categoryController.delete
);

// ════════════════════════════════════════
// PUBLIC ROUTES (No Authentication)
// ════════════════════════════════════════

/**
 * @route GET /api/categories
 * @description Lấy danh sách danh mục công khai (chỉ active, có cache)
 * @access Public
 */
router.get(
  '/categories',
  validate(categoryValidator.getList, 'query'),
  categoryController.listPublic
);

/**
 * @route GET /api/categories/:slug
 * @description Lấy danh mục theo slug (SEO-friendly, có cache)
 * @access Public
 */
router.get(
  '/categories/:slug',
  categoryController.getBySlug
);

export default router;
