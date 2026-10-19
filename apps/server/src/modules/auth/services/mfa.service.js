/**
 * @file mfa.service.js
 * @module Services_MFA
 * @description Xử lý các nghiệp vụ liên quan đến Xác thực đa yếu tố (MFA).
 * Cung cấp giải thuật mã hóa Base32, sinh/xác thực mã TOTP chuẩn RFC 6238, mã hóa khóa bí mật bằng AES-256-GCM,
 * và quản lý các mã khôi phục (Backup Codes) được băm bằng Argon2id.
 */

import crypto from "crypto";
import { User, MfaCredential } from "../../../models/index.js";
import { logger } from "../../../utils/logger.js";
import { auditLogger } from "../utils/audit.logger.js";
import { encryptData, decryptData, hashPassword, verifyPasswordUniversal } from "../utils/security.util.js";
import { MFA_CONFIG, AUDIT_EVENTS } from "../../../constants/auth.constant.js";
import { createAuthError as createError } from "../utils/auth-error.util.js";

// Bảng mã alphabet cho Base32
const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/**
 * Giải mã chuỗi Base32 thành Buffer.
 *
 * @param {string} val - Chuỗi Base32 cần giải mã
 * @returns {Buffer} Buffer dữ liệu nhị phân
 */
export const base32Decode = (val) => {
  const cleanStr = val.replace(/=+$/, "").toUpperCase();
  let bits = "";
  for (let i = 0; i < cleanStr.length; i++) {
    const idx = BASE32_ALPHABET.indexOf(cleanStr[i]);
    if (idx === -1) {
      throw new Error("Ký tự Base32 không hợp lệ");
    }
    bits += idx.toString(2).padStart(5, "0");
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.substring(i, i + 8), 2));
  }
  return Buffer.from(bytes);
};

/**
 * Mã hóa Buffer thành chuỗi Base32.
 *
 * @param {Buffer} buf - Buffer dữ liệu nhị phân
 * @returns {string} Chuỗi Base32
 */
export const base32Encode = (buf) => {
  let bits = "";
  for (let i = 0; i < buf.length; i++) {
    bits += buf[i].toString(2).padStart(8, "0");
  }
  let encoded = "";
  for (let i = 0; i < bits.length; i += 5) {
    const chunk = bits.substring(i, i + 5).padEnd(5, "0");
    encoded += BASE32_ALPHABET[parseInt(chunk, 2)];
  }
  return encoded;
};

/**
 * Xác minh mã TOTP dựa trên thuật toán TOTP (RFC 6238).
 *
 * @param {string} token - Mã OTP cần kiểm tra (6 chữ số)
 * @param {string} secret - Khóa bí mật dạng Base32
 * @param {number} [window=1] - Khoảng bù thời gian (mặc định cho phép sai lệch 30s trước/sau)
 * @returns {boolean}
 */
export const verifyTOTP = (token, secret, window = 1) => {
  try {
    const key = base32Decode(secret);
    const timeStep = 30;
    const currentCounter = Math.floor(Date.now() / 1000 / timeStep);

    for (let i = -window; i <= window; i++) {
      const counter = currentCounter + i;
      const counterBuf = Buffer.alloc(8);
      
      // Ghi số nguyên 64-bit Big-Endian vào buffer
      let temp = counter;
      for (let j = 7; j >= 0; j--) {
        counterBuf[j] = temp & 0xff;
        temp = temp >> 8;
      }

      const hmac = crypto.createHmac("sha1", key);
      hmac.update(counterBuf);
      const hmacResult = hmac.digest();

      const offset = hmacResult[hmacResult.length - 1] & 0x0f;
      const code =
        ((hmacResult[offset] & 0x7f) << 24) |
        ((hmacResult[offset + 1] & 0xff) << 16) |
        ((hmacResult[offset + 2] & 0xff) << 8) |
        (hmacResult[offset + 3] & 0xff);

      const otp = code % 1000000;
      const otpStr = String(otp).padStart(6, "0");

      if (otpStr === token) {
        return true;
      }
    }
    return false;
  } catch (error) {
    logger.warn(`[MfaService] Lỗi xác minh TOTP: ${error.message}`);
    return false;
  }
};

/**
 * Lấy khóa mã hóa AES dùng cho MFA (băm từ JWT Access Secret)
 */
const getMfaEncryptionKey = () => {
  const secret = process.env.JWT_ACCESS_SECRET || "mfa_fallback_secret_encryption_key_sap_anime_2026";
  return crypto.createHash("sha256").update(secret).digest("hex");
};

export const mfaService = {
  /**
   * Khởi tạo thông số cài đặt MFA (TOTP Secret & QR Code URI).
   *
   * @param {string} userId - ID người dùng
   * @returns {Promise<Object>} { secret, otpauthUrl }
   */
  async generateMfaSecret(userId) {
    const user = await User.findByPk(userId);
    if (!user) {
      throw createError("Người dùng không tồn tại", 404);
    }

    // Sinh 20 byte ngẫu nhiên cho khóa bí mật và mã hóa sang Base32
    const rawSecret = crypto.randomBytes(20);
    const secret = base32Encode(rawSecret);

    // Xây dựng đường dẫn QR Code theo tiêu chuẩn otpauth URI
    const issuer = encodeURIComponent(MFA_CONFIG.ISSUER);
    const email = encodeURIComponent(user.email);
    const otpauthUrl = `otpauth://totp/${issuer}:${email}?secret=${secret}&issuer=${issuer}`;

    return { secret, otpauthUrl };
  },

  /**
   * Xác minh mã code đầu tiên và kích hoạt MFA cho người dùng.
   * Sinh ra và trả về danh sách các mã dự phòng (Backup Codes).
   *
   * @param {string} userId - ID người dùng
   * @param {string} code - Mã OTP xác thực từ client
   * @param {string} tempSecret - Khóa bí mật tạm thời (Base32)
   * @returns {Promise<Array<string>>} Danh sách 10 mã khôi phục dự phòng (chỉ trả về một lần duy nhất)
   */
  async enableMfa(userId, code, tempSecret) {
    const user = await User.findByPk(userId);
    if (!user) {
      throw createError("Người dùng không tồn tại", 404);
    }

    // 1. Xác thực mã OTP đầu tiên
    const isValid = verifyTOTP(code, tempSecret);
    if (!isValid) {
      throw createError("Mã xác thực OTP không chính xác", 400);
    }

    // 2. Mã hóa khóa bí mật bằng AES-256-GCM để lưu trữ an toàn
    const encKey = getMfaEncryptionKey();
    const { encrypted, iv, authTag } = encryptData(tempSecret, encKey);

    // 3. Sinh 10 mã dự phòng bảo mật (Backup Codes)
    const backupCodes = [];
    const backupCodesHashed = [];

    for (let i = 0; i < MFA_CONFIG.BACKUP_CODES_COUNT; i++) {
      // Mỗi mã dài 8 ký tự (Hex)
      const rawCode = crypto.randomBytes(4).toString("hex");
      backupCodes.push(rawCode);
      
      const hashed = await hashPassword(rawCode);
      backupCodesHashed.push(hashed);
    }

    // 4. Lưu thông tin vào DB trong một transaction
    const transaction = await MfaCredential.sequelize.transaction();
    try {
      // Xóa các credential cũ nếu có
      await MfaCredential.destroy({ where: { user_id: userId }, transaction });

      await MfaCredential.create({
        user_id: userId,
        type: "totp",
        secret: encrypted,
        iv,
        auth_tag: authTag,
        backup_codes_hashed: backupCodesHashed,
        verified_at: new Date()
      }, { transaction });

      await user.update({ two_factor_enabled: true }, { transaction });

      await transaction.commit();

      auditLogger.log({
        event: AUDIT_EVENTS.SUSPICIOUS_ACTIVITY,
        userId: userId,
        metadata: { action: "enable_mfa", type: "totp" }
      });

      return backupCodes;
    } catch (error) {
      await transaction.rollback();
      logger.error("[MfaService] Lỗi kích hoạt MFA:", error);
      throw createError("Không thể kích hoạt xác thực hai yếu tố", 500);
    }
  },

  /**
   * Hủy xác thực MFA.
   *
   * @param {string} userId - ID người dùng
   * @param {string} code - Mã OTP xác thực để hủy
   * @returns {Promise<boolean>}
   */
  async disableMfa(userId, code) {
    const user = await User.findByPk(userId);
    if (!user) {
      throw createError("Người dùng không tồn tại", 404);
    }

    const credential = await MfaCredential.findOne({ where: { user_id: userId } });
    if (!credential) {
      throw createError("Xác thực hai yếu tố chưa được thiết lập", 400);
    }

    // Giải mã secret key để xác minh
    const encKey = getMfaEncryptionKey();
    const secret = decryptData({
      encrypted: credential.secret,
      iv: credential.iv,
      authTag: credential.auth_tag
    }, encKey);

    const isValid = verifyTOTP(code, secret);
    if (!isValid) {
      throw createError("Mã xác thực không chính xác", 400);
    }

    const transaction = await MfaCredential.sequelize.transaction();
    try {
      await credential.destroy({ transaction });
      await user.update({ two_factor_enabled: false }, { transaction });
      await transaction.commit();

      auditLogger.log({
        event: AUDIT_EVENTS.SUSPICIOUS_ACTIVITY,
        userId: userId,
        metadata: { action: "disable_mfa" }
      });

      return true;
    } catch (error) {
      await transaction.rollback();
      logger.error("[MfaService] Lỗi hủy MFA:", error);
      throw createError("Không thể hủy xác thực hai yếu tố", 500);
    }
  },

  /**
   * Xác minh mã đăng nhập hai yếu tố (chấp nhận cả mã OTP hiện tại và mã dự phòng).
   *
   * @param {string} userId - ID người dùng
   * @param {string} code - Mã OTP hoặc mã dự phòng cần kiểm tra
   * @returns {Promise<boolean>} True nếu xác thực thành công
   */
  async verifyMfaLogin(userId, code) {
    try {
      const credential = await MfaCredential.findOne({ where: { user_id: userId } });
      if (!credential) {
        return false;
      }

      // TH1: Kiểm tra mã TOTP thông thường (6 chữ số)
      if (code.length === 6 && /^\d+$/.test(code)) {
        const encKey = getMfaEncryptionKey();
        const secret = decryptData({
          encrypted: credential.secret,
          iv: credential.iv,
          authTag: credential.auth_tag
        }, encKey);

        const isValid = verifyTOTP(code, secret);
        if (isValid) return true;
      }

      // TH2: Kiểm tra mã dự phòng (Backup Codes)
      const backupCodes = credential.backup_codes_hashed || [];
      if (backupCodes.length > 0) {
        for (let i = 0; i < backupCodes.length; i++) {
          const hashedCode = backupCodes[i];
          const { valid } = await verifyPasswordUniversal(hashedCode, code);

          if (valid) {
            // Loại bỏ mã dự phòng đã sử dụng (One-time use)
            const updatedCodes = backupCodes.filter((_, idx) => idx !== i);
            credential.backup_codes_hashed = updatedCodes;
            await credential.save();
            
            logger.info(`[MfaService] User ${userId} đăng nhập thành công bằng mã dự phòng. Đã hủy mã.`);
            return true;
          }
        }
      }

      return false;
    } catch (error) {
      logger.error("[MfaService] Lỗi xác minh đăng nhập MFA:", error);
      return false;
    }
  }
};

export default mfaService;
