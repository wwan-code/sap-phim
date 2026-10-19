/**
 * @file studio.service.js
 * @module Services/StudioService
 * @description Dịch vụ quản lý hãng sản xuất (Studio) cho Client & Admin, kế thừa BaseService.
 */

import BaseService from "./base.service";
import api from "./api";
import { ENDPOINTS } from "@/shared/constants/api-endpoints.constants";

class StudioService extends BaseService {
  constructor() {
    super("StudioService", {
      enableCache: true,
      enableMetrics: true,
      requestTimeout: 10000,
    });
  }

  // ════════════════════════════════════════
  // PUBLIC APIS
  // ════════════════════════════════════════

  /**
   * Lấy danh sách hãng sản xuất công khai (chỉ active, có cache)
   * @param {Object} [params={}]
   * @returns {Promise<Array>}
   */
  async listPublic(params = {}) {
    return this._measure("listPublic", async () => {
      const cleanParams = this._cleanParams(params);
      const cacheKey = this._generateCacheKey("public_list", cleanParams);

      return this.prefetch(cacheKey, async () => {
        const response = await this._deduplicateRequest(ENDPOINTS.STUDIOS.LIST, { params: cleanParams });
        return this._extractData(response);
      }, this.CACHE_TTL.list);
    });
  }

  /**
   * Lấy chi tiết hãng sản xuất theo slug (SEO-friendly)
   * @param {string} slug
   * @returns {Promise<Object>}
   */
  async getBySlug(slug) {
    if (!slug) throw new Error("Slug hãng sản xuất không được để trống");
    return this._measure("getBySlug", async () => {
      const cacheKey = `public_slug:${slug}`;
      return this.prefetch(cacheKey, async () => {
        const response = await this._deduplicateRequest(ENDPOINTS.STUDIOS.DETAIL(slug));
        return this._extractData(response);
      }, this.CACHE_TTL.slug);
    });
  }

  // ════════════════════════════════════════
  // ADMIN APIS
  // ════════════════════════════════════════

  /**
   * Lấy danh sách hãng sản xuất đầy đủ (Admin)
   * @param {Object} [params={}]
   * @returns {Promise<Object>}
   */
  async getAll(params = {}) {
    return this._measure("admin.getAll", async () => {
      const cleanParams = this._cleanParams(params);
      const response = await api.get(ENDPOINTS.STUDIOS.ADMIN_LIST, { params: cleanParams });
      return this._extractData(response);
    });
  }

  /**
   * Lấy chi tiết hãng sản xuất theo ID (Admin)
   * @param {string|number} id
   * @returns {Promise<Object>}
   */
  async getById(id) {
    this._validateId(id, "hãng sản xuất");
    return this._measure("admin.getById", async () => {
      const response = await api.get(ENDPOINTS.STUDIOS.ADMIN_DETAIL(id));
      return this._extractData(response);
    });
  }

  /**
   * Tạo mới hãng sản xuất (Admin)
   * @param {Object} payload { name, slug, description, logo_url, country_code, is_active }
   * @returns {Promise<Object>}
   */
  async create(payload) {
    return this._measure("admin.create", async () => {
      const response = await api.post(ENDPOINTS.STUDIOS.ADMIN_CREATE, payload);
      this.clearCache();
      return this._extractData(response);
    });
  }

  /**
   * Cập nhật thông tin hãng sản xuất (Admin)
   * @param {string|number} id
   * @param {Object} payload
   * @returns {Promise<Object>}
   */
  async update(id, payload) {
    this._validateId(id, "hãng sản xuất");
    return this._measure("admin.update", async () => {
      const response = await api.patch(ENDPOINTS.STUDIOS.ADMIN_UPDATE(id), payload);
      this.clearCache();
      return this._extractData(response);
    });
  }

  /**
   * Xóa mềm hãng sản xuất (Admin)
   * @param {string|number} id
   * @returns {Promise<Object>}
   */
  async delete(id) {
    this._validateId(id, "hãng sản xuất");
    return this._measure("admin.delete", async () => {
      const response = await api.delete(ENDPOINTS.STUDIOS.ADMIN_DELETE(id));
      this.clearCache();
      return this._extractData(response);
    });
  }

  /**
   * Khôi phục hãng sản xuất đã xóa mềm (Admin)
   * @param {string|number} id
   * @returns {Promise<Object>}
   */
  async restore(id) {
    this._validateId(id, "hãng sản xuất");
    return this._measure("admin.restore", async () => {
      const response = await api.post(ENDPOINTS.STUDIOS.ADMIN_RESTORE(id));
      this.clearCache();
      return this._extractData(response);
    });
  }

  /**
   * Xóa mềm hàng loạt hãng sản xuất (Admin)
   * @param {Array<string|number>} ids
   * @returns {Promise<Object>}
   */
  async bulkDelete(ids) {
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new Error("Danh sách ID không hợp lệ");
    }
    return this._measure("admin.bulkDelete", async () => {
      const response = await api.delete(ENDPOINTS.STUDIOS.ADMIN_BULK_DELETE, { data: { ids } });
      this.clearCache();
      return this._extractData(response);
    });
  }

  /**
   * Khôi phục hàng loạt hãng sản xuất (Admin)
   * @param {Array<string|number>} ids
   * @returns {Promise<Object>}
   */
  async bulkRestore(ids) {
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new Error("Danh sách ID không hợp lệ");
    }
    return this._measure("admin.bulkRestore", async () => {
      const response = await api.post(ENDPOINTS.STUDIOS.ADMIN_BULK_RESTORE, { ids });
      this.clearCache();
      return this._extractData(response);
    });
  }

  /**
   * Xóa vĩnh viễn hãng sản xuất (Admin)
   * @param {string|number} id
   * @returns {Promise<Object>}
   */
  async forceDelete(id) {
    this._validateId(id, "hãng sản xuất");
    return this._measure("admin.forceDelete", async () => {
      const response = await api.delete(ENDPOINTS.STUDIOS.ADMIN_FORCE_DELETE(id));
      this.clearCache();
      return this._extractData(response);
    });
  }

  /**
   * Xóa vĩnh viễn hàng loạt hãng sản xuất (Admin)
   * @param {Array<string|number>} ids
   * @returns {Promise<Object>}
   */
  async bulkForceDelete(ids) {
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new Error("Danh sách ID không hợp lệ");
    }
    return this._measure("admin.bulkForceDelete", async () => {
      const response = await api.post(ENDPOINTS.STUDIOS.ADMIN_BULK_FORCE_DELETE, { ids });
      this.clearCache();
      return this._extractData(response);
    });
  }

  /**
   * Dọn sạch toàn bộ thùng rác hãng sản xuất (Admin)
   * @returns {Promise<Object>}
   */
  async emptyTrash() {
    return this._measure("admin.emptyTrash", async () => {
      const response = await api.delete(ENDPOINTS.STUDIOS.ADMIN_EMPTY_TRASH);
      this.clearCache();
      return this._extractData(response);
    });
  }
}

export const studioService = new StudioService();
export default studioService;
