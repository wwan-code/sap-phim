/**
 * @file upload.service.js
 * @module Services/UploadService
 * @description Dịch vụ quản lý tải lên tệp tin (hình ảnh đơn, batch, avatar, cover, processing queue) kế thừa BaseService.
 */

import BaseService from "./base.service";
import api from "./api";
import { ENDPOINTS, UPLOAD_TIMEOUT } from "@/shared/constants/api-endpoints.constants";
import { store } from "@/store";
import { updateUser } from "@/store/slices/auth.slice";

/**
 * @class UploadService
 * @extends BaseService
 * @description Xử lý toàn bộ logic gọi API tải lên đa phương tiện, tích hợp đo lường hiệu năng và quản lý tiến độ mạng
 */
class UploadService extends BaseService {
  constructor() {
    super("UploadService", {
      enableCache: false, // Dữ liệu upload không cache
      enableMetrics: true,
      requestTimeout: UPLOAD_TIMEOUT,
    });
  }

  /**
   * Chuyển đổi dữ liệu linh hoạt sang FormData nếu chưa phải là FormData
   * @private
   * @param {FormData|Object} data
   * @param {string} fileKey Tên trường file mặc định ('image' | 'avatar' | 'cover' | 'images')
   * @returns {FormData}
   */
  _buildFormData(data, fileKey = "image") {
    if (data instanceof FormData) {
      return data;
    }

    const formData = new FormData();
    if (!data) return formData;

    // Nếu truyền trực tiếp File/Blob
    if (data instanceof File || data instanceof Blob) {
      formData.append(fileKey, data);
      return formData;
    }

    // Nếu truyền object chứa file và các params phụ trợ
    Object.keys(data).forEach((key) => {
      const value = data[key];
      if (value === undefined || value === null) return;

      if (key === "file" || key === fileKey) {
        formData.append(fileKey, value);
      } else if (key === "files" && Array.isArray(value)) {
        value.forEach((f) => formData.append("images", f));
      } else if (typeof value === "object" && !(value instanceof File) && !(value instanceof Blob)) {
        formData.append(key, JSON.stringify(value));
      } else {
        formData.append(key, String(value));
      }
    });

    return formData;
  }

  // ════════════════════════════════════════════════════════════════
  // 1. TẢI LÊN HÌNH ẢNH (IMAGE UPLOAD METHODS)
  // ════════════════════════════════════════════════════════════════

  /**
   * Tải lên một hình ảnh duy nhất (xử lý đồng bộ hoặc đẩy vào AI queue)
   * @param {FormData|Object} data File hoặc Object { file, type, width, height, quality, format, upscale, crop, aiProcessing, priority, jobId }
   * @param {Object} [config={}] Cấu hình request { onUploadProgress, signal, timeout }
   * @returns {Promise<Object>} { url, path, jobId, status, message, ... }
   */
  async uploadImage(data, config = {}) {
    return this._measure("uploadImage", async () => {
      const formData = this._buildFormData(data, "image");
      const response = await api.post(ENDPOINTS.UPLOAD.IMAGE, formData, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: config.timeout || UPLOAD_TIMEOUT,
        onUploadProgress: config.onUploadProgress,
        signal: config.signal,
      });
      return this._extractData(response);
    });
  }

  /**
   * Tải lên ảnh đại diện cá nhân (tự động resize và tối ưu avatar)
   * @param {File|Blob|FormData|Object} data File ảnh avatar
   * @param {Object} [config={}] Cấu hình request { onUploadProgress, signal }
   * @returns {Promise<Object>} { avatar_url, path, ... }
   */
  async uploadAvatar(data, config = {}) {
    return this._measure("uploadAvatar", async () => {
      const formData = this._buildFormData(data, "avatar");
      const response = await api.post(ENDPOINTS.UPLOAD.AVATAR, formData, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: config.timeout || UPLOAD_TIMEOUT,
        onUploadProgress: config.onUploadProgress,
        signal: config.signal,
      });
      const extracted = this._extractData(response);
      const avatarUrl = extracted?.avatar_url || extracted?.url;
      if (avatarUrl) {
        store.dispatch(updateUser({ avatar_url: avatarUrl }));
      }
      return extracted;
    });
  }

  /**
   * Tải lên ảnh bìa (cover/banner)
   * @param {File|Blob|FormData|Object} data File ảnh bìa
   * @param {Object} [config={}] Cấu hình request { onUploadProgress, signal }
   * @returns {Promise<Object>} { cover_url, path, ... }
   */
  async uploadCover(data, config = {}) {
    return this._measure("uploadCover", async () => {
      const formData = this._buildFormData(data, "cover");
      const response = await api.post(ENDPOINTS.UPLOAD.COVER, formData, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: config.timeout || UPLOAD_TIMEOUT,
        onUploadProgress: config.onUploadProgress,
        signal: config.signal,
      });
      const extracted = this._extractData(response);
      const coverUrl = extracted?.cover_url || extracted?.url;
      if (coverUrl) {
        store.dispatch(updateUser({ cover_url: coverUrl }));
      }
      return extracted;
    });
  }

  /**
   * Tải lên nhiều hình ảnh cùng lúc theo đợt (Batch Upload)
   * @param {FormData|Object} data { files: File[], batchId, aiProcessing, priority, specs }
   * @param {Object} [config={}] Cấu hình request { onUploadProgress, signal }
   * @returns {Promise<Object>} { batchId, total, completed, errors, results, failed }
   */
  async uploadBatch(data, config = {}) {
    return this._measure("uploadBatch", async () => {
      const formData = this._buildFormData(data, "images");
      const response = await api.post(ENDPOINTS.UPLOAD.BATCH, formData, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: config.timeout || UPLOAD_TIMEOUT * 2,
        onUploadProgress: config.onUploadProgress,
        signal: config.signal,
      });
      return this._extractData(response);
    });
  }

  /**
   * Xóa tệp tin đã tải lên khỏi hệ thống lưu trữ
   * @param {string} url URL hoặc đường dẫn của tệp tin cần xóa
   * @param {Object} [config={}]
   * @returns {Promise<Object>}
   */
  async deleteFile(url, config = {}) {
    return this._measure("deleteFile", async () => {
      const response = await api.delete(ENDPOINTS.UPLOAD.DELETE, {
        data: { url },
        signal: config.signal,
      });
      return this._extractData(response);
    });
  }

  /**
   * Yêu cầu xử lý lại tệp tin đã tồn tại trong storage
   * @param {Object} payload { path, specs, priority, jobId }
   * @param {Object} [config={}]
   * @returns {Promise<Object>} { jobId, status, message }
   */
  async reprocessExisting(payload, config = {}) {
    return this._measure("reprocessExisting", async () => {
      const response = await api.post(ENDPOINTS.UPLOAD.PROCESS_EXISTING, payload, {
        signal: config.signal,
      });
      return this._extractData(response);
    });
  }

  // ════════════════════════════════════════════════════════════════
  // 2. THEO DÕI TIẾN ĐỘ & QUẢN TRỊ (PROGRESS & ADMIN)
  // ════════════════════════════════════════════════════════════════

  /**
   * Lấy trạng thái hiện tại của một công việc xử lý ảnh
   * @param {string} jobId Mã ID công việc
   * @param {Object} [config={}]
   * @returns {Promise<Object>}
   */
  async getJobStatus(jobId, config = {}) {
    return this._measure("getJobStatus", async () => {
      if (!jobId) throw new Error("JobId không được để trống");
      const response = await api.get(ENDPOINTS.UPLOAD.STATUS(jobId), {
        signal: config.signal,
      });
      return this._extractData(response);
    });
  }

  /**
   * Hủy một công việc đang xử lý trong hàng đợi
   * @param {string} jobId Mã ID công việc cần hủy
   * @param {Object} [config={}]
   * @returns {Promise<Object>} { jobId, cancelled: true }
   */
  async cancelJob(jobId, config = {}) {
    return this._measure("cancelJob", async () => {
      if (!jobId) throw new Error("JobId không được để trống");
      const response = await api.delete(ENDPOINTS.UPLOAD.CANCEL(jobId), {
        signal: config.signal,
      });
      return this._extractData(response);
    });
  }

  /**
   * Lấy thống kê hàng đợi và dung lượng lưu trữ (Dành cho Admin)
   * @param {Object} [config={}]
   * @returns {Promise<Object>} { queue, storage, timestamp }
   */
  async getStats(config = {}) {
    return this._measure("getStats", async () => {
      const response = await api.get(ENDPOINTS.UPLOAD.STATS, {
        signal: config.signal,
      });
      return this._extractData(response);
    });
  }
}

export const uploadService = new UploadService();
export default uploadService;
