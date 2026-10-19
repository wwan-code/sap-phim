/**
 * Tiện ích Bảo mật (Security Utilities)
 * 
 * @description Các hàm tiện ích bảo mật toàn diện cho module Authentication.
 * Bao gồm: băm mật khẩu (Argon2id), tạo token an toàn, dấu vân tay thiết bị (Fingerprinting), mã hóa dữ liệu (AES-256-GCM) và bảo vệ Timing attacks.
 */
import crypto from "crypto";
import argon2 from "argon2";
import { CRYPTO_CONFIG, PASSWORD_POLICY } from "../../../constants/auth.constant.js";

// ════════════════════════════════════════
// BĂM MẬT KHẨU (PASSWORD HASHING - ARGON2ID)
// ════════════════════════════════════════

/**
 * Băm mật khẩu bằng thuật toán Argon2id.
 * Argon2id là thuật toán được khuyên dùng (thắng giải Password Hashing Competition 2015).
 * Có khả năng chống lại các cuộc tấn công bằng GPU tốt hơn bcrypt.
 *
 * @param {string} password - Mật khẩu thuần
 * @returns {Promise<string>} Chuỗi hash mật khẩu
 */
export const hashPassword = async (password) => {
  try {
    const hash = await argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: CRYPTO_CONFIG.ARGON2.memoryCost,
      timeCost: CRYPTO_CONFIG.ARGON2.timeCost,
      parallelism: CRYPTO_CONFIG.ARGON2.parallelism,
      hashLength: CRYPTO_CONFIG.ARGON2.hashLength,
    });

    return hash;
  } catch (error) {
    console.error("[Security] Hashing mật khẩu thất bại:", error);
    throw new Error("Không thể băm mật khẩu");
  }
};

/**
 * Kiểm tra mật khẩu có khớp với chuỗi hash Argon2 hay không.
 *
 * @param {string} hash - Chuỗi hash đã lưu trong DB
 * @param {string} password - Mật khẩu người dùng nhập
 * @returns {Promise<boolean>} Trả về true nếu khớp
 */
export const verifyPassword = async (hash, password) => {
  try {
    return await argon2.verify(hash, password);
  } catch (error) {
    console.error("[Security] Xác thực mật khẩu thất bại:", error);
    return false;
  }
};

/**
 * Kiểm tra xem chuỗi hash có cần được băm lại hay không (dùng khi nâng cấp thuật toán).
 *
 * @param {string} hash - Chuỗi hash hiện tại
 * @returns {boolean} Trả về true nếu cần cập nhật hash
 */
export const needsRehash = (hash) => {
  try {
    return argon2.needsRehash(hash, {
      memoryCost: CRYPTO_CONFIG.ARGON2.memoryCost,
      timeCost: CRYPTO_CONFIG.ARGON2.timeCost,
      parallelism: CRYPTO_CONFIG.ARGON2.parallelism,
    });
  } catch (error) {
    console.error("[Security] Kiểm tra rehash thất bại:", error);
    return false;
  }
};

// ════════════════════════════════════════
// HỖ TRỢ CHUYỂN ĐỔI (MIGRATION HELPERS)
// ════════════════════════════════════════

/**
 * Kiểm tra xem chuỗi hash có định dạng của bcrypt hay không.
 * Bcrypt hash thường bắt đầu bằng $2a$, $2b$, hoặc $2y$.
 */
export const isBcryptHash = (hash) => {
  return /^\$2[aby]\$/.test(hash);
};

/**
 * Xác thực mật khẩu đối với hash bcrypt (dùng cho các tài khoản cũ).
 *
 * @param {string} hash - Hash bcrypt
 * @param {string} password - Mật khẩu thuần
 * @returns {Promise<boolean>}
 */
export const verifyBcryptPassword = async (hash, password) => {
  try {
    const bcrypt = await import("bcryptjs");
    return await bcrypt.compare(password, hash);
  } catch (error) {
    console.error("[Security] Xác thực Bcrypt thất bại:", error);
    return false;
  }
};

/**
 * Xác thực mật khẩu tổng quát (Hỗ trợ cả Argon2 và Bcrypt).
 * Tự động phát hiện loại hash và xác thực tương ứng.
 * Trả về flag 'needsRehash' để ứng dụng có thể cập nhật lên Argon2 sau khi đăng nhập thành công.
 *
 * @param {string} hash - Chuỗi hash trong DB
 * @param {string} password - Mật khẩu người dùng nhập
 * @returns {Promise<{valid: boolean, needsRehash: boolean}>}
 */
export const verifyPasswordUniversal = async (hash, password) => {
  try {
    let valid = false;
    let shouldRehash = false;

    if (isBcryptHash(hash)) {
      // Hash bcrypt cũ - xác thực và đánh dấu cần chuyển đổi
      valid = await verifyBcryptPassword(hash, password);
      shouldRehash = valid; // Chuyển sang Argon2 ngay khi đăng nhập thành công
    } else {
      // Hash Argon2
      valid = await verifyPassword(hash, password);
      shouldRehash = valid && needsRehash(hash);
    }

    return { valid, needsRehash: shouldRehash };
  } catch (error) {
    console.error("[Security] Xác thực mật khẩu tổng quát thất bại:", error);
    return { valid: false, needsRehash: false };
  }
};

// ════════════════════════════════════════
// TẠO TOKEN (TOKEN GENERATION)
// ════════════════════════════════════════

/**
 * Tạo token ngẫu nhiên bảo mật cao (Cryptographically secure).
 *
 * @param {number} length - Độ dài tính bằng byte (mặc định: 32)
 * @returns {string} Token dạng Hex
 */
export const generateSecureToken = (length = 32) => {
  return crypto.randomBytes(length).toString("hex");
};

/**
 * Tạo token ngẫu nhiên an toàn khi dùng trên URL (Base64url).
 *
 * @param {number} length - Độ dài tính bằng byte (mặc định: 32)
 * @returns {string} Token dạng Base64url
 */
export const generateUrlSafeToken = (length = 32) => {
  return crypto.randomBytes(length).toString("base64url");
};

/**
 * Băm token bằng thuật toán SHA-256.
 * Dùng để lưu trữ refresh tokens một cách bảo mật trong DB.
 *
 * @param {string} token - Token thuần
 * @returns {string} Chuỗi băm SHA-256 (Hex)
 */
export const hashToken = (token) => {
  return crypto
    .createHash(CRYPTO_CONFIG.TOKEN_HASH_ALGORITHM)
    .update(token)
    .digest("hex");
};

// ════════════════════════════════════════
// SO SÁNH AN TOÀN (TIMING-SAFE)
// ════════════════════════════════════════

/**
 * So sánh hai chuỗi an toàn trước các cuộc tấn công timing (Timing attacks).
 * Luôn so sánh tất cả các byte bất kể chúng có khớp hay không.
 *
 * @param {string} a - Chuỗi thứ nhất
 * @param {string} b - Chuỗi thứ hai
 * @returns {boolean} Trả về true nếu khớp
 */
export const timingSafeEqual = (a, b) => {
  if (typeof a !== "string" || typeof b !== "string") {
    return false;
  }

  // Phải cùng độ dài mới dùng được crypto.timingSafeEqual
  if (a.length !== b.length) {
    return false;
  }

  try {
    const bufA = Buffer.from(a, "utf8");
    const bufB = Buffer.from(b, "utf8");
    return crypto.timingSafeEqual(bufA, bufB);
  } catch (error) {
    console.error("[Security] So sánh timing-safe thất bại:", error);
    return false;
  }
};

// ════════════════════════════════════════
// BẢO VỆ CSRF (CSRF PROTECTION)
// ════════════════════════════════════════

/**
 * Tạo token CSRF mới.
 */
export const generateCsrfToken = () => {
  return generateSecureToken(32);
};

/**
 * Xác thực token CSRF.
 */
export const validateCsrfToken = (tokenFromCookie, tokenFromHeader) => {
  if (!tokenFromCookie || !tokenFromHeader) {
    return false;
  }

  return timingSafeEqual(tokenFromCookie, tokenFromHeader);
};

// ════════════════════════════════════════
// XÁC THỰC MẬT KHẨU (PASSWORD VALIDATION)
// ════════════════════════════════════════

/**
 * Kiểm tra xem mật khẩu có nằm trong danh sách mật khẩu phổ biến hay không.
 */
export const isCommonPassword = (password) => {
  if (!password) return false;
  return PASSWORD_POLICY.COMMON_PASSWORDS.includes(password.toLowerCase());
};

/**
 * Kiểm tra mật khẩu có quá giống tên đăng nhập hay không.
 */
export const isSimilarToUsername = (password, username) => {
  if (!password || !username) return false;

  const passwordLower = password.toLowerCase();
  const usernameLower = username.toLowerCase();

  // Chứa toàn bộ tên đăng nhập
  if (passwordLower.includes(usernameLower)) return true;
  if (usernameLower.includes(passwordLower)) return true;

  // Độ tương đồng Levenshtein
  const distance = levenshteinDistance(passwordLower, usernameLower);
  const similarity =
    1 - distance / Math.max(passwordLower.length, usernameLower.length);

  // Nếu giống hơn 70%, từ chối
  return similarity > 0.7;
};

/**
 * Tính khoảng cách Levenshtein giữa hai chuỗi.
 */
const levenshteinDistance = (a, b) => {
  const matrix = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // thay thế
          matrix[i][j - 1] + 1, // chèn
          matrix[i - 1][j] + 1, // xóa
        );
      }
    }
  }

  return matrix[b.length][a.length];
};

// ════════════════════════════════════════
// MÃ HÓA DỮ LIỆU (DATA ENCRYPTION)
// ════════════════════════════════════════

/**
 * Mã hóa dữ liệu nhạy cảm bằng thuật toán AES-256-GCM.
 *
 * @param {string} text - Nội dung cần mã hóa
 * @param {string} key - Khóa mã hóa (32 bytes hex)
 * @returns {Object} { encrypted, iv, authTag }
 */
export const encryptData = (text, key) => {
  try {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(
      "aes-256-gcm",
      Buffer.from(key, "hex"),
      iv,
    );

    let encrypted = cipher.update(text, "utf8", "hex");
    encrypted += cipher.final("hex");

    const authTag = cipher.getAuthTag();

    return {
      encrypted,
      iv: iv.toString("hex"),
      authTag: authTag.toString("hex"),
    };
  } catch (error) {
    console.error("[Security] Mã hóa dữ liệu thất bại:", error);
    throw new Error("Không thể mã hóa dữ liệu");
  }
};

/**
 * Giải mã dữ liệu.
 */
export const decryptData = (encryptedData, key) => {
  try {
    const { encrypted, iv, authTag } = encryptedData;

    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      Buffer.from(key, "hex"),
      Buffer.from(iv, "hex"),
    );

    decipher.setAuthTag(Buffer.from(authTag, "hex"));

    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  } catch (error) {
    console.error("[Security] Giải mã dữ liệu thất bại:", error);
    throw new Error("Không thể giải mã dữ liệu");
  }
};

// ════════════════════════════════════════
// KIỂM TRA ĐỊA CHỈ IP (IP CHECKING)
// ════════════════════════════════════════

/**
 * Kiểm tra địa chỉ IPv4 hợp lệ.
 */
export const isValidIPv4 = (ip) => {
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;

  if (!ipv4Regex.test(ip)) return false;

  const parts = ip.split(".");
  return parts.every((part) => {
    const num = parseInt(part, 10);
    return num >= 0 && num <= 255;
  });
};

/**
 * Kiểm tra địa chỉ IPv6 hợp lệ.
 */
export const isValidIPv6 = (ip) => {
  const ipv6Regex =
    /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/;

  return ipv6Regex.test(ip);
};

/**
 * Kiểm tra IP có phải là IP nội bộ (private) hay không.
 */
export const isPrivateIP = (ip) => {
  const privateIPv4Ranges = [
    /^10\./,
    /^172\.(1[6-9]|2[0-9]|3[01])\./,
    /^192\.168\./,
    /^127\./,
    /^169\.254\./,
  ];

  return privateIPv4Ranges.some((regex) => regex.test(ip));
};

// ════════════════════════════════════════
// XUẤT BẢN TIỆN ÍCH (EXPORT)
// ════════════════════════════════════════

export default {
  hashPassword,
  verifyPassword,
  needsRehash,
  verifyPasswordUniversal,
  isBcryptHash,
  generateSecureToken,
  generateUrlSafeToken,
  hashToken,
  timingSafeEqual,
  generateCsrfToken,
  validateCsrfToken,
  isCommonPassword,
  isSimilarToUsername,
  encryptData,
  decryptData,
  isValidIPv4,
  isValidIPv6,
  isPrivateIP,
};
