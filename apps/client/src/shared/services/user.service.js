/**
 * @file user.service.js
 * @module Services/UserService
 * @description Dịch vụ quản lý người dùng (Member & Admin) kế thừa BaseService, tích hợp Redux và Cache Management.
 */

import BaseService from "./base.service";
import api from "./api";
import { uploadService } from "./upload.service";
import { ENDPOINTS } from "@/shared/constants/api-endpoints.constants";
import { store } from "@/store";
import { updateUser, logout as logoutAction } from "@/store/slices/auth.slice";
import { clearStoredTokens } from "@/shared/utils/token-manager";

class UserService extends BaseService {
  constructor() {
    super("UserService", {
      enableCache: true,
      enableMetrics: true,
      requestTimeout: 15000,
    });
  }

  // ════════════════════════════════════════════════════════════════
  // MEMBER APIS (DÀNH CHO NGƯỜI DÙNG ĐĂNG NHẬP / CÁ NHÂN)
  // ════════════════════════════════════════════════════════════════

  /**
   * Lấy thông tin chi tiết profile của user hiện tại
   * @returns {Promise<Object>}
   */
  async getMyProfile() {
    return this._measure("getMyProfile", async () => {
      const response = await api.get(ENDPOINTS.USER.ME);
      const user = this._extractData(response);

      if (user) {
        store.dispatch(updateUser(user));
      }

      return user;
    });
  }

  /**
   * Cập nhật thông tin profile cá nhân (full_name, bio, phone, gender, v.v.)
   * @param {Object} payload
   * @returns {Promise<Object>}
   */
  async updateMyProfile(payload) {
    return this._measure("updateMyProfile", async () => {
      const response = await api.patch(ENDPOINTS.USER.ME, payload);
      const updated = this._extractData(response);

      if (updated) {
        store.dispatch(updateUser(updated));
      }

      return updated;
    });
  }

  /**
   * Cập nhật Avatar (sử dụng Upload API)
   * @param {File|Blob|FormData|Object} payload
   * @param {Object} [config={}]
   * @returns {Promise<Object>}
   */
  async updateAvatar(payload, config = {}) {
    return uploadService.uploadAvatar(payload, config);
  }

  /**
   * Cập nhật ảnh bìa (sử dụng Upload API)
   * @param {File|Blob|FormData|Object} payload
   * @param {Object} [config={}]
   * @returns {Promise<Object>}
   */
  async updateCover(payload, config = {}) {
    return uploadService.uploadCover(payload, config);
  }

  /**
   * Lấy cấu hình tùy chọn cá nhân (Preferences)
   * @returns {Promise<Object>}
   */
  async getPreferences() {
    return this._measure("getPreferences", async () => {
      const response = await api.get(ENDPOINTS.USER.PREFERENCES);
      return this._extractData(response);
    });
  }

  /**
   * Cập nhật cấu hình tùy chọn cá nhân
   * @param {Object} payload
   * @returns {Promise<Object>}
   */
  async updatePreferences(payload) {
    return this._measure("updatePreferences", async () => {
      const response = await api.patch(ENDPOINTS.USER.PREFERENCES, payload);
      return this._extractData(response);
    });
  }

  /**
   * Cập nhật thiết lập quyền riêng tư (Privacy)
   * @param {Object} payload
   * @returns {Promise<Object>}
   */
  async updatePrivacy(payload) {
    return this._measure("updatePrivacy", async () => {
      const response = await api.patch(ENDPOINTS.USER.PRIVACY, payload);
      return this._extractData(response);
    });
  }

  /**
   * Khôi phục cài đặt tùy chọn về mặc định
   * @returns {Promise<Object>}
   */
  async resetPreferences() {
    return this._measure("resetPreferences", async () => {
      const response = await api.post(ENDPOINTS.USER.PREFERENCES_RESET);
      return this._extractData(response);
    });
  }

  /**
   * Áp dụng bộ cài đặt tùy chọn mẫu (Preset)
   * @param {Object} payload { preset_name }
   * @returns {Promise<Object>}
   */
  async applyPreset(payload) {
    return this._measure("applyPreset", async () => {
      const response = await api.post(ENDPOINTS.USER.PREFERENCES_PRESET, payload);
      return this._extractData(response);
    });
  }

  /**
   * Lấy thống kê hoạt động của tài khoản (stats)
   * @returns {Promise<Object>}
   */
  async getStats() {
    return this._measure("getStats", async () => {
      const response = await api.get(ENDPOINTS.USER.STATS);
      return this._extractData(response);
    });
  }

  /**
   * Yêu cầu xuất toàn bộ dữ liệu cá nhân theo quy định GDPR
   * @returns {Promise<Object>}
   */
  async exportData() {
    return this._measure("exportData", async () => {
      const response = await api.get(ENDPOINTS.USER.EXPORT);
      return this._extractData(response);
    });
  }

  /**
   * Xóa tài khoản người dùng
   * @param {Object} payload { password, confirmation }
   * @returns {Promise<Object>}
   */
  async deleteAccount(payload) {
    return this._measure("deleteAccount", async () => {
      const response = await api.delete(ENDPOINTS.USER.DELETE_ACCOUNT, { data: payload });
      clearStoredTokens();
      store.dispatch(logoutAction());
      return this._extractData(response);
    });
  }

  // ════════════════════════════════════════════════════════════════
  // SOCIAL & PUBLIC APIS
  // ════════════════════════════════════════════════════════════════

  /**
   * Lấy thông tin profile công khai của một người dùng bất kỳ
   * @param {string} userId
   * @returns {Promise<Object>}
   */
  async getUserProfile(userId) {
    this._validateId(userId, "người dùng");
    return this._measure("getUserProfile", async () => {
      const response = await api.get(ENDPOINTS.USER.PROFILE(userId));
      return this._extractData(response);
    });
  }

  /**
   * Theo dõi một người dùng
   * @param {string} userId
   * @returns {Promise<Object>}
   */
  async followUser(userId) {
    this._validateId(userId, "người dùng");
    return this._measure("followUser", async () => {
      const response = await api.post(ENDPOINTS.USER.FOLLOW(userId));
      return this._extractData(response);
    });
  }

  /**
   * Hủy theo dõi một người dùng
   * @param {string} userId
   * @returns {Promise<Object>}
   */
  async unfollowUser(userId) {
    this._validateId(userId, "người dùng");
    return this._measure("unfollowUser", async () => {
      const response = await api.delete(ENDPOINTS.USER.FOLLOW(userId));
      return this._extractData(response);
    });
  }

  /**
   * Lấy danh sách người theo dõi (Followers)
   * @param {string} userId
   * @param {Object} [params={}]
   * @returns {Promise<Object>}
   */
  async getFollowers(userId, params = {}) {
    this._validateId(userId, "người dùng");
    return this._measure("getFollowers", async () => {
      const cleanParams = this._cleanParams(params);
      const response = await api.get(ENDPOINTS.USER.FOLLOWERS(userId), { params: cleanParams });
      return this._extractData(response);
    });
  }

  /**
   * Lấy danh sách đang theo dõi (Following)
   * @param {string} userId
   * @param {Object} [params={}]
   * @returns {Promise<Object>}
   */
  async getFollowing(userId, params = {}) {
    this._validateId(userId, "người dùng");
    return this._measure("getFollowing", async () => {
      const cleanParams = this._cleanParams(params);
      const response = await api.get(ENDPOINTS.USER.FOLLOWING(userId), { params: cleanParams });
      return this._extractData(response);
    });
  }

  // ════════════════════════════════════════════════════════════════
  // ADMIN MANAGEMENT APIS (DÀNH CHO QUẢN TRỊ VIÊN)
  // ════════════════════════════════════════════════════════════════

  /**
   * Danh sách người dùng hệ thống phân trang và lọc (Admin)
   * @param {Object} [params={}]
   * @returns {Promise<Object>} { users, pagination, metrics }
   */
  async listUsers(params = {}) {
    return this._measure("admin.listUsers", async () => {
      const cleanParams = this._cleanParams(params);
      const response = await api.get(ENDPOINTS.ADMIN_USERS.LIST, { params: cleanParams });
      return this._extractData(response);
    });
  }

  /**
   * Xem chi tiết người dùng (Admin)
   * @param {string} id
   * @returns {Promise<Object>}
   */
  async getUser(id) {
    this._validateId(id, "người dùng");
    return this._measure("admin.getUser", async () => {
      const response = await api.get(ENDPOINTS.ADMIN_USERS.DETAIL(id));
      return this._extractData(response);
    });
  }

  /**
   * Tạo tài khoản người dùng mới (Admin)
   * @param {Object} payload
   * @returns {Promise<Object>}
   */
  async createUser(payload) {
    return this._measure("admin.createUser", async () => {
      const response = await api.post(ENDPOINTS.ADMIN_USERS.CREATE, payload);
      return this._extractData(response);
    });
  }

  /**
   * Cập nhật thông tin người dùng (Admin)
   * @param {string} id
   * @param {Object} payload
   * @returns {Promise<Object>}
   */
  async updateUser(id, payload) {
    this._validateId(id, "người dùng");
    return this._measure("admin.updateUser", async () => {
      const response = await api.patch(ENDPOINTS.ADMIN_USERS.UPDATE(id), payload);
      return this._extractData(response);
    });
  }

  /**
   * Cập nhật cấp bậc / kinh nghiệm của người dùng (Admin)
   * @param {string} id
   * @param {Object} payload { level, exp, reason }
   * @returns {Promise<Object>}
   */
  async updateUserLevel(id, payload) {
    this._validateId(id, "người dùng");
    return this._measure("admin.updateUserLevel", async () => {
      const response = await api.patch(ENDPOINTS.ADMIN_USERS.UPDATE_LEVEL(id), payload);
      return this._extractData(response);
    });
  }

  /**
   * Khôi phục tài khoản đã bị soft-delete (Admin)
   * @param {string} id
   * @returns {Promise<Object>}
   */
  async restoreUser(id) {
    this._validateId(id, "người dùng");
    return this._measure("admin.restoreUser", async () => {
      const response = await api.post(ENDPOINTS.ADMIN_USERS.RESTORE(id));
      return this._extractData(response);
    });
  }

  /**
   * Xóa tài khoản vĩnh viễn (Chỉ dành cho Boss)
   * @param {string} id
   * @returns {Promise<Object>}
   */
  async deleteUser(id) {
    this._validateId(id, "người dùng");
    return this._measure("admin.deleteUser", async () => {
      const response = await api.delete(ENDPOINTS.ADMIN_USERS.DELETE(id));
      return this._extractData(response);
    });
  }

  /**
   * Cập nhật trạng thái người dùng hàng loạt (Cấm / Kích hoạt)
   * @param {Object} payload { user_ids, status, reason, ban_until }
   * @returns {Promise<Object>}
   */
  async bulkUpdateStatus(payload) {
    return this._measure("admin.bulkUpdateStatus", async () => {
      const response = await api.post(ENDPOINTS.ADMIN_USERS.BULK_STATUS, payload);
      return this._extractData(response);
    });
  }

  /**
   * Lấy danh sách các phiên đăng nhập của người dùng (Admin)
   * @param {string} id
   * @returns {Promise<Array>}
   */
  async listUserSessions(id) {
    this._validateId(id, "người dùng");
    return this._measure("admin.listUserSessions", async () => {
      const response = await api.get(ENDPOINTS.ADMIN_USERS.SESSIONS(id));
      const data = this._extractData(response);
      return data?.sessions || data || [];
    });
  }

  /**
   * Thu hồi phiên đăng nhập của người dùng (Admin)
   * @param {string} id
   * @param {string|number} sessionId
   * @returns {Promise<Object>}
   */
  async revokeUserSession(id, sessionId) {
    this._validateId(id, "người dùng");
    this._validateId(sessionId, "phiên đăng nhập");
    return this._measure("admin.revokeUserSession", async () => {
      const response = await api.delete(ENDPOINTS.ADMIN_USERS.REVOKE_SESSION(id, sessionId));
      return this._extractData(response);
    });
  }

  /**
   * Xem thông tin ví người dùng (Admin)
   * @param {string} id
   * @returns {Promise<Object>}
   */
  async getUserWallet(id) {
    this._validateId(id, "người dùng");
    return this._measure("admin.getUserWallet", async () => {
      const response = await api.get(ENDPOINTS.ADMIN_USERS.WALLET(id));
      return this._extractData(response);
    });
  }

  /**
   * Khóa ví người dùng (Admin)
   * @param {string} id
   * @param {Object} payload { reason }
   * @returns {Promise<Object>}
   */
  async lockUserWallet(id, payload) {
    this._validateId(id, "người dùng");
    return this._measure("admin.lockUserWallet", async () => {
      const response = await api.post(ENDPOINTS.ADMIN_USERS.LOCK_WALLET(id), payload);
      return this._extractData(response);
    });
  }

  /**
   * Mở khóa ví người dùng (Admin)
   * @param {string} id
   * @returns {Promise<Object>}
   */
  async unlockUserWallet(id) {
    this._validateId(id, "người dùng");
    return this._measure("admin.unlockUserWallet", async () => {
      const response = await api.post(ENDPOINTS.ADMIN_USERS.UNLOCK_WALLET(id));
      return this._extractData(response);
    });
  }

  /**
   * Lấy lịch sử đăng ký gói cước VIP của người dùng (Admin)
   * @param {string} id
   * @param {Object} [params={}]
   * @returns {Promise<Object>}
   */
  async listUserSubscriptions(id, params = {}) {
    this._validateId(id, "người dùng");
    return this._measure("admin.listUserSubscriptions", async () => {
      const cleanParams = this._cleanParams(params);
      const response = await api.get(ENDPOINTS.ADMIN_USERS.SUBSCRIPTIONS(id), { params: cleanParams });
      return this._extractData(response);
    });
  }
}

export const userService = new UserService();
export default userService;
