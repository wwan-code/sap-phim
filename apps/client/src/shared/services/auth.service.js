/**
 * @file auth.service.js
 * @module Services/AuthService
 * @description Dịch vụ xác thực và quản lý tài khoản người dùng, kế thừa BaseService tích hợp Telemetry và Token Manager.
 */

import BaseService from "./base.service";
import api from "./api";
import { ENDPOINTS } from "@/shared/constants/api-endpoints.constants";
import { store } from "@/store";
import { setCredentials, logout as logoutAction, updateUser } from "@/store/slices/auth.slice";
import { setStoredTokens, clearStoredTokens, performLogout } from "@/shared/utils/token-manager";

class AuthService extends BaseService {
  constructor() {
    super("AuthService", {
      enableCache: false, // Dữ liệu auth mang tính bảo mật và realtime, không lưu LRU cache tĩnh
      enableMetrics: true,
      requestTimeout: 15000,
    });
  }

  /**
   * Đăng nhập tài khoản
   * @param {Object} credentials { identifier, password, rememberMe, deviceFingerprint }
   * @returns {Promise<Object>}
   */
  async login({ identifier, password, rememberMe = false, deviceFingerprint }) {
    return this._measure("login", async () => {
      const response = await api.post(ENDPOINTS.AUTH.LOGIN, {
        identifier,
        password,
        rememberMe,
        deviceFingerprint,
      });

      const data = this._extractData(response);

      // Nếu yêu cầu MFA hoặc bắt buộc thiết lập MFA, trả về kết quả mà chưa cập nhật auth credentials
      if (
        data?.mfaRequired ||
        data?.requireMfa ||
        data?.status === "mfa_required" ||
        data?.status === "mfa_setup_required"
      ) {
        return data;
      }

      if (data?.accessToken) {
        setStoredTokens({
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
          remember: rememberMe,
        });

        store.dispatch(
          setCredentials({
            user: data.user,
            accessToken: data.accessToken,
            refreshToken: data.refreshToken,
          }),
        );
      }

      return data;
    });
  }

  /**
   * Xác minh mã 2FA / MFA để hoàn tất đăng nhập
   * @param {Object} payload { mfaToken, code }
   * @returns {Promise<Object>}
   */
  async verifyMfaLogin({ mfaToken, code }) {
    return this._measure("verifyMfaLogin", async () => {
      const response = await api.post(ENDPOINTS.AUTH.MFA_LOGIN_VERIFY, {
        mfaToken,
        code,
      });

      const data = this._extractData(response);

      if (data?.accessToken) {
        setStoredTokens({
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
          remember: true,
        });

        store.dispatch(
          setCredentials({
            user: data.user,
            accessToken: data.accessToken,
            refreshToken: data.refreshToken,
          }),
        );
      }

      return data;
    });
  }

  /**
   * Đăng ký tài khoản người dùng mới
   * @param {Object} payload { username, email, password, full_name, acceptTerms, deviceFingerprint }
   * @returns {Promise<Object>}
   */
  async register(payload) {
    return this._measure("register", async () => {
      const response = await api.post(ENDPOINTS.AUTH.REGISTER, payload);
      return this._extractData(response);
    });
  }

  /**
   * Lấy thông tin tài khoản người dùng hiện tại (Profile)
   * @returns {Promise<Object>}
   */
  async getMe() {
    return this._measure("getMe", async () => {
      const response = await api.get(ENDPOINTS.AUTH.ME);
      const data = this._extractData(response);
      const user = data?.user || data;

      if (user) {
        store.dispatch(updateUser(user));
      }

      return user;
    });
  }

  /**
   * Làm mới Access Token bằng Refresh Token
   * @param {Object} payload { refreshToken, deviceFingerprint }
   * @returns {Promise<Object>}
   */
  async refreshToken(payload = {}) {
    return this._measure("refreshToken", async () => {
      const response = await api.post(ENDPOINTS.AUTH.REFRESH_TOKEN, payload);
      const data = this._extractData(response);

      if (data?.accessToken) {
        setStoredTokens({
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
        });

        store.dispatch(
          setCredentials({
            user: data.user,
            accessToken: data.accessToken,
            refreshToken: data.refreshToken,
          }),
        );
      }

      return data;
    });
  }

  /**
   * Đăng xuất phiên hiện tại
   * @returns {Promise<void>}
   */
  async logout() {
    return this._measure("logout", async () => {
      try {
        await api.post(ENDPOINTS.AUTH.LOGOUT);
      } catch (e) {
        // Ignored
      } finally {
        performLogout();
      }
    });
  }

  /**
   * Đăng xuất khỏi tất cả các thiết bị
   * @returns {Promise<void>}
   */
  async logoutAll() {
    return this._measure("logoutAll", async () => {
      try {
        await api.post(ENDPOINTS.AUTH.LOGOUT_ALL);
      } catch (e) {
        // Ignored
      } finally {
        performLogout();
      }
    });
  }

  /**
   * Đổi mật khẩu
   * @param {Object} payload { current_password, new_password, confirm_password, logout_all }
   * @returns {Promise<Object>}
   */
  async changePassword(payload) {
    return this._measure("changePassword", async () => {
      const response = await api.put(ENDPOINTS.AUTH.CHANGE_PASSWORD, payload);
      return this._extractData(response);
    });
  }

  /**
   * Quên mật khẩu - gửi email khôi phục
   * @param {Object} payload { email }
   * @returns {Promise<Object>}
   */
  async forgotPassword(payload) {
    return this._measure("forgotPassword", async () => {
      const response = await api.post(ENDPOINTS.AUTH.FORGOT_PASSWORD, payload);
      return this._extractData(response);
    });
  }

  /**
   * Đặt lại mật khẩu với token từ email
   * @param {Object} payload { token, password, confirm_password }
   * @returns {Promise<Object>}
   */
  async resetPassword(payload) {
    return this._measure("resetPassword", async () => {
      const response = await api.post(ENDPOINTS.AUTH.RESET_PASSWORD, payload);
      return this._extractData(response);
    });
  }

  /**
   * Xác thực Email bằng token
   * @param {string} token
   * @returns {Promise<Object>}
   */
  async verifyEmail(token) {
    return this._measure("verifyEmail", async () => {
      const response = await api.get(ENDPOINTS.AUTH.VERIFY_EMAIL(token));
      return this._extractData(response);
    });
  }

  /**
   * Gửi lại email xác thực (chưa đăng nhập)
   * @param {Object} payload { email }
   * @returns {Promise<Object>}
   */
  async resendVerification(payload) {
    return this._measure("resendVerification", async () => {
      const response = await api.post(ENDPOINTS.AUTH.RESEND_VERIFICATION, payload);
      return this._extractData(response);
    });
  }

  /**
   * Gửi lại email xác thực (đã đăng nhập)
   * @returns {Promise<Object>}
   */
  async sendVerificationEmail() {
    return this._measure("sendVerificationEmail", async () => {
      const response = await api.post(ENDPOINTS.AUTH.SEND_VERIFICATION_EMAIL);
      return this._extractData(response);
    });
  }

  /**
   * Lấy danh sách các phiên đăng nhập đang hoạt động
   * @returns {Promise<Array>}
   */
  async getSessions() {
    return this._measure("getSessions", async () => {
      const response = await api.get(ENDPOINTS.AUTH.SESSIONS);
      const data = this._extractData(response);
      return data?.sessions || data || [];
    });
  }

  /**
   * Thu hồi một phiên đăng nhập
   * @param {string|number} sessionId
   * @returns {Promise<Object>}
   */
  async revokeSession(sessionId) {
    this._validateId(sessionId, "phiên đăng nhập");
    return this._measure("revokeSession", async () => {
      const response = await api.delete(ENDPOINTS.AUTH.REVOKE_SESSION(sessionId));
      return this._extractData(response);
    });
  }

  /**
   * Khởi tạo thiết lập MFA
   * @param {string} [tempToken] - Token tạm thời của phiên đăng nhập chờ MFA
   * @returns {Promise<Object>} { secret, qrCodeUrl, backupCodes }
   */
  async setupMfa(tempToken = null) {
    return this._measure("setupMfa", async () => {
      const config = tempToken
        ? { headers: { Authorization: `Bearer ${tempToken}` } }
        : {};
      const response = await api.post(ENDPOINTS.AUTH.MFA_SETUP, {}, config);
      return this._extractData(response);
    });
  }

  /**
   * Kích hoạt MFA
   * @param {Object} payload { code, secret }
   * @param {string} [tempToken] - Token tạm thời của phiên đăng nhập chờ MFA
   * @returns {Promise<Object>}
   */
  async enableMfa(payload, tempToken = null) {
    return this._measure("enableMfa", async () => {
      const config = tempToken
        ? { headers: { Authorization: `Bearer ${tempToken}` } }
        : {};
      const response = await api.post(ENDPOINTS.AUTH.MFA_ENABLE, payload, config);
      return this._extractData(response);
    });
  }

  /**
   * Hủy kích hoạt MFA
   * @param {Object} payload { code }
   * @returns {Promise<Object>}
   */
  async disableMfa(payload) {
    return this._measure("disableMfa", async () => {
      const response = await api.post(ENDPOINTS.AUTH.MFA_DISABLE, payload);
      return this._extractData(response);
    });
  }
}

export const authService = new AuthService();
export default authService;
