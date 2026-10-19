/**
 * @file device-trust.service.js
 * @module Services_DeviceTrust
 * @description Quản lý thiết bị tin cậy và thực thi các giới hạn thiết bị đăng nhập đồng thời dựa trên gói dịch vụ.
 */

import { Op } from "sequelize";
import { TrustedDevice, UserSession } from "../../../models/index.js";
import { hashToken } from "../utils/security.util.js";
import { logger } from "../../../utils/logger.js";
import { MEMBERSHIP_DEVICE_LIMITS } from "../../../constants/auth.constant.js";
import { revokeSession } from "../helpers/session.helper.js";
import events, { EVENTS } from "../../../utils/events.util.js";

/**
 * Sinh dấu vân tay thiết bị ổn định (không phụ thuộc địa chỉ IP).
 *
 * @param {Object} deviceInfo - Thông tin thiết bị từ UAParser
 * @returns {string} Chuỗi hash vân tay thiết bị
 */
export const generateStableFingerprint = (deviceInfo) => {
  const browserName = deviceInfo.browser?.name || "";
  const browserVersion = deviceInfo.browser?.version || "";
  const osName = deviceInfo.os?.name || "";
  const osVersion = deviceInfo.os?.version || "";
  const deviceVendor = deviceInfo.device?.vendor || "";
  const deviceModel = deviceInfo.device?.model || "";
  const cpuArch = deviceInfo.cpu?.architecture || "";

  // Tạo chuỗi thô từ các thông số phần cứng & phần mềm cố định
  const rawFingerprint = [
    browserName,
    browserVersion,
    osName,
    osVersion,
    deviceVendor,
    deviceModel,
    cpuArch
  ].join("|");

  // Fallback về User-Agent nếu toàn bộ trường thông tin trên đều trống
  const finalString = rawFingerprint.replace(/\|/g, "").trim() ? rawFingerprint : (deviceInfo.userAgent || "");
  return hashToken(finalString);
};

export const deviceTrustService = {
  /**
   * Đăng ký hoặc cập nhật thiết bị của người dùng.
   *
   * @param {string} userId - ID người dùng
   * @param {Object} deviceInfo - Thông tin thiết bị
   * @returns {Promise<Object>} Bản ghi thiết bị đã đăng ký
   */
  async registerDevice(userId, deviceInfo) {
    const fingerprint = generateStableFingerprint(deviceInfo);
    const deviceName = deviceInfo.deviceName || "Thiết bị không xác định";

    try {
      let [device, created] = await TrustedDevice.findOrCreate({
        where: { user_id: userId, device_fingerprint: fingerprint },
        defaults: {
          device_name: deviceName,
          is_trusted: false,
          last_used_at: new Date()
        }
      });

      if (!created) {
        device.last_used_at = new Date();
        await device.save();
      } else {
        // Nếu đây là thiết bị đầu tiên, tự động tin cậy thiết bị này
        const totalDevices = await TrustedDevice.count({ where: { user_id: userId } });
        if (totalDevices <= 1) {
          device.is_trusted = true;
          await device.save();
          logger.info(`[DeviceTrust] Tự động tin cậy thiết bị đầu tiên của user ${userId}`);
        } else {
          logger.info(`[DeviceTrust] Đăng ký thiết bị mới (chưa tin cậy) cho user ${userId}`);
        }
      }

      return device;
    } catch (error) {
      logger.error("[DeviceTrust] Lỗi đăng ký thiết bị:", error);
      throw error;
    }
  },

  /**
   * Lấy giới hạn thiết bị tối đa của người dùng dựa trên gói Subscription.
   *
   * @param {Object} user - Đối tượng người dùng kèm subscriptions
   * @returns {number} Giới hạn thiết bị tối đa
   */
  getDeviceLimit(user) {
    const activeSub = user.subscriptions && user.subscriptions.length > 0 ? user.subscriptions[0] : null;
    if (activeSub?.plan?.features && typeof activeSub.plan.features.max_devices === 'number') {
      return activeSub.plan.features.max_devices;
    }
    const planSlug = activeSub?.plan?.slug || "free";
    return MEMBERSHIP_DEVICE_LIMITS[planSlug] || 1;
  },

  /**
   * Thực thi giới hạn số thiết bị hoạt động đồng thời.
   * Thu hồi các phiên cũ nhất nếu số lượng vượt định mức.
   *
   * @param {string} userId - ID người dùng
   * @param {number} maxDevices - Số thiết bị tối đa được phép hoạt động
   * @param {string} [excludeSessionId] - ID phiên đăng nhập hiện tại để tránh tự thu hồi
   */
  async enforceDeviceLimit(userId, maxDevices, excludeSessionId = null) {
    try {
      const activeSessions = await UserSession.findAll({
        where: {
          user_id: userId,
          is_revoked: false,
          expires_at: { [Op.gt]: new Date() }
        },
        order: [["last_used_at", "DESC"]]
      });

      // Nếu vượt giới hạn thiết bị
      if (activeSessions.length > maxDevices) {
        // Sắp xếp các phiên cũ nhất lên trước để chuẩn bị thu hồi
        const sessionsToRevoke = activeSessions
          .filter(s => s.id !== excludeSessionId)
          .slice(maxDevices - 1); // Giữ lại (maxDevices - 1) phiên mới nhất (trừ phiên hiện tại)

        const revokedSessionIds = [];
        for (const session of sessionsToRevoke) {
          const success = await revokeSession(session.id, "device_limit_reached");
          if (success) {
            revokedSessionIds.push(session.id);
            logger.info(`[DeviceTrust] Đã tự động thu hồi phiên cũ ${session.id} của user ${userId} do vượt giới hạn`);
          }
        }

        if (revokedSessionIds.length > 0) {
          // Gửi sự kiện để đồng bộ hóa ngắt kết nối WebSocket
          events.emit(EVENTS.AUTH.PASSWORD_CHANGED, {
            userId,
            action: "keep_current_session",
            revokedSessionIds
          });
        }
      }
    } catch (error) {
      logger.error("[DeviceTrust] Lỗi thực thi giới hạn thiết bị:", error);
    }
  }
};

export default deviceTrustService;
