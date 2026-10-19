/**
 * Hệ thống Phát hiện Bất thường (Anomaly Detector)
 *
 * @name anomaly-detector.service.js
 * @module Services
 * @description Hệ thống phân tích rủi ro đăng nhập thông minh.
 * Chấm điểm (Scoring) mỗi nỗ lực đăng nhập dựa trên đa tín hiệu: Vị trí địa lý, Thiết bị, IP và Hành vi thời gian.
 *
 * @note Các trọng số rủi ro được cấu hình dựa trên mức độ nghiêm trọng của từng loại dấu hiệu.
 */

import { Op } from "sequelize";
import { UserSession } from "../../../models/index.js";
import { logger } from "../../../utils/logger.js";
import { auditLogger } from "../utils/audit.logger.js";
import {
  compareLocations,
  buildLocationProfile,
  formatLocationString,
} from "./location.service.js";
import { AUDIT_EVENTS } from "../../../constants/auth.constant.js";

// ════════════════════════════════════════
// CẤU HÌNH TRỌNG SỐ RỦI RO (RISK SCORING)
// ════════════════════════════════════════

/**
 * Trọng số rủi ro cho từng tín hiệu (Tổng điểm tối đa = 100)
 */
const RISK_WEIGHTS = {
  // Tín hiệu vị trí địa lý (Location)
  NEW_COUNTRY: 40, // Đăng nhập từ quốc gia lạ
  NEW_CONTINENT: 50, // Đăng nhập từ châu lục khác
  IMPOSSIBLE_TRAVEL: 80, // Tốc độ di chuyển bất khả thi về mặt vật lý
  DIFFERENT_REGION: 15, // Vùng khác trong cùng quốc gia

  // Tín hiệu thiết bị (Device)
  NEW_DEVICE: 25, // Thiết bị/User-agent chưa từng xuất hiện
  NEW_BROWSER: 10, // Trình duyệt khác loại
  NEW_OS: 15, // Hệ điều hành khác loại
  BOT_USER_AGENT: 60, // User-agent có dấu hiệu bot/công cụ tự động

  // Tín hiệu IP
  NEW_IP_RANGE: 10, // Dải IP (/24) mới
  TOR_EXIT_NODE: 70, // Nút thoát mạng Tor
  DATACENTER_IP: 30, // IP từ trung tâm dữ liệu (VPN/Proxy)

  // Tín hiệu thời gian & hành vi (Temporal/Behavioral)
  UNUSUAL_HOUR: 10, // Giờ đăng nhập bất thường so với thói quen
  HIGH_FREQUENCY: 35, // Tần suất đăng nhập quá cao trong thời gian ngắn
  AFTER_FAILED_ATTEMPTS: 20, // Đăng nhập thành công sau nhiều lần thất bại
};

/**
 * Các ngưỡng cấp độ rủi ro và hành động tương ứng của hệ thống
 */
const RISK_LEVELS = {
  SAFE: { max: 20, label: "safe", action: "allow" },
  LOW: { max: 40, label: "low", action: "allow_log" },
  MEDIUM: { max: 60, label: "medium", action: "notify" },
  HIGH: { max: 80, label: "high", action: "require_2fa" },
  CRITICAL: { max: 100, label: "critical", action: "block_and_alert" },
};

// ════════════════════════════════════════
// CÁC BỘ PHÁT HIỆN TÍN HIỆU (DETECTORS)
// ════════════════════════════════════════

/**
 * Kiểm tra xem địa chỉ IP có thuộc dải trung tâm dữ liệu hoặc VPN hay không.
 *
 * @param {string} ip - Địa chỉ IP cần kiểm tra
 * @returns {boolean} True nếu là IP Datacenter/VPN
 */
const isDatacenterOrVpnIp = (ip) => {
  if (!ip) return false;

  const datacenterPatterns = [
    /^(45\.(33|56|63|79))/, // Linode
    /^(104\.(16|17|18|19|20|21|22|23|24|25|26|27|28|29|30|31)\.)/, // Cloudflare
    /^(52\.|54\.|18\.|35\.)/, // AWS
    /^(34\.|35\.)/, // GCP
    /^(40\.|52\.|13\.)/, // Azure
  ];

  return datacenterPatterns.some((pattern) => pattern.test(ip));
};

/**
 * Kiểm tra xem User-Agent có phải là các công cụ tự động/Bot hay không.
 *
 * @param {string} userAgent - Chuỗi User-Agent từ Request
 * @returns {boolean} True nếu phát hiện Bot
 */
const isBotUserAgent = (userAgent) => {
  if (!userAgent) return false;

  const botPatterns = [
    /bot|crawler|spider|scraper|curl|wget|python|java\/|go-http/i,
    /headless|phantomjs|selenium|puppeteer|playwright/i,
    /postman|insomnia|httpie/i,
  ];

  return botPatterns.some((pattern) => pattern.test(userAgent));
};

/**
 * Phát hiện giờ đăng nhập bất thường dựa trên lịch sử hoạt động của người dùng.
 *
 * @param {number} currentHour - Giờ hiện tại (0-23)
 * @param {Array} sessions - Danh sách các phiên đăng nhập trước đó
 * @returns {Object} Kết quả đánh giá tính bất thường
 */
const checkUnusualHour = (currentHour, sessions = []) => {
  if (sessions.length < 5) return { unusual: false, score: 0 };

  const hourCounts = new Array(24).fill(0);
  sessions.forEach((s) => {
    const hour = new Date(s.created_at).getHours();
    hourCounts[hour]++;
  });

  const maxCount = Math.max(...hourCounts);
  const threshold = maxCount * 0.1; // Ngưỡng: Dưới 10% so với giờ cao điểm của người dùng

  if (hourCounts[currentHour] < threshold) {
    return {
      unusual: true,
      score: RISK_WEIGHTS.UNUSUAL_HOUR,
      reason: "off_hours_login",
      currentHour,
      usualActiveHours: hourCounts
        .map((c, i) => ({ hour: i, count: c }))
        .filter((h) => h.count >= threshold)
        .map((h) => h.hour),
    };
  }

  return { unusual: false, score: 0 };
};

/**
 * Kiểm tra tần suất đăng nhập cao bất thường trong thời gian ngắn.
 *
 * @param {string} userId - ID người dùng
 * @param {number} [windowMinutes=15] - Cửa sổ thời gian kiểm tra (phút)
 * @returns {Promise<Object>} Kết quả phát hiện tấn công tần suất cao
 */
const checkHighFrequencyLogin = async (userId, windowMinutes = 15) => {
  try {
    const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000);

    const recentCount = await UserSession.count({
      where: {
        user_id: userId,
        created_at: { [Op.gte]: windowStart },
      },
    });

    if (recentCount >= 3) {
      return {
        suspicious: true,
        score: RISK_WEIGHTS.HIGH_FREQUENCY,
        reason: "high_frequency_login",
        count: recentCount,
        windowMinutes,
      };
    }
  } catch (err) {
    logger.warn(`[AnomalyDetector] Lỗi kiểm tra tần suất đăng nhập: ${err.message}`);
  }

  return { suspicious: false, score: 0 };
};

// ════════════════════════════════════════
// HỆ THỐNG PHÂN TÍCH CHÍNH
// ════════════════════════════════════════

/**
 * Phân tích toàn diện nỗ lực đăng nhập và trả về đánh giá mức độ rủi ro.
 *
 * @param {Object} params - Dữ liệu đầu vào để phân tích
 * @param {string} params.userId - ID người dùng
 * @param {Object} [params.deviceInfo={}] - Thông tin thiết bị (User-Agent, IP, ...)
 * @param {Object} [params.currentLocation={}] - Vị trí địa lý hiện tại (đã phân giải)
 * @param {Array} [params.recentSessions=[]] - Lịch sử các phiên hoạt động gần đây
 * @param {Object} [params.user=null] - Đối tượng người dùng (kiểm tra login_attempts)
 * @returns {Promise<Object>} Báo cáo đánh giá rủi ro và hành động đề xuất
 */
export const analyzeLoginAttempt = async ({
  userId,
  deviceInfo = {},
  currentLocation = {},
  recentSessions = [],
  user = null,
}) => {
  const signals = [];
  let totalScore = 0;

  const currentIp = deviceInfo.ip;
  const currentUserAgent = deviceInfo.userAgent || "";
  const currentBrowser = deviceInfo.browser?.name || "";
  const currentOS = deviceInfo.os?.name || "";

  // Tín hiệu 1: Phát hiện Bot/Công cụ tự động
  if (isBotUserAgent(currentUserAgent)) {
    const score = RISK_WEIGHTS.BOT_USER_AGENT;
    totalScore += score;
    signals.push({
      type: "bot_user_agent",
      score,
      description: "Phát hiện User-Agent khớp với các mẫu Bot hoặc công cụ tự động",
      userAgent: currentUserAgent.substring(0, 100),
    });
  }

  // Tín hiệu 2: IP từ trung tâm dữ liệu hoặc dịch vụ VPN
  if (isDatacenterOrVpnIp(currentIp)) {
    const score = RISK_WEIGHTS.DATACENTER_IP;
    totalScore += score;
    signals.push({
      type: "datacenter_ip",
      score,
      description: "Địa chỉ IP thuộc dải trung tâm dữ liệu (Datacenter) hoặc VPN",
      ip: currentIp,
    });
  }

  // Tín hiệu 3: So sánh sự thay đổi vị trí so với lần đăng nhập trước
  if (recentSessions.length > 0) {
    const lastSession = recentSessions[0];
    const prevLocation = lastSession?.device_info?.location;

    if (prevLocation && currentLocation?.primary) {
      const lastLoginTime = new Date(lastSession.created_at).getTime();
      const timeDiffHours = (Date.now() - lastLoginTime) / (1000 * 3600);

      const locationComparison = compareLocations(
        currentLocation.primary,
        prevLocation,
        timeDiffHours,
      );

      if (locationComparison.riskScore > 0) {
        totalScore += locationComparison.riskScore;
        signals.push({
          type: locationComparison.reason,
          score: locationComparison.riskScore,
          description: getLocationRiskDescription(locationComparison),
          ...locationComparison,
        });
      }
    }

    // Tín hiệu 4: Thiết bị mới (Lần đầu truy cập từ tổ hợp Trình duyệt + OS này)
    const knownDevices = recentSessions.map((s) => ({
      browser: s.device_info?.browser?.name,
      os: s.device_info?.os?.name,
    }));

    const deviceKnown = knownDevices.some(
      (d) => d.browser === currentBrowser && d.os === currentOS,
    );

    if (!deviceKnown && currentBrowser) {
      const score = RISK_WEIGHTS.NEW_DEVICE;
      totalScore += score;
      signals.push({
        type: "new_device",
        score,
        description: `Lần đầu phát hiện đăng nhập từ ${currentBrowser} trên nền tảng ${currentOS}`,
        browser: currentBrowser,
        os: currentOS,
      });
    }

    // Tín hiệu 5: Quốc gia mới (Không nằm trong hồ sơ lịch sử của người dùng)
    if (recentSessions.length >= 2) {
      const locationProfile = buildLocationProfile(recentSessions);
      const currentCountry = currentLocation?.primary?.country;

      if (
        locationProfile?.homeCountry &&
        currentCountry &&
        currentCountry !== locationProfile.homeCountry &&
        !locationProfile.countriesUsed.includes(currentCountry)
      ) {
        if (
          !signals.find(
            (s) => s.type.includes("country") || s.type.includes("continent"),
          )
        ) {
          const score = RISK_WEIGHTS.NEW_COUNTRY;
          totalScore += score;
          signals.push({
            type: "new_country_in_history",
            score,
            description: `Đăng nhập từ quốc gia mới (${currentCountry}) — chưa từng xuất hiện trong lịch sử vị trí`,
            currentCountry,
            homeCountry: locationProfile.homeCountry,
            knownCountries: locationProfile.countriesUsed,
          });
        }
      }
    }

    // Tín hiệu 6: Đăng nhập vào khung giờ bất thường
    const currentHour = new Date().getHours();
    const hourCheck = checkUnusualHour(currentHour, recentSessions);
    if (hourCheck.unusual) {
      totalScore += hourCheck.score;
      signals.push({
        type: "unusual_hour",
        score: hourCheck.score,
        description: `Đăng nhập vào khung giờ bất thường so với thói quen (${currentHour}:00)`,
        ...hourCheck,
      });
    }
  } else {
    // Trường hợp nỗ lực đăng nhập lần đầu tiên của tài khoản
    signals.push({
      type: "first_login",
      score: 0,
      description: "Ghi nhận nỗ lực đăng nhập đầu tiên cho tài khoản này",
    });
  }

  // Tín hiệu 7: Kiểm tra tần suất đăng nhập (Brute-force/Credential Stuffing)
  if (userId) {
    const freqCheck = await checkHighFrequencyLogin(userId);
    if (freqCheck.suspicious) {
      totalScore += freqCheck.score;
      signals.push({
        type: "high_frequency",
        score: freqCheck.score,
        description: "Phát hiện tần suất đăng nhập cao bất thường trong thời gian ngắn",
        ...freqCheck,
      });
    }
  }

  // Tín hiệu 8: Có dấu hiệu nỗ lực sai mật khẩu nhiều lần trước đó
  if (user && user.login_attempts > 2) {
    const score = RISK_WEIGHTS.AFTER_FAILED_ATTEMPTS;
    totalScore += score;
    signals.push({
      type: "after_failed_attempts",
      score,
      description: `Đăng nhập thành công sau ${user.login_attempts} lần thất bại liên tiếp`,
      failedAttempts: user.login_attempts,
    });
  }

  // Tổng hợp và phân cấp rủi ro
  const cappedScore = Math.min(totalScore, 100);
  const riskLevel = getRiskLevel(cappedScore);

  const result = {
    userId,
    riskScore: cappedScore,
    riskLevel: riskLevel.label,
    action: riskLevel.action,
    signals,
    requiresVerification: ["require_2fa", "block_and_alert"].includes(
      riskLevel.action,
    ),
    shouldNotify: ["notify", "require_2fa", "block_and_alert"].includes(
      riskLevel.action,
    ),
    shouldBlock: riskLevel.action === "block_and_alert",
    analysis: {
      location: formatLocationString(currentLocation?.primary),
      device: deviceInfo.deviceName || "Thiết bị không xác định",
      ip: currentIp,
      timestamp: new Date().toISOString(),
    },
  };

  // Ghi nhật ký cho các hoạt động có độ rủi ro trung bình trở lên
  if (cappedScore >= 60) {
    logger.warn(`[AnomalyDetector] Phát hiện nỗ lực đăng nhập rủi ro cao`, {
      userId,
      riskScore: cappedScore,
      riskLevel: riskLevel.label,
      signals: signals.map((s) => s.type),
      ip: currentIp,
    });

    auditLogger.log({
      event: AUDIT_EVENTS.SUSPICIOUS_ACTIVITY,
      userId,
      ip: currentIp,
      userAgent: currentUserAgent,
      metadata: {
        activityType: "suspicious_login",
        riskScore: cappedScore,
        riskLevel: riskLevel.label,
        signals,
        action: riskLevel.action,
      },
      severity: cappedScore >= 80 ? "error" : "warn",
    });
  }

  return result;
};

// ════════════════════════════════════════
// TIỆN ÍCH TRỢ GIÚP (HELPERS)
// ════════════════════════════════════════

/**
 * Ánh xạ tổng điểm rủi ro sang cấp độ cảnh báo tương ứng.
 *
 * @param {number} score - Tổng điểm rủi ro (0-100)
 * @returns {Object} Thông tin cấp độ rủi ro và hành động đề xuất
 */
const getRiskLevel = (score) => {
  if (score <= RISK_LEVELS.SAFE.max) return RISK_LEVELS.SAFE;
  if (score <= RISK_LEVELS.LOW.max) return RISK_LEVELS.LOW;
  if (score <= RISK_LEVELS.MEDIUM.max) return RISK_LEVELS.MEDIUM;
  if (score <= RISK_LEVELS.HIGH.max) return RISK_LEVELS.HIGH;
  return RISK_LEVELS.CRITICAL;
};

/**
 * Xây dựng mô tả chi tiết cho các rủi ro liên quan đến vị trí địa lý.
 *
 * @param {Object} comparison - Kết quả so sánh vị trí
 * @returns {string} Chuỗi mô tả tiếng Việt
 */
const getLocationRiskDescription = (comparison) => {
  switch (comparison.reason) {
    case "impossible_travel":
      return `Tốc độ di chuyển vật lý bất khả thi: ${comparison.distanceKm}km trong ${Math.round(comparison.timeDiffHours)} giờ (tối thiểu cần ${comparison.requiredHours} giờ)`;
    case "different_continent":
      return `Đăng nhập từ châu lục khác: ${comparison.fromLocation} → ${comparison.toLocation}`;
    case "different_country":
      return `Đăng nhập từ quốc gia khác: ${comparison.fromLocation} → ${comparison.toLocation}`;
    case "far_within_country":
      return `Vị trí đăng nhập cách xa khu vực hoạt động thông thường: ${comparison.distanceKm}km`;
    default:
      return "Phát hiện dấu hiệu bất thường về vị trí truy cập";
  }
};

/**
 * Tạo thông điệp cảnh báo phù hợp để hiển thị cho người dùng cuối.
 *
 * @param {string} riskLevel - Nhãn cấp độ rủi ro (label)
 * @param {Array} [signals=[]] - Danh sách các tín hiệu phát hiện được
 * @returns {Object|null} Đối tượng chứa tiêu đề và nội dung thông báo
 */
export const getActionMessage = (riskLevel, signals = []) => {
  const locationSignal = signals.find((s) =>
    [
      "impossible_travel",
      "different_continent",
      "different_country",
      "new_country_in_history",
    ].includes(s.type),
  );

  switch (riskLevel) {
    case "critical":
      return {
        title: "Đăng nhập bị chặn — Phát hiện hoạt động đáng ngờ",
        message: `Hệ thống ghi nhận hoạt động đăng nhập bất thường${locationSignal ? ` từ ${locationSignal.toLocation}` : ""}. Tài khoản của bạn đã được tạm khóa để bảo vệ.`,
        action: "verify_email",
      };
    case "high":
      return {
        title: "Yêu cầu xác minh danh tính",
        message: `Phát hiện đăng nhập${locationSignal ? ` từ vị trí mới: ${locationSignal.toLocation}` : " từ thiết bị chưa xác định"}. Vui lòng thực hiện xác minh để tiếp tục.`,
        action: "require_2fa",
      };
    case "medium":
      return {
        title: "Cảnh báo đăng nhập mới",
        message: `Chúng tôi đã phát hiện một lượt đăng nhập mới${locationSignal ? ` từ ${locationSignal.toLocation}` : ""}. Vui lòng kiểm tra email của bạn.`,
        action: "notify",
      };
    default:
      return null;
  }
};

export default {
  analyzeLoginAttempt,
  getActionMessage,
  RISK_WEIGHTS,
  RISK_LEVELS,
};
