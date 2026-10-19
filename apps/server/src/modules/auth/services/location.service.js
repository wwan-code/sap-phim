/**
 * Dịch vụ Vị trí (Location Service)
 *
 * @name location.service.js
 * @module Services
 * @description Hệ thống phát hiện và phân tích vị trí đa nguồn (GeoIP, GPS, WiFi).
 * Cung cấp khả năng tính toán khoảng cách địa lý, đối soát vị trí và xây dựng hồ sơ di chuyển của người dùng.
 *
 * @note Tương tự cơ chế phát hiện vị trí đa lớp của các nền tảng lớn như Facebook/Google.
 */

import geoip from "geoip-lite";
import { logger } from "../../../utils/logger.js";

// ════════════════════════════════════════
// HẰNG SỐ (CONSTANTS)
// ════════════════════════════════════════

/**
 * Các nguồn dữ liệu vị trí hỗ trợ
 */
const LOCATION_SOURCES = {
  GPS: "gps", // Độ chính xác cao - HTML5 Geolocation từ trình duyệt/ứng dụng
  WIFI: "wifi", // Độ chính xác trung bình - Dựa trên bối cảnh mạng WiFi
  IP: "ip", // Độ chính xác cấp thành phố - Tra cứu GeoIP
  MANUAL: "manual", // Người dùng tự cung cấp
  CACHED: "cached", // Truy xuất từ lịch sử đăng nhập đã lưu
};

/**
 * Ngưỡng khoảng cách (km) để phân loại mức độ thay đổi vị trí
 */
const DISTANCE_THRESHOLDS = {
  SAME_LOCATION: 10, // Cùng khu vực: < 10km
  NEARBY: 50, // Lân cận: < 50km
  SAME_REGION: 200, // Cùng vùng/tỉnh: < 200km
  SAME_COUNTRY: 1000, // Cùng quốc gia: < 1000km
  SUSPICIOUS: 3000, // Đáng ngờ: Thay đổi vị trí đột ngột > 3000km
  IMPOSSIBLE: 8000, // Bất khả thi: Di chuyển > 8000km trong thời gian ngắn
};

/**
 * Ánh xạ mã quốc gia sang Châu lục (Sử dụng nội bộ để tối ưu hiệu năng)
 */
const COUNTRY_CONTINENT = {
  VN: "AS", TH: "AS", SG: "AS", MY: "AS", ID: "AS", PH: "AS", JP: "AS", KR: "AS", CN: "AS", IN: "AS", BD: "AS", PK: "AS", AF: "AS",
  US: "NA", CA: "NA", MX: "NA",
  GB: "EU", DE: "EU", FR: "EU", IT: "EU", ES: "EU", NL: "EU", PL: "EU", RU: "EU", UA: "EU", SE: "EU", NO: "EU", DK: "EU", FI: "EU",
  BR: "SA", AR: "SA", CO: "SA", CL: "SA", PE: "SA",
  NG: "AF", ZA: "AF", EG: "AF", KE: "AF", ET: "AF",
  AU: "OC", NZ: "OC",
};

// ════════════════════════════════════════
// TIỆN ÍCH ĐỊA LÝ CỐT LÕI (CORE GEO)
// ════════════════════════════════════════

/**
 * Tính khoảng cách đường chim bay giữa hai tọa độ địa lý (Công thức Haversine).
 *
 * @param {number[]} ll1 - Tọa độ [vĩ độ, kinh độ] điểm thứ nhất
 * @param {number[]} ll2 - Tọa độ [vĩ độ, kinh độ] điểm thứ hai
 * @returns {number|null} Khoảng cách tính bằng kilomet (làm tròn)
 */
export const haversineDistance = (ll1, ll2) => {
  if (!ll1 || !ll2 || ll1.length < 2 || ll2.length < 2) return null;

  const R = 6371; // Bán kính trung bình của Trái đất (km)
  const toRad = (deg) => (deg * Math.PI) / 180;

  const dLat = toRad(ll2[0] - ll1[0]);
  const dLng = toRad(ll2[1] - ll1[1]);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(ll1[0])) * Math.cos(toRad(ll2[0])) * Math.sin(dLng / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
};

/**
 * Tính toán thời gian di chuyển tối thiểu hợp lý (giờ) giữa hai khoảng cách địa lý.
 * Định mức dựa trên tốc độ bay thương mại kết hợp thời gian làm thủ tục hàng không.
 *
 * @param {number} distanceKm - Khoảng cách (km)
 * @returns {number} Thời gian tối thiểu cần thiết (giờ)
 */
export const minTravelTime = (distanceKm) => {
  const FLIGHT_SPEED = 900; // Tốc độ bay trung bình (km/h)
  const AIRPORT_OVERHEAD = 3; // Thời gian chờ (thủ tục, quá cảnh, ...)
  return distanceKm / FLIGHT_SPEED + AIRPORT_OVERHEAD;
};

/**
 * Xác định Châu lục dựa trên mã quốc gia ISO 3166-1 alpha-2.
 *
 * @param {string} countryCode - Mã quốc gia
 * @returns {string} Mã châu lục hoặc "UNKNOWN"
 */
export const getContinent = (countryCode) => {
  return COUNTRY_CONTINENT[countryCode?.toUpperCase()] || "UNKNOWN";
};

// ════════════════════════════════════════
// VỊ TRÍ DỰA TRÊN IP (GEOIP)
// ════════════════════════════════════════

/**
 * Tra cứu thông tin vị trí địa lý từ địa chỉ IP.
 * Hỗ trợ giả lập dữ liệu cho môi trường phát triển (Localhost).
 *
 * @param {string} ip - Địa chỉ IPv4 hoặc IPv6
 * @returns {Object|null} Dữ liệu vị trí chi tiết hoặc null nếu không tìm thấy
 */
export const lookupIpLocation = (ip) => {
  if (!ip) return null;

  // Xử lý chuẩn hóa địa chỉ IP
  const cleanIp = ip.replace(/^::ffff:/, "");

  // Cơ chế giả lập cho môi trường phát triển (Development)
  if (
    process.env.NODE_ENV !== "production" &&
    (cleanIp === "127.0.0.1" || cleanIp === "::1" || cleanIp === "localhost")
  ) {
    const mockIp = process.env.DEV_MOCK_IP || "14.161.22.11"; // Mặc định: Việt Nam
    logger.debug(`[LocationService] Chế độ Dev: Giả lập ${cleanIp} thành ${mockIp}`);
    return lookupIpLocation(mockIp);
  }

  try {
    const geo = geoip.lookup(cleanIp);
    if (!geo) {
      logger.debug(`[LocationService] Không thể phân giải GeoIP cho địa chỉ: ${cleanIp}`);
      return null;
    }

    return {
      source: LOCATION_SOURCES.IP,
      accuracy: "city",
      ip: cleanIp,
      country: geo.country || null,
      countryName: getCountryName(geo.country),
      region: geo.region || null,
      city: geo.city || null,
      timezone: geo.timezone || null,
      continent: getContinent(geo.country),
      ll: geo.ll || null, // [Vĩ độ, Kinh độ]
      range: geo.range || null,
    };
  } catch (err) {
    logger.warn(`[LocationService] Lỗi khi tra cứu GeoIP cho ${cleanIp}: ${err.message}`);
    return null;
  }
};

// ════════════════════════════════════════
// VỊ TRÍ GPS TỪ CLIENT
// ════════════════════════════════════════

/**
 * Xác thực và chuẩn hóa dữ liệu tọa độ GPS do phía Client cung cấp.
 * Ngăn chặn dữ liệu tọa độ rác hoặc dữ liệu đã lỗi thời (Stale data).
 *
 * @param {Object} clientLocation - Dữ liệu vị trí thô từ Client
 * @returns {Object|null} Thông tin vị trí đã được làm sạch
 */
export const processClientGpsLocation = (clientLocation) => {
  if (!clientLocation) return null;

  const { latitude, longitude, accuracy, timestamp } = clientLocation;

  // Kiểm tra tính hợp lệ của tọa độ toán học
  if (
    typeof latitude !== "number" ||
    typeof longitude !== "number" ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    logger.warn("[LocationService] Nhận được tọa độ GPS không hợp lệ từ Client");
    return null;
  }

  // Loại bỏ dữ liệu GPS nếu thời gian ghi nhận đã quá cũ (trên 10 phút)
  if (timestamp) {
    const ageMs = Date.now() - new Date(timestamp).getTime();
    if (ageMs > 10 * 60 * 1000) {
      logger.warn("[LocationService] Dữ liệu GPS đã cũ (stale), hệ thống sẽ bỏ qua");
      return null;
    }
  }

  return {
    source: LOCATION_SOURCES.GPS,
    accuracy: accuracy ? `${Math.round(accuracy)}m` : "không xác định",
    ll: [latitude, longitude],
    timestamp: timestamp || new Date().toISOString(),
    country: null,
    city: null,
  };
};

// ════════════════════════════════════════
// BỘ PHÂN GIẢI VỊ TRÍ TỔNG HỢP (RESOLVER)
// ════════════════════════════════════════

/**
 * Phân giải và tổng hợp vị trí tối ưu nhất từ đa nguồn.
 * Ưu tiên: GPS (Chính xác nhất) > WiFi > IP (Cấp thành phố).
 *
 * @param {Object} [deviceInfo={}] - Thông tin thiết bị và bối cảnh Client
 * @param {string} [ip=null] - Địa chỉ IP yêu cầu
 * @returns {Promise<Object>} Kết quả phân giải vị trí kèm mức độ tin cậy
 */
export const resolveLocation = async (deviceInfo = {}, ip = null) => {
  const resolved = {
    primary: null,
    ipLocation: null,
    gpsLocation: null,
    confidence: "low",
    discrepancy: null,
  };

  // 1. Phân giải vị trí dựa trên địa chỉ IP (Lớp cơ sở)
  const ipToUse = ip || deviceInfo.ip;
  if (ipToUse) {
    resolved.ipLocation = lookupIpLocation(ipToUse);
  }

  // 2. Xử lý dữ liệu GPS nếu Client có cung cấp
  if (deviceInfo.clientLocation?.latitude) {
    resolved.gpsLocation = processClientGpsLocation(deviceInfo.clientLocation);

    if (resolved.gpsLocation && resolved.ipLocation?.ll) {
      // Đối soát chéo giữa GPS và IP để phát hiện các trường hợp giả lập vị trí (Fake GPS)
      const dist = haversineDistance(
        resolved.gpsLocation.ll,
        resolved.ipLocation.ll,
      );

      if (dist !== null) {
        resolved.discrepancy = {
          distanceKm: dist,
          suspicious: dist > DISTANCE_THRESHOLDS.SAME_COUNTRY,
        };

        if (dist > DISTANCE_THRESHOLDS.SUSPICIOUS) {
          logger.warn(
            `[LocationService] Phát hiện sai lệch lớn giữa GPS và IP (${dist}km) — Nghi vấn giả lập vị trí`,
            { gps: resolved.gpsLocation.ll, ip: resolved.ipLocation.ll },
          );
        }
      }
    }
  }

  // 3. Quyết định nguồn vị trí chính (Primary Location)
  if (resolved.gpsLocation && !resolved.discrepancy?.suspicious) {
    resolved.primary = {
      ...resolved.gpsLocation,
      // Làm giàu dữ liệu tọa độ bằng thông tin hành chính từ GeoIP
      country: resolved.gpsLocation.country || resolved.ipLocation?.country,
      countryName:
        resolved.gpsLocation.countryName || resolved.ipLocation?.countryName,
      city: resolved.gpsLocation.city || resolved.ipLocation?.city,
      timezone: resolved.gpsLocation.timezone || resolved.ipLocation?.timezone,
      continent:
        resolved.gpsLocation.continent || resolved.ipLocation?.continent,
    };
    resolved.confidence = "high";
  } else if (resolved.ipLocation) {
    resolved.primary = resolved.ipLocation;
    resolved.confidence = "medium";
  }

  return resolved;
};

// ════════════════════════════════════════
// SO SÁNH VÀ ĐÁNH GIÁ (COMPARISON)
// ════════════════════════════════════════

/**
 * So sánh hai vị trí và tính toán mức độ rủi ro dựa trên sự thay đổi địa lý và thời gian.
 * Trả về thang điểm rủi ro (0-100) để phục vụ hệ thống phát hiện bất thường.
 *
 * @param {Object} newLocation - Vị trí đăng nhập mới cần kiểm tra
 * @param {Object} prevLocation - Vị trí đăng nhập hợp lệ gần nhất
 * @param {number} [timeDiffHours=0] - Khoảng thời gian giữa hai lần đăng nhập (giờ)
 * @returns {Object} Đánh giá chi tiết về sự thay đổi vị trí
 */
export const compareLocations = (
  newLocation,
  prevLocation,
  timeDiffHours = 0,
) => {
  if (!newLocation || !prevLocation) {
    return { riskScore: 0, reason: "insufficient_data", distanceKm: null };
  }

  const newLL = newLocation.ll || newLocation.primary?.ll;
  const prevLL = prevLocation.ll || prevLocation.primary?.ll;

  const newCountry = newLocation.country || newLocation.primary?.country;
  const prevCountry = prevLocation.country || prevLocation.primary?.country;
  const newContinent = getContinent(newCountry);
  const prevContinent = getContinent(prevCountry);

  // 1. Kiểm tra sự thay đổi ở cấp độ Quốc gia/Châu lục
  if (newCountry && prevCountry && newCountry !== prevCountry) {
    const distanceKm =
      newLL && prevLL ? haversineDistance(newLL, prevLL) : null;

    // Phát hiện di chuyển bất khả thi (Impossible Travel)
    if (distanceKm && timeDiffHours > 0) {
      const requiredHours = minTravelTime(distanceKm);
      if (timeDiffHours < requiredHours) {
        return {
          riskScore: 95,
          reason: "impossible_travel",
          distanceKm,
          timeDiffHours,
          requiredHours: Math.round(requiredHours),
          fromLocation: formatLocationString(prevLocation),
          toLocation: formatLocationString(newLocation),
        };
      }
    }

    // Thay đổi Châu lục
    if (newContinent !== prevContinent) {
      return {
        riskScore: 75,
        reason: "different_continent",
        distanceKm,
        fromLocation: formatLocationString(prevLocation),
        toLocation: formatLocationString(newLocation),
      };
    }

    // Cùng Châu lục nhưng khác Quốc gia
    return {
      riskScore: 55,
      reason: "different_country",
      distanceKm,
      fromLocation: formatLocationString(prevLocation),
      toLocation: formatLocationString(newLocation),
    };
  }

  // 2. Cùng quốc gia, kiểm tra khoảng cách tọa độ chi tiết
  if (newLL && prevLL) {
    const distanceKm = haversineDistance(newLL, prevLL);

    // Di chuyển quãng đường dài trong cùng một quốc gia
    if (distanceKm > DISTANCE_THRESHOLDS.SAME_COUNTRY) {
      return {
        riskScore: 40,
        reason: "far_within_country",
        distanceKm,
        fromLocation: formatLocationString(prevLocation),
        toLocation: formatLocationString(newLocation),
      };
    }

    // Thay đổi vùng/tỉnh (Regional Change)
    if (distanceKm > DISTANCE_THRESHOLDS.SAME_REGION) {
      return {
        riskScore: 15,
        reason: "different_region",
        distanceKm,
        fromLocation: formatLocationString(prevLocation),
        toLocation: formatLocationString(newLocation),
      };
    }
  }

  return {
    riskScore: 0,
    reason: "normal",
    distanceKm: newLL && prevLL ? haversineDistance(newLL, prevLL) : null,
    fromLocation: formatLocationString(prevLocation),
    toLocation: formatLocationString(newLocation),
  };
};

// ════════════════════════════════════════
// ĐỊNH DẠNG VÀ HIỂN THỊ (FORMATTING)
// ════════════════════════════════════════

/**
 * Định dạng dữ liệu vị trí thành chuỗi văn bản thân thiện với người dùng.
 * Ví dụ: "Hanoi, Vietnam" hoặc "Ho Chi Minh City, VN"
 *
 * @param {Object} location - Đối tượng vị trí
 * @returns {string} Chuỗi văn bản mô tả vị trí
 */
export const formatLocationString = (location) => {
  if (!location) return "Vị trí không xác định";

  const loc = location.primary || location;
  const parts = [];

  if (loc.city) parts.push(loc.city);
  if (loc.countryName) parts.push(loc.countryName);
  else if (loc.country) parts.push(loc.country);

  return parts.length > 0 ? parts.join(", ") : "Vị trí không xác định";
};

/**
 * Chuyển đổi mã quốc gia sang Emoji cờ tương ứng.
 *
 * @param {string} countryCode - Mã quốc gia (ISO 3166-1)
 * @returns {string} Emoji lá cờ
 */
export const getCountryFlag = (countryCode) => {
  if (!countryCode || countryCode.length !== 2) return "🌍";
  const codePoints = [...countryCode.toUpperCase()].map(
    (char) => 127397 + char.charCodeAt(0),
  );
  return String.fromPoint(...codePoints);
};

/**
 * Danh mục tên quốc gia phổ biến (Hỗ trợ hiển thị)
 */
const COUNTRY_NAMES = {
  VN: "Vietnam", US: "United States", GB: "United Kingdom", DE: "Germany", FR: "France", JP: "Japan", CN: "China", KR: "South Korea",
  SG: "Singapore", TH: "Thailand", MY: "Malaysia", ID: "Indonesia", PH: "Philippines", AU: "Australia", CA: "Canada", IN: "India", RU: "Russia", BR: "Brazil",
};

/**
 * Lấy tên đầy đủ của quốc gia dựa trên mã định danh.
 *
 * @param {string} countryCode - Mã quốc gia
 * @returns {string} Tên đầy đủ của quốc gia
 */
export const getCountryName = (countryCode) => {
  return COUNTRY_NAMES[countryCode?.toUpperCase()] || countryCode || "Không xác định";
};

// ════════════════════════════════════════
// PHÂN TÍCH LỊCH SỬ (HISTORY ANALYSIS)
// ════════════════════════════════════════

/**
 * Phân tích lịch sử truy cập để xây dựng hồ sơ "Vị trí thường trú" (Home Location).
 * Giúp hệ thống nhận diện các vị trí quen thuộc của người dùng.
 *
 * @param {Array} [sessions=[]] - Danh sách các phiên đăng nhập lịch sử
 * @returns {Object|null} Hồ sơ phân tích vị trí quen thuộc
 */
export const buildLocationProfile = (sessions = []) => {
  if (!sessions.length) return null;

  const countryCount = {};
  const cityCount = {};
  const timezoneCount = {};

  for (const session of sessions) {
    const loc = session.device_info?.location;
    if (!loc) continue;

    if (loc.country)
      countryCount[loc.country] = (countryCount[loc.country] || 0) + 1;
    if (loc.city) cityCount[loc.city] = (cityCount[loc.city] || 0) + 1;
    if (loc.timezone)
      timezoneCount[loc.timezone] = (timezoneCount[loc.timezone] || 0) + 1;
  }

  const topCountry = Object.entries(countryCount).sort((a, b) => b[1] - a[1])[0];
  const topCity = Object.entries(cityCount).sort((a, b) => b[1] - a[1])[0];
  const topTimezone = Object.entries(timezoneCount).sort((a, b) => b[1] - a[1])[0];

  return {
    homeCountry: topCountry?.[0] || null,
    homeCity: topCity?.[0] || null,
    homeTimezone: topTimezone?.[0] || null,
    sampleSize: sessions.length,
    countriesUsed: Object.keys(countryCount),
    citiesUsed: Object.keys(cityCount),
  };
};

export default {
  haversineDistance,
  minTravelTime,
  getContinent,
  lookupIpLocation,
  processClientGpsLocation,
  resolveLocation,
  compareLocations,
  formatLocationString,
  getCountryFlag,
  getCountryName,
  buildLocationProfile,
  LOCATION_SOURCES,
  DISTANCE_THRESHOLDS,
};

