/**
 * @file genre.controller.js
 * @module Controller_Genre
 * @description Xử lý các yêu cầu HTTP liên quan đến thể loại (Genre).
 */

import { responseUtil } from '../../../utils/response.util.js';
import { genreService } from '../services/genre.service.js';
import { logger } from '../../../utils/logger.js';

export const genreController = {
  /**
   * [ADMIN] Tạo mới thể loại
   * @route POST /api/admin/genres
   * @access Admin
   */
  async create(req, res, next) {
    try {
      const genre = await genreService.create(req.body);

      return responseUtil.success(
        res,
        genre,
        'Tạo thể loại thành công',
        201
      );
    } catch (error) {
      next(error);
    }
  },

  /**
   * [ADMIN] Lấy thể loại theo ID
   * @route GET /api/admin/genres/:id
   * @access Admin
   */
  async getById(req, res, next) {
    try {
      const { id } = req.params;
      const genre = await genreService.getById(id);

      return responseUtil.success(
        res,
        genre,
        'Lấy thể loại thành công'
      );
    } catch (error) {
      next(error);
    }
  },

  /**
   * [ADMIN] Lấy danh sách thể loại (có lọc, phân trang)
   * @route GET /api/admin/genres
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

      const result = await genreService.getList(filters);

      return responseUtil.paginated(res, {
        items: result.items,
        total: result.total,
        page: result.page,
        limit: result.limit,
        message: 'Lấy danh sách thể loại thành công',
        meta: { counts: result.counts },
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * [ADMIN] Cập nhật thể loại
   * @route PATCH /api/admin/genres/:id
   * @access Admin
   */
  async update(req, res, next) {
    try {
      const { id } = req.params;
      const genre = await genreService.update(id, req.body);

      return responseUtil.success(
        res,
        genre,
        'Cập nhật thể loại thành công'
      );
    } catch (error) {
      next(error);
    }
  },

  /**
   * [ADMIN] Xóa thể loại
   * @route DELETE /api/admin/genres/:id
   * @access Admin
   */
  async delete(req, res, next) {
    try {
      const { id } = req.params;
      await genreService.delete(id);

      return responseUtil.success(
        res,
        null,
        'Xóa thể loại thành công'
      );
    } catch (error) {
      next(error);
    }
  },

  /**
   * [ADMIN] Xóa hàng loạt thể loại
   * @route DELETE /api/admin/genres/bulk
   * @access Admin
   */
  async bulkDelete(req, res, next) {
    try {
      const { ids } = req.body;
      const count = await genreService.bulkDelete(ids);

      return responseUtil.success(
        res,
        { count },
        `Xóa thành công ${count} thể loại`
      );
    } catch (error) {
      next(error);
    }
  },

  /**
   * [ADMIN] Khôi phục thể loại bị xóa mềm
   * @route POST /api/admin/genres/:id/restore
   * @access Admin
   */
  async restore(req, res, next) {
    try {
      const { id } = req.params;
      const genre = await genreService.restore(id);

      return responseUtil.success(
        res,
        genre,
        "Khôi phục thể loại thành công"
      );
    } catch (error) {
      next(error);
    }
  },

  /**
   * [ADMIN] Khôi phục hàng loạt thể loại
   * @route POST /api/admin/genres/bulk-restore
   * @access Admin
   */
  async bulkRestore(req, res, next) {
    try {
      const { ids } = req.body;
      const count = await genreService.bulkRestore(ids);

      return responseUtil.success(
        res,
        { count },
        `Khôi phục thành công ${count} thể loại`
      );
    } catch (error) {
      next(error);
    }
  },

  /**
   * [ADMIN] Xóa vĩnh viễn thể loại
   * @route DELETE /api/admin/genres/:id/force
   * @access Admin
   */
  async forceDelete(req, res, next) {
    try {
      const { id } = req.params;
      await genreService.forceDelete(id, req.userId);

      return responseUtil.success(
        res,
        null,
        'Xóa vĩnh viễn thể loại thành công'
      );
    } catch (error) {
      next(error);
    }
  },

  /**
   * [ADMIN] Xóa vĩnh viễn hàng loạt thể loại
   * @route POST /api/admin/genres/bulk-force-delete
   * @access Admin
   */
  async bulkForceDelete(req, res, next) {
    try {
      const { ids } = req.body;
      const count = await genreService.bulkForceDelete(ids, req.userId);

      return responseUtil.success(
        res,
        { count },
        `Đã xóa vĩnh viễn ${count} thể loại thành công`
      );
    } catch (error) {
      next(error);
    }
  },

  /**
   * [ADMIN] Dọn sạch thùng rác (xóa vĩnh viễn toàn bộ thể loại trong thùng rác)
   * @route DELETE /api/admin/genres/empty-trash
   * @access Admin
   */
  async emptyTrash(req, res, next) {
    try {
      const count = await genreService.emptyTrash(req.userId);

      return responseUtil.success(
        res,
        { count },
        `Đã dọn sạch thùng rác (${count} thể loại đã bị xóa vĩnh viễn)`
      );
    } catch (error) {
      next(error);
    }
  },

  /**
   * [PUBLIC] Lấy danh sách thể loại công khai (cached)
   * @route GET /api/genres
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

      const result = await genreService.getPublicList(filters);

      return responseUtil.paginated(res, {
        items: result.items,
        total: result.total,
        page: result.page,
        limit: result.limit,
        message: 'Lấy danh sách thể loại thành công',
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * [PUBLIC] Lấy thể loại theo slug (cached)
   * @route GET /api/genres/:slug
   * @access Public
   */
  async getBySlug(req, res, next) {
    try {
      const { slug } = req.params;
      const genre = await genreService.getBySlug(slug);

      return responseUtil.success(
        res,
        genre,
        'Lấy thể loại thành công'
      );
    } catch (error) {
      next(error);
    }
  },
};

export default genreController;
