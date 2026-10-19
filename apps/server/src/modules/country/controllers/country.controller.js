/**
 * @file country.controller.js
 * @module Controller_Country
 * @description Xử lý các yêu cầu HTTP liên quan đến quốc gia (Country).
 */

import { responseUtil } from '../../../utils/response.util.js';
import { countryService } from '../services/country.service.js';
import { logger } from '../../../utils/logger.js';

export const countryController = {
  /**
   * [ADMIN] Tạo mới quốc gia
   * @route POST /api/admin/countries
   * @access Admin
   */
  async create(req, res, next) {
    try {
      const country = await countryService.create(req.body);

      return responseUtil.success(
        res,
        country,
        'Tạo quốc gia thành công',
        201
      );
    } catch (error) {
      next(error);
    }
  },

  /**
   * [ADMIN] Lấy quốc gia theo ID
   * @route GET /api/admin/countries/:id
   * @access Admin
   */
  async getById(req, res, next) {
    try {
      const { id } = req.params;
      const country = await countryService.getById(id);

      return responseUtil.success(
        res,
        country,
        'Lấy quốc gia thành công'
      );
    } catch (error) {
      next(error);
    }
  },

  /**
   * [ADMIN] Lấy danh sách quốc gia (có lọc, phân trang)
   * @route GET /api/admin/countries
   * @access Admin
   * @query page - Trang (mặc định: 1)
   * @query limit - Số lượng bản ghi (mặc định: 20)
   * @query is_active - Lọc theo trạng thái
   * @query search - Tìm kiếm theo tên hoặc mã
   * @query order_by - Trường sắp xếp (mặc định: name)
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

      const result = await countryService.getList(filters);

      return responseUtil.paginated(res, {
        items: result.items,
        total: result.total,
        page: result.page,
        limit: result.limit,
        message: 'Lấy danh sách quốc gia thành công',
        meta: { counts: result.counts },
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * [ADMIN] Cập nhật quốc gia
   * @route PATCH /api/admin/countries/:id
   * @access Admin
   */
  async update(req, res, next) {
    try {
      const { id } = req.params;
      const country = await countryService.update(id, req.body);

      return responseUtil.success(
        res,
        country,
        'Cập nhật quốc gia thành công'
      );
    } catch (error) {
      next(error);
    }
  },

  /**
   * [ADMIN] Xóa quốc gia
   * @route DELETE /api/admin/countries/:id
   * @access Admin
   */
  async delete(req, res, next) {
    try {
      const { id } = req.params;
      await countryService.delete(id);

      return responseUtil.success(
        res,
        null,
        'Xóa quốc gia thành công'
      );
    } catch (error) {
      next(error);
    }
  },

  /**
   * [ADMIN] Xóa hàng loạt quốc gia
   * @route DELETE /api/admin/countries/bulk
   * @access Admin
   */
  async bulkDelete(req, res, next) {
    try {
      const { ids } = req.body;
      const count = await countryService.bulkDelete(ids);

      return responseUtil.success(
        res,
        { count },
        `Xóa thành công ${count} quốc gia`
      );
    } catch (error) {
      next(error);
    }
  },

  /**
   * [ADMIN] Khôi phục quốc gia bị xóa mềm
   * @route POST /api/admin/countries/:id/restore
   * @access Admin
   */
  async restore(req, res, next) {
    try {
      const { id } = req.params;
      const country = await countryService.restore(id);

      return responseUtil.success(
        res,
        country,
        "Khôi phục quốc gia thành công"
      );
    } catch (error) {
      next(error);
    }
  },

  /**
   * [ADMIN] Khôi phục hàng loạt quốc gia
   * @route POST /api/admin/countries/bulk-restore
   * @access Admin
   */
  async bulkRestore(req, res, next) {
    try {
      const { ids } = req.body;
      const count = await countryService.bulkRestore(ids);

      return responseUtil.success(
        res,
        { count },
        `Khôi phục thành công ${count} quốc gia`
      );
    } catch (error) {
      next(error);
    }
  },

  /**
   * [ADMIN] Xóa vĩnh viễn quốc gia
   * @route DELETE /api/admin/countries/:id/force
   * @access Admin
   */
  async forceDelete(req, res, next) {
    try {
      const { id } = req.params;
      await countryService.forceDelete(id, req.userId);

      return responseUtil.success(
        res,
        null,
        'Xóa vĩnh viễn quốc gia thành công'
      );
    } catch (error) {
      next(error);
    }
  },

  /**
   * [ADMIN] Xóa vĩnh viễn hàng loạt quốc gia
   * @route POST /api/admin/countries/bulk-force-delete
   * @access Admin
   */
  async bulkForceDelete(req, res, next) {
    try {
      const { ids } = req.body;
      const count = await countryService.bulkForceDelete(ids, req.userId);

      return responseUtil.success(
        res,
        { count },
        `Đã xóa vĩnh viễn ${count} quốc gia thành công`
      );
    } catch (error) {
      next(error);
    }
  },

  /**
   * [ADMIN] Dọn sạch thùng rác (xóa vĩnh viễn toàn bộ quốc gia trong thùng rác)
   * @route DELETE /api/admin/countries/empty-trash
   * @access Admin
   */
  async emptyTrash(req, res, next) {
    try {
      const count = await countryService.emptyTrash(req.userId);

      return responseUtil.success(
        res,
        { count },
        `Đã dọn sạch thùng rác (${count} quốc gia đã bị xóa vĩnh viễn)`
      );
    } catch (error) {
      next(error);
    }
  },

  /**
   * [PUBLIC] Lấy danh sách quốc gia công khai (cached)
   * @route GET /api/countries
   * @access Public
   * @query page - Trang (mặc định: 1)
   * @query limit - Số lượng bản ghi (mặc định: 20)
   * @query search - Tìm kiếm theo tên hoặc mã
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

      const result = await countryService.getPublicList(filters);

      return responseUtil.paginated(res, {
        items: result.items,
        total: result.total,
        page: result.page,
        limit: result.limit,
        message: 'Lấy danh sách quốc gia thành công',
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * [PUBLIC] Lấy quốc gia theo slug (cached)
   * @route GET /api/countries/:slug
   * @access Public
   */
  async getBySlug(req, res, next) {
    try {
      const { slug } = req.params;
      const country = await countryService.getBySlug(slug);

      return responseUtil.success(
        res,
        country,
        'Lấy quốc gia thành công'
      );
    } catch (error) {
      next(error);
    }
  },
};

export default countryController;
