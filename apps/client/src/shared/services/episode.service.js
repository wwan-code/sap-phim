/**
 * @file episode.service.js
 * @module Services/EpisodeService
 * @description Dịch vụ quản lý tập phim, yêu cầu token tải lên, xử lý chuyển mã và phụ đề, kế thừa BaseService.
 */

import BaseService from "./base.service";
import api from "./api";
import { ENDPOINTS } from "@/shared/constants/api-endpoints.constants";

class EpisodeService extends BaseService {
  constructor() {
    super("EpisodeService", {
      enableCache: false,
      enableMetrics: true,
      requestTimeout: 30000,
    });
  }

  /**
   * Lấy danh sách tập phim cho trang Admin
   * @param {Object} [params={}] - movie_id, status, page, limit
   * @returns {Promise<Object>}
   */
  async listAdmin(params = {}) {
    return this._measure("listAdmin", async () => {
      const cleanParams = this._cleanParams(params);
      const response = await api.get(ENDPOINTS.EPISODES.ADMIN_LIST, { params: cleanParams });
      return this._extractData(response);
    });
  }

  /**
   * Lấy chi tiết tập phim
   * @param {string} id
   * @returns {Promise<Object>}
   */
  async getById(id) {
    if (!id) throw new Error("ID tập phim không được để trống");
    return this._measure("getById", async () => {
      const response = await api.get(ENDPOINTS.EPISODES.ADMIN_DETAIL(id));
      return this._extractData(response);
    });
  }

  /**
   * Tạo tập phim mới
   * @param {Object} data - movie_id, episode_number, title, ...
   * @returns {Promise<Object>}
   */
  async create(data) {
    return this._measure("create", async () => {
      const response = await api.post(ENDPOINTS.EPISODES.ADMIN_CREATE, data);
      return this._extractData(response);
    });
  }

  /**
   * Cập nhật thông tin tập phim
   * @param {string} id
   * @param {Object} data
   * @returns {Promise<Object>}
   */
  async update(id, data) {
    if (!id) throw new Error("ID tập phim không được để trống");
    return this._measure("update", async () => {
      const response = await api.patch(ENDPOINTS.EPISODES.ADMIN_UPDATE(id), data);
      return this._extractData(response);
    });
  }

  /**
   * Xóa tập phim
   * @param {string} id
   * @returns {Promise<Object>}
   */
  async delete(id) {
    if (!id) throw new Error("ID tập phim không được để trống");
    return this._measure("delete", async () => {
      const response = await api.delete(ENDPOINTS.EPISODES.ADMIN_DELETE(id));
      return this._extractData(response);
    });
  }

  /**
   * Yêu cầu TUS Upload Token để tải lên tệp video
   * @param {string} id - ID tập phim
   * @returns {Promise<{ tus_url: string, upload_token: string, episode_id: string, movie_id: string }>}
   */
  async requestUploadToken(id) {
    if (!id) throw new Error("ID tập phim không được để trống");
    return this._measure("requestUploadToken", async () => {
      const response = await api.post(ENDPOINTS.EPISODES.ADMIN_UPLOAD_TOKEN(id));
      return this._extractData(response);
    });
  }

  /**
   * Yêu cầu thử lại quá trình chuyển mã video bị lỗi
   * @param {string} id - ID tập phim
   * @returns {Promise<Object>}
   */
  async retryJob(id) {
    if (!id) throw new Error("ID tập phim không được để trống");
    return this._measure("retryJob", async () => {
      const response = await api.post(ENDPOINTS.EPISODES.ADMIN_RETRY(id));
      return this._extractData(response);
    });
  }

  /**
   * Xóa các tệp tài nguyên video của tập phim trên Video Server
   * @param {string} id
   * @returns {Promise<Object>}
   */
  async deleteVideoAsset(id) {
    if (!id) throw new Error("ID tập phim không được để trống");
    return this._measure("deleteVideoAsset", async () => {
      const response = await api.delete(ENDPOINTS.EPISODES.ADMIN_DELETE_VIDEO(id));
      return this._extractData(response);
    });
  }

  /**
   * Lấy danh sách phụ đề của tập phim
   * @param {string} id
   * @returns {Promise<Array>}
   */
  async listSubtitles(id) {
    if (!id) throw new Error("ID tập phim không được để trống");
    return this._measure("listSubtitles", async () => {
      const response = await api.get(ENDPOINTS.EPISODES.ADMIN_SUBTITLES(id));
      const extracted = this._extractData(response);
      return Array.isArray(extracted)
        ? extracted
        : Array.isArray(extracted?.data)
          ? extracted.data
          : [];
    });
  }

  /**
   * Tải lên phụ đề mới
   * @param {string} id
   * @param {FormData} formData
   * @returns {Promise<Object>}
   */
  async uploadSubtitle(id, formData) {
    if (!id) throw new Error("ID tập phim không được để trống");
    return this._measure("uploadSubtitle", async () => {
      const response = await api.post(ENDPOINTS.EPISODES.ADMIN_SUBTITLES(id), formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const extracted = this._extractData(response);
      return extracted?.data || extracted;
    });
  }

  /**
   * Xóa một bản phụ đề
   * @param {string} id
   * @param {string} language
   * @returns {Promise<Object>}
   */
  async deleteSubtitle(id, language) {
    if (!id || !language) throw new Error("ID và ngôn ngữ phụ đề không được để trống");
    return this._measure("deleteSubtitle", async () => {
      const response = await api.delete(ENDPOINTS.EPISODES.ADMIN_DELETE_SUBTITLE(id, language));
      return this._extractData(response);
    });
  }

  /**
   * Lấy thông tin Playback đầy đủ cho Video Player
   * @param {string} id
   * @returns {Promise<Object>}
   */
  async getPlayback(id) {
    if (!id) throw new Error("ID tập phim không được để trống");
    return this._measure("getPlayback", async () => {
      const response = await api.get(ENDPOINTS.EPISODES.PLAYBACK(id));
      return this._extractData(response);
    });
  }
}

export const episodeService = new EpisodeService();
export default episodeService;
