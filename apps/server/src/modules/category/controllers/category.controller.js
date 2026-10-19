/**
 * @file category.controller.js
 * @module Controller_Category
 * @description Xử lý các yêu cầu HTTP liên quan đến danh mục (Category).
 */

import { responseUtil } from '../../../utils/response.util.js';
import { categoryService } from '../services/category.service.js';
import { logger } from '../../../utils/logger.js';

export const categoryController = {
  /**
   * [ADMIN] Tạo mới danh mục
   * @route POST /api/admin/categories
   * @access Admin
   */
  async create(req, res, next) {
    try {
      const category = await categoryService.create(req.body);

      return responseUtil.success(
        res,
        category,
        'Tạo danh mục thành công',
        201
      );
    } catch (error) {
      next(error);
    }
  },

  /**
   * [ADMIN] Lấy danh mục theo ID
   * @route GET /api/admin/categories/:id
   * @access Admin
   */
  async getById(req, res, next) {
    try {
      const { id } = req.params;
      const category = await categoryService.getById(id);

      return responseUtil.success(
        res,
        category,
        'Lấy danh mục thành công'
      );
    } catch (error) {
      next(error);
    }
  },

  /**
   * [ADMIN] Lấy danh sách danh mục (có lọc, phân trang)
   * @route GET /api/admin/categories
   * @access Admin
   * @query page - Trang (mặc định: 1)
   * @query limit - Số lượng bản ghi (mặc định: 20)
   * @query is_active - Lọc theo trạng thái
   * @query search - Tìm kiếm theo tên
   * @query order_by - Trường sắp xếp (mặc định: order_num)
   * @query sort - Hướng sắp xếp (ASC/DESC, mặc định: ASC)
   */
  async getAll(req, res, next) {
    try {
      const {
        page = 1,
        limit = 20,
        is_active,
        search,
        order_by,
        sort,
        include_deleted,
        only_deleted,
      } = req.query;

      const filters = {
        page: parseInt(page, 10),
        limit: Math.min(parseInt(limit, 10), 100),
        includeDeleted: include_deleted === true || include_deleted === 'true',
        onlyDeleted: only_deleted === true || only_deleted === 'true',
      };

      if (is_active !== undefined) {
        filters.is_active = is_active === true || is_active === 'true';
      }

      if (search) {
        filters.search = search;
      }

      if (order_by) {
        filters.order_by = order_by;
      }

      if (sort) {
        filters.sort = sort.toUpperCase();
      }

      const result = await categoryService.getList(filters);

      return responseUtil.paginated(res, {
        items: result.items,
        total: result.total,
        page: result.page,
        limit: result.limit,
        message: 'Lấy danh sách danh mục thành công',
        meta: { counts: result.counts },
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * [ADMIN] Cập nhật danh mục
   * @route PATCH /api/admin/categories/:id
   * @access Admin
   */
  async update(req, res, next) {
    try {
      const { id } = req.params;
      const category = await categoryService.update(id, req.body);

      return responseUtil.success(
        res,
        category,
        'Cập nhật danh mục thành công'
      );
    } catch (error) {
      next(error);
    }
  },

  /**
   * [ADMIN] Xóa danh mục
   * @route DELETE /api/admin/categories/:id
   * @access Admin
   */
  async delete(req, res, next) {
    try {
      const { id } = req.params;
      await categoryService.delete(id);

      return responseUtil.success(
        res,
        null,
        'Xóa danh mục thành công'
      );
    } catch (error) {
      next(error);
    }
  },

  /**
   * [ADMIN] Xóa hàng loạt danh mục
   * @route DELETE /api/admin/categories/bulk
   * @access Admin
   */
  async bulkDelete(req, res, next) {
    try {
      const { ids } = req.body;
      const count = await categoryService.bulkDelete(ids);

      return responseUtil.success(
        res,
        { count },
        `Xóa thành công ${count} danh mục`
      );
    } catch (error) {
      next(error);
    }
  },

  /**
   * [ADMIN] Khôi phục danh mục bị xóa mềm
   * @route POST /api/admin/categories/:id/restore
   * @access Admin
   */
  async restore(req, res, next) {
    try {
      const { id } = req.params;
      const category = await categoryService.restore(id);

      return responseUtil.success(
        res,
        category,
        "Khôi phục danh mục thành công"
      );
    } catch (error) {
      next(error);
    }
  },

  /**
   * [ADMIN] Khôi phục hàng loạt danh mục
   * @route POST /api/admin/categories/bulk-restore
   * @access Admin
   */
  async bulkRestore(req, res, next) {
    try {
      const { ids } = req.body;
      const count = await categoryService.bulkRestore(ids);

      return responseUtil.success(
        res,
        { count },
        `Khôi phục thành công ${count} danh mục`
      );
    } catch (error) {
      next(error);
    }
  },

  /**
   * [ADMIN] Xóa vĩnh viễn danh mục
   * @route DELETE /api/admin/categories/:id/force
   * @access Admin
   */
  async forceDelete(req, res, next) {
    try {
      const { id } = req.params;
      await categoryService.forceDelete(id, req.userId);

      return responseUtil.success(
        res,
        null,
        'Xóa vĩnh viễn danh mục thành công'
      );
    } catch (error) {
      next(error);
    }
  },

  /**
   * [ADMIN] Xóa vĩnh viễn hàng loạt danh mục
   * @route POST /api/admin/categories/bulk-force-delete
   * @access Admin
   */
  async bulkForceDelete(req, res, next) {
    try {
      const { ids } = req.body;
      const count = await categoryService.bulkForceDelete(ids, req.userId);

      return responseUtil.success(
        res,
        { count },
        `Đã xóa vĩnh viễn ${count} danh mục thành công`
      );
    } catch (error) {
      next(error);
    }
  },

  /**
   * [ADMIN] Dọn sạch thùng rác (xóa vĩnh viễn toàn bộ danh mục trong thùng rác)
   * @route DELETE /api/admin/categories/empty-trash
   * @access Admin
   */
  async emptyTrash(req, res, next) {
    try {
      const count = await categoryService.emptyTrash(req.userId);

      return responseUtil.success(
        res,
        { count },
        `Đã dọn sạch thùng rác (${count} danh mục đã bị xóa vĩnh viễn)`
      );
    } catch (error) {
      next(error);
    }
  },

  /**
   * [PUBLIC] Lấy danh sách danh mục công khai (cached)
   * @route GET /api/categories
   * @access Public
   * @query page - Trang (mặc định: 1)
   * @query limit - Số lượng bản ghi (mặc định: 20)
   * @query search - Tìm kiếm theo tên
   */
  async listPublic(req, res, next) {
    try {
      const {
        page = 1,
        limit = 20,
        search,
      } = req.query;

      const filters = {
        page: parseInt(page, 10),
        limit: Math.min(parseInt(limit, 10), 100),
      };

      if (search) {
        filters.search = search;
      }

      const result = await categoryService.getPublicList(filters);

      return responseUtil.paginated(res, {
        items: result.items,
        total: result.total,
        page: result.page,
        limit: result.limit,
        message: 'Lấy danh sách danh mục thành công',
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * [PUBLIC] Lấy danh mục theo slug (cached)
   * @route GET /api/categories/:slug
   * @access Public
   */
  async getBySlug(req, res, next) {
    try {
      const { slug } = req.params;
      const category = await categoryService.getBySlug(slug);

      return responseUtil.success(
        res,
        category,
        'Lấy danh mục thành công'
      );
    } catch (error) {
      next(error);
    }
  },
};

export default categoryController;
