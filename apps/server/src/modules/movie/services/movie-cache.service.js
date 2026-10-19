/**
 * Dịch vụ Cache Phim (Movie Cache Service)
 * 
 * @description Lớp đệm Redis để tối ưu hóa hiệu năng truy vấn cho module Phim.
 * Hỗ trợ lưu trữ danh sách, chi tiết theo slug/id, phim nổi bật và thịnh hành.
 */
import { cacheHelper, cacheConfig } from "../../../config/redis.config.js";
import { logger } from "../../../utils/logger.js";

const CACHE_PREFIXES = {
  LIST: "movies:list:",
  SLUG: "movies:slug:",
  ID: "movies:id:",
  FEATURED: "movies:featured",
  TRENDING: "movies:trending",
  HOME: "home:sections:",
  SEARCH: "movies:search:",
  LEGACY_LIST: "movie:list:",
};

const CACHE_TTL = cacheConfig.ttl.movie;

class MovieCacheService {
  /**
   * Tạo khóa cache cho truy vấn danh sách (dựa trên các tham số query)
   * @private
   */
  _generateListKey(query) {
    const sorted = Object.keys(query)
      .sort()
      .reduce((acc, key) => {
        acc[key] = query[key];
        return acc;
      }, {});
    return `${CACHE_PREFIXES.LIST}${Buffer.from(JSON.stringify(sorted)).toString("base64")}`;
  }

  /**
   * Lấy danh sách phim từ cache
   * @param {Object} query - Bộ lọc truy vấn
   * @param {boolean} isAdmin - Cờ quản trị (dùng TTL ngắn hơn)
   * @returns {Promise<Object>} { data: [], hit: boolean }
   */
  async getList(query, isAdmin = false) {
    try {
      const key = this._generateListKey(query);
      const cached = await cacheHelper.get(key);

      if (cached) {
        logger.debug("[MovieCache] Truy xuất danh sách từ cache (Hit)", { query });
        return { data: cached, hit: true };
      }

      return { data: null, hit: false };
    } catch (error) {
      logger.error("[MovieCache] Lỗi khi lấy danh sách từ cache", { error: error.message });
      return { data: null, hit: false };
    }
  }

  /**
   * Lưu danh sách phim vào cache
   * @param {Object} query - Bộ lọc truy vấn
   * @param {Object} data - Dữ liệu cần lưu
   * @param {boolean} isAdmin - Cờ quản trị
   */
  async setList(query, data, isAdmin = false) {
    try {
      const key = this._generateListKey(query);
      const ttl = isAdmin ? 60 : CACHE_TTL.list;
      await cacheHelper.set(key, data, ttl);
      logger.debug("[MovieCache] Đã lưu danh sách vào cache", { query, ttl });
    } catch (error) {
      logger.error("[MovieCache] Lỗi khi lưu danh sách vào cache", { error: error.message });
    }
  }

  /**
   * Lấy thông tin phim theo slug từ cache
   * @param {string} slug - Slug của phim
   * @returns {Promise<Object>}
   */
  async getBySlug(slug) {
    try {
      const key = `${CACHE_PREFIXES.SLUG}${slug}`;
      const cached = await cacheHelper.get(key);
      return { data: cached, hit: !!cached };
    } catch (error) {
      logger.error("[MovieCache] Lỗi khi lấy phim theo slug từ cache", { error: error.message });
      return { data: null, hit: false };
    }
  }

  /**
   * Lưu thông tin phim theo slug vào cache
   */
  async setBySlug(slug, data) {
    try {
      const key = `${CACHE_PREFIXES.SLUG}${slug}`;
      await cacheHelper.set(key, data, CACHE_TTL.detail);
    } catch (error) {
      logger.error("[MovieCache] Lỗi khi lưu phim theo slug vào cache", { error: error.message });
    }
  }

  /**
   * Lấy thông tin phim theo ID từ cache
   */
  async getById(id) {
    try {
      const key = `${CACHE_PREFIXES.ID}${id}`;
      const cached = await cacheHelper.get(key);
      return { data: cached, hit: !!cached };
    } catch (error) {
      logger.error("[MovieCache] Lỗi khi lấy phim theo ID từ cache", { error: error.message });
      return { data: null, hit: false };
    }
  }

  /**
   * Lưu thông tin phim theo ID vào cache
   */
  async setById(id, data) {
    try {
      const key = `${CACHE_PREFIXES.ID}${id}`;
      await cacheHelper.set(key, data, CACHE_TTL.detail);
    } catch (error) {
      logger.error("[MovieCache] Lỗi khi lưu phim theo ID vào cache", { error: error.message });
    }
  }

  /**
   * Lấy danh sách phim nổi bật (Featured)
   */
  async getFeatured() {
    try {
      const cached = await cacheHelper.get(CACHE_PREFIXES.FEATURED);
      return { data: cached, hit: !!cached };
    } catch (error) {
      return { data: null, hit: false };
    }
  }

  /**
   * Lưu danh sách phim nổi bật vào cache
   */
  async setFeatured(data) {
    try {
      await cacheHelper.set(CACHE_PREFIXES.FEATURED, data, CACHE_TTL.featured);
    } catch (error) {
      logger.error("[MovieCache] Lỗi khi lưu phim nổi bật vào cache", { error: error.message });
    }
  }

  /**
   * Lấy danh sách phim thịnh hành kèm bộ lọc
   */
  async getTrending(filters = {}) {
    try {
      const key = `${CACHE_PREFIXES.TRENDING}:${this._generateListKey(filters)}`;
      const cached = await cacheHelper.get(key);
      return { data: cached, hit: !!cached };
    } catch (error) {
      return { data: null, hit: false };
    }
  }

  /**
   * Lưu danh sách phim thịnh hành vào cache
   */
  async setTrending(filters = {}, data) {
    try {
      const key = `${CACHE_PREFIXES.TRENDING}:${this._generateListKey(filters)}`;
      await cacheHelper.set(key, data, CACHE_TTL.trending);
    } catch (error) {
      logger.error("[MovieCache] Lỗi khi lưu phim thịnh hành vào cache", { error: error.message });
    }
  }

  /**
   * Hủy bỏ (vô hiệu hóa) toàn bộ cache của module phim
   */
  async getHome(variant = "guest") {
    try {
      const key = `${CACHE_PREFIXES.HOME}${variant}`;
      const cached = await cacheHelper.get(key);
      return { data: cached, hit: !!cached };
    } catch (error) {
      return { data: null, hit: false };
    }
  }

  async setHome(variant = "guest", data) {
    try {
      const key = `${CACHE_PREFIXES.HOME}${variant}`;
      await cacheHelper.set(key, data, 300); // 5 phút TTL
    } catch (error) {
      logger.error("[MovieCache] Failed to cache home sections", { error: error.message });
    }
  }

  async invalidateAll() {
    try {
      await cacheHelper.delByPattern(`${CACHE_PREFIXES.LIST}*`);
      await cacheHelper.delByPattern(`${CACHE_PREFIXES.LEGACY_LIST}*`);
      await cacheHelper.delByPattern(`${CACHE_PREFIXES.SLUG}*`);
      await cacheHelper.delByPattern(`${CACHE_PREFIXES.ID}*`);
      await cacheHelper.delByPattern(`${CACHE_PREFIXES.SEARCH}*`);
      await cacheHelper.delByPattern(`${CACHE_PREFIXES.FEATURED}*`);
      await cacheHelper.delByPattern(`${CACHE_PREFIXES.TRENDING}*`);
      await cacheHelper.delByPattern(`${CACHE_PREFIXES.HOME}*`);
      logger.info("[MovieCache] Đã vô hiệu hóa toàn bộ cache phim");
    } catch (error) {
      logger.error("[MovieCache] Lỗi khi vô hiệu hóa toàn bộ cache", {
        error: error.message,
      });
    }
  }

  /**
   * Vô hiệu hóa cache cho một phim cụ thể và các danh sách liên quan
   * 
   * @param {string} id - ID phim
   * @param {string} slug - Slug phim
   */
  async invalidateMovie(id, slug) {
    try {
      const slugs = Array.isArray(slug) ? slug.filter(Boolean) : [slug].filter(Boolean);
      // Xóa cache theo ID
      if (id) {
        await cacheHelper.del(`${CACHE_PREFIXES.ID}${id}`);
      }

      // Xóa cache theo Slug
      for (const item of slugs) {
        await cacheHelper.del(`${CACHE_PREFIXES.SLUG}${item}`);
      }

      // Xóa toàn bộ danh sách (cách tiếp cận an toàn)
      await cacheHelper.delByPattern(`${CACHE_PREFIXES.LIST}*`);
      await cacheHelper.delByPattern(`${CACHE_PREFIXES.LEGACY_LIST}*`);

      // Xóa cache nổi bật và thịnh hành
      await cacheHelper.delByPattern(`${CACHE_PREFIXES.FEATURED}*`);
      await cacheHelper.delByPattern(`${CACHE_PREFIXES.TRENDING}*`);
      await cacheHelper.delByPattern(`${CACHE_PREFIXES.HOME}*`);

      logger.debug("[MovieCache] Cleared movie cache", { id, slug: slugs });
    } catch (error) {
      logger.error("[MovieCache] Lỗi khi xóa cache phim", {
        error: error.message,
      });
    }
  }

  /**
   * Lấy thông số thống kê của cache
   */
  async getStats() {
    return {
      prefixes: CACHE_PREFIXES,
      ttl: CACHE_TTL,
      timestamp: new Date().toISOString(),
    };
  }
}

export const movieCacheService = new MovieCacheService();
export default movieCacheService;
