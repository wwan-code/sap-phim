/**
 * Enhanced Session Helper
 * Quản lý vòng đời phiên đăng nhập (Session) với các tính năng:
 * - Định vị địa chỉ (GeoIP + GPS)
 * - Tích hợp phát hiện bất thường (Anomaly Detection)
 * - Xoay vòng Token kèm phát hiện tái sử dụng (Token Rotation + Reuse Detection)
 * - Quản lý đa thiết bị và tính toán độ tin cậy của phiên.
 */
import { v4 as uuidv4 } from "uuid";
import { Op, Sequelize } from "sequelize";
import { UserSession } from "../../../models/index.js";
import { logger } from "../../../utils/logger.js";
import { hashToken } from "../utils/security.util.js";
import { auditLogger } from "../utils/audit.logger.js";
import {
  resolveLocation,
  formatLocationString,
} from "../services/location.service.js";
import { TOKEN_CONFIG, SESSION_CONFIG } from "../../../constants/auth.constant.js";
import jwtConfig from "../../../config/jwt.config.js";
import { cacheHelper, getRedisClient } from "../../../config/redis.config.js";

const GRACE_SESSION_CACHE_TTL_SEC = 20;

// ─── Tính Toán Thời Gian Hết Hạn Token ──────────────────────────────────────────────

/**
 * Tính toán ngày hết hạn của Token.
 */
const getTokenExpiryDate = (expiresIn, rememberMe = false) => {
  if (rememberMe) {
    return new Date(Date.now() + TOKEN_CONFIG.REMEMBER_ME_EXPIRY_MS);
  }

  if (typeof expiresIn === "number") {
    return new Date(Date.now() + expiresIn * 1000);
  }

  const match = String(expiresIn).match(/^(\d+)([dhm])$/);
  if (!match) return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const value = parseInt(match[1], 10);
  const unit = match[2];
  const msValue =
    unit === "d"
      ? value * 86400000
      : unit === "h"
        ? value * 3600000
        : unit === "m"
          ? value * 60000
          : 0;

  return new Date(Date.now() + msValue);
};

// ─── Tiện Ích Hiển Thị Phiên ────────────────────────────────────────────────────────

/**
 * Định dạng tên phiên đăng nhập để hiển thị cho người dùng.
 * Ví dụ: "Chrome trên Windows 10 · Hà Nội, Việt Nam"
 */
export const formatSessionName = (deviceInfo) => {
  if (!deviceInfo) return "Phiên không xác định";

  const { deviceName, location } = deviceInfo;
  let name = deviceName || "Thiết bị không xác định";

  const locStr = formatLocationString(location);
  if (locStr && locStr !== "Unknown Location") {
    name += ` · ${locStr}`;
  } else if (deviceInfo.ip) {
    name += ` · ${deviceInfo.ip}`;
  }

  return name;
};

// ─── Khởi Tạo Phiên (Session Creation) ──────────────────────────────────────────────

/**
 * Tạo một phiên đăng nhập mới kèm theo định vị chi tiết.
 *
 * @param {string} userId - ID người dùng
 * @param {string} refreshToken - Refresh Token thuần (sẽ được băm trước khi lưu)
 * @param {string} tokenFamily - UUID chuỗi Token (Token Family)
 * @param {Object} deviceInfo - Thông tin thiết bị thô từ Controller
 * @param {boolean} rememberMe - Gia hạn thời gian phiên
 * @param {string|null} sessionId - ID phiên được tạo trước (liên kết với JWT)
 * @param {Object|null} anomalyResult - Kết quả từ hệ thống phát hiện bất thường
 * @returns {Promise<Object>} Phiên đăng nhập đã tạo
 */
export const createSession = async (
  userId,
  refreshToken,
  tokenFamily,
  deviceInfo = {},
  rememberMe = false,
  sessionId = null,
  anomalyResult = null,
  options = {},
) => {
  try {
    const tokenHash = hashToken(refreshToken);
    const expiresAt = getTokenExpiryDate(
      jwtConfig.refresh.expiresIn,
      rememberMe,
    );

    const locationResult =
      options.locationResult || (await resolveLocation(deviceInfo, deviceInfo.ip));

    // Xây dựng đối tượng lưu trữ thông tin thiết bị
    const storageDeviceInfo = {
      ip: deviceInfo.ip,
      userAgent: deviceInfo.userAgent,
      deviceName: deviceInfo.deviceName,
      os: deviceInfo.os,
      browser: deviceInfo.browser,
      device: deviceInfo.device,
      cpu: deviceInfo.cpu,
      location: locationResult.primary,
      locationConfidence: locationResult.confidence,
      ipLocation: locationResult.ipLocation,
      gpsLocation: locationResult.gpsLocation || null,
      locationDiscrepancy: locationResult.discrepancy || null,
      rememberMe, // Lưu trạng thái ghi nhớ đăng nhập vào JSONB
    };


    // Thu thập các cờ bất thường
    const anomalyFlags =
      anomalyResult?.signals?.filter((s) => s.score > 0)?.map((s) => s.type) ||
      [];

    const session = await UserSession.create({
      id: sessionId || undefined,
      user_id: userId,
      token_hash: tokenHash,
      token_family: tokenFamily,
      device_info: storageDeviceInfo,
      anomaly_flags: anomalyFlags,
      risk_score: anomalyResult?.riskScore || 0,
      expires_at: expiresAt,
      last_used_at: new Date(),
      is_revoked: false,
    });

    const locationStr = formatLocationString(locationResult.primary);

    auditLogger.sessionCreated(
      userId,
      session.id,
      deviceInfo.ip,
      deviceInfo.userAgent,
      {
        tokenFamily,
        rememberMe,
        expiresAt,
        location: locationStr,
        locationSource: locationResult.primary?.source,
        locationConfidence: locationResult.confidence,
        riskScore: anomalyResult?.riskScore || 0,
        anomalyFlags,
      },
    );

    logger.info(
      `[Session] Đã tạo phiên: user=${userId}, vị trí="${locationStr}", ` +
      `nguồn=${locationResult.primary?.source || "unknown"}, ` +
      `rủi ro=${anomalyResult?.riskScore || 0}`,
    );

    return session;
  } catch (error) {
    logger.error("[Session] Tạo phiên thất bại:", error);
    throw new Error("Không thể tạo phiên đăng nhập");
  }
};

// ─── Tra Cứu Phiên (Session Lookup) ────────────────────────────────────────────────

/**
 * Tìm kiếm phiên đăng nhập bằng Refresh Token (chấp nhận cả phiên đã thu hồi để phục vụ kiểm tra bảo mật).
 */
export const findSessionByToken = async (refreshToken) => {
  try {
    const tokenHash = hashToken(refreshToken);
    return await UserSession.findOne({
      where: {
        token_hash: tokenHash,
        expires_at: { [Op.gt]: new Date() },
      },
    });
  } catch (error) {
    logger.error("[Session] Tìm kiếm phiên thất bại:", error);
    return null;
  }
};

// ─── Xoay Vòng Phiên (Token Rotation & Reuse Detection) ──────────────────────────

/**
 * Xoay vòng phiên đăng nhập - Thu hồi phiên cũ, tạo phiên mới.
 * Phát hiện các cuộc tấn công tái sử dụng token (Stolen Token Reuse).
 *
 * @param {Object} oldSession - Đối tượng phiên hiện tại
 * @param {string} newRefreshToken - Refresh Token thuần mới
 * @param {Object} deviceInfo - Thông tin thiết bị cập nhật
 * @param {string|null} newSessionId - ID cho phiên mới
 * @returns {Promise<{ session: Object|null, reuseDetected: boolean }>}
 */
export const rotateSession = async (
  oldSession,
  newRefreshToken,
  deviceInfo = {},
  newSessionId = null,
  tokens = null,
) => {
  // 1. PHÁT HIỆN TÁI SỬ DỤNG (REUSE DETECTION) HOẶC PHỤC HỒI ĐỒNG THỜI (CONCURRENCY RECOVERY)
  if (oldSession.is_revoked) {
    if (oldSession.revoked_reason === "rotated" && oldSession.revoked_at) {
      const timeSinceRevocation = Date.now() - new Date(oldSession.revoked_at).getTime();

      // Kiểm tra trong cửa sổ 10 giây (grace window) để phục hồi cho các yêu cầu song song
      if (timeSinceRevocation <= 10000) {
        logger.info(
          `[Session] Trùng lặp refresh nằm trong cửa sổ grace window (${timeSinceRevocation}ms) cho session: ${oldSession.id}`
        );

        // Thử lấy bộ tokens mới đã cache từ yêu cầu trước đó
        const cachedTokens = await cacheHelper.get(`grace_session:${oldSession.id}`);
        if (cachedTokens) {
          logger.info(`[Session] Trả về bộ tokens phục hồi từ Redis cho session: ${oldSession.id}`);
          return {
            session: oldSession,
            reuseDetected: false,
            isGraceRecovery: true,
            recoveredTokens: cachedTokens,
          };
        }

        // Fallback: Tìm session đang hoạt động tiếp theo trong family này.
        // LƯU Ý QUAN TRỌNG (xem FIX-CRITICAL-02 ở token.service.js):
        // Khi rơi vào nhánh này (cache miss), caller KHÔNG được sinh refresh
        // token mới — vì token đó sẽ không khớp với token_hash đã lưu của
        // nextActiveSession, gây ra refresh token "mồ côi". caller chỉ nên
        // cấp lại access token và giữ nguyên cookie refresh token hiện có.
        const nextActiveSession = await UserSession.findOne({
          where: {
            token_family: oldSession.token_family,
            is_revoked: false,
            expires_at: { [Op.gt]: new Date() },
          },
        });

        if (nextActiveSession) {
          logger.info(`[Session] Tìm thấy session active kế tiếp: ${nextActiveSession.id}`);
          return {
            session: nextActiveSession,
            reuseDetected: false,
            isGraceRecovery: true,
            recoveredTokens: null, // caller PHẢI chỉ cấp access-token-only, xem lưu ý trên
          };
        }
      }
    }

    // Tấn công replay thực tế (vượt quá 10s hoặc phiên bị hủy thủ công)
    logger.warn(
      `[Security] 🚨 Phát hiện tấn công tái sử dụng Token! ` +
      `Family: ${oldSession.token_family}, User: ${oldSession.user_id}, Session: ${oldSession.id}`
    );

    // Thu hồi NGAY LẬP TỨC toàn bộ gia đình token (Token Family) để bảo vệ tài khoản
    const transaction = await UserSession.sequelize.transaction();
    try {
      const revokedCount = await UserSession.update(
        {
          is_revoked: true,
          revoked_at: new Date(),
          revoked_reason: "reuse_detected",
        },
        {
          where: {
            token_family: oldSession.token_family,
            is_revoked: false,
          },
          transaction,
        }
      );

      await transaction.commit();

      auditLogger.tokenReuseDetected(
        oldSession.user_id,
        deviceInfo.ip,
        deviceInfo.userAgent,
        {
          tokenFamily: oldSession.token_family,
          revokedCount: revokedCount[0],
          oldSessionId: oldSession.id,
        }
      );

      // Lưu ý: việc bump token_version (vô hiệu hóa access token đang tồn tại)
      // được thực hiện ở tầng gọi (token.service.js) — nơi đã import sẵn User
      // model, tránh session.helper.js phải phụ thuộc chéo vào User model.
      return { session: null, reuseDetected: true };
    } catch (err) {
      await transaction.rollback();
      logger.error("[Session] Thu hồi family thất bại khi phát hiện reuse:", err);
      throw err;
    }
  }

  // 2. KHÓA PHÂN PHỐI (REDIS LOCK) CHO QUÁ TRÌNH XOAY VÒNG BÌNH THƯỜNG
  const redis = getRedisClient();
  const lockKey = `lock:rotation:${oldSession.token_family}`;
  let lockAcquired = false;

  // Thử lấy khóa, thử lại tối đa 5 lần với độ trễ 100ms
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const res = await redis.set(lockKey, "1", "NX", "PX", 5000);
      if (res === "OK") {
        lockAcquired = true;
        break;
      }
    } catch (err) {
      // Redis offline/lỗi, cho phép bỏ qua lock và chạy DB transaction để tránh block user
      logger.warn(`[Session] Lỗi lock Redis, bỏ qua lock: ${err.message}`);
      lockAcquired = true;
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  if (!lockAcquired) {
    logger.warn(`[Session] Không thể lấy lock xoay vòng cho family ${oldSession.token_family}. Đang refetch trạng thái.`);
    const refetchedSession = await UserSession.findByPk(oldSession.id);
    if (refetchedSession && refetchedSession.is_revoked) {
      // Session đã bị xoay vòng bởi luồng song song khác. Đệ quy gọi lại để vào nhánh Grace Recovery.
      return rotateSession(refetchedSession, newRefreshToken, deviceInfo, newSessionId, tokens);
    }
    throw new Error("Hệ thống bận, vui lòng thử lại");
  }

  // Thực hiện xoay vòng trong Database Transaction
  const transaction = await UserSession.sequelize.transaction();
  try {
    // Lock hàng trong DB để chắc chắn không bị race condition ở tầng SQL
    const lockedSession = await UserSession.findByPk(oldSession.id, {
      transaction,
      lock: true,
    });

    if (!lockedSession || lockedSession.is_revoked) {
      // Đã bị xoay vòng trước đó
      await transaction.rollback();
      try {
        await redis.del(lockKey);
      } catch (err) {
        // Bỏ qua
      }
      return rotateSession(lockedSession || oldSession, newRefreshToken, deviceInfo, newSessionId, tokens);
    }

    // Đánh dấu session cũ là đã xoay vòng
    await lockedSession.update(
      {
        is_revoked: true,
        revoked_at: new Date(),
        revoked_reason: "rotated",
      },
      { transaction }
    );

    const locationResult = await resolveLocation(deviceInfo, deviceInfo.ip);
    const tokenHash = hashToken(newRefreshToken);
    const rememberMe = lockedSession.device_info?.rememberMe || false;
    const expiresAt = getTokenExpiryDate(jwtConfig.refresh.expiresIn, rememberMe);

    // Tạo session mới cho token mới
    const newSession = await UserSession.create(
      {
        id: newSessionId || undefined,
        user_id: lockedSession.user_id,
        token_hash: tokenHash,
        token_family: lockedSession.token_family,
        device_info: {
          ip: deviceInfo.ip,
          userAgent: deviceInfo.userAgent,
          deviceName: deviceInfo.deviceName,
          os: deviceInfo.os,
          browser: deviceInfo.browser,
          device: deviceInfo.device,
          cpu: deviceInfo.cpu,
          location: locationResult.primary,
          locationConfidence: locationResult.confidence,
          ipLocation: locationResult.ipLocation,
          gpsLocation: locationResult.gpsLocation || null,
          rememberMe, // Tiếp tục duy trì rememberMe cho các đợt rotation sau
        },

        risk_score: lockedSession.risk_score || 0,
        expires_at: expiresAt,
        last_used_at: new Date(),
        is_revoked: false,
      },
      { transaction }
    );

    await transaction.commit();

    // Giải phóng lock
    try {
      await redis.del(lockKey);
    } catch (err) {
      // Bỏ qua lỗi del lock
    }

    // FIX-02: TTL 20s (thay vì 15s) — nới buffer an toàn cho cửa sổ grace 10s.
    if (tokens) {
      cacheHelper.set(`grace_session:${lockedSession.id}`, tokens, GRACE_SESSION_CACHE_TTL_SEC).catch((err) => {
        logger.warn(`[Session] Lỗi cache grace tokens: ${err.message}`);
      });
    }

    logger.debug(
      `[Session] Đã xoay vòng thành công: user=${lockedSession.user_id}, ` +
      `cũ=${lockedSession.id}, mới=${newSession.id}`
    );

    return { session: newSession, reuseDetected: false };
  } catch (error) {
    await transaction.rollback();
    try {
      await redis.del(lockKey);
    } catch (err) {
      // Bỏ qua
    }
    logger.error("[Session] Xoay vòng phiên thất bại:", error);
    throw new Error("Không thể xoay vòng phiên đăng nhập");
  }
};

// ─── Thu Hồi Phiên (Session Revocation) ───────────────────────────────────────────

/**
 * Thu hồi một phiên cụ thể bằng ID.
 */
export const revokeSession = async (sessionId, reason = "manual") => {
  try {
    const [affected] = await UserSession.update(
      {
        is_revoked: true,
        revoked_at: new Date(),
        revoked_reason: reason,
      },
      { where: { id: sessionId, is_revoked: false } },
    );

    logger.info(`[Session] Đã thu hồi phiên ${sessionId}, lý do: ${reason}`);
    return affected > 0;
  } catch (error) {
    logger.error("[Session] Thu hồi theo ID thất bại:", error);
    return false;
  }
};

/**
 * Thu hồi phiên bằng Refresh Token thô (dùng khi đăng xuất).
 */
export const revokeSessionByToken = async (refreshToken, reason = "logout") => {
  try {
    const tokenHash = hashToken(refreshToken);
    const [affected] = await UserSession.update(
      {
        is_revoked: true,
        revoked_at: new Date(),
        revoked_reason: reason,
      },
      { where: { token_hash: tokenHash, is_revoked: false } },
    );
    return affected > 0;
  } catch (error) {
    logger.error("[Session] Thu hồi theo token thất bại:", error);
    return false;
  }
};

/**
 * Thu hồi tất cả các phiên của một người dùng.
 */
export const revokeAllUserSessions = async (userId, reason = "logout_all") => {
  try {
    const [affected] = await UserSession.update(
      {
        is_revoked: true,
        revoked_at: new Date(),
        revoked_reason: reason,
      },
      { where: { user_id: userId, is_revoked: false } },
    );

    logger.info(
      `[Session] Đã thu hồi ${affected} phiên cho user ${userId}, lý do: ${reason}`,
    );
    return affected;
  } catch (error) {
    logger.error("[Session] Thu hồi tất cả thất bại:", error);
    return 0;
  }
};

// ─── Truy Vấn Phiên (Session Queries) ──────────────────────────────────────────────

/**
 * Lấy danh sách các phiên đang hoạt động kèm thông tin mở rộng.
 */
export const getUserSessions = async (userId) => {
  try {
    const sessions = await UserSession.findAll({
      where: {
        user_id: userId,
        is_revoked: false,
        expires_at: { [Op.gt]: new Date() },
      },
      attributes: [
        "id",
        "device_info",
        "risk_score",
        "anomaly_flags",
        "created_at",
        "last_used_at",
        "expires_at",
        "token_family",
        "token_hash",
      ],
      order: [["last_used_at", "DESC"]],
    });

    return sessions;
  } catch (error) {
    logger.error("[Session] Lấy danh sách phiên thất bại:", error);
    return [];
  }
};

/**
 * Lấy các phiên gần đây để phân tích bất thường.
 */
export const getRecentSessionsForAnalysis = async (userId, limit = 20) => {
  try {
    return await UserSession.findAll({
      where: {
        user_id: userId,
        created_at: {
          [Op.gte]: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), // 90 ngày gần nhất
        },
      },
      attributes: ["id", "device_info", "created_at", "risk_score"],
      order: [["created_at", "DESC"]],
      limit,
    });
  } catch (error) {
    logger.warn("[Session] Lấy phiên để phân tích thất bại:", error);
    return [];
  }
};

/**
 * Cập nhật thời điểm sử dụng phiên cuối cùng.
 */
export const updateSessionLastUsed = async (sessionId) => {
  try {
    await UserSession.update(
      { last_used_at: new Date() },
      { where: { id: sessionId } },
    );
  } catch (error) {
    logger.warn("[Session] Cập nhật thời gian sử dụng thất bại:", error);
  }
};

// ─── Dọn Dẹp (Cleanup) ────────────────────────────────────────────────────────────

/**
 * Dọn dẹp các phiên đã hết hạn hoặc đã bị thu hồi lâu ngày khỏi database.
 */
export const cleanupExpiredSessions = async () => {
  try {
    const cutoffDate = new Date(
      Date.now() - SESSION_CONFIG.EXPIRED_SESSION_RETENTION,
    );

    const result = await UserSession.destroy({
      where: {
        [Op.or]: [
          { expires_at: { [Op.lt]: new Date() } },
          {
            is_revoked: true,
            revoked_at: { [Op.lt]: cutoffDate },
          },
        ],
      },
    });

    if (result > 0) {
      logger.info(`[Session] Đã dọn dẹp ${result} phiên hết hạn/thu hồi`);
    }

    return result;
  } catch (error) {
    logger.error("[Session] Dọn dẹp phiên thất bại:", error);
    return 0;
  }
};

/**
 * Xóa toàn bộ phiên của một thiết bị cụ thể (User Agent).
 */
export const clearDeviceSessions = async (userId, userAgent) => {
  if (!userAgent) return 0;

  try {
    const [affected] = await UserSession.update(
      {
        is_revoked: true,
        revoked_at: new Date(),
        revoked_reason: "device_session_replaced",
      },
      {
        where: {
          user_id: userId,
          is_revoked: false,
          [Op.and]: [
            Sequelize.where(Sequelize.json("device_info.userAgent"), userAgent),
          ],
        },
      },
    );

    return affected;
  } catch (error) {
    logger.error("[Session] Thu hồi phiên thiết bị thất bại:", error);
    return 0;
  }
};

export const generateTokenFamily = () => uuidv4();

export default {
  createSession,
  findSessionByToken,
  rotateSession,
  revokeSession,
  revokeSessionByToken,
  revokeAllUserSessions,
  clearDeviceSessions,
  getUserSessions,
  getRecentSessionsForAnalysis,
  updateSessionLastUsed,
  cleanupExpiredSessions,
  generateTokenFamily,
  formatSessionName,
};
