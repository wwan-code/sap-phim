/**
 * Bộ điều khiển Xác thực (Auth Controller)
 *
 * @description Xử lý các yêu cầu HTTP liên quan đến xác thực và quản lý phiên người dùng.
 * Đóng vai trò là tầng giao tiếp (Interface) giữa Client và các dịch vụ nghiệp vụ (Auth Service).
 * Đảm nhiệm việc trích xuất thông tin thiết bị, quản lý Cookie bảo mật và chuẩn hóa phản hồi từ máy chủ.
 */
import { authService } from "../services/auth.service.js";
import { mfaService } from "../services/mfa.service.js";
import { responseUtil } from "../../../utils/response.util.js";
import {
  setAuthCookies,
  clearAuthCookies,
  getRefreshTokenCandidatesFromRequest,
  getRefreshTokenFromRequest,
} from "../helpers/cookie.helper.js";
import { UAParser } from "ua-parser-js";

// ════════════════════════════════════════
// TIỆN ÍCH NHẬN DIỆN THIẾT BỊ (DEVICE DETECTION UTILS)
// ════════════════════════════════════════
/**
 * Trích xuất thông tin chi tiết về thiết bị từ Request
 * @description Bao gồm: IP, User Agent, Trình duyệt, Hệ điều hành và loại thiết bị.
 * Phục vụ các tính năng bảo mật như Fingerprinting và Phát hiện bất thường (Anomaly Detection).
 *
 * @param {Request} req - Express Request object
 * @returns {Object} Thông tin thiết bị đã chuẩn hóa
 */
const getDeviceInfo = (req) => {
  const userAgent = req.headers["user-agent"];
  const parser = new UAParser(userAgent);
  const result = parser.getResult();

  // Trích xuất địa chỉ IP (Xử lý trường hợp qua nhiều Proxy)
  const ip = (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "")
    .split(",")[0]
    .trim();

  // Tạo tên thiết bị thân thiện (ví dụ: "Chrome on Windows 10")
  let deviceName = "Unknown Device";
  if (result.browser.name && result.os.name) {
    deviceName = `${result.browser.name} trên ${result.os.name}`;
    if (result.os.version) deviceName += ` ${result.os.version}`;
  } else if (result.browser.name) {
    deviceName = result.browser.name;
  }

  // Bổ sung thông tin phần cứng nếu phát hiện được
  if (result.device.vendor && result.device.model) {
    deviceName = `${result.device.vendor} ${result.device.model} - ${deviceName}`;
  }

  return {
    ip,
    userAgent,
    deviceName,
    os: result.os,
    browser: result.browser,
    device: result.device,
    cpu: result.cpu,
    clientLocation: req.body?.location || null,
  };
};

// ════════════════════════════════════════
// PHƯƠNG THỨC ĐIỀU KHIỂN (CONTROLLER METHODS)
// ════════════════════════════════════════
export const authController = {
  /**
   * Đăng ký tài khoản người dùng mới
   * @route POST /api/v1/auth/register
   */
  async register(req, res, next) {
    try {
      const deviceInfo = getDeviceInfo(req);

      const result = await authService.register(req.body, deviceInfo);

      return responseUtil.success(
        res,
        { status: result.status },
        result.message || "Đăng ký thành công. Vui lòng kiểm tra hộp thư.",
        201,
      );
    } catch (error) {
      next(error);
    }
  },

  /**
   * Đăng nhập người dùng vào hệ thống
   * @route POST /api/v1/auth/login
   */
  async login(req, res, next) {
    try {
      const deviceInfo = getDeviceInfo(req);
      const result = await authService.login(req.body, deviceInfo);

      // Lưu Refresh Token vào HttpOnly Cookie nếu đăng nhập thành công và không bị vướng 2FA
      if (result.refreshToken) {
        setAuthCookies(res, result.refreshToken, result.rememberMe ?? req.body.rememberMe ?? false);
      }

      return responseUtil.success(res, result, "Đăng nhập thành công");
    } catch (error) {
      next(error);
    }
  },

  /**
   * Đăng xuất khỏi phiên hiện tại
   * @route POST /api/v1/auth/logout
   */
  async logout(req, res, next) {
    try {
      const refreshToken = getRefreshTokenFromRequest(req);
      const accessToken = req.headers.authorization;
      const userId = req.user?.id;

      await authService.logout(userId, refreshToken, accessToken);

      clearAuthCookies(res);

      return responseUtil.success(res, null, "Đăng xuất thành công");
    } catch (error) {
      next(error);
    }
  },

  /**
   * Đăng xuất khỏi toàn bộ các thiết bị đang hoạt động
   * @route POST /api/v1/auth/logout-all
   */
  async logoutAll(req, res, next) {
    try {
      const result = await authService.logoutAll(req.user.id);

      clearAuthCookies(res);

      return responseUtil.success(
        res,
        result,
        "Đã đăng xuất khỏi tất cả thiết bị",
      );
    } catch (error) {
      next(error);
    }
  },

  /**
   * Lấy danh sách các phiên đăng nhập đang hoạt động của người dùng
   * @route GET /api/v1/auth/sessions
   */
  async getSessions(req, res, next) {
    try {
      const refreshToken = getRefreshTokenFromRequest(req);
      const sessions = await authService.getSessions(req.user.id, refreshToken);
      return responseUtil.success(res, { sessions });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Thu hồi một phiên đăng nhập cụ thể theo ID
   * @route DELETE /api/v1/auth/sessions/:id
   */
  async revokeSession(req, res, next) {
    try {
      const { id } = req.params;
      await authService.revokeSession(req.user.id, id);
      return responseUtil.success(res, null, "Đã thu hồi phiên đăng nhập");
    } catch (error) {
      next(error);
    }
  },

  /**
   * Thay đổi mật khẩu người dùng
   * @route PUT /api/v1/auth/change-password
   */
  async changePassword(req, res, next) {
    try {
      const { current_password, new_password, logout_all = false } = req.body;
      const refreshToken = getRefreshTokenFromRequest(req);
      const deviceInfo = getDeviceInfo(req);

      const result = await authService.changePassword(
        req.user.id,
        current_password,
        new_password,
        {
          logoutAll: logout_all,
          refreshToken,
          deviceInfo,
        },
      );

      // Nếu có token trả về, nghĩa là phiên hiện tại vẫn được duy trì (xoay vòng token)
      if (result && result.refreshToken) {
        setAuthCookies(res, result.refreshToken, result.rememberMe || false);
        return responseUtil.success(
          res,
          result,
          "Đổi mật khẩu thành công. Phiên đăng nhập được duy trì.",
        );
      }

      // Ngược lại, đã đăng xuất khỏi tất cả thiết bị
      clearAuthCookies(res);
      return responseUtil.success(
        res,
        null,
        "Đổi mật khẩu thành công. Đã đăng xuất khỏi tất cả thiết bị.",
      );
    } catch (error) {
      next(error);
    }
  },

  /**
   * Làm mới Access Token bằng Refresh Token (Token Rotation)
   * @route POST /api/v1/auth/refresh-token
   */
  async refreshToken(req, res, next) {
    try {
      const refreshToken = getRefreshTokenCandidatesFromRequest(req);
      const deviceInfo = getDeviceInfo(req);

      const result = await authService.refreshToken(refreshToken, deviceInfo);

      if (!result.skipRefreshCookieUpdate && result.refreshToken) {
        setAuthCookies(res, result.refreshToken, result.rememberMe || false);
      }

      const payload = { ...result };
      delete payload.skipRefreshCookieUpdate;
      return responseUtil.success(res, payload, "Token đã được làm mới");
    } catch (error) {
      if ([400, 401, 403].includes(error.statusCode)) {
        clearAuthCookies(res);
      }
      next(error);
    }
  },

  /**
   * Gửi yêu cầu quên mật khẩu
   * @route POST /api/v1/auth/forgot-password
   */
  async forgotPassword(req, res, next) {
    try {
      await authService.forgotPassword(req.body.email);
      return responseUtil.success(
        res,
        null,
        "Nếu email tồn tại, bạn sẽ nhận được link đặt lại mật khẩu",
      );
    } catch (error) {
      next(error);
    }
  },

  /**
   * Đặt lại mật khẩu mới bằng Token bảo mật
   * @route POST /api/v1/auth/reset-password
   */
  async resetPassword(req, res, next) {
    try {
      const { token, password } = req.body;
      await authService.resetPassword(token, password);
      return responseUtil.success(
        res,
        null,
        "Mật khẩu đã được đặt lại thành công",
      );
    } catch (error) {
      next(error);
    }
  },

  /**
   * Xác thực tài khoản qua Email bằng Token
   * @route GET /api/v1/auth/verify-email/:token
   */
  async verifyEmail(req, res, next) {
    try {
      const deviceInfo = getDeviceInfo(req);
      const result = await authService.verifyEmail(
        req.params.token,
        deviceInfo,
      );

      // Tự động đăng nhập sau khi xác thực thành công
      if (result && result.refreshToken) {
        setAuthCookies(res, result.refreshToken, result.rememberMe || false);
      }

      return responseUtil.success(
        res,
        result,
        "Email đã được xác thực thành công",
      );
    } catch (error) {
      next(error);
    }
  },

  /**
   * Gửi lại Email xác thực (Yêu cầu phiên đăng nhập)
   * @route POST /api/v1/auth/send-verification-email
   */
  async resendVerificationEmail(req, res, next) {
    try {
      await authService.resendVerificationEmail(req.user.id);
      return responseUtil.success(
        res,
        null,
        "Email xác thực đã được gửi lại. Vui lòng kiểm tra hộp thư của bạn.",
      );
    } catch (error) {
      next(error);
    }
  },

  /**
   * Gửi lại Email xác thực bằng địa chỉ Email (Công khai)
   * @route POST /api/v1/auth/resend-verification-by-email
   */
  async resendVerificationEmailByEmail(req, res, next) {
    try {
      const { email } = req.body;
      await authService.resendVerificationEmailByEmail(email);
      return responseUtil.success(
        res,
        null,
        "Nếu email đúng và chưa được xác thực, chúng tôi đã gửi lại link xác thực. Vui lòng kiểm tra hộp thư.",
      );
    } catch (error) {
      next(error);
    }
  },

  /**
   * Lấy thông tin tài khoản hiện tại (Profile)
   * @route GET /api/v1/auth/me
   */
  async getMe(req, res, next) {
    try {
      const result = await authService.getMe(req.user.id);
      return responseUtil.success(res, result);
    } catch (error) {
      next(error);
    }
  },

  /**
   * Xác minh MFA OTP để đăng nhập hoàn tất
   * @route POST /api/v1/auth/mfa/login-verify
   */
  async verifyMfaLogin(req, res, next) {
    try {
      const { mfaToken, code } = req.body;
      const result = await authService.verifyMfaLogin(mfaToken, code);

      if (result.refreshToken) {
        setAuthCookies(res, result.refreshToken, result.rememberMe || false);
      }

      return responseUtil.success(res, result, "Xác thực hai yếu tố thành công");
    } catch (error) {
      next(error);
    }
  },

  /**
   * Khởi tạo thiết lập MFA
   * @route POST /api/v1/auth/mfa/setup
   */
  async setupMfa(req, res, next) {
    try {
      const result = await mfaService.generateMfaSecret(req.user.id);
      return responseUtil.success(res, result, "Khởi tạo thiết lập MFA thành công");
    } catch (error) {
      next(error);
    }
  },

  /**
   * Kích hoạt MFA bằng code kiểm tra
   * @route POST /api/v1/auth/mfa/enable
   */
  async enableMfa(req, res, next) {
    try {
      const { code, secret } = req.body;
      const backupCodes = await mfaService.enableMfa(req.user.id, code, secret);
      return responseUtil.success(
        res,
        { backupCodes },
        "Đã kích hoạt xác thực hai yếu tố thành công. Hãy lưu lại mã dự phòng."
      );
    } catch (error) {
      next(error);
    }
  },

  /**
   * Hủy kích hoạt MFA
   * @route POST /api/v1/auth/mfa/disable
   */
  async disableMfa(req, res, next) {
    try {
      const { code } = req.body;
      await mfaService.disableMfa(req.user.id, code);
      return responseUtil.success(res, null, "Đã hủy kích hoạt xác thực hai yếu tố");
    } catch (error) {
      next(error);
    }
  },
};
