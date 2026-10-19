/**
 * @file studio.service.js
 * @module Service_Studio
 * @description Lớp dịch vụ xử lý logic nghiệp vụ cho hãng sản xuất (Studio).
 */

import { Op } from "sequelize";
import { slugify } from "../../../utils/slugify.util.js";
import { logger } from "../../../utils/logger.js";
import { Studio, Movie, AuditLog, sequelize } from "../../../models/index.js";

// Các mã lỗi nghiệp vụ
const STUDIO_ERROR_CODES = {
  STUDIO_NOT_FOUND: "STUDIO_001",
  STUDIO_DUPLICATE_NAME: "STUDIO_002",
  STUDIO_DUPLICATE_SLUG: "STUDIO_003",
  INVALID_STUDIO_ID: "STUDIO_004",
};

/**
 * Tạo lỗi nghiệp vụ tùy chỉnh
 */
const createStudioError = (message, statusCode, errorCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.errorCode = errorCode;
  error.isOperational = true;
  return error;
};

export const studioService = {
  /**
   * Tạo slug duy nhất cho studio
   * @param {string} name - Tên studio
   * @param {string} [excludeId] - ID loại trừ
   * @returns {Promise<string>} Slug duy nhất
   */
  async generateUniqueSlug(name, excludeId = null) {
    const baseSlug = slugify(name);
    let slug = baseSlug;
    let count = 0;

    while (true) {
      const whereClause = { slug };
      if (excludeId) {
        whereClause.id = { [Op.ne]: excludeId };
      }

      const existing = await Studio.findOne({
        where: whereClause,
        paranoid: false,
      });

      if (!existing) {
        return slug;
      }

      count++;
      slug = `${baseSlug}-${count}`;
    }
  },

  /**
   * Tạo mới hãng sản xuất
   * @param {Object} data - Dữ liệu studio
   * @param {string} [userId] - ID quản trị viên tạo
   * @returns {Promise<Object>} Hãng sản xuất vừa tạo
   */
  async create(data, userId = null) {
    try {
      const slug = await this.generateUniqueSlug(data.name);

      const studio = await Studio.create({
        ...data,
        slug,
        created_by: userId,
        updated_by: userId,
      });

      logger.info(`[Studio] Created new studio: ${studio.id}`, { studioId: studio.id });

      // Lưu log audit hành động
      await AuditLog.logEvent({
        eventType: "studio.create",
        eventCategory: "admin",
        severity: "info",
        userId,
        metadata: { studioId: studio.id, name: studio.name, slug },
        description: `Tạo hãng sản xuất mới: ${studio.name}`,
        status: "success",
      });

      return studio;
    } catch (error) {
      if (error.isOperational) throw error;
      logger.error("[Studio] Create error:", error);
      throw createStudioError("Lỗi tạo hãng sản xuất", 500, "STUDIO_CREATE_ERR");
    }
  },

  /**
   * Lấy studio theo ID
   * @param {string} id - ID studio
   * @param {boolean} [includeDeleted=false] - Lấy cả studio đã bị xóa mềm
   * @returns {Promise<Object>} Studio
   */
  async getById(id, includeDeleted = false) {
    try {
      const studio = await Studio.findByPk(id, {
        paranoid: !includeDeleted,
      });

      if (!studio) {
        throw createStudioError(
          "Hãng sản xuất không tồn tại hoặc đã bị xóa",
          404,
          STUDIO_ERROR_CODES.STUDIO_NOT_FOUND
        );
      }

      return studio;
    } catch (error) {
      if (error.isOperational) throw error;
      logger.error("[Studio] GetById error:", error);
      throw createStudioError("Lỗi lấy thông tin hãng sản xuất", 500, "STUDIO_ERR");
    }
  },

  /**
   * Lấy studio theo slug (API công khai)
   * @param {string} slug - Slug studio
   * @returns {Promise<Object>} Studio kèm danh sách phim đã sản xuất
   */
  async getBySlug(slug) {
    try {
      const studio = await Studio.findOne({
        where: { slug, is_active: true },
        include: [
          {
            model: Movie,
            as: "movies",
            attributes: ["id", "titles", "slug", "images", "type", "status", "release_date", "imdb_rating"],
            where: { is_published: true },
            required: false,
          },
        ],
      });

      if (!studio) {
        throw createStudioError(
          "Hãng sản xuất không tồn tại hoặc đã bị ẩn",
          404,
          STUDIO_ERROR_CODES.STUDIO_NOT_FOUND
        );
      }

      return studio;
    } catch (error) {
      if (error.isOperational) throw error;
      logger.error("[Studio] GetBySlug error:", error);
      throw createStudioError("Lỗi lấy chi tiết hãng sản xuất", 500, "STUDIO_ERR");
    }
  },

  /**
   * Lấy danh sách hãng sản xuất với bộ lọc và phân trang
   * @param {Object} options - Tùy chọn tìm kiếm
   * @returns {Promise<Object>} Kết quả phân trang
   */
  async getList(options = {}) {
    try {
      const {
        page = 1,
        limit = 20,
        is_active,
        search,
        country,
        order_by = "name",
        sort = "ASC",
        includeDeleted = false,
        onlyDeleted = false,
      } = options;

      const offset = (page - 1) * limit;
      const where = {};

      if (onlyDeleted || (includeDeleted && is_active === false)) {
        where.deleted_at = { [Op.not]: null };
      } else if (is_active !== undefined) {
        where.is_active = is_active;
      }

      if (country) {
        where.country = country;
      }

      if (search) {
        where[Op.or] = [
          { name: { [Op.iLike]: `%${search}%` } },
          { description: { [Op.iLike]: `%${search}%` } },
        ];
      }

      const isParanoid = !includeDeleted && !onlyDeleted;

      const orderClause =
        order_by === "movies_count"
          ? [
              [
                sequelize.literal(
                  '(SELECT COUNT(*)::int FROM movies WHERE movies.studio_id = "Studio"."id" AND movies.deleted_at IS NULL)'
                ),
                sort,
              ],
            ]
          : [[order_by, sort]];

      const { count: total, rows: items } = await Studio.findAndCountAll({
        where,
        attributes: {
          include: [
            [
              sequelize.literal(
                '(SELECT COUNT(*)::int FROM movies WHERE movies.studio_id = "Studio"."id" AND movies.deleted_at IS NULL)'
              ),
              "movies_count",
            ],
          ],
        },
        limit,
        offset,
        order: orderClause,
        paranoid: isParanoid,
      });

      const itemsWithCount = items.map((studio) => {
        const plain = studio.get({ plain: true });
        plain.movies_count = parseInt(plain.movies_count, 10) || 0;
        return plain;
      });

      // Thống kê counts theo trạng thái
      const baseWhere = {};
      if (country) baseWhere.country = country;
      if (search) {
        baseWhere[Op.or] = [
          { name: { [Op.iLike]: `%${search}%` } },
          { description: { [Op.iLike]: `%${search}%` } },
        ];
      }

      const activeGroup = await Studio.findAll({
        attributes: [
          "is_active",
          [sequelize.fn("COUNT", sequelize.col("id")), "count"],
        ],
        where: baseWhere,
        group: ["is_active"],
        raw: true,
        paranoid: true,
      });

      const trashCountResult = await Studio.count({
        where: { ...baseWhere, deleted_at: { [Op.not]: null } },
        paranoid: false,
      });

      let activeCount = 0;
      let inactiveCount = 0;
      let totalActive = 0;

      activeGroup.forEach((row) => {
        const c = parseInt(row.count, 10) || 0;
        totalActive += c;
        if (row.is_active === true || row.is_active === "true" || row.is_active === 1) {
          activeCount += c;
        } else {
          inactiveCount += c;
        }
      });

      const counts = {
        all: totalActive,
        active: activeCount,
        inactive: inactiveCount,
        deleted: trashCountResult || 0,
      };

      return {
        items: itemsWithCount,
        total,
        page,
        limit,
        counts,
      };
    } catch (error) {
      logger.error("[Studio] GetList error:", error);
      throw createStudioError("Lỗi lấy danh sách hãng sản xuất", 500, "STUDIO_ERR");
    }
  },

  /**
   * Lấy danh sách công khai
   */
  async getPublicList(options = {}) {
    return this.getList({
      ...options,
      is_active: true,
      includeDeleted: false,
    });
  },

  /**
   * Cập nhật hãng sản xuất
   * @param {string} id - ID studio
   * @param {Object} data - Dữ liệu cập nhật
   * @param {string} [userId] - ID quản trị viên cập nhật
   * @returns {Promise<Object>} Studio đã cập nhật
   */
  async update(id, data, userId = null) {
    try {
      const studio = await Studio.findByPk(id);

      if (!studio) {
        throw createStudioError(
          "Hãng sản xuất không tồn tại",
          404,
          STUDIO_ERROR_CODES.STUDIO_NOT_FOUND
        );
      }

      const targetName = data.name !== undefined ? data.name.trim() : studio.name;
      const updateData = { ...data, updated_by: userId };
      if (data.name !== undefined) {
        updateData.name = targetName;
      }

      // Tự động đồng bộ slug nếu tên thay đổi hoặc slug hiện tại bị lệch
      if ((data.name && targetName !== studio.name) || slugify(targetName) !== studio.slug) {
        updateData.slug = await this.generateUniqueSlug(targetName, id);
      }

      await studio.update(updateData);
      logger.info(`[Studio] Updated studio: ${id}`, { studioId: id, slug: studio.slug });

      // Lưu log audit hành động
      await AuditLog.logEvent({
        eventType: "studio.update",
        eventCategory: "admin",
        severity: "info",
        userId,
        metadata: { studioId: id, updateFields: Object.keys(data) },
        description: `Cập nhật thông tin hãng sản xuất: ${studio.name}`,
        status: "success",
      });

      return studio;
    } catch (error) {
      if (error.isOperational) throw error;
      logger.error("[Studio] Update error:", error);
      throw createStudioError("Lỗi cập nhật hãng sản xuất", 500, "STUDIO_UPDATE_ERR");
    }
  },

  /**
   * Xóa mềm hãng sản xuất
   * @param {string} id - ID studio
   * @param {string} [userId] - ID quản trị viên xóa
   * @returns {Promise<boolean>} Kết quả
   */
  async delete(id, userId = null) {
    try {
      const studio = await Studio.findByPk(id);

      if (!studio) {
        throw createStudioError(
          "Hãng sản xuất không tồn tại",
          404,
          STUDIO_ERROR_CODES.STUDIO_NOT_FOUND
        );
      }

      // Kiểm tra xem có phim nào đang liên kết không
      const movieCount = await Movie.count({
        where: { studio_id: id },
      });

      if (movieCount > 0) {
        throw createStudioError(
          `Không thể xóa hãng sản xuất vì vẫn còn ${movieCount} bộ phim liên kết`,
          400,
          "STUDIO_HAS_MOVIES"
        );
      }

      await studio.destroy();
      logger.info(`[Studio] Soft deleted studio: ${id}`, { studioId: id });

      // Lưu log audit hành động
      await AuditLog.logEvent({
        eventType: "studio.delete",
        eventCategory: "admin",
        severity: "warn",
        userId,
        metadata: { studioId: id, name: studio.name },
        description: `Xóa mềm hãng sản xuất: ${studio.name}`,
        status: "success",
      });

      return true;
    } catch (error) {
      if (error.isOperational) throw error;
      logger.error("[Studio] Delete error:", error);
      throw createStudioError("Lỗi xóa hãng sản xuất", 500, "STUDIO_DELETE_ERR");
    }
  },

  /**
   * Khôi phục hãng sản xuất bị xóa mềm
   * @param {string} id - ID studio
   * @param {string} [userId] - ID quản trị viên khôi phục
   * @returns {Promise<Object>} Studio đã khôi phục
   */
  async restore(id, userId = null) {
    try {
      const studio = await Studio.findByPk(id, { paranoid: false });

      if (!studio) {
        throw createStudioError(
          "Hãng sản xuất không tồn tại trong danh sách đã xóa",
          404,
          STUDIO_ERROR_CODES.STUDIO_NOT_FOUND
        );
      }

      if (!studio.deleted_at) {
        return studio;
      }

      await studio.restore();
      logger.info(`[Studio] Restored studio: ${id}`, { studioId: id });

      // Lưu log audit hành động
      await AuditLog.logEvent({
        eventType: "studio.restore",
        eventCategory: "admin",
        severity: "info",
        userId,
        metadata: { studioId: id, name: studio.name },
        description: `Khôi phục hãng sản xuất: ${studio.name}`,
        status: "success",
      });

      return studio;
    } catch (error) {
      if (error.isOperational) throw error;
      logger.error("[Studio] Restore error:", error);
      throw createStudioError("Lỗi khôi phục hãng sản xuất", 500, "STUDIO_RESTORE_ERR");
    }
  },

  /**
   * Lấy thông tin thống kê số phim đã sản xuất
   * @param {string} id - ID studio
   * @returns {Promise<Object>} Đối tượng chứa thống kê
   */
  async getStats(id) {
    try {
      const count = await Movie.count({
        where: { studio_id: id },
      });

      return {
        studio_id: id,
        total_movies: count,
      };
    } catch (error) {
      logger.error(`[Studio] Get stats failed for studio ${id}:`, error);
      throw createStudioError("Lỗi lấy thống kê hãng sản xuất", 500, "STUDIO_ERR");
    }
  },

  /**
   * Xóa mềm hàng loạt hãng sản xuất
   * @param {Array<string>} ids - Danh sách ID studio cần xóa
   * @param {string} [userId] - ID quản trị viên
   * @returns {Promise<number>} Số lượng studio đã xóa
   */
  async bulkDelete(ids, userId = null) {
    try {
      await Movie.update(
        { studio_id: null },
        { where: { studio_id: { [Op.in]: ids } } }
      );

      const deletedCount = await Studio.destroy({
        where: { id: { [Op.in]: ids } },
      });

      logger.info(`[Studio] Bulk soft deleted ${deletedCount} studios`, { ids });

      await AuditLog.logEvent({
        eventType: "studio.bulk_delete",
        eventCategory: "admin",
        severity: "warn",
        userId,
        metadata: { ids, count: deletedCount },
        description: `Xóa mềm hàng loạt ${deletedCount} hãng sản xuất`,
        status: "success",
      });

      return deletedCount;
    } catch (error) {
      if (error.isOperational) throw error;
      logger.error("[Studio] BulkDelete error:", error);
      throw createStudioError("Lỗi xóa hàng loạt hãng sản xuất", 500, "STUDIO_DELETE_ERR");
    }
  },

  /**
   * Khôi phục hàng loạt hãng sản xuất bị xóa mềm
   * @param {Array<string>} ids - Danh sách ID studio cần khôi phục
   * @param {string} [userId] - ID quản trị viên
   * @returns {Promise<number>} Số lượng studio đã khôi phục
   */
  async bulkRestore(ids, userId = null) {
    try {
      const restoredCount = await Studio.restore({
        where: { id: { [Op.in]: ids } },
      });

      logger.info(`[Studio] Bulk restored ${restoredCount} studios`, { ids });

      await AuditLog.logEvent({
        eventType: "studio.bulk_restore",
        eventCategory: "admin",
        severity: "info",
        userId,
        metadata: { ids, count: restoredCount },
        description: `Khôi phục hàng loạt ${restoredCount} hãng sản xuất`,
        status: "success",
      });

      return restoredCount;
    } catch (error) {
      if (error.isOperational) throw error;
      logger.error("[Studio] BulkRestore error:", error);
      throw createStudioError("Lỗi khôi phục hàng loạt hãng sản xuất", 500, "STUDIO_RESTORE_ERR");
    }
  },

  /**
   * Xóa vĩnh viễn hãng sản xuất
   * @param {string} id - ID hãng sản xuất
   * @param {string} [userId] - ID quản trị viên
   * @returns {Promise<boolean>}
   */
  async forceDelete(id, userId = null) {
    try {
      const studio = await Studio.findByPk(id, { paranoid: false });

      if (!studio) {
        throw createStudioError(
          "Hãng sản xuất không tồn tại",
          404,
          STUDIO_ERROR_CODES.STUDIO_NOT_FOUND
        );
      }

      // Gỡ liên kết trong Movie (set studio_id = null)
      await Movie.update(
        { studio_id: null },
        { where: { studio_id: id }, paranoid: false }
      ).catch((err) => {
        logger.warn(`[Studio] Failed to nullify studio_id in Movie on force delete ${id}:`, err);
      });

      // Xóa cứng trong Database
      await studio.destroy({ force: true });
      logger.info(`[Studio] Permanently deleted studio: ${id}`, { studioId: id, userId });

      await AuditLog.logEvent({
        eventType: "studio.force_delete",
        eventCategory: "admin",
        severity: "warn",
        userId,
        metadata: { studioId: id, name: studio.name },
        description: `Xóa vĩnh viễn hãng sản xuất: ${studio.name}`,
        status: "success",
      });

      return true;
    } catch (error) {
      if (error.isOperational) throw error;
      logger.error("[Studio] Force delete error:", error);
      throw createStudioError("Lỗi xóa vĩnh viễn hãng sản xuất", 500, "STUDIO_FORCE_DELETE_ERR");
    }
  },

  /**
   * Xóa vĩnh viễn hàng loạt hãng sản xuất
   * @param {Array<string>} ids - Danh sách ID cần xóa vĩnh viễn
   * @param {string} [userId] - ID quản trị viên
   * @returns {Promise<number>} Số lượng đã xóa
   */
  async bulkForceDelete(ids, userId = null) {
    try {
      if (!Array.isArray(ids) || ids.length === 0) {
        return 0;
      }

      // Gỡ liên kết trong Movie
      await Movie.update(
        { studio_id: null },
        { where: { studio_id: { [Op.in]: ids } }, paranoid: false }
      ).catch((err) => {
        logger.warn(`[Studio] Failed to bulk nullify studio_id in Movie:`, err);
      });

      const deletedCount = await Studio.destroy({
        where: { id: { [Op.in]: ids } },
        force: true,
      });

      logger.info(`[Studio] Bulk permanently deleted ${deletedCount} studios`, { ids, userId });

      await AuditLog.logEvent({
        eventType: "studio.bulk_force_delete",
        eventCategory: "admin",
        severity: "warn",
        userId,
        metadata: { ids, count: deletedCount },
        description: `Xóa vĩnh viễn hàng loạt ${deletedCount} hãng sản xuất`,
        status: "success",
      });

      return deletedCount;
    } catch (error) {
      if (error.isOperational) throw error;
      logger.error("[Studio] Bulk force delete error:", error);
      throw createStudioError("Lỗi xóa vĩnh viễn hàng loạt hãng sản xuất", 500, "STUDIO_BULK_FORCE_DELETE_ERR");
    }
  },

  /**
   * Dọn sạch thùng rác (xóa vĩnh viễn tất cả hãng sản xuất đã bị xóa mềm)
   * @param {string} [userId] - ID quản trị viên
   * @returns {Promise<number>} Số lượng đã xóa
   */
  async emptyTrash(userId = null) {
    try {
      const trashed = await Studio.findAll({
        attributes: ["id"],
        where: { deleted_at: { [Op.not]: null } },
        paranoid: false,
      });

      if (!trashed.length) {
        return 0;
      }

      const ids = trashed.map((s) => s.id);

      // Gỡ liên kết trong Movie
      await Movie.update(
        { studio_id: null },
        { where: { studio_id: { [Op.in]: ids } }, paranoid: false }
      ).catch((err) => {
        logger.warn(`[Studio] Failed to nullify studio_id on empty trash:`, err);
      });

      const deletedCount = await Studio.destroy({
        where: { id: { [Op.in]: ids } },
        force: true,
      });

      logger.info(`[Studio] Empty trash: permanently deleted ${deletedCount} studios`, { userId });

      await AuditLog.logEvent({
        eventType: "studio.empty_trash",
        eventCategory: "admin",
        severity: "warn",
        userId,
        metadata: { count: deletedCount },
        description: `Dọn sạch thùng rác: xóa vĩnh viễn ${deletedCount} hãng sản xuất`,
        status: "success",
      });

      return deletedCount;
    } catch (error) {
      if (error.isOperational) throw error;
      logger.error("[Studio] Empty trash error:", error);
      throw createStudioError("Lỗi dọn sạch thùng rác hãng sản xuất", 500, "STUDIO_EMPTY_TRASH_ERR");
    }
  },
};

export default studioService;
