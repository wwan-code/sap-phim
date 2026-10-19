/**
 * @file country.routes.js
 * @module Routes_Country
 * @description Định nghĩa các route cho module quốc gia (Country).
 */

import express from 'express';
import { countryController } from '../controllers/country.controller.js';
import { validate } from '../../../middlewares/validator.middleware.js';
import { countryValidator } from '../validators/country.validator.js';
import { verifyToken, hasPermission } from '../../../middlewares/auth.middleware.js';

const router = express.Router();

// ════════════════════════════════════════
// ADMIN ROUTES (Protected)
// ════════════════════════════════════════

/**
 * @route POST /api/admin/countries
 * @description Tạo mới quốc gia
 * @access Admin
 * @permission countries.manage
 */
router.post(
  '/admin/countries',
  verifyToken,
  hasPermission('countries.manage'),
  validate(countryValidator.create),
  countryController.create
);

/**
 * @route GET /api/admin/countries
 * @description Lấy danh sách quốc gia (admin - đầy đủ)
 * @access Admin
 * @permission countries.manage
 */
router.get(
  '/admin/countries',
  verifyToken,
  hasPermission('countries.manage'),
  validate(countryValidator.getList, 'query'),
  countryController.getAll
);

/**
 * @route GET /api/admin/countries/:id
 * @description Lấy quốc gia theo ID
 * @access Admin
 * @permission countries.manage
 */
router.get(
  '/admin/countries/:id',
  verifyToken,
  hasPermission('countries.manage'),
  countryController.getById
);

/**
 * @route PATCH /api/admin/countries/:id
 * @description Cập nhật quốc gia
 * @access Admin
 * @permission countries.manage
 */
router.patch(
  '/admin/countries/:id',
  verifyToken,
  hasPermission('countries.manage'),
  validate(countryValidator.update),
  countryController.update
);

/**
 * @route DELETE /api/admin/countries/bulk
 * @description Xóa hàng loạt quốc gia
 * @access Admin
 * @permission countries.manage
 */
router.delete(
  '/admin/countries/bulk',
  verifyToken,
  hasPermission('countries.manage'),
  validate(countryValidator.bulkDelete),
  countryController.bulkDelete
);

/**
 * @route POST /api/admin/countries/bulk-restore
 * @description Khôi phục hàng loạt quốc gia
 * @access Admin
 * @permission countries.manage
 */
router.post(
  '/admin/countries/bulk-restore',
  verifyToken,
  hasPermission('countries.manage'),
  validate(countryValidator.bulkRestore),
  countryController.bulkRestore
);

/**
 * @route DELETE /api/admin/countries/empty-trash
 * @description Dọn sạch toàn bộ thùng rác quốc gia
 * @access Admin
 * @permission countries.manage
 */
router.delete(
  '/admin/countries/empty-trash',
  verifyToken,
  hasPermission('countries.manage'),
  countryController.emptyTrash
);

/**
 * @route POST /api/admin/countries/bulk-force-delete
 * @description Xóa vĩnh viễn hàng loạt quốc gia
 * @access Admin
 * @permission countries.manage
 */
router.post(
  '/admin/countries/bulk-force-delete',
  verifyToken,
  hasPermission('countries.manage'),
  validate(countryValidator.bulkDelete),
  countryController.bulkForceDelete
);

/**
 * @route DELETE /api/admin/countries/:id/force
 * @description Xóa vĩnh viễn quốc gia
 * @access Admin
 * @permission countries.manage
 */
router.delete(
  '/admin/countries/:id/force',
  verifyToken,
  hasPermission('countries.manage'),
  countryController.forceDelete
);

/**
 * @route POST /api/admin/countries/:id/restore
 * @description Khôi phục quốc gia bị xóa mềm
 * @access Admin
 * @permission countries.manage
 */
router.post(
  '/admin/countries/:id/restore',
  verifyToken,
  hasPermission('countries.manage'),
  countryController.restore
);

/**
 * @route DELETE /api/admin/countries/:id
 * @description Xóa quốc gia
 * @access Admin
 * @permission countries.manage
 */
router.delete(
  '/admin/countries/:id',
  verifyToken,
  hasPermission('countries.manage'),
  countryController.delete
);

// ════════════════════════════════════════
// PUBLIC ROUTES (No Authentication)
// ════════════════════════════════════════

/**
 * @route GET /api/countries
 * @description Lấy danh sách quốc gia công khai (chỉ active, có cache)
 * @access Public
 */
router.get(
  '/countries',
  validate(countryValidator.getList, 'query'),
  countryController.listPublic
);

/**
 * @route GET /api/countries/:slug
 * @description Lấy quốc gia theo slug (SEO-friendly, có cache)
 * @access Public
 */
router.get(
  '/countries/:slug',
  countryController.getBySlug
);

export default router;
