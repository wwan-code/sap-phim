/**
 * @file country.service.js
 * @module Service_Country
 * @description Lớp dịch vụ xử lý logic nghiệp vụ cho quốc gia (Country).
 */

import { Op } from 'sequelize';
import { slugify } from '../../../utils/slugify.util.js';
import { logger } from '../../../utils/logger.js';

// Import models
import { Country, Movie, AuditLog, sequelize } from '../../../models/index.js';

// Error codes
const COUNTRY_ERROR_CODES = {
  COUNTRY_NOT_FOUND: 'COUNTRY_001',
  COUNTRY_DUPLICATE_NAME: 'COUNTRY_002',
  COUNTRY_DUPLICATE_SLUG: 'COUNTRY_003',
  COUNTRY_DUPLICATE_CODE: 'COUNTRY_004',
  INVALID_COUNTRY_ID: 'COUNTRY_005',
};

/**
 * Tạo lỗi tùy chỉnh cho module Country
 */
const createCountryError = (message, statusCode, errorCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.errorCode = errorCode;
  error.isOperational = true;
  return error;
};

/**
 * Service Country - Xử lý tất cả logic liên quan đến quốc gia
 */
export const countryService = {
  /**
   * Tạo mới quốc gia
   * @param {Object} data - Dữ liệu quốc gia cần tạo
   * @param {string} data.name - Tên quốc gia
   * @param {string} data.code - Mã quốc gia (2 ký tự)
   * @param {string} [data.flag_url] - URL cờ quốc gia
   * @param {boolean} [data.is_active=true] - Trạng thái kích hoạt
   * @returns {Promise<Object>} Quốc gia vừa tạo
   */
  async create(data) {
    try {
      // Kiểm tra tên trùng lặp
      const existingByName = await Country.findOne({
        where: { name: data.name },
      });

      if (existingByName) {
        throw createCountryError(
          'Tên quốc gia đã tồn tại',
          409,
          COUNTRY_ERROR_CODES.COUNTRY_DUPLICATE_NAME
        );
      }

      // Kiểm tra mã quốc gia trùng lặp
      const existingByCode = await Country.findOne({
        where: { code: data.code.toUpperCase() },
      });

      if (existingByCode) {
        throw createCountryError(
          'Mã quốc gia đã tồn tại',
          409,
          COUNTRY_ERROR_CODES.COUNTRY_DUPLICATE_CODE
        );
      }

      // Tạo slug từ tên
      const slug = slugify(data.name);

      // Kiểm tra slug trùng lặp
      const existingBySlug = await Country.findOne({
        where: { slug },
      });

      if (existingBySlug) {
        throw createCountryError(
          'Slug quốc gia đã tồn tại',
          409,
          COUNTRY_ERROR_CODES.COUNTRY_DUPLICATE_SLUG
        );
      }

      // Tạo quốc gia
      const country = await Country.create({
        name: data.name,
        slug,
        code: data.code.toUpperCase(),
        flag_url: data.flag_url || null,
        is_active: data.is_active !== false,
        movies_count: 0,
      });

      logger.info(`[Country] Created new country: ${country.id}`, { countryId: country.id });

      return country;
    } catch (error) {
      if (error.isOperational) throw error;
      logger.error('[Country] Create error:', error);
      throw createCountryError('Lỗi tạo quốc gia', 500, 'COUNTRY_ERR');
    }
  },

  /**
   * Lấy quốc gia theo ID
   * @param {string} id - ID quốc gia
   * @returns {Promise<Object>} Quốc gia
   */
  async getById(id) {
    try {
      const country = await Country.findByPk(id);

      if (!country) {
        throw createCountryError(
          'Quốc gia không tồn tại',
          404,
          COUNTRY_ERROR_CODES.COUNTRY_NOT_FOUND
        );
      }

      return country;
    } catch (error) {
      if (error.isOperational) throw error;
      logger.error('[Country] GetById error:', error);
      throw createCountryError('Lỗi lấy quốc gia', 500, 'COUNTRY_ERR');
    }
  },

  /**
   * Lấy quốc gia theo slug (cho API công khai)
   * @param {string} slug - Slug quốc gia
   * @returns {Promise<Object>} Quốc gia
   */
  async getBySlug(slug) {
    try {
      const country = await Country.findOne({
        where: { slug, is_active: true },
      });

      if (!country) {
        throw createCountryError(
          'Quốc gia không tồn tại',
          404,
          COUNTRY_ERROR_CODES.COUNTRY_NOT_FOUND
        );
      }

      return country;
    } catch (error) {
      if (error.isOperational) throw error;
      logger.error('[Country] GetBySlug error:', error);
      throw createCountryError('Lỗi lấy quốc gia', 500, 'COUNTRY_ERR');
    }
  },

  /**
   * Lấy danh sách quốc gia với phân trang và lọc
   * @param {Object} options - Tùy chọn tìm kiếm
   * @param {number} options.page - Trang hiện tại
   * @param {number} options.limit - Số lượng bản ghi mỗi trang
   * @param {boolean} [options.is_active] - Lọc theo trạng thái
   * @param {string} [options.search] - Tìm kiếm theo tên
   * @param {string} [options.order_by] - Trường sắp xếp
   * @param {string} [options.sort] - Hướng sắp xếp
   * @returns {Promise<Object>} Danh sách quốc gia với phân trang
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
          { code: { [Op.iLike]: `%${search}%` } },
        ];
      }

      const isParanoid = !includeDeleted && !onlyDeleted;

      const { count: total, rows: items } = await Country.findAndCountAll({
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
          { code: { [Op.iLike]: `%${search}%` } },
        ];
      }

      const activeGroup = await Country.findAll({
        attributes: [
          "is_active",
          [sequelize.fn("COUNT", sequelize.col("id")), "count"],
        ],
        where: baseWhere,
        group: ["is_active"],
        raw: true,
        paranoid: true,
      });

      const trashCountResult = await Country.count({
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
      logger.error('[Country] GetList error:', error);
      throw createCountryError('Lỗi lấy danh sách quốc gia', 500, 'COUNTRY_ERR');
    }
  },

  /**
   * Lấy danh sách quốc gia công khai (chỉ active, được cache)
   * @param {Object} options - Tùy chọn tìm kiếm
   * @returns {Promise<Object>} Danh sách quốc gia công khai
   */
  async getPublicList(options = {}) {
    try {
      return await this.getList({
        ...options,
        is_active: true,
      });
    } catch (error) {
      logger.error('[Country] GetPublicList error:', error);
      throw error;
    }
  },

  /**
   * Cập nhật quốc gia
   * @param {string} id - ID quốc gia
   * @param {Object} data - Dữ liệu cập nhật
   * @returns {Promise<Object>} Quốc gia đã cập nhật
   */
  async update(id, data) {
    try {
      const country = await Country.findByPk(id);

      if (!country) {
        throw createCountryError(
          'Quốc gia không tồn tại',
          404,
          COUNTRY_ERROR_CODES.COUNTRY_NOT_FOUND
        );
      }

      const targetName = data.name !== undefined ? data.name.trim() : country.name;

      // Kiểm tra tên trùng lặp nếu có thay đổi
      if (data.name && targetName !== country.name) {
        const existingByName = await Country.findOne({
          where: { name: targetName, id: { [Op.ne]: id } },
        });

        if (existingByName) {
          throw createCountryError(
            'Tên quốc gia đã tồn tại',
            409,
            COUNTRY_ERROR_CODES.COUNTRY_DUPLICATE_NAME
          );
        }
      }

      const updatePayload = {
        name: targetName,
        flag_url: data.flag_url !== undefined ? data.flag_url : country.flag_url,
        is_active: data.is_active !== undefined ? data.is_active : country.is_active,
      };

      // Tự động đồng bộ slug nếu tên thay đổi hoặc slug hiện tại bị lệch
      const expectedSlug = slugify(targetName);
      if (expectedSlug !== country.slug) {
        const existingBySlug = await Country.findOne({
          where: { slug: expectedSlug, id: { [Op.ne]: id } },
          paranoid: false,
        });

        if (existingBySlug) {
          throw createCountryError(
            'Slug quốc gia đã tồn tại',
            409,
            COUNTRY_ERROR_CODES.COUNTRY_DUPLICATE_SLUG
          );
        }

        updatePayload.slug = expectedSlug;
      }

      // Cập nhật quốc gia
      await country.update(updatePayload);

      logger.info(`[Country] Updated country: ${country.id}`, { countryId: country.id, slug: country.slug });

      return country;
    } catch (error) {
      if (error.isOperational) throw error;
      logger.error('[Country] Update error:', error);
      throw createCountryError('Lỗi cập nhật quốc gia', 500, 'COUNTRY_ERR');
    }
  },

  /**
   * Xóa quốc gia
   * @param {string} id - ID quốc gia
   * @returns {Promise<boolean>} Kết quả xóa
   */
  async delete(id) {
    try {
      const country = await Country.findByPk(id);

      if (!country) {
        throw createCountryError(
          'Quốc gia không tồn tại',
          404,
          COUNTRY_ERROR_CODES.COUNTRY_NOT_FOUND
        );
      }

      // Kiểm tra xem có phim nào liên kết không
      const movieCount = await Movie.count({
        where: { country_id: id },
      });

      if (movieCount > 0) {
        throw createCountryError(
          `Không thể xóa quốc gia vì có ${movieCount} phim liên kết`,
          409,
          'COUNTRY_HAS_MOVIES'
        );
      }

      await country.destroy();

      logger.info(`[Country] Deleted country: ${id}`, { countryId: id });

      return true;
    } catch (error) {
      if (error.isOperational) throw error;
      logger.error('[Country] Delete error:', error);
      throw createCountryError('Lỗi xóa quốc gia', 500, 'COUNTRY_ERR');
    }
  },

  /**
   * Xóa hàng loạt quốc gia
   * @param {Array<string>} ids - Danh sách ID quốc gia cần xóa
   * @returns {Promise<number>} Số lượng quốc gia đã xóa
   */
  async bulkDelete(ids) {
    try {
      const deletedCount = await Country.destroy({
        where: { id: { [Op.in]: ids } },
      });

      logger.info(`[Country] Bulk deleted ${deletedCount} countries`, { ids });

      return deletedCount;
    } catch (error) {
      if (error.isOperational) throw error;
      logger.error('[Country] BulkDelete error:', error);
      throw createCountryError('Lỗi xóa hàng loạt quốc gia', 500, 'COUNTRY_ERR');
    }
  },

  /**
   * Khôi phục quốc gia bị xóa mềm
   * @param {string} id - ID quốc gia
   * @returns {Promise<Object>} Quốc gia đã khôi phục
   */
  async restore(id) {
    try {
      const country = await Country.findByPk(id, { paranoid: false });

      if (!country) {
        throw createCountryError(
          'Quốc gia không tồn tại trong danh sách đã xóa',
          404,
          'COUNTRY_NOT_FOUND'
        );
      }

      if (!country.deleted_at) {
        return country;
      }

      await country.restore();
      logger.info(`[Country] Restored country: ${id}`, { countryId: id });

      return country;
    } catch (error) {
      if (error.isOperational) throw error;
      logger.error('[Country] Restore error:', error);
      throw createCountryError('Lỗi khôi phục quốc gia', 500, 'COUNTRY_ERR');
    }
  },

  /**
   * Khôi phục hàng loạt quốc gia bị xóa mềm
   * @param {Array<string>} ids - Danh sách ID quốc gia cần khôi phục
   * @returns {Promise<number>} Số lượng quốc gia đã khôi phục
   */
  async bulkRestore(ids) {
    try {
      const restoredCount = await Country.restore({
        where: { id: { [Op.in]: ids } },
      });

      logger.info(`[Country] Bulk restored ${restoredCount} countries`, { ids });

      return restoredCount;
    } catch (error) {
      if (error.isOperational) throw error;
      logger.error('[Country] BulkRestore error:', error);
      throw createCountryError('Lỗi khôi phục hàng loạt quốc gia', 500, 'COUNTRY_ERR');
    }
  },

  /**
   * Xóa vĩnh viễn quốc gia
   * @param {string} id - ID quốc gia
   * @param {string} [userId] - ID quản trị viên
   * @returns {Promise<boolean>}
   */
  async forceDelete(id, userId = null) {
    try {
      const country = await Country.findByPk(id, { paranoid: false });

      if (!country) {
        throw createCountryError(
          'Quốc gia không tồn tại',
          404,
          COUNTRY_ERROR_CODES.COUNTRY_NOT_FOUND
        );
      }

      // Gỡ liên kết trong Movie (set country_id = null)
      await Movie.update(
        { country_id: null },
        { where: { country_id: id }, paranoid: false }
      ).catch((err) => {
        logger.warn(`[Country] Failed to nullify country_id in Movie on force delete ${id}:`, err);
      });

      // Xóa cứng trong Database
      await country.destroy({ force: true });
      logger.info(`[Country] Permanently deleted country: ${id}`, { countryId: id, userId });

      await AuditLog.logEvent({
        eventType: 'country.force_delete',
        eventCategory: 'admin',
        severity: 'warn',
        userId,
        metadata: { countryId: id, name: country.name },
        description: `Xóa vĩnh viễn quốc gia: ${country.name}`,
        status: 'success',
      });

      return true;
    } catch (error) {
      if (error.isOperational) throw error;
      logger.error('[Country] Force delete error:', error);
      throw createCountryError('Lỗi xóa vĩnh viễn quốc gia', 500, 'COUNTRY_FORCE_DELETE_ERR');
    }
  },

  /**
   * Xóa vĩnh viễn hàng loạt quốc gia
   * @param {Array<string>} ids - Danh sách ID quốc gia cần xóa vĩnh viễn
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
        { country_id: null },
        { where: { country_id: { [Op.in]: ids } }, paranoid: false }
      ).catch((err) => {
        logger.warn(`[Country] Failed to bulk nullify country_id in Movie:`, err);
      });

      const deletedCount = await Country.destroy({
        where: { id: { [Op.in]: ids } },
        force: true,
      });

      logger.info(`[Country] Bulk permanently deleted ${deletedCount} countries`, { ids, userId });

      await AuditLog.logEvent({
        eventType: 'country.bulk_force_delete',
        eventCategory: 'admin',
        severity: 'warn',
        userId,
        metadata: { ids, count: deletedCount },
        description: `Xóa vĩnh viễn hàng loạt ${deletedCount} quốc gia`,
        status: 'success',
      });

      return deletedCount;
    } catch (error) {
      if (error.isOperational) throw error;
      logger.error('[Country] Bulk force delete error:', error);
      throw createCountryError('Lỗi xóa vĩnh viễn hàng loạt quốc gia', 500, 'COUNTRY_BULK_FORCE_DELETE_ERR');
    }
  },

  /**
   * Dọn sạch thùng rác (xóa vĩnh viễn tất cả quốc gia đã bị xóa mềm)
   * @param {string} [userId] - ID quản trị viên
   * @returns {Promise<number>} Số lượng đã xóa
   */
  async emptyTrash(userId = null) {
    try {
      const trashed = await Country.findAll({
        attributes: ['id'],
        where: { deleted_at: { [Op.not]: null } },
        paranoid: false,
      });

      if (!trashed.length) {
        return 0;
      }

      const ids = trashed.map((c) => c.id);

      // Gỡ liên kết trong Movie
      await Movie.update(
        { country_id: null },
        { where: { country_id: { [Op.in]: ids } }, paranoid: false }
      ).catch((err) => {
        logger.warn(`[Country] Failed to nullify country_id on empty trash:`, err);
      });

      const deletedCount = await Country.destroy({
        where: { id: { [Op.in]: ids } },
        force: true,
      });

      logger.info(`[Country] Empty trash: permanently deleted ${deletedCount} countries`, { userId });

      await AuditLog.logEvent({
        eventType: 'country.empty_trash',
        eventCategory: 'admin',
        severity: 'warn',
        userId,
        metadata: { count: deletedCount },
        description: `Dọn sạch thùng rác: xóa vĩnh viễn ${deletedCount} quốc gia`,
        status: 'success',
      });

      return deletedCount;
    } catch (error) {
      if (error.isOperational) throw error;
      logger.error('[Country] Empty trash error:', error);
      throw createCountryError('Lỗi dọn sạch thùng rác quốc gia', 500, 'COUNTRY_EMPTY_TRASH_ERR');
    }
  },
};

export default countryService;
