/**
 * @file category.service.js
 * @module Service_Category
 * @description Lớp dịch vụ xử lý logic nghiệp vụ cho danh mục (Category).
 */

import { Op } from 'sequelize';
import { slugify } from '../../../utils/slugify.util.js';
import { logger } from '../../../utils/logger.js';

// Import models
import { Category, Movie, AuditLog, sequelize } from '../../../models/index.js';

// Error codes
const CATEGORY_ERROR_CODES = {
  CATEGORY_NOT_FOUND: 'CATEGORY_001',
  CATEGORY_DUPLICATE_NAME: 'CATEGORY_002',
  CATEGORY_DUPLICATE_SLUG: 'CATEGORY_003',
  INVALID_CATEGORY_ID: 'CATEGORY_004',
};

/**
 * Tạo lỗi tùy chỉnh cho module Category
 */
const createCategoryError = (message, statusCode, errorCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.errorCode = errorCode;
  error.isOperational = true;
  return error;
};

/**
 * Service Category - Xử lý tất cả logic liên quan đến danh mục
 */
export const categoryService = {
  /**
   * Tạo mới danh mục
   * @param {Object} data - Dữ liệu danh mục cần tạo
   * @param {string} data.name - Tên danh mục
   * @param {string} [data.description] - Mô tả danh mục
   * @param {boolean} [data.is_active=true] - Trạng thái kích hoạt
   * @param {number} [data.order_num=0] - Thứ tự hiển thị
   * @returns {Promise<Object>} Danh mục vừa tạo
   */
  async create(data) {
    try {
      // Kiểm tra tên trùng lặp
      const existingByName = await Category.findOne({
        where: { name: data.name },
      });

      if (existingByName) {
        throw createCategoryError(
          'Tên danh mục đã tồn tại',
          409,
          CATEGORY_ERROR_CODES.CATEGORY_DUPLICATE_NAME
        );
      }

      // Tạo slug từ tên
      const slug = slugify(data.name);

      // Kiểm tra slug trùng lặp
      const existingBySlug = await Category.findOne({
        where: { slug },
      });

      if (existingBySlug) {
        throw createCategoryError(
          'Slug danh mục đã tồn tại',
          409,
          CATEGORY_ERROR_CODES.CATEGORY_DUPLICATE_SLUG
        );
      }

      // Tạo danh mục
      const category = await Category.create({
        name: data.name,
        slug,
        description: data.description || null,
        is_active: data.is_active !== false,
        order_num: data.order_num || 0,
        movies_count: 0,
      });

      logger.info(`[Category] Created new category: ${category.id}`, { categoryId: category.id });

      return category;
    } catch (error) {
      if (error.isOperational) throw error;
      logger.error('[Category] Create error:', error);
      throw createCategoryError('Lỗi tạo danh mục', 500, 'CATEGORY_ERR');
    }
  },

  /**
   * Lấy danh mục theo ID
   * @param {string} id - ID danh mục
   * @returns {Promise<Object>} Danh mục
   */
  async getById(id) {
    try {
      const category = await Category.findByPk(id);

      if (!category) {
        throw createCategoryError(
          'Danh mục không tồn tại',
          404,
          CATEGORY_ERROR_CODES.CATEGORY_NOT_FOUND
        );
      }

      return category;
    } catch (error) {
      if (error.isOperational) throw error;
      logger.error('[Category] GetById error:', error);
      throw createCategoryError('Lỗi lấy danh mục', 500, 'CATEGORY_ERR');
    }
  },

  /**
   * Lấy danh mục theo slug (cho API công khai)
   * @param {string} slug - Slug danh mục
   * @returns {Promise<Object>} Danh mục
   */
  async getBySlug(slug) {
    try {
      const category = await Category.findOne({
        where: { slug, is_active: true },
      });

      if (!category) {
        throw createCategoryError(
          'Danh mục không tồn tại',
          404,
          CATEGORY_ERROR_CODES.CATEGORY_NOT_FOUND
        );
      }

      return category;
    } catch (error) {
      if (error.isOperational) throw error;
      logger.error('[Category] GetBySlug error:', error);
      throw createCategoryError('Lỗi lấy danh mục', 500, 'CATEGORY_ERR');
    }
  },

  /**
   * Lấy danh sách danh mục với phân trang và lọc
   * @param {Object} options - Tùy chọn tìm kiếm
   * @param {number} options.page - Trang hiện tại
   * @param {number} options.limit - Số lượng bản ghi mỗi trang
   * @param {boolean} [options.is_active] - Lọc theo trạng thái
   * @param {string} [options.search] - Tìm kiếm theo tên
   * @param {string} [options.order_by] - Trường sắp xếp
   * @param {string} [options.sort] - Hướng sắp xếp
   * @returns {Promise<Object>} Danh sách danh mục với phân trang
   */
  async getList(options = {}) {
    try {
      const {
        page = 1,
        limit = 20,
        is_active,
        search,
        order_by = 'order_num',
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

      const { count: total, rows: items } = await Category.findAndCountAll({
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

      const activeGroup = await Category.findAll({
        attributes: [
          "is_active",
          [sequelize.fn("COUNT", sequelize.col("id")), "count"],
        ],
        where: baseWhere,
        group: ["is_active"],
        raw: true,
        paranoid: true,
      });

      const trashCountResult = await Category.count({
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
      logger.error('[Category] GetList error:', error);
      throw createCategoryError('Lỗi lấy danh sách danh mục', 500, 'CATEGORY_ERR');
    }
  },

  /**
   * Lấy danh sách danh mục công khai (chỉ active, được cache)
   * @param {Object} options - Tùy chọn tìm kiếm
   * @returns {Promise<Object>} Danh sách danh mục công khai
   */
  async getPublicList(options = {}) {
    try {
      return await this.getList({
        ...options,
        is_active: true,
      });
    } catch (error) {
      logger.error('[Category] GetPublicList error:', error);
      throw error;
    }
  },

  /**
   * Cập nhật danh mục
   * @param {string} id - ID danh mục
   * @param {Object} data - Dữ liệu cập nhật
   * @returns {Promise<Object>} Danh mục đã cập nhật
   */
  async update(id, data) {
    try {
      const category = await Category.findByPk(id);

      if (!category) {
        throw createCategoryError(
          'Danh mục không tồn tại',
          404,
          CATEGORY_ERROR_CODES.CATEGORY_NOT_FOUND
        );
      }

      const targetName = data.name !== undefined ? data.name.trim() : category.name;

      // Kiểm tra tên trùng lặp nếu có thay đổi
      if (data.name && targetName !== category.name) {
        const existingByName = await Category.findOne({
          where: { name: targetName, id: { [Op.ne]: id } },
        });

        if (existingByName) {
          throw createCategoryError(
            'Tên danh mục đã tồn tại',
            409,
            CATEGORY_ERROR_CODES.CATEGORY_DUPLICATE_NAME
          );
        }
      }

      const updatePayload = {
        name: targetName,
        description: data.description !== undefined ? data.description : category.description,
        is_active: data.is_active !== undefined ? data.is_active : category.is_active,
        order_num: data.order_num !== undefined ? data.order_num : category.order_num,
      };

      // Tự động đồng bộ slug nếu tên thay đổi hoặc slug hiện tại bị lệch
      const expectedSlug = slugify(targetName);
      if (expectedSlug !== category.slug) {
        const existingBySlug = await Category.findOne({
          where: { slug: expectedSlug, id: { [Op.ne]: id } },
          paranoid: false,
        });

        if (existingBySlug) {
          throw createCategoryError(
            'Slug danh mục đã tồn tại',
            409,
            CATEGORY_ERROR_CODES.CATEGORY_DUPLICATE_SLUG
          );
        }

        updatePayload.slug = expectedSlug;
      }

      // Cập nhật danh mục
      await category.update(updatePayload);

      logger.info(`[Category] Updated category: ${category.id}`, { categoryId: category.id, slug: category.slug });

      return category;
    } catch (error) {
      if (error.isOperational) throw error;
      logger.error('[Category] Update error:', error);
      throw createCategoryError('Lỗi cập nhật danh mục', 500, 'CATEGORY_ERR');
    }
  },

  /**
   * Xóa danh mục
   * @param {string} id - ID danh mục
   * @returns {Promise<boolean>} Kết quả xóa
   */
  async delete(id) {
    try {
      const category = await Category.findByPk(id);

      if (!category) {
        throw createCategoryError(
          'Danh mục không tồn tại',
          404,
          CATEGORY_ERROR_CODES.CATEGORY_NOT_FOUND
        );
      }

      // Kiểm tra xem có phim nào liên kết không
      const movieCount = await Movie.count({
        where: { category_id: id },
      });

      if (movieCount > 0) {
        throw createCategoryError(
          `Không thể xóa danh mục vì có ${movieCount} phim liên kết`,
          409,
          'CATEGORY_HAS_MOVIES'
        );
      }

      await category.destroy();

      logger.info(`[Category] Deleted category: ${id}`, { categoryId: id });

      return true;
    } catch (error) {
      if (error.isOperational) throw error;
      logger.error('[Category] Delete error:', error);
      throw createCategoryError('Lỗi xóa danh mục', 500, 'CATEGORY_ERR');
    }
  },

  /**
   * Xóa hàng loạt danh mục
   * @param {Array<string>} ids - Danh sách ID danh mục cần xóa
   * @returns {Promise<number>} Số lượng danh mục đã xóa
   */
  async bulkDelete(ids) {
    try {
      const deletedCount = await Category.destroy({
        where: { id: { [Op.in]: ids } },
      });

      logger.info(`[Category] Bulk deleted ${deletedCount} categories`, { ids });

      return deletedCount;
    } catch (error) {
      if (error.isOperational) throw error;
      logger.error('[Category] BulkDelete error:', error);
      throw createCategoryError('Lỗi xóa hàng loạt danh mục', 500, 'CATEGORY_ERR');
    }
  },

  /**
   * Khôi phục danh mục bị xóa mềm
   * @param {string} id - ID danh mục
   * @returns {Promise<Object>} Danh mục đã khôi phục
   */
  async restore(id) {
    try {
      const category = await Category.findByPk(id, { paranoid: false });

      if (!category) {
        throw createCategoryError(
          'Danh mục không tồn tại trong danh sách đã xóa',
          404,
          'CATEGORY_NOT_FOUND'
        );
      }

      if (!category.deleted_at) {
        return category;
      }

      await category.restore();
      logger.info(`[Category] Restored category: ${id}`, { categoryId: id });

      return category;
    } catch (error) {
      if (error.isOperational) throw error;
      logger.error('[Category] Restore error:', error);
      throw createCategoryError('Lỗi khôi phục danh mục', 500, 'CATEGORY_ERR');
    }
  },

  /**
   * Khôi phục hàng loạt danh mục bị xóa mềm
   * @param {Array<string>} ids - Danh sách ID danh mục cần khôi phục
   * @returns {Promise<number>} Số lượng danh mục đã khôi phục
   */
  async bulkRestore(ids) {
    try {
      const restoredCount = await Category.restore({
        where: { id: { [Op.in]: ids } },
      });

      logger.info(`[Category] Bulk restored ${restoredCount} categories`, { ids });

      return restoredCount;
    } catch (error) {
      if (error.isOperational) throw error;
      logger.error('[Category] BulkRestore error:', error);
      throw createCategoryError('Lỗi khôi phục hàng loạt danh mục', 500, 'CATEGORY_ERR');
    }
  },

  /**
   * Xóa vĩnh viễn danh mục
   * @param {string} id - ID danh mục
   * @param {string} [userId] - ID quản trị viên
   * @returns {Promise<boolean>}
   */
  async forceDelete(id, userId = null) {
    try {
      const category = await Category.findByPk(id, { paranoid: false });

      if (!category) {
        throw createCategoryError(
          'Danh mục không tồn tại',
          404,
          CATEGORY_ERROR_CODES.CATEGORY_NOT_FOUND
        );
      }

      // Gỡ liên kết trong Movie (set category_id = null)
      await Movie.update(
        { category_id: null },
        { where: { category_id: id }, paranoid: false }
      ).catch((err) => {
        logger.warn(`[Category] Failed to nullify category_id in Movie on force delete ${id}:`, err);
      });

      // Xóa cứng trong Database
      await category.destroy({ force: true });
      logger.info(`[Category] Permanently deleted category: ${id}`, { categoryId: id, userId });

      await AuditLog.logEvent({
        eventType: 'category.force_delete',
        eventCategory: 'admin',
        severity: 'warn',
        userId,
        metadata: { categoryId: id, name: category.name },
        description: `Xóa vĩnh viễn danh mục: ${category.name}`,
        status: 'success',
      });

      return true;
    } catch (error) {
      if (error.isOperational) throw error;
      logger.error('[Category] Force delete error:', error);
      throw createCategoryError('Lỗi xóa vĩnh viễn danh mục', 500, 'CATEGORY_FORCE_DELETE_ERR');
    }
  },

  /**
   * Xóa vĩnh viễn hàng loạt danh mục
   * @param {Array<string>} ids - Danh sách ID danh mục cần xóa vĩnh viễn
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
        { category_id: null },
        { where: { category_id: { [Op.in]: ids } }, paranoid: false }
      ).catch((err) => {
        logger.warn(`[Category] Failed to bulk nullify category_id in Movie:`, err);
      });

      const deletedCount = await Category.destroy({
        where: { id: { [Op.in]: ids } },
        force: true,
      });

      logger.info(`[Category] Bulk permanently deleted ${deletedCount} categories`, { ids, userId });

      await AuditLog.logEvent({
        eventType: 'category.bulk_force_delete',
        eventCategory: 'admin',
        severity: 'warn',
        userId,
        metadata: { ids, count: deletedCount },
        description: `Xóa vĩnh viễn hàng loạt ${deletedCount} danh mục`,
        status: 'success',
      });

      return deletedCount;
    } catch (error) {
      if (error.isOperational) throw error;
      logger.error('[Category] Bulk force delete error:', error);
      throw createCategoryError('Lỗi xóa vĩnh viễn hàng loạt danh mục', 500, 'CATEGORY_BULK_FORCE_DELETE_ERR');
    }
  },

  /**
   * Dọn sạch thùng rác (xóa vĩnh viễn tất cả danh mục đã bị xóa mềm)
   * @param {string} [userId] - ID quản trị viên
   * @returns {Promise<number>} Số lượng đã xóa
   */
  async emptyTrash(userId = null) {
    try {
      const trashed = await Category.findAll({
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
        { category_id: null },
        { where: { category_id: { [Op.in]: ids } }, paranoid: false }
      ).catch((err) => {
        logger.warn(`[Category] Failed to nullify category_id on empty trash:`, err);
      });

      const deletedCount = await Category.destroy({
        where: { id: { [Op.in]: ids } },
        force: true,
      });

      logger.info(`[Category] Empty trash: permanently deleted ${deletedCount} categories`, { userId });

      await AuditLog.logEvent({
        eventType: 'category.empty_trash',
        eventCategory: 'admin',
        severity: 'warn',
        userId,
        metadata: { count: deletedCount },
        description: `Dọn sạch thùng rác: xóa vĩnh viễn ${deletedCount} danh mục`,
        status: 'success',
      });

      return deletedCount;
    } catch (error) {
      if (error.isOperational) throw error;
      logger.error('[Category] Empty trash error:', error);
      throw createCategoryError('Lỗi dọn sạch thùng rác danh mục', 500, 'CATEGORY_EMPTY_TRASH_ERR');
    }
  },
};

export default categoryService;
