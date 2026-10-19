/**
 * @file series.controller.js
 * @module Controller_Series
 * @description Xử lý các yêu cầu HTTP liên quan đến thương hiệu phim (Series).
 */

import { responseUtil } from "../../../utils/response.util.js";
import { seriesService } from "../services/series.service.js";
import { logger } from "../../../utils/logger.js";

export const seriesController = {
  /**
   * [ADMIN] Tạo mới thương hiệu phim
   * @route POST /api/admin/series
   * @access Admin
   */
  async create(req, res, next) {
    try {
      const series = await seriesService.create(req.body, req.userId);

      return responseUtil.success(
        res,
        series,
        "Tạo thương hiệu phim thành công",
        201
      );
    } catch (error) {
      next(error);
    }
  },

  /**
   * [ADMIN] Lấy thương hiệu phim theo ID
   * @route GET /api/admin/series/:id
   * @access Admin
   */
  async getById(req, res, next) {
    try {
      const { id } = req.params;
      const series = await seriesService.getById(id, true);

      return responseUtil.success(
        res,
        series,
        "Lấy thương hiệu phim thành công"
      );
    } catch (error) {
      next(error);
    }
  },

  /**
   * [ADMIN] Lấy danh sách thương hiệu phim (có phân trang, tìm kiếm)
   * @route GET /api/admin/series
   * @access Admin
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

      const result = await seriesService.getList(filters);

      return responseUtil.paginated(res, {
        items: result.items,
        total: result.total,
        page: result.page,
        limit: result.limit,
        message: "Lấy danh sách thương hiệu phim thành công",
        meta: { counts: result.counts },
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * [ADMIN] Cập nhật thương hiệu phim
   * @route PATCH /api/admin/series/:id
   * @access Admin
   */
  async update(req, res, next) {
    try {
      const { id } = req.params;
      const series = await seriesService.update(id, req.body, req.userId);

      return responseUtil.success(
        res,
        series,
        "Cập nhật thương hiệu phim thành công"
      );
    } catch (error) {
      next(error);
    }
  },

  /**
   * [ADMIN] Xóa mềm thương hiệu phim
   * @route DELETE /api/admin/series/:id
   * @access Admin
   */
  async delete(req, res, next) {
    try {
      const { id } = req.params;
      await seriesService.delete(id, req.userId);

      return responseUtil.success(
        res,
        null,
        "Xóa thương hiệu phim thành công"
      );
    } catch (error) {
      next(error);
    }
  },

  /**
   * [ADMIN] Khôi phục thương hiệu phim bị xóa mềm
   * @route POST /api/admin/series/:id/restore
   * @access Admin
   */
  async restore(req, res, next) {
    try {
      const { id } = req.params;
      const series = await seriesService.restore(id, req.userId);

      return responseUtil.success(
        res,
        series,
        "Khôi phục thương hiệu phim thành công"
      );
    } catch (error) {
      next(error);
    }
  },

  /**
   * [ADMIN] Xóa hàng loạt thương hiệu phim
   * @route DELETE /api/admin/series/bulk
   * @access Admin
   */
  async bulkDelete(req, res, next) {
    try {
      const { ids } = req.body;
      const count = await seriesService.bulkDelete(ids, req.userId);

      return responseUtil.success(
        res,
        { count },
        `Xóa thành công ${count} thương hiệu phim`
      );
    } catch (error) {
      next(error);
    }
  },

  /**
   * [ADMIN] Khôi phục hàng loạt thương hiệu phim
   * @route POST /api/admin/series/bulk-restore
   * @access Admin
   */
  async bulkRestore(req, res, next) {
    try {
      const { ids } = req.body;
      const count = await seriesService.bulkRestore(ids, req.userId);

      return responseUtil.success(
        res,
        { count },
        `Khôi phục thành công ${count} thương hiệu phim`
      );
    } catch (error) {
      next(error);
    }
  },

  /**
   * [ADMIN] Xóa vĩnh viễn thương hiệu phim
   * @route DELETE /api/admin/series/:id/force
   * @access Admin
   */
  async forceDelete(req, res, next) {
    try {
      const { id } = req.params;
      await seriesService.forceDelete(id, req.userId);

      return responseUtil.success(
        res,
        null,
        "Xóa vĩnh viễn thương hiệu phim thành công"
      );
    } catch (error) {
      next(error);
    }
  },

  /**
   * [ADMIN] Xóa vĩnh viễn hàng loạt thương hiệu phim
   * @route POST /api/admin/series/bulk-force-delete
   * @access Admin
   */
  async bulkForceDelete(req, res, next) {
    try {
      const { ids } = req.body;
      const count = await seriesService.bulkForceDelete(ids, req.userId);

      return responseUtil.success(
        res,
        { count },
        `Đã xóa vĩnh viễn ${count} thương hiệu phim thành công`
      );
    } catch (error) {
      next(error);
    }
  },

  /**
   * [ADMIN] Dọn sạch thùng rác (xóa vĩnh viễn toàn bộ thương hiệu phim trong thùng rác)
   * @route DELETE /api/admin/series/empty-trash
   * @access Admin
   */
  async emptyTrash(req, res, next) {
    try {
      const count = await seriesService.emptyTrash(req.userId);

      return responseUtil.success(
        res,
        { count },
        `Đã dọn sạch thùng rác (${count} thương hiệu phim đã bị xóa vĩnh viễn)`
      );
    } catch (error) {
      next(error);
    }
  },

  /**
   * [PUBLIC] Lấy danh sách thương hiệu phim công khai
   * @route GET /api/series
   * @access Public
   */
  async listPublic(req, res, next) {
    try {
      const {
        page = 1,
        limit = 20,
        search,
        order_by,
        sort,
      } = req.query;

      const filters = {
        page: parseInt(page, 10),
        limit: Math.min(parseInt(limit, 10), 100),
      };

      if (search) {
        filters.search = search;
      }

      if (order_by) {
        filters.order_by = order_by;
      }

      if (sort) {
        filters.sort = sort.toUpperCase();
      }

      const result = await seriesService.getPublicList(filters);

      return responseUtil.paginated(res, {
        items: result.items,
        total: result.total,
        page: result.page,
        limit: result.limit,
        message: "Lấy danh sách thương hiệu phim thành công",
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * [PUBLIC] Lấy thương hiệu phim theo slug
   * @route GET /api/series/:slug
   * @access Public
   */
  async getBySlug(req, res, next) {
    try {
      const { slug } = req.params;
      const series = await seriesService.getBySlug(slug);

      return responseUtil.success(
        res,
        series,
        "Lấy thương hiệu phim thành công"
      );
    } catch (error) {
      next(error);
    }
  },
};

export default seriesController;
