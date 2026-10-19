/**
 * @file genre.service.js
 * @module Service_Genre
 * @description Lớp dịch vụ xử lý logic nghiệp vụ cho thể loại (Genre).
 */

import { Op } from 'sequelize';
import { slugify } from '../../../utils/slugify.util.js';
import { logger } from '../../../utils/logger.js';

// Import models
import { Genre, Movie, AuditLog, sequelize } from '../../../models/index.js';

// Error codes
const GENRE_ERROR_CODES = {
  GENRE_NOT_FOUND: 'GENRE_001',
  GENRE_DUPLICATE_NAME: 'GENRE_002',
  GENRE_DUPLICATE_SLUG: 'GENRE_003',
  INVALID_GENRE_ID: 'GENRE_004',
};

/**
 * Tạo lỗi tùy chỉnh cho module Genre
 */
const createGenreError = (message, statusCode, errorCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.errorCode = errorCode;
  error.isOperational = true;
  return error;
};

/**
 * Service Genre - Xử lý tất cả logic liên quan đến thể loại
 */
export const genreService = {
  /**
   * Tạo mới thể loại
   * @param {Object} data - Dữ liệu thể loại cần tạo
   * @param {string} data.name - Tên thể loại
   * @param {string} [data.description] - Mô tả thể loại
   * @param {boolean} [data.is_active=true] - Trạng thái kích hoạt
   * @param {number} [data.order_num=0] - Thứ tự hiển thị
   * @returns {Promise<Object>} Thể loại vừa tạo
   */
  async create(data) {
    try {
      // Kiểm tra tên trùng lặp
      const existingByName = await Genre.findOne({
        where: { name: data.name },
      });

      if (existingByName) {
        throw createGenreError(
          'Tên thể loại đã tồn tại',
          409,
          GENRE_ERROR_CODES.GENRE_DUPLICATE_NAME
        );
      }

      // Tạo slug từ tên
      const slug = slugify(data.name);

      // Kiểm tra slug trùng lặp
      const existingBySlug = await Genre.findOne({
        where: { slug },
      });

      if (existingBySlug) {
        throw createGenreError(
          'Slug thể loại đã tồn tại',
          409,
          GENRE_ERROR_CODES.GENRE_DUPLICATE_SLUG
        );
      }

      // Tạo thể loại
      const genre = await Genre.create({
        name: data.name,
        slug,
        description: data.description || null,
        is_active: data.is_active !== false,
        movies_count: 0,
      });

      logger.info(`[Genre] Created new genre: ${genre.id}`, { genreId: genre.id });

      return genre;
    } catch (error) {
      if (error.isOperational) throw error;
      logger.error('[Genre] Create error:', error);
      throw createGenreError('Lỗi tạo thể loại', 500, 'GENRE_ERR');
    }
  },

  /**
   * Lấy thể loại theo ID
   * @param {string} id - ID thể loại
   * @returns {Promise<Object>} Thể loại
   */
  async getById(id) {
    try {
      const genre = await Genre.findByPk(id);

      if (!genre) {
        throw createGenreError(
          'Thể loại không tồn tại',
          404,
          GENRE_ERROR_CODES.GENRE_NOT_FOUND
        );
      }

      return genre;
    } catch (error) {
      if (error.isOperational) throw error;
      logger.error('[Genre] GetById error:', error);
      throw createGenreError('Lỗi lấy thể loại', 500, 'GENRE_ERR');
    }
  },

  /**
   * Lấy thể loại theo slug (cho API công khai)
   * @param {string} slug - Slug thể loại
   * @returns {Promise<Object>} Thể loại
   */
  async getBySlug(slug) {
    try {
      const genre = await Genre.findOne({
        where: { slug, is_active: true },
      });

      if (!genre) {
        throw createGenreError(
          'Thể loại không tồn tại',
          404,
          GENRE_ERROR_CODES.GENRE_NOT_FOUND
        );
      }

      return genre;
    } catch (error) {
      if (error.isOperational) throw error;
      logger.error('[Genre] GetBySlug error:', error);
      throw createGenreError('Lỗi lấy thể loại', 500, 'GENRE_ERR');
    }
  },

  /**
   * Lấy danh sách thể loại với phân trang và lọc
   * @param {Object} options - Tùy chọn tìm kiếm
   * @param {number} options.page - Trang hiện tại
   * @param {number} options.limit - Số lượng bản ghi mỗi trang
   * @param {boolean} [options.is_active] - Lọc theo trạng thái
   * @param {string} [options.search] - Tìm kiếm theo tên
   * @param {string} [options.order_by] - Trường sắp xếp
   * @param {string} [options.sort] - Hướng sắp xếp
   * @returns {Promise<Object>} Danh sách thể loại với phân trang
   */
  async getList(options = {}) {
    try {
      const {
        page = 1,
        limit = 20,
        is_active,
        search,
        order_by = 'name',
        sort = 'ASC',
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
        where[Op.or] = [
          { name: { [Op.iLike]: `%${search}%` } },
          { description: { [Op.iLike]: `%${search}%` } },
        ];
      }

      const isParanoid = !includeDeleted && !onlyDeleted;

      const { count: total, rows: items } = await Genre.findAndCountAll({
        where,
        limit,
        offset,
        order: [[order_by, sort]],
        paranoid: isParanoid,
      });

      // Thống kê counts theo trạng thái
      const baseWhere = {};
      if (search) {
        baseWhere[Op.or] = [
          { name: { [Op.iLike]: `%${search}%` } },
          { description: { [Op.iLike]: `%${search}%` } },
        ];
      }

      const activeGroup = await Genre.findAll({
        attributes: [
          "is_active",
          [sequelize.fn("COUNT", sequelize.col("id")), "count"],
        ],
        where: baseWhere,
        group: ["is_active"],
        raw: true,
        paranoid: true,
      });

      const trashCountResult = await Genre.count({
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
      logger.error('[Genre] GetList error:', error);
      throw createGenreError('Lỗi lấy danh sách thể loại', 500, 'GENRE_ERR');
    }
  },

  /**
   * Lấy danh sách thể loại công khai (chỉ active, được cache)
   * @param {Object} options - Tùy chọn tìm kiếm
   * @returns {Promise<Object>} Danh sách thể loại công khai
   */
  async getPublicList(options = {}) {
    try {
      return await this.getList({
        ...options,
        is_active: true,
      });
    } catch (error) {
      logger.error('[Genre] GetPublicList error:', error);
      throw error;
    }
  },

  /**
   * Cập nhật thể loại
   * @param {string} id - ID thể loại
   * @param {Object} data - Dữ liệu cập nhật
   * @returns {Promise<Object>} Thể loại đã cập nhật
   */
  async update(id, data) {
    try {
      const genre = await Genre.findByPk(id);

      if (!genre) {
        throw createGenreError(
          'Thể loại không tồn tại',
          404,
          GENRE_ERROR_CODES.GENRE_NOT_FOUND
        );
      }

      const targetName = data.name !== undefined ? data.name.trim() : genre.name;

      // Kiểm tra tên trùng lặp nếu có thay đổi
      if (data.name && targetName !== genre.name) {
        const existingByName = await Genre.findOne({
          where: { name: targetName, id: { [Op.ne]: id } },
        });

        if (existingByName) {
          throw createGenreError(
            'Tên thể loại đã tồn tại',
            409,
            GENRE_ERROR_CODES.GENRE_DUPLICATE_NAME
          );
        }
      }

      const updatePayload = {
        name: targetName,
        description: data.description !== undefined ? data.description : genre.description,
        is_active: data.is_active !== undefined ? data.is_active : genre.is_active,
      };

      // Tự động đồng bộ slug nếu tên thay đổi hoặc slug hiện tại bị lệch
      const expectedSlug = slugify(targetName);
      if (expectedSlug !== genre.slug) {
        const existingBySlug = await Genre.findOne({
          where: { slug: expectedSlug, id: { [Op.ne]: id } },
          paranoid: false,
        });

        if (existingBySlug) {
          throw createGenreError(
            'Slug thể loại đã tồn tại',
            409,
            GENRE_ERROR_CODES.GENRE_DUPLICATE_SLUG
          );
        }

        updatePayload.slug = expectedSlug;
      }

      // Cập nhật thể loại
      await genre.update(updatePayload);

      logger.info(`[Genre] Updated genre: ${genre.id}`, { genreId: genre.id, slug: genre.slug });

      return genre;
    } catch (error) {
      if (error.isOperational) throw error;
      logger.error('[Genre] Update error:', error);
      throw createGenreError('Lỗi cập nhật thể loại', 500, 'GENRE_ERR');
    }
  },

  /**
   * Xóa thể loại
   * @param {string} id - ID thể loại
   * @returns {Promise<boolean>} Kết quả xóa
   */
  async delete(id) {
    try {
      const genre = await Genre.findByPk(id);

      if (!genre) {
        throw createGenreError(
          'Thể loại không tồn tại',
          404,
          GENRE_ERROR_CODES.GENRE_NOT_FOUND
        );
      }

      // Kiểm tra xem có phim nào liên kết không
      const movieCount = await genre.countMovies();

      if (movieCount > 0) {
        throw createGenreError(
          `Không thể xóa thể loại vì có ${movieCount} phim liên kết`,
          409,
          'GENRE_HAS_MOVIES'
        );
      }

      await genre.destroy();

      logger.info(`[Genre] Deleted genre: ${id}`, { genreId: id });

      return true;
    } catch (error) {
      if (error.isOperational) throw error;
      logger.error('[Genre] Delete error:', error);
      throw createGenreError('Lỗi xóa thể loại', 500, 'GENRE_ERR');
    }
  },

  /**
   * Xóa hàng loạt thể loại
   * @param {Array<string>} ids - Danh sách ID thể loại cần xóa
   * @returns {Promise<number>} Số lượng thể loại đã xóa
   */
  async bulkDelete(ids) {
    try {
      const deletedCount = await Genre.destroy({
        where: { id: { [Op.in]: ids } },
      });

      logger.info(`[Genre] Bulk deleted ${deletedCount} genres`, { ids });

      return deletedCount;
    } catch (error) {
      if (error.isOperational) throw error;
      logger.error('[Genre] BulkDelete error:', error);
      throw createGenreError('Lỗi xóa hàng loạt thể loại', 500, 'GENRE_ERR');
    }
  },

  /**
   * Khôi phục thể loại bị xóa mềm
   * @param {string} id - ID thể loại
   * @returns {Promise<Object>} Thể loại đã khôi phục
   */
  async restore(id) {
    try {
      const genre = await Genre.findByPk(id, { paranoid: false });

      if (!genre) {
        throw createGenreError(
          'Thể loại không tồn tại trong danh sách đã xóa',
          404,
          'GENRE_NOT_FOUND'
        );
      }

      if (!genre.deleted_at) {
        return genre;
      }

      await genre.restore();
      logger.info(`[Genre] Restored genre: ${id}`, { genreId: id });

      return genre;
    } catch (error) {
      if (error.isOperational) throw error;
      logger.error('[Genre] Restore error:', error);
      throw createGenreError('Lỗi khôi phục thể loại', 500, 'GENRE_ERR');
    }
  },

  /**
   * Khôi phục hàng loạt thể loại bị xóa mềm
   * @param {Array<string>} ids - Danh sách ID thể loại cần khôi phục
   * @returns {Promise<number>} Số lượng thể loại đã khôi phục
   */
  async bulkRestore(ids) {
    try {
      const restoredCount = await Genre.restore({
        where: { id: { [Op.in]: ids } },
      });

      logger.info(`[Genre] Bulk restored ${restoredCount} genres`, { ids });

      return restoredCount;
    } catch (error) {
      if (error.isOperational) throw error;
      logger.error('[Genre] BulkRestore error:', error);
      throw createGenreError('Lỗi khôi phục hàng loạt thể loại', 500, 'GENRE_ERR');
    }
  },

  /**
   * Xóa vĩnh viễn thể loại
   * @param {string} id - ID thể loại
   * @param {string} [userId] - ID quản trị viên
   * @returns {Promise<boolean>}
   */
  async forceDelete(id, userId = null) {
    try {
      const genre = await Genre.findByPk(id, { paranoid: false });

      if (!genre) {
        throw createGenreError(
          'Thể loại không tồn tại',
          404,
          GENRE_ERROR_CODES.GENRE_NOT_FOUND
        );
      }

      // Xóa liên kết trong bảng trung gian movie_genres
      await sequelize.query('DELETE FROM movie_genres WHERE genre_id = :id', {
        replacements: { id },
      }).catch((err) => {
        logger.warn(`[Genre] Failed to detach movie_genres on force delete ${id}:`, err);
      });

      // Xóa cứng trong Database
      await genre.destroy({ force: true });
      logger.info(`[Genre] Permanently deleted genre: ${id}`, { genreId: id, userId });

      await AuditLog.logEvent({
        eventType: 'genre.force_delete',
        eventCategory: 'admin',
        severity: 'warn',
        userId,
        metadata: { genreId: id, name: genre.name },
        description: `Xóa vĩnh viễn thể loại: ${genre.name}`,
        status: 'success',
      });

      return true;
    } catch (error) {
      if (error.isOperational) throw error;
      logger.error('[Genre] Force delete error:', error);
      throw createGenreError('Lỗi xóa vĩnh viễn thể loại', 500, 'GENRE_FORCE_DELETE_ERR');
    }
  },

  /**
   * Xóa vĩnh viễn hàng loạt thể loại
   * @param {Array<string>} ids - Danh sách ID thể loại cần xóa vĩnh viễn
   * @param {string} [userId] - ID quản trị viên
   * @returns {Promise<number>} Số lượng đã xóa
   */
  async bulkForceDelete(ids, userId = null) {
    try {
      if (!Array.isArray(ids) || ids.length === 0) {
        return 0;
      }

      // Xóa liên kết trong bảng trung gian movie_genres
      await sequelize.query('DELETE FROM movie_genres WHERE genre_id IN (:ids)', {
        replacements: { ids },
      }).catch((err) => {
        logger.warn(`[Genre] Failed to bulk detach movie_genres on force delete:`, err);
      });

      const deletedCount = await Genre.destroy({
        where: { id: { [Op.in]: ids } },
        force: true,
      });

      logger.info(`[Genre] Bulk permanently deleted ${deletedCount} genres`, { ids, userId });

      await AuditLog.logEvent({
        eventType: 'genre.bulk_force_delete',
        eventCategory: 'admin',
        severity: 'warn',
        userId,
        metadata: { ids, count: deletedCount },
        description: `Xóa vĩnh viễn hàng loạt ${deletedCount} thể loại`,
        status: 'success',
      });

      return deletedCount;
    } catch (error) {
      if (error.isOperational) throw error;
      logger.error('[Genre] Bulk force delete error:', error);
      throw createGenreError('Lỗi xóa vĩnh viễn hàng loạt thể loại', 500, 'GENRE_BULK_FORCE_DELETE_ERR');
    }
  },

  /**
   * Dọn sạch thùng rác (xóa vĩnh viễn tất cả thể loại đã bị xóa mềm)
   * @param {string} [userId] - ID quản trị viên
   * @returns {Promise<number>} Số lượng đã xóa
   */
  async emptyTrash(userId = null) {
    try {
      const trashed = await Genre.findAll({
        attributes: ['id'],
        where: { deleted_at: { [Op.not]: null } },
        paranoid: false,
      });

      if (!trashed.length) {
        return 0;
      }

      const ids = trashed.map((g) => g.id);

      // Xóa liên kết trong bảng trung gian movie_genres
      await sequelize.query('DELETE FROM movie_genres WHERE genre_id IN (:ids)', {
        replacements: { ids },
      }).catch((err) => {
        logger.warn(`[Genre] Failed to detach movie_genres on empty trash:`, err);
      });

      const deletedCount = await Genre.destroy({
        where: { id: { [Op.in]: ids } },
        force: true,
      });

      logger.info(`[Genre] Empty trash: permanently deleted ${deletedCount} genres`, { userId });

      await AuditLog.logEvent({
        eventType: 'genre.empty_trash',
        eventCategory: 'admin',
        severity: 'warn',
        userId,
        metadata: { count: deletedCount },
        description: `Dọn sạch thùng rác: xóa vĩnh viễn ${deletedCount} thể loại`,
        status: 'success',
      });

      return deletedCount;
    } catch (error) {
      if (error.isOperational) throw error;
      logger.error('[Genre] Empty trash error:', error);
      throw createGenreError('Lỗi dọn sạch thùng rác thể loại', 500, 'GENRE_EMPTY_TRASH_ERR');
    }
  },
};

export default genreService;
