/**
 * @file ai.service.js
 * @module Services/AIService
 * @description Dịch vụ Client gọi API Sạp Phim AI DataOps Platform, kế thừa BaseService.
 */

import { ENDPOINTS } from "@/shared/constants/api-endpoints.constants";

import BaseService from "./base.service";
import api from "./api";

class AIService extends BaseService {
  constructor() {
    super("AIService", {
      enableCache: false,
      enableMetrics: true,
      requestTimeout: 20000,
    });
  }

  /**
   * Gửi yêu cầu gợi ý thông tin phim/anime
   *
   * @param {Object} payload
   * @param {string} payload.title - Tiêu đề tác phẩm
   * @param {number} [payload.year] - Năm phát hành
   * @param {string} [payload.type='all'] - Phạm vi gợi ý
   * @param {boolean} [payload.force_refresh=false]
   * @returns {Promise<Object>}
   */
  async suggestMovie(payload) {
    return this._measure("suggestMovie", async () => {
      const response = await api.post(ENDPOINTS.AI.SUGGEST, payload);
      return this._extractData(response);
    });
  }

  /** @description Resolve catalog identity before starting a suggestion. @param {object} payload @returns {Promise<object>} */
  async resolveMovie(payload) {
    return this._extractData(await api.post(ENDPOINTS.AI.RESOLVE, payload));
  }

  /** @description Recover jobs for the authenticated account and exact form target. @param {object} params @returns {Promise<object>} */
  async getJobs(params) {
    return this._extractData(await api.get(ENDPOINTS.AI.JOBS, { params }));
  }

  /** @description Cancel an owned job without recreating a request. @param {string} jobId @returns {Promise<object>} */
  async cancelJob(jobId) {
    return this._extractData(await api.post(ENDPOINTS.AI.JOB_CANCEL(jobId)));
  }

  /** @description Record acceptance counts without transmitting form values. @param {string} jobId @param {object} payload @returns {Promise<object>} */
  async recordReview(jobId, payload) {
    return this._extractData(await api.post(ENDPOINTS.AI.JOB_REVIEW(jobId), payload));
  }

  /**
   * Tra cứu trạng thái và kết quả Job AI
   *
   * @param {string} jobId
   * @returns {Promise<Object>}
   */
  async getJobStatus(jobId) {
    return this._measure("getJobStatus", async () => {
      const response = await api.get(ENDPOINTS.AI.JOB_STATUS(jobId));
      return this._extractData(response);
    });
  }

  /**
   * Lấy lịch sử kiểm toán AI
   *
   * @param {Object} [params={}]
   * @returns {Promise<Object>}
   */
  async getHistory(params = {}) {
    return this._measure("getHistory", async () => {
      const response = await api.get(ENDPOINTS.AI.HISTORY, { params });
      return this._extractData(response);
    });
  }
}

export const aiService = new AIService();
export default aiService;
