/**
 * @file studio.controller.js
 * @module Controller_Studio
 * @description Xử lý các yêu cầu HTTP liên quan đến hãng sản xuất (Studio).
 */

import { responseUtil } from "../../../utils/response.util.js";
import { studioService } from "../services/studio.service.js";
import { logger } from "../../../utils/logger.js";

export const studioController = {
  /**
   * [ADMIN] Tạo mới hãng sản xuất
   * @route POST /api/admin/studios
   * @access Admin
   */
  async create(req, res, next) {
    try {
      const studio = await studioService.create(req.body, req.userId);

      return responseUtil.success(
        res,
        studio,
        "Tạo hãng sản xuất thành công",
        201
      );
    } catch (error) {
      next(error);
    }
  },

  /**
   * [ADMIN] Lấy hãng sản xuất theo ID
   * @route GET /api/admin/studios/:id
   * @access Admin
   */
  async getById(req, res, next) {
    try {
      const { id } = req.params;
      const studio = await studioService.getById(id, true);

      return responseUtil.success(
        res,
        studio,
        "Lấy hãng sản xuất thành công"
      );
    } catch (error) {
      next(error);
    }
  },

  /**
   * [ADMIN] Lấy danh sách hãng sản xuất (có phân trang, tìm kiếm)
   * @route GET /api/admin/studios
   * @access Admin
   */
  async getAll(req, res, next) {
    try {
      const {
        page = 1,
        limit = 20,
        is_active,
        search,
        country,
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

      if (country) {
        filters.country = country;
      }

      if (order_by) {
        filters.order_by = order_by;
      }

      if (sort) {
        filters.sort = sort.toUpperCase();
      }

      const result = await studioService.getList(filters);

      return responseUtil.paginated(res, {
        items: result.items,
        total: result.total,
        page: result.page,
        limit: result.limit,
        message: "Lấy danh sách hãng sản xuất thành công",
        meta: { counts: result.counts },
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * [ADMIN] Cập nhật hãng sản xuất
   * @route PATCH /api/admin/studios/:id
   * @access Admin
   */
  async update(req, res, next) {
    try {
      const { id } = req.params;
      const studio = await studioService.update(id, req.body, req.userId);

      return responseUtil.success(
        res,
        studio,
        "Cập nhật hãng sản xuất thành công"
      );
    } catch (error) {
      next(error);
    }
  },

  /**
   * [ADMIN] Xóa mềm hãng sản xuất
   * @route DELETE /api/admin/studios/:id
   * @access Admin
   */
  async delete(req, res, next) {
    try {
      const { id } = req.params;
      await studioService.delete(id, req.userId);

      return responseUtil.success(
        res,
        null,
        "Xóa hãng sản xuất thành công"
      );
    } catch (error) {
      next(error);
    }
  },

  /**
   * [ADMIN] Khôi phục hãng sản xuất bị xóa mềm
   * @route POST /api/admin/studios/:id/restore
   * @access Admin
   */
  async restore(req, res, next) {
    try {
      const { id } = req.params;
      const studio = await studioService.restore(id, req.userId);

      return responseUtil.success(
        res,
        studio,
        "Khôi phục hãng sản xuất thành công"
      );
    } catch (error) {
      next(error);
    }
  },

  /**
   * [ADMIN] Xóa hàng loạt hãng sản xuất
   * @route DELETE /api/admin/studios/bulk
   * @access Admin
   */
  async bulkDelete(req, res, next) {
    try {
      const { ids } = req.body;
      const count = await studioService.bulkDelete(ids, req.userId);

      return responseUtil.success(
        res,
        { count },
        `Xóa thành công ${count} hãng sản xuất`
      );
    } catch (error) {
      next(error);
    }
  },

  /**
   * [ADMIN] Khôi phục hàng loạt hãng sản xuất
   * @route POST /api/admin/studios/bulk-restore
   * @access Admin
   */
  async bulkRestore(req, res, next) {
    try {
      const { ids } = req.body;
      const count = await studioService.bulkRestore(ids, req.userId);

      return responseUtil.success(
        res,
        { count },
        `Khôi phục thành công ${count} hãng sản xuất`
      );
    } catch (error) {
      next(error);
    }
  },

  /**
   * [ADMIN] Xóa vĩnh viễn hãng sản xuất
   * @route DELETE /api/admin/studios/:id/force
   * @access Admin
   */
  async forceDelete(req, res, next) {
    try {
      const { id } = req.params;
      await studioService.forceDelete(id, req.userId);

      return responseUtil.success(
        res,
        null,
        "Xóa vĩnh viễn hãng sản xuất thành công"
      );
    } catch (error) {
      next(error);
    }
  },

  /**
   * [ADMIN] Xóa vĩnh viễn hàng loạt hãng sản xuất
   * @route POST /api/admin/studios/bulk-force-delete
   * @access Admin
   */
  async bulkForceDelete(req, res, next) {
    try {
      const { ids } = req.body;
      const count = await studioService.bulkForceDelete(ids, req.userId);

      return responseUtil.success(
        res,
        { count },
        `Đã xóa vĩnh viễn ${count} hãng sản xuất thành công`
      );
    } catch (error) {
      next(error);
    }
  },

  /**
   * [ADMIN] Dọn sạch thùng rác (xóa vĩnh viễn toàn bộ hãng sản xuất trong thùng rác)
   * @route DELETE /api/admin/studios/empty-trash
   * @access Admin
   */
  async emptyTrash(req, res, next) {
    try {
      const count = await studioService.emptyTrash(req.userId);

      return responseUtil.success(
        res,
        { count },
        `Đã dọn sạch thùng rác (${count} hãng sản xuất đã bị xóa vĩnh viễn)`
      );
    } catch (error) {
      next(error);
    }
  },

  /**
   * [PUBLIC] Lấy danh sách hãng sản xuất công khai
   * @route GET /api/studios
   * @access Public
   */
  async listPublic(req, res, next) {
    try {
      const {
        page = 1,
        limit = 20,
        search,
        country,
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

      if (country) {
        filters.country = country;
      }

      if (order_by) {
        filters.order_by = order_by;
      }

      if (sort) {
        filters.sort = sort.toUpperCase();
      }

      const result = await studioService.getPublicList(filters);

      return responseUtil.paginated(res, {
        items: result.items,
        total: result.total,
        page: result.page,
        limit: result.limit,
        message: "Lấy danh sách hãng sản xuất thành công",
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * [PUBLIC] Lấy hãng sản xuất theo slug
   * @route GET /api/studios/:slug
   * @access Public
   */
  async getBySlug(req, res, next) {
    try {
      const { slug } = req.params;
      const studio = await studioService.getBySlug(slug);

      return responseUtil.success(
        res,
        studio,
        "Lấy hãng sản xuất thành công"
      );
    } catch (error) {
      next(error);
    }
  },
};

export default studioController;
