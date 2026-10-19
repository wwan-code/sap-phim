/**
 * @file actor.controller.js
 * @module Controller_Actor
 * @description Xử lý các yêu cầu HTTP liên quan đến diễn viên (Actor).
 */

import { responseUtil } from "../../../utils/response.util.js";
import { actorService } from "../services/actor.service.js";
import { logger } from "../../../utils/logger.js";

export const actorController = {
  /**
   * [ADMIN] Tạo mới diễn viên
   * @route POST /api/admin/actors
   * @access Admin
   */
  async create(req, res, next) {
    try {
      const actor = await actorService.create(req.body, req.userId);

      return responseUtil.success(
        res,
        actor,
        "Tạo thông tin diễn viên thành công",
        201
      );
    } catch (error) {
      next(error);
    }
  },

  /**
   * [ADMIN] Lấy thông tin diễn viên theo ID
   * @route GET /api/admin/actors/:id
   * @access Admin
   */
  async getById(req, res, next) {
    try {
      const { id } = req.params;
      const actor = await actorService.getById(id, true); // Admin có thể xem cả bản ghi đã xóa mềm

      return responseUtil.success(
        res,
        actor,
        "Lấy thông tin diễn viên thành công"
      );
    } catch (error) {
      next(error);
    }
  },

  /**
   * [ADMIN] Lấy danh sách diễn viên (có lọc, phân trang, bao gồm cả đã xóa mềm)
   * @route GET /api/admin/actors
   * @access Admin
   */
  async getAll(req, res, next) {
    try {
      const {
        page = 1,
        limit = 20,
        is_active,
        search,
        gender,
        nationality,
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

      if (gender) {
        filters.gender = gender;
      }

      if (nationality) {
        filters.nationality = nationality;
      }

      if (order_by) {
        filters.order_by = order_by;
      }

      if (sort) {
        filters.sort = sort.toUpperCase();
      }

      const result = await actorService.getList(filters);

      return responseUtil.paginated(res, {
        items: result.items,
        total: result.total,
        page: result.page,
        limit: result.limit,
        message: "Lấy danh sách diễn viên thành công",
        meta: { counts: result.counts },
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * [ADMIN] Cập nhật diễn viên
   * @route PATCH /api/admin/actors/:id
   * @access Admin
   */
  async update(req, res, next) {
    try {
      const { id } = req.params;
      const actor = await actorService.update(id, req.body, req.userId);

      return responseUtil.success(
        res,
        actor,
        "Cập nhật thông tin diễn viên thành công"
      );
    } catch (error) {
      next(error);
    }
  },

  /**
   * [ADMIN] Xóa mềm diễn viên
   * @route DELETE /api/admin/actors/:id
   * @access Admin
   */
  async delete(req, res, next) {
    try {
      const { id } = req.params;
      await actorService.delete(id, req.userId);

      return responseUtil.success(
        res,
        null,
        "Xóa thông tin diễn viên thành công"
      );
    } catch (error) {
      next(error);
    }
  },

  /**
   * [ADMIN] Khôi phục diễn viên bị xóa mềm
   * @route POST /api/admin/actors/:id/restore
   * @access Admin
   */
  async restore(req, res, next) {
    try {
      const { id } = req.params;
      const actor = await actorService.restore(id, req.userId);

      return responseUtil.success(
        res,
        actor,
        "Khôi phục thông tin diễn viên thành công"
      );
    } catch (error) {
      next(error);
    }
  },

  /**
   * [ADMIN] Xóa hàng loạt diễn viên
   * @route DELETE /api/admin/actors/bulk
   * @access Admin
   */
  async bulkDelete(req, res, next) {
    try {
      const { ids } = req.body;
      const count = await actorService.bulkDelete(ids, req.userId);

      return responseUtil.success(
        res,
        { count },
        `Xóa thành công ${count} diễn viên`
      );
    } catch (error) {
      next(error);
    }
  },

  /**
   * [ADMIN] Khôi phục hàng loạt diễn viên
   * @route POST /api/admin/actors/bulk-restore
   * @access Admin
   */
  async bulkRestore(req, res, next) {
    try {
      const { ids } = req.body;
      const count = await actorService.bulkRestore(ids, req.userId);

      return responseUtil.success(
        res,
        { count },
        `Khôi phục thành công ${count} diễn viên`
      );
    } catch (error) {
      next(error);
    }
  },

  /**
   * [ADMIN] Xóa vĩnh viễn diễn viên
   * @route DELETE /api/admin/actors/:id/force
   * @access Admin
   */
  async forceDelete(req, res, next) {
    try {
      const { id } = req.params;
      await actorService.forceDelete(id, req.userId);

      return responseUtil.success(
        res,
        null,
        "Xóa vĩnh viễn thông tin diễn viên thành công"
      );
    } catch (error) {
      next(error);
    }
  },

  /**
   * [ADMIN] Xóa vĩnh viễn hàng loạt diễn viên
   * @route POST /api/admin/actors/bulk-force-delete
   * @access Admin
   */
  async bulkForceDelete(req, res, next) {
    try {
      const { ids } = req.body;
      const count = await actorService.bulkForceDelete(ids, req.userId);

      return responseUtil.success(
        res,
        { count },
        `Đã xóa vĩnh viễn ${count} diễn viên thành công`
      );
    } catch (error) {
      next(error);
    }
  },

  /**
   * [ADMIN] Dọn sạch thùng rác (xóa vĩnh viễn toàn bộ diễn viên trong thùng rác)
   * @route DELETE /api/admin/actors/empty-trash
   * @access Admin
   */
  async emptyTrash(req, res, next) {
    try {
      const count = await actorService.emptyTrash(req.userId);

      return responseUtil.success(
        res,
        { count },
        `Đã dọn sạch thùng rác (${count} diễn viên đã bị xóa vĩnh viễn)`
      );
    } catch (error) {
      next(error);
    }
  },

  /**
   * [PUBLIC] Lấy danh sách diễn viên công khai (chỉ hoạt động, chưa bị xóa)
   * @route GET /api/actors
   * @access Public
   */
  async listPublic(req, res, next) {
    try {
      const {
        page = 1,
        limit = 20,
        search,
        gender,
        nationality,
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

      if (gender) {
        filters.gender = gender;
      }

      if (nationality) {
        filters.nationality = nationality;
      }

      if (order_by) {
        filters.order_by = order_by;
      }

      if (sort) {
        filters.sort = sort.toUpperCase();
      }

      const result = await actorService.getPublicList(filters);

      return responseUtil.paginated(res, {
        items: result.items,
        total: result.total,
        page: result.page,
        limit: result.limit,
        message: "Lấy danh sách diễn viên thành công",
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * [PUBLIC] Lấy chi tiết diễn viên theo slug
   * @route GET /api/actors/:slug
   * @access Public
   */
  async getBySlug(req, res, next) {
    try {
      const { slug } = req.params;
      const actor = await actorService.getBySlug(slug);

      return responseUtil.success(
        res,
        actor,
        "Lấy thông tin diễn viên thành công"
      );
    } catch (error) {
      next(error);
    }
  },
};

export default actorController;
