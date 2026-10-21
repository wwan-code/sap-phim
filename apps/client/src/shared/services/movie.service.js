/**
 * @file movie.service.js
 * @module Services/MovieService
 * @description Dịch vụ quản lý tác phẩm điện ảnh, anime và media (Movie Management) cho Client & Admin, kế thừa BaseService.
 */

import BaseService from "./base.service";
import api from "./api";
import { ENDPOINTS } from "@/shared/constants/api-endpoints.constants";

class MovieService extends BaseService {
  constructor() {
    super("MovieService", {
      enableCache: true,
      enableMetrics: true,
      requestTimeout: 15000,
    });
  }

  // ════════════════════════════════════════
  // PUBLIC APIS
  // ════════════════════════════════════════

  /**
   * Lấy danh sách phim công khai (chỉ published, có cache)
   * @param {Object} [params={}]
   * @returns {Promise<Object>}
   */
  async listPublic(params = {}) {
    return this._measure("listPublic", async () => {
      const cleanParams = this._cleanParams(params);
      const cacheKey = this._generateCacheKey("public_list", cleanParams);

      return this.prefetch(cacheKey, async () => {
        const response = await this._deduplicateRequest(ENDPOINTS.MOVIES.LIST, { params: cleanParams });
        return this._extractData(response);
      }, this.CACHE_TTL.list);
    });
  }

  /**
   * Lấy chi tiết phim theo slug (SEO-friendly)
   * @param {string} slug
   * @returns {Promise<Object>}
   */
  async getBySlug(slug) {
    if (!slug) throw new Error("Slug phim không được để trống");
    return this._measure("getBySlug", async () => {
      const cacheKey = `public_slug:${slug}`;
      return this.prefetch(cacheKey, async () => {
        const response = await this._deduplicateRequest(ENDPOINTS.MOVIES.DETAIL(slug));
        return this._extractData(response);
      }, this.CACHE_TTL.slug);
    });
  }

  // ════════════════════════════════════════
  // ADMIN APIS
  // ════════════════════════════════════════

  /**
   * Lấy danh sách phim đầy đủ cho Quản trị viên (Admin DataGrid)
   * @param {Object} [params={}] - search, status, type, category, is_published, is_trash, tab, page, limit, order_by, sort
   * @returns {Promise<Object>} { items, total, page, limit, meta: { counts } }
   */
  async getAll(params = {}) {
    return this._measure("admin.getAll", async () => {
      const cleanParams = this._cleanParams(params);
      const response = await api.get(ENDPOINTS.MOVIES.ADMIN_LIST, { params: cleanParams });
      return this._extractData(response);
    });
  }

  /**
   * Lấy chi tiết phim theo ID (Admin Form/Edit)
   * @param {string} id - Movie UUID
   * @returns {Promise<Object>}
   */
  async getById(id) {
    this._validateId(id, "phim");
    return this._measure("admin.getById", async () => {
      const response = await api.get(ENDPOINTS.MOVIES.ADMIN_DETAIL(id));
      return this._extractData(response);
    });
  }

  /**
   * Lấy dữ liệu Metadata gộp cho trang chỉnh sửa/tạo phim (Genres, Categories, Countries, Studios, Actors, Series)
   * @returns {Promise<Object>}
   */
  async getMetadata() {
    return this._measure("admin.getMetadata", async () => {
      const response = await api.get(ENDPOINTS.MOVIES.ADMIN_METADATA);
      return this._extractData(response);
    });
  }

  /**
   * Tạo mới phim/anime (Hỗ trợ multipart form-data hoặc JSON)
   * @param {FormData|Object} payload
   * @param {Object} [options={}] - { jobId }
   * @returns {Promise<Object>}
   */
  async create(payload, options = {}) {
    return this._measure("admin.create", async () => {
      const headers = {};
      if (options.jobId) {
        headers["X-Job-Id"] = options.jobId;
      }
      const response = await api.post(ENDPOINTS.MOVIES.ADMIN_CREATE, payload, { headers });
      this.clearCache();
      const data = this._extractData(response);
      if (data && typeof data === 'object' && response?.data?.meta) {
        data.meta = response.data.meta;
      }
      return data;
    });
  }

  /**
   * Cập nhật thông tin phim/anime (Hỗ trợ multipart form-data hoặc JSON)
   * @param {string} id
   * @param {FormData|Object} payload
   * @param {Object} [options={}] - { jobId }
   * @returns {Promise<Object>}
   */
  async update(id, payload, options = {}) {
    this._validateId(id, "phim");
    return this._measure("admin.update", async () => {
      const headers = {};
      if (options.jobId) {
        headers["X-Job-Id"] = options.jobId;
      }
      const response = await api.patch(ENDPOINTS.MOVIES.ADMIN_UPDATE(id), payload, { headers });
      this.clearCache();
      const data = this._extractData(response);
      if (data && typeof data === 'object' && response?.data?.meta) {
        data.meta = response.data.meta;
      }
      return data;
    });
  }

  /**
   * Cập nhật riêng hình ảnh media của phim (Non-blocking / Queued)
   * @param {string} id
   * @param {FormData} filesFormData
   * @param {Object} [options={}] - { jobId }
   * @returns {Promise<Object>}
   */
  async updateImages(id, filesFormData, options = {}) {
    this._validateId(id, "phim");
    return this._measure("admin.updateImages", async () => {
      const headers = {};
      if (options.jobId) {
        headers["X-Job-Id"] = options.jobId;
      }
      const response = await api.patch(ENDPOINTS.MOVIES.ADMIN_IMAGES(id), filesFormData, { headers });
      this.clearCache();
      return this._extractData(response);
    });
  }

  /**
   * Xóa mềm phim vào thùng rác
   * @param {string} id
   * @returns {Promise<Object>}
   */
  async delete(id) {
    this._validateId(id, "phim");
    return this._measure("admin.delete", async () => {
      const response = await api.delete(ENDPOINTS.MOVIES.ADMIN_DELETE(id));
      this.clearCache();
      return this._extractData(response);
    });
  }

  /**
   * Khôi phục phim từ thùng rác
   * @param {string} id
   * @returns {Promise<Object>}
   */
  async restore(id) {
    this._validateId(id, "phim");
    return this._measure("admin.restore", async () => {
      const response = await api.post(ENDPOINTS.MOVIES.ADMIN_RESTORE(id));
      this.clearCache();
      return this._extractData(response);
    });
  }

  /**
   * Xóa vĩnh viễn phim khỏi hệ thống
   * @param {string} id
   * @returns {Promise<Object>}
   */
  async forceDelete(id) {
    this._validateId(id, "phim");
    return this._measure("admin.forceDelete", async () => {
      const response = await api.delete(ENDPOINTS.MOVIES.ADMIN_FORCE_DELETE(id));
      this.clearCache();
      return this._extractData(response);
    });
  }

  /**
   * Khôi phục hàng loạt phim từ thùng rác
   * @param {Array<string>} ids
   * @returns {Promise<Object>}
   */
  async bulkRestore(ids) {
    if (!Array.isArray(ids) || ids.length === 0) throw new Error("Danh sách ID không được để trống");
    return this._measure("admin.bulkRestore", async () => {
      const response = await api.post(ENDPOINTS.MOVIES.ADMIN_BULK_RESTORE, { ids });
      this.clearCache();
      return this._extractData(response);
    });
  }

  /**
   * Xóa vĩnh viễn hàng loạt phim
   * @param {Array<string>} ids
   * @returns {Promise<Object>}
   */
  async bulkForceDelete(ids) {
    if (!Array.isArray(ids) || ids.length === 0) throw new Error("Danh sách ID không được để trống");
    return this._measure("admin.bulkForceDelete", async () => {
      const response = await api.post(ENDPOINTS.MOVIES.ADMIN_BULK_FORCE_DELETE, { ids });
      this.clearCache();
      return this._extractData(response);
    });
  }

  /**
   * Dọn sạch thùng rác (xóa vĩnh viễn toàn bộ phim trong thùng rác)
   * @returns {Promise<Object>}
   */
  async emptyTrash() {
    return this._measure("admin.emptyTrash", async () => {
      const response = await api.delete(ENDPOINTS.MOVIES.ADMIN_EMPTY_TRASH);
      this.clearCache();
      return this._extractData(response);
    });
  }
}

export const movieService = new MovieService();
export default movieService;
