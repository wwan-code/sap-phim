/**
 * @file series.service.js
 * @module Service_Series
 * @description Lớp dịch vụ xử lý logic nghiệp vụ cho thương hiệu phim (Series).
 */

import { Op } from "sequelize";
import { slugify } from "../../../utils/slugify.util.js";
import { logger } from "../../../utils/logger.js";
import { Series, Movie, AuditLog, sequelize } from "../../../models/index.js";

// Các mã lỗi nghiệp vụ
const SERIES_ERROR_CODES = {
  SERIES_NOT_FOUND: "SERIES_001",
  SERIES_DUPLICATE_NAME: "SERIES_002",
  SERIES_DUPLICATE_SLUG: "SERIES_003",
  INVALID_SERIES_ID: "SERIES_004",
};

/**
 * Tạo lỗi nghiệp vụ tùy chỉnh
 */
const createSeriesError = (message, statusCode, errorCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.errorCode = errorCode;
  error.isOperational = true;
  return error;
};

export const seriesService = {
  /**
   * Tạo slug duy nhất cho series
   * @param {string} name - Tên series
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

      const existing = await Series.findOne({
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
   * Tạo mới thương hiệu phim
   * @param {Object} data - Dữ liệu series
   * @param {string} [userId] - ID quản trị viên tạo
   * @returns {Promise<Object>} Thương hiệu phim vừa tạo
   */
  async create(data, userId = null) {
    try {
      const slug = await this.generateUniqueSlug(data.name);

      const series = await Series.create({
        ...data,
        slug,
        created_by: userId,
        updated_by: userId,
        total_movies: 0,
      });

      logger.info(`[Series] Created new series: ${series.id}`, { seriesId: series.id });

      // Lưu log audit hành động
      await AuditLog.logEvent({
        eventType: "series.create",
        eventCategory: "admin",
        severity: "info",
        userId,
        metadata: { seriesId: series.id, name: series.name, slug },
        description: `Tạo thương hiệu phim mới: ${series.name}`,
        status: "success",
      });

      return series;
    } catch (error) {
      if (error.isOperational) throw error;
      logger.error("[Series] Create error:", error);
      throw createSeriesError("Lỗi tạo thương hiệu phim", 500, "SERIES_CREATE_ERR");
    }
  },

  /**
   * Lấy thương hiệu phim theo ID
   * @param {string} id - ID series
   * @param {boolean} [includeDeleted=false] - Lấy cả series đã bị xóa mềm
   * @returns {Promise<Object>} Series
   */
  async getById(id, includeDeleted = false) {
    try {
      // Đồng bộ số lượng phim liên kết trước khi trả về
      await this.syncMoviesCount(id);

      const series = await Series.findByPk(id, {
        paranoid: !includeDeleted,
      });

      if (!series) {
        throw createSeriesError(
          "Thương hiệu phim không tồn tại hoặc đã bị xóa",
          404,
          SERIES_ERROR_CODES.SERIES_NOT_FOUND
        );
      }

      return series;
    } catch (error) {
      if (error.isOperational) throw error;
      logger.error("[Series] GetById error:", error);
      throw createSeriesError("Lỗi lấy thông tin thương hiệu phim", 500, "SERIES_ERR");
    }
  },

  /**
   * Lấy thương hiệu phim theo slug (API công khai)
   * @param {string} slug - Slug series
   * @returns {Promise<Object>} Series kèm danh sách phim trong thương hiệu
   */
  async getBySlug(slug) {
    try {
      const series = await Series.findOne({
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

      if (!series) {
        throw createSeriesError(
          "Thương hiệu phim không tồn tại hoặc đã bị ẩn",
          404,
          SERIES_ERROR_CODES.SERIES_NOT_FOUND
        );
      }

      // Đồng bộ số lượng phim liên kết
      await this.syncMoviesCount(series.id);

      return series;
    } catch (error) {
      if (error.isOperational) throw error;
      logger.error("[Series] GetBySlug error:", error);
      throw createSeriesError("Lỗi lấy chi tiết thương hiệu phim", 500, "SERIES_ERR");
    }
  },

  /**
   * Lấy danh sách thương hiệu phim với bộ lọc và phân trang
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

      if (search) {
        where.name = { [Op.iLike]: `%${search}%` };
      }

      const isParanoid = !includeDeleted && !onlyDeleted;

      const { count: total, rows: items } = await Series.findAndCountAll({
        where,
        limit,
        offset,
        order: [[order_by, sort]],
        paranoid: isParanoid,
      });

      // Đồng bộ movies count cho các series trả về
      await Promise.all(
        items.map((series) => this.syncMoviesCount(series.id))
      );

      // Fetch lại để có movies count chính xác
      const refreshedItems = await Series.findAll({
        where: {
          id: { [Op.in]: items.map(item => item.id) }
        },
        order: [[order_by, sort]],
        paranoid: isParanoid,
      });

      // Thống kê counts theo trạng thái
      const baseWhere = {};
      if (search) {
        baseWhere.name = { [Op.iLike]: `%${search}%` };
      }

      const activeGroup = await Series.findAll({
        attributes: [
          "is_active",
          [sequelize.fn("COUNT", sequelize.col("id")), "count"],
        ],
        where: baseWhere,
        group: ["is_active"],
        raw: true,
        paranoid: true,
      });

      const trashCountResult = await Series.count({
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
        items: refreshedItems,
        total,
        page,
        limit,
        counts,
      };
    } catch (error) {
      logger.error("[Series] GetList error:", error);
      throw createSeriesError("Lỗi lấy danh sách thương hiệu phim", 500, "SERIES_ERR");
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
   * Cập nhật thương hiệu phim
   * @param {string} id - ID series
   * @param {Object} data - Dữ liệu cập nhật
   * @param {string} [userId] - ID quản trị viên cập nhật
   * @returns {Promise<Object>} Series đã cập nhật
   */
  async update(id, data, userId = null) {
    try {
      const series = await Series.findByPk(id);

      if (!series) {
        throw createSeriesError(
          "Thương hiệu phim không tồn tại",
          404,
          SERIES_ERROR_CODES.SERIES_NOT_FOUND
        );
      }

      const targetName = data.name !== undefined ? data.name.trim() : series.name;
      const updateData = { ...data, updated_by: userId };
      if (data.name !== undefined) {
        updateData.name = targetName;
      }

      // Tự động đồng bộ slug nếu tên thay đổi hoặc slug hiện tại bị lệch
      if ((data.name && targetName !== series.name) || slugify(targetName) !== series.slug) {
        updateData.slug = await this.generateUniqueSlug(targetName, id);
      }

      await series.update(updateData);
      logger.info(`[Series] Updated series: ${id}`, { seriesId: id, slug: series.slug });

      // Lưu log audit hành động
      await AuditLog.logEvent({
        eventType: "series.update",
        eventCategory: "admin",
        severity: "info",
        userId,
        metadata: { seriesId: id, updateFields: Object.keys(data) },
        description: `Cập nhật thông tin thương hiệu phim: ${series.name}`,
        status: "success",
      });

      return series;
    } catch (error) {
      if (error.isOperational) throw error;
      logger.error("[Series] Update error:", error);
      throw createSeriesError("Lỗi cập nhật thương hiệu phim", 500, "SERIES_UPDATE_ERR");
    }
  },

  /**
   * Xóa mềm thương hiệu phim
   * @param {string} id - ID series
   * @param {string} [userId] - ID quản trị viên xóa
   * @returns {Promise<boolean>} Kết quả
   */
  async delete(id, userId = null) {
    try {
      const series = await Series.findByPk(id);

      if (!series) {
        throw createSeriesError(
          "Thương hiệu phim không tồn tại",
          404,
          SERIES_ERROR_CODES.SERIES_NOT_FOUND
        );
      }

      // Giải phóng các phim liên kết (thiết lập series_id = null)
      // Theo thiết lập association onDelete: 'SET NULL', Sequelize sẽ tự thực hiện nếu ta cấu hình. 
      // Hoặc ta có thể cập nhật thủ công các phim liên quan để đảm bảo tính an toàn.
      await Movie.update(
        { series_id: null },
        { where: { series_id: id } }
      );

      await series.destroy();
      logger.info(`[Series] Soft deleted series: ${id}`, { seriesId: id });

      // Lưu log audit hành động
      await AuditLog.logEvent({
        eventType: "series.delete",
        eventCategory: "admin",
        severity: "warn",
        userId,
        metadata: { seriesId: id, name: series.name },
        description: `Xóa mềm thương hiệu phim: ${series.name}`,
        status: "success",
      });

      return true;
    } catch (error) {
      if (error.isOperational) throw error;
      logger.error("[Series] Delete error:", error);
      throw createSeriesError("Lỗi xóa thương hiệu phim", 500, "SERIES_DELETE_ERR");
    }
  },

  /**
   * Khôi phục thương hiệu phim bị xóa mềm
   * @param {string} id - ID series
   * @param {string} [userId] - ID quản trị viên khôi phục
   * @returns {Promise<Object>} Series đã khôi phục
   */
  async restore(id, userId = null) {
    try {
      const series = await Series.findByPk(id, { paranoid: false });

      if (!series) {
        throw createSeriesError(
          "Thương hiệu phim không tồn tại trong danh sách đã xóa",
          404,
          SERIES_ERROR_CODES.SERIES_NOT_FOUND
        );
      }

      if (!series.deleted_at) {
        return series;
      }

      await series.restore();
      logger.info(`[Series] Restored series: ${id}`, { seriesId: id });

      // Lưu log audit hành động
      await AuditLog.logEvent({
        eventType: "series.restore",
        eventCategory: "admin",
        severity: "info",
        userId,
        metadata: { seriesId: id, name: series.name },
        description: `Khôi phục thương hiệu phim: ${series.name}`,
        status: "success",
      });

      return series;
    } catch (error) {
      if (error.isOperational) throw error;
      logger.error("[Series] Restore error:", error);
      throw createSeriesError("Lỗi khôi phục thương hiệu phim", 500, "SERIES_RESTORE_ERR");
    }
  },

  /**
   * Đồng bộ và cập nhật tổng số phim liên kết
   * @param {string} id - ID series
   * @returns {Promise<number>} Số phim liên kết
   */
  async syncMoviesCount(id) {
    try {
      const count = await Movie.count({
        where: { series_id: id },
      });

      await Series.update(
        { total_movies: count },
        { where: { id }, paranoid: false }
      );

      return count;
    } catch (error) {
      logger.error(`[Series] Sync movies count failed for series ${id}:`, error);
      return 0;
    }
  },

  /**
   * Xóa mềm hàng loạt thương hiệu phim
   * @param {Array<string>} ids - Danh sách ID series cần xóa
   * @param {string} [userId] - ID quản trị viên
   * @returns {Promise<number>} Số lượng series đã xóa
   */
  async bulkDelete(ids, userId = null) {
    try {
      await Movie.update(
        { series_id: null },
        { where: { series_id: { [Op.in]: ids } } }
      );

      const deletedCount = await Series.destroy({
        where: { id: { [Op.in]: ids } },
      });

      logger.info(`[Series] Bulk soft deleted ${deletedCount} series`, { ids });

      await AuditLog.logEvent({
        eventType: "series.bulk_delete",
        eventCategory: "admin",
        severity: "warn",
        userId,
        metadata: { ids, count: deletedCount },
        description: `Xóa mềm hàng loạt ${deletedCount} thương hiệu phim`,
        status: "success",
      });

      return deletedCount;
    } catch (error) {
      if (error.isOperational) throw error;
      logger.error("[Series] BulkDelete error:", error);
      throw createSeriesError("Lỗi xóa hàng loạt thương hiệu phim", 500, "SERIES_DELETE_ERR");
    }
  },

  /**
   * Khôi phục hàng loạt thương hiệu phim bị xóa mềm
   * @param {Array<string>} ids - Danh sách ID series cần khôi phục
   * @param {string} [userId] - ID quản trị viên
   * @returns {Promise<number>} Số lượng series đã khôi phục
   */
  async bulkRestore(ids, userId = null) {
    try {
      const restoredCount = await Series.restore({
        where: { id: { [Op.in]: ids } },
      });

      logger.info(`[Series] Bulk restored ${restoredCount} series`, { ids });

      await AuditLog.logEvent({
        eventType: "series.bulk_restore",
        eventCategory: "admin",
        severity: "info",
        userId,
        metadata: { ids, count: restoredCount },
        description: `Khôi phục hàng loạt ${restoredCount} thương hiệu phim`,
        status: "success",
      });

      return restoredCount;
    } catch (error) {
      if (error.isOperational) throw error;
      logger.error("[Series] BulkRestore error:", error);
      throw createSeriesError("Lỗi khôi phục hàng loạt thương hiệu phim", 500, "SERIES_RESTORE_ERR");
    }
  },

  /**
   * Xóa vĩnh viễn thương hiệu phim
   * @param {string} id - ID thương hiệu phim
   * @param {string} [userId] - ID quản trị viên
   * @returns {Promise<boolean>}
   */
  async forceDelete(id, userId = null) {
    try {
      const series = await Series.findByPk(id, { paranoid: false });

      if (!series) {
        throw createSeriesError(
          "Thương hiệu phim không tồn tại",
          404,
          SERIES_ERROR_CODES.SERIES_NOT_FOUND
        );
      }

      // Gỡ liên kết trong Movie (set series_id = null)
      await Movie.update(
        { series_id: null },
        { where: { series_id: id }, paranoid: false }
      ).catch((err) => {
        logger.warn(`[Series] Failed to nullify series_id in Movie on force delete ${id}:`, err);
      });

      // Xóa cứng trong Database
      await series.destroy({ force: true });
      logger.info(`[Series] Permanently deleted series: ${id}`, { seriesId: id, userId });

      await AuditLog.logEvent({
        eventType: "series.force_delete",
        eventCategory: "admin",
        severity: "warn",
        userId,
        metadata: { seriesId: id, name: series.name },
        description: `Xóa vĩnh viễn thương hiệu phim: ${series.name}`,
        status: "success",
      });

      return true;
    } catch (error) {
      if (error.isOperational) throw error;
      logger.error("[Series] Force delete error:", error);
      throw createSeriesError("Lỗi xóa vĩnh viễn thương hiệu phim", 500, "SERIES_FORCE_DELETE_ERR");
    }
  },

  /**
   * Xóa vĩnh viễn hàng loạt thương hiệu phim
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
        { series_id: null },
        { where: { series_id: { [Op.in]: ids } }, paranoid: false }
      ).catch((err) => {
        logger.warn(`[Series] Failed to bulk nullify series_id in Movie:`, err);
      });

      const deletedCount = await Series.destroy({
        where: { id: { [Op.in]: ids } },
        force: true,
      });

      logger.info(`[Series] Bulk permanently deleted ${deletedCount} series`, { ids, userId });

      await AuditLog.logEvent({
        eventType: "series.bulk_force_delete",
        eventCategory: "admin",
        severity: "warn",
        userId,
        metadata: { ids, count: deletedCount },
        description: `Xóa vĩnh viễn hàng loạt ${deletedCount} thương hiệu phim`,
        status: "success",
      });

      return deletedCount;
    } catch (error) {
      if (error.isOperational) throw error;
      logger.error("[Series] Bulk force delete error:", error);
      throw createSeriesError("Lỗi xóa vĩnh viễn hàng loạt thương hiệu phim", 500, "SERIES_BULK_FORCE_DELETE_ERR");
    }
  },

  /**
   * Dọn sạch thùng rác (xóa vĩnh viễn tất cả thương hiệu phim đã bị xóa mềm)
   * @param {string} [userId] - ID quản trị viên
   * @returns {Promise<number>} Số lượng đã xóa
   */
  async emptyTrash(userId = null) {
    try {
      const trashed = await Series.findAll({
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
        { series_id: null },
        { where: { series_id: { [Op.in]: ids } }, paranoid: false }
      ).catch((err) => {
        logger.warn(`[Series] Failed to nullify series_id on empty trash:`, err);
      });

      const deletedCount = await Series.destroy({
        where: { id: { [Op.in]: ids } },
        force: true,
      });

      logger.info(`[Series] Empty trash: permanently deleted ${deletedCount} series`, { userId });

      await AuditLog.logEvent({
        eventType: "series.empty_trash",
        eventCategory: "admin",
        severity: "warn",
        userId,
        metadata: { count: deletedCount },
        description: `Dọn sạch thùng rác: xóa vĩnh viễn ${deletedCount} thương hiệu phim`,
        status: "success",
      });

      return deletedCount;
    } catch (error) {
      if (error.isOperational) throw error;
      logger.error("[Series] Empty trash error:", error);
      throw createSeriesError("Lỗi dọn sạch thùng rác thương hiệu phim", 500, "SERIES_EMPTY_TRASH_ERR");
    }
  },
};

export default seriesService;
