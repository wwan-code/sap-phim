/**
 * @file actor.service.js
 * @module Service_Actor
 * @description Lớp dịch vụ xử lý logic nghiệp vụ cho diễn viên (Actor).
 */

import { Op } from "sequelize";
import { slugify } from "../../../utils/slugify.util.js";
import { logger } from "../../../utils/logger.js";
import { Actor, MovieActor, Movie, AuditLog, sequelize } from "../../../models/index.js";

// Các mã lỗi nghiệp vụ
const ACTOR_ERROR_CODES = {
  ACTOR_NOT_FOUND: "ACTOR_001",
  ACTOR_DUPLICATE_NAME: "ACTOR_002",
  ACTOR_DUPLICATE_SLUG: "ACTOR_003",
  INVALID_ACTOR_ID: "ACTOR_004",
};

/**
 * Tạo lỗi nghiệp vụ tùy chỉnh
 */
const createActorError = (message, statusCode, errorCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.errorCode = errorCode;
  error.isOperational = true;
  return error;
};

export const actorService = {
  /**
   * Tạo slug duy nhất bằng cách kiểm tra trùng lặp và thêm suffix nếu cần
   * @param {string} name - Tên diễn viên
   * @param {string} [excludeId] - ID loại trừ khi kiểm tra cập nhật
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

      // Kiểm tra xem slug đã tồn tại chưa (bao gồm cả các bản ghi đã xóa mềm)
      const existing = await Actor.findOne({
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
   * Tạo mới diễn viên
   * @param {Object} data - Dữ liệu diễn viên
   * @param {string} [userId] - ID quản trị viên tạo
   * @returns {Promise<Object>} Diễn viên vừa tạo
   */
  async create(data, userId = null) {
    try {
      // Tự động sinh slug duy nhất
      const slug = await this.generateUniqueSlug(data.name);

      // Tạo diễn viên mới
      const actor = await Actor.create({
        ...data,
        slug,
        created_by: userId,
        updated_by: userId,
        movies_count: 0,
      });

      logger.info(`[Actor] Created new actor: ${actor.id}`, { actorId: actor.id });

      // Lưu log audit hành động
      await AuditLog.logEvent({
        eventType: "actor.create",
        eventCategory: "admin",
        severity: "info",
        userId,
        metadata: { actorId: actor.id, name: actor.name, slug },
        description: `Tạo diễn viên mới: ${actor.name}`,
        status: "success",
      });

      return actor;
    } catch (error) {
      if (error.isOperational) throw error;
      logger.error("[Actor] Create error:", error);
      throw createActorError("Lỗi tạo diễn viên", 500, "ACTOR_CREATE_ERR");
    }
  },

  /**
   * Lấy diễn viên theo ID
   * @param {string} id - ID diễn viên
   * @param {boolean} [includeDeleted=false] - Lấy cả diễn viên đã bị xóa mềm
   * @returns {Promise<Object>} Diễn viên
   */
  async getById(id, includeDeleted = false) {
    try {
      const actor = await Actor.findByPk(id, {
        paranoid: !includeDeleted,
      });

      if (!actor) {
        throw createActorError(
          "Diễn viên không tồn tại hoặc đã bị xóa",
          404,
          ACTOR_ERROR_CODES.ACTOR_NOT_FOUND
        );
      }

      return actor;
    } catch (error) {
      if (error.isOperational) throw error;
      logger.error("[Actor] GetById error:", error);
      throw createActorError("Lỗi lấy thông tin diễn viên", 500, "ACTOR_ERR");
    }
  },

  /**
   * Lấy diễn viên theo slug (API công khai)
   * @param {string} slug - Slug diễn viên
   * @returns {Promise<Object>} Diễn viên kèm danh sách phim tham gia
   */
  async getBySlug(slug) {
    try {
      const actor = await Actor.findOne({
        where: { slug, is_active: true },
        include: [
          {
            model: Movie,
            as: "movies",
            attributes: ["id", "titles", "slug", "images", "type", "status", "release_date", "imdb_rating"],
            through: {
              attributes: ["role_name", "character_name", "character_image", "cast_order", "is_main_cast"],
            },
            where: { is_published: true },
            required: false,
          },
        ],
      });

      if (!actor) {
        throw createActorError(
          "Diễn viên không tồn tại hoặc đã bị ẩn",
          404,
          ACTOR_ERROR_CODES.ACTOR_NOT_FOUND
        );
      }

      return actor;
    } catch (error) {
      if (error.isOperational) throw error;
      logger.error("[Actor] GetBySlug error:", error);
      throw createActorError("Lỗi lấy chi tiết diễn viên", 500, "ACTOR_ERR");
    }
  },

  /**
   * Lấy danh sách diễn viên với bộ lọc và phân trang
   * @param {Object} options - Tùy chọn tìm kiếm
   * @returns {Promise<Object>} Danh sách kết quả phân trang
   */
  async getList(options = {}) {
    try {
      const {
        page = 1,
        limit = 20,
        is_active,
        search,
        gender,
        nationality,
        order_by = "popularity_score",
        sort = "DESC",
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

      if (gender) {
        where.gender = gender;
      }

      if (nationality) {
        where.nationality = nationality;
      }

      if (search) {
        where[Op.or] = [
          { name: { [Op.iLike]: `%${search}%` } },
          { biography: { [Op.iLike]: `%${search}%` } },
          // Tìm kiếm trong JSONB aliases nếu cần
          {
            aliases: {
              [Op.contains]: [search],
            },
          },
        ];
      }

      const isParanoid = !includeDeleted && !onlyDeleted;

      const { count: total, rows: items } = await Actor.findAndCountAll({
        where,
        limit,
        offset,
        order: [[order_by, sort]],
        paranoid: isParanoid,
      });

      // Thống kê counts theo trạng thái
      const baseWhere = {};
      if (gender) baseWhere.gender = gender;
      if (nationality) baseWhere.nationality = nationality;
      if (search) {
        baseWhere[Op.or] = [
          { name: { [Op.iLike]: `%${search}%` } },
          { biography: { [Op.iLike]: `%${search}%` } },
        ];
      }

      const activeGroup = await Actor.findAll({
        attributes: [
          "is_active",
          [sequelize.fn("COUNT", sequelize.col("id")), "count"],
        ],
        where: baseWhere,
        group: ["is_active"],
        raw: true,
        paranoid: true,
      });

      const trashCountResult = await Actor.count({
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
        items,
        total,
        page,
        limit,
        counts,
      };
    } catch (error) {
      logger.error("[Actor] GetList error:", error);
      throw createActorError("Lỗi lấy danh sách diễn viên", 500, "ACTOR_ERR");
    }
  },

  /**
   * Lấy danh sách công khai (chỉ hoạt động và chưa bị xóa mềm)
   */
  async getPublicList(options = {}) {
    return this.getList({
      ...options,
      is_active: true,
      includeDeleted: false,
    });
  },

  /**
   * Cập nhật diễn viên
   * @param {string} id - ID diễn viên
   * @param {Object} data - Dữ liệu cập nhật
   * @param {string} [userId] - ID quản trị viên cập nhật
   * @returns {Promise<Object>} Diễn viên đã cập nhật
   */
  async update(id, data, userId = null) {
    try {
      const actor = await Actor.findByPk(id);

      if (!actor) {
        throw createActorError(
          "Diễn viên không tồn tại",
          404,
          ACTOR_ERROR_CODES.ACTOR_NOT_FOUND
        );
      }

      const targetName = data.name !== undefined ? data.name.trim() : actor.name;
      const updateData = { ...data, updated_by: userId };
      if (data.name !== undefined) {
        updateData.name = targetName;
      }

      // Tự động đồng bộ slug nếu tên thay đổi hoặc slug hiện tại bị lệch
      if ((data.name && targetName !== actor.name) || slugify(targetName) !== actor.slug) {
        updateData.slug = await this.generateUniqueSlug(targetName, id);
      }

      await actor.update(updateData);
      logger.info(`[Actor] Updated actor: ${id}`, { actorId: id, slug: actor.slug });

      // Lưu log audit hành động
      await AuditLog.logEvent({
        eventType: "actor.update",
        eventCategory: "admin",
        severity: "info",
        userId,
        metadata: { actorId: id, updateFields: Object.keys(data) },
        description: `Cập nhật thông tin diễn viên: ${actor.name}`,
        status: "success",
      });

      return actor;
    } catch (error) {
      if (error.isOperational) throw error;
      logger.error("[Actor] Update error:", error);
      throw createActorError("Lỗi cập nhật diễn viên", 500, "ACTOR_UPDATE_ERR");
    }
  },

  /**
   * Xóa mềm diễn viên
   * @param {string} id - ID diễn viên
   * @param {string} [userId] - ID quản trị viên xóa
   * @returns {Promise<boolean>} Kết quả
   */
  async delete(id, userId = null) {
    try {
      const actor = await Actor.findByPk(id);

      if (!actor) {
        throw createActorError(
          "Diễn viên không tồn tại",
          404,
          ACTOR_ERROR_CODES.ACTOR_NOT_FOUND
        );
      }

      // Xóa mềm
      await actor.destroy();
      logger.info(`[Actor] Soft deleted actor: ${id}`, { actorId: id });

      // Lưu log audit hành động
      await AuditLog.logEvent({
        eventType: "actor.delete",
        eventCategory: "admin",
        severity: "warn",
        userId,
        metadata: { actorId: id, name: actor.name },
        description: `Xóa mềm diễn viên: ${actor.name}`,
        status: "success",
      });

      return true;
    } catch (error) {
      if (error.isOperational) throw error;
      logger.error("[Actor] Delete error:", error);
      throw createActorError("Lỗi xóa diễn viên", 500, "ACTOR_DELETE_ERR");
    }
  },

  /**
   * Khôi phục diễn viên bị xóa mềm
   * @param {string} id - ID diễn viên
   * @param {string} [userId] - ID quản trị viên khôi phục
   * @returns {Promise<Object>} Diễn viên đã khôi phục
   */
  async restore(id, userId = null) {
    try {
      const actor = await Actor.findByPk(id, { paranoid: false });

      if (!actor) {
        throw createActorError(
          "Diễn viên không tồn tại trong danh sách đã xóa",
          404,
          ACTOR_ERROR_CODES.ACTOR_NOT_FOUND
        );
      }

      if (!actor.deleted_at) {
        return actor;
      }

      // Khôi phục
      await actor.restore();
      logger.info(`[Actor] Restored actor: ${id}`, { actorId: id });

      // Lưu log audit hành động
      await AuditLog.logEvent({
        eventType: "actor.restore",
        eventCategory: "admin",
        severity: "info",
        userId,
        metadata: { actorId: id, name: actor.name },
        description: `Khôi phục diễn viên: ${actor.name}`,
        status: "success",
      });

      return actor;
    } catch (error) {
      if (error.isOperational) throw error;
      logger.error("[Actor] Restore error:", error);
      throw createActorError("Lỗi khôi phục diễn viên", 500, "ACTOR_RESTORE_ERR");
    }
  },

  /**
   * Đồng bộ và cập nhật tổng số phim đã tham gia
   * @param {string} id - ID diễn viên
   * @returns {Promise<number>} Số phim đã tham gia
   */
  async syncMoviesCount(id) {
    try {
      const count = await MovieActor.count({
        where: { actor_id: id },
      });

      await Actor.update(
        { movies_count: count },
        { where: { id }, paranoid: false }
      );

      return count;
    } catch (error) {
      logger.error(`[Actor] Sync movies count failed for actor ${id}:`, error);
      return 0;
    }
  },

  /**
   * Xóa mềm hàng loạt diễn viên
   * @param {Array<string>} ids - Danh sách ID diễn viên cần xóa
   * @param {string} [userId] - ID quản trị viên
   * @returns {Promise<number>} Số lượng diễn viên đã xóa
   */
  async bulkDelete(ids, userId = null) {
    try {
      const deletedCount = await Actor.destroy({
        where: { id: { [Op.in]: ids } },
      });

      logger.info(`[Actor] Bulk soft deleted ${deletedCount} actors`, { ids });

      await AuditLog.logEvent({
        eventType: "actor.bulk_delete",
        eventCategory: "admin",
        severity: "warn",
        userId,
        metadata: { ids, count: deletedCount },
        description: `Xóa mềm hàng loạt ${deletedCount} diễn viên`,
        status: "success",
      });

      return deletedCount;
    } catch (error) {
      if (error.isOperational) throw error;
      logger.error("[Actor] BulkDelete error:", error);
      throw createActorError("Lỗi xóa hàng loạt diễn viên", 500, "ACTOR_DELETE_ERR");
    }
  },

  /**
   * Khôi phục hàng loạt diễn viên bị xóa mềm
   * @param {Array<string>} ids - Danh sách ID diễn viên cần khôi phục
   * @param {string} [userId] - ID quản trị viên
   * @returns {Promise<number>} Số lượng diễn viên đã khôi phục
   */
  async bulkRestore(ids, userId = null) {
    try {
      const restoredCount = await Actor.restore({
        where: { id: { [Op.in]: ids } },
      });

      logger.info(`[Actor] Bulk restored ${restoredCount} actors`, { ids });

      await AuditLog.logEvent({
        eventType: "actor.bulk_restore",
        eventCategory: "admin",
        severity: "info",
        userId,
        metadata: { ids, count: restoredCount },
        description: `Khôi phục hàng loạt ${restoredCount} diễn viên`,
        status: "success",
      });

      return restoredCount;
    } catch (error) {
      if (error.isOperational) throw error;
      logger.error("[Actor] BulkRestore error:", error);
      throw createActorError("Lỗi khôi phục hàng loạt diễn viên", 500, "ACTOR_RESTORE_ERR");
    }
  },

  /**
   * Xóa vĩnh viễn diễn viên
   * @param {string} id - ID diễn viên
   * @param {string} [userId] - ID quản trị viên
   * @returns {Promise<boolean>}
   */
  async forceDelete(id, userId = null) {
    try {
      const actor = await Actor.findByPk(id, { paranoid: false });

      if (!actor) {
        throw createActorError(
          "Diễn viên không tồn tại",
          404,
          ACTOR_ERROR_CODES.ACTOR_NOT_FOUND
        );
      }

      // Xóa liên kết trong bảng trung gian MovieActor
      await MovieActor.destroy({ where: { actor_id: id } }).catch((err) => {
        logger.warn(`[Actor] Failed to detach MovieActor on force delete actor ${id}:`, err);
      });

      // Xóa cứng trong Database
      await actor.destroy({ force: true });
      logger.info(`[Actor] Permanently deleted actor: ${id}`, { actorId: id, userId });

      await AuditLog.logEvent({
        eventType: "actor.force_delete",
        eventCategory: "admin",
        severity: "warn",
        userId,
        metadata: { actorId: id, name: actor.name },
        description: `Xóa vĩnh viễn diễn viên: ${actor.name}`,
        status: "success",
      });

      return true;
    } catch (error) {
      if (error.isOperational) throw error;
      logger.error("[Actor] Force delete error:", error);
      throw createActorError("Lỗi xóa vĩnh viễn diễn viên", 500, "ACTOR_FORCE_DELETE_ERR");
    }
  },

  /**
   * Xóa vĩnh viễn hàng loạt diễn viên
   * @param {Array<string>} ids - Danh sách ID diễn viên cần xóa vĩnh viễn
   * @param {string} [userId] - ID quản trị viên
   * @returns {Promise<number>} Số lượng đã xóa
   */
  async bulkForceDelete(ids, userId = null) {
    try {
      if (!Array.isArray(ids) || ids.length === 0) {
        return 0;
      }

      // Xóa liên kết trong bảng trung gian MovieActor
      await MovieActor.destroy({ where: { actor_id: { [Op.in]: ids } } }).catch((err) => {
        logger.warn(`[Actor] Failed to bulk detach MovieActor on force delete:`, err);
      });

      const deletedCount = await Actor.destroy({
        where: { id: { [Op.in]: ids } },
        force: true,
      });

      logger.info(`[Actor] Bulk permanently deleted ${deletedCount} actors`, { ids, userId });

      await AuditLog.logEvent({
        eventType: "actor.bulk_force_delete",
        eventCategory: "admin",
        severity: "warn",
        userId,
        metadata: { ids, count: deletedCount },
        description: `Xóa vĩnh viễn hàng loạt ${deletedCount} diễn viên`,
        status: "success",
      });

      return deletedCount;
    } catch (error) {
      if (error.isOperational) throw error;
      logger.error("[Actor] Bulk force delete error:", error);
      throw createActorError("Lỗi xóa vĩnh viễn hàng loạt diễn viên", 500, "ACTOR_BULK_FORCE_DELETE_ERR");
    }
  },

  /**
   * Dọn sạch thùng rác (xóa vĩnh viễn tất cả diễn viên đã bị xóa mềm)
   * @param {string} [userId] - ID quản trị viên
   * @returns {Promise<number>} Số lượng đã xóa
   */
  async emptyTrash(userId = null) {
    try {
      const trashedActors = await Actor.findAll({
        attributes: ['id'],
        where: { deleted_at: { [Op.not]: null } },
        paranoid: false,
      });

      if (!trashedActors.length) {
        return 0;
      }

      const ids = trashedActors.map((a) => a.id);

      // Xóa liên kết trong bảng trung gian MovieActor
      await MovieActor.destroy({ where: { actor_id: { [Op.in]: ids } } }).catch((err) => {
        logger.warn(`[Actor] Failed to detach MovieActor on empty trash:`, err);
      });

      const deletedCount = await Actor.destroy({
        where: { id: { [Op.in]: ids } },
        force: true,
      });

      logger.info(`[Actor] Empty trash: permanently deleted ${deletedCount} actors`, { userId });

      await AuditLog.logEvent({
        eventType: "actor.empty_trash",
        eventCategory: "admin",
        severity: "warn",
        userId,
        metadata: { count: deletedCount },
        description: `Dọn sạch thùng rác: xóa vĩnh viễn ${deletedCount} diễn viên`,
        status: "success",
      });

      return deletedCount;
    } catch (error) {
      if (error.isOperational) throw error;
      logger.error("[Actor] Empty trash error:", error);
      throw createActorError("Lỗi dọn sạch thùng rác diễn viên", 500, "ACTOR_EMPTY_TRASH_ERR");
    }
  },
};

export default actorService;
