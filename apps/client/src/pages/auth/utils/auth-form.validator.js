/**
 * @file auth-form.validator.js
 * @module Pages/Auth/Utils/AuthFormValidator
 * @description Bộ hàm tiện ích kiểm tra tính hợp lệ của biểu mẫu Auth, tính toán độ mạnh mật khẩu và đồng bộ quy tắc với backend.
 */

/**
 * Biểu thức chính quy kiểm tra định dạng email tiêu chuẩn RFC 5322
 */
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

/**
 * Biểu thức chính quy kiểm tra username: 3-30 ký tự, chữ cái, số, gạch dưới, gạch ngang
 */
const USERNAME_REGEX = /^[a-zA-Z0-9_-]{3,30}$/;

/**
 * Kiểm tra tính hợp lệ của tên đăng nhập
 *
 * @param {string} username - Tên đăng nhập cần kiểm tra
 * @returns {string|null} Thông báo lỗi nếu không hợp lệ, null nếu hợp lệ
 */
export const validateUsername = (username) => {
  if (!username || !username.trim()) {
    return 'Vui lòng nhập tên đăng nhập';
  }

  const trimmed = username.trim();
  if (trimmed.length < 3) {
    return 'Tên đăng nhập phải có ít nhất 3 ký tự';
  }

  if (trimmed.length > 30) {
    return 'Tên đăng nhập không được quá 30 ký tự';
  }

  if (!USERNAME_REGEX.test(trimmed)) {
    return 'Tên đăng nhập chỉ được chứa chữ cái, chữ số, gạch dưới (_) và gạch ngang (-)';
  }

  return null;
};

/**
 * Kiểm tra tính hợp lệ của email
 *
 * @param {string} email - Địa chỉ email cần kiểm tra
 * @returns {string|null} Thông báo lỗi nếu không hợp lệ, null nếu hợp lệ
 */
export const validateEmail = (email) => {
  if (!email || !email.trim()) {
    return 'Vui lòng nhập địa chỉ email';
  }

  const trimmed = email.trim();
  if (!EMAIL_REGEX.test(trimmed)) {
    return 'Địa chỉ email không đúng định dạng';
  }

  return null;
};

/**
 * Phân tích độ mạnh mật khẩu và kiểm tra từng tiêu chí bảo mật
 *
 * @param {string} password - Mật khẩu cần đánh giá
 * @returns {{ score: number, level: 'weak'|'fair'|'good'|'strong', label: string, criteria: { hasMinLength: boolean, hasLetter: boolean, hasNumberOrSpecial: boolean } }}
 */
export const calculatePasswordStrength = (password = '') => {
  const str = String(password || '');

  const hasMinLength = str.length >= 8;
  const hasLetter = /[a-zA-Z]/.test(str);
  const hasNumber = /[0-9]/.test(str);
  const hasSpecial = /[^a-zA-Z0-9]/.test(str);
  const hasNumberOrSpecial = hasNumber || hasSpecial;
  const hasMixedCase = /[a-z]/.test(str) && /[A-Z]/.test(str);

  let score = 0;
  if (str.length >= 6) score += 20;
  if (hasMinLength) score += 20;
  if (hasLetter) score += 20;
  if (hasNumberOrSpecial) score += 20;
  if (hasMixedCase && hasSpecial && str.length >= 10) score += 20;

  let level = 'weak';
  let label = 'Yếu';

  if (score >= 80) {
    level = 'strong';
    label = 'Rất mạnh';
  } else if (score >= 60) {
    level = 'good';
    label = 'Mạnh';
  } else if (score >= 40) {
    level = 'fair';
    label = 'Trung bình';
  }

  return {
    score,
    level,
    label,
    criteria: {
      hasMinLength,
      hasLetter,
      hasNumberOrSpecial,
    },
  };
};

/**
 * Kiểm tra tính hợp lệ của mật khẩu mới khi đăng ký hoặc đặt lại mật khẩu
 *
 * @param {string} password - Mật khẩu cần kiểm tra
 * @returns {string|null} Thông báo lỗi nếu không đạt yêu cầu bảo mật, null nếu hợp lệ
 */
export const validatePassword = (password) => {
  if (!password) {
    return 'Vui lòng nhập mật khẩu';
  }

  if (password.length < 8) {
    return 'Mật khẩu phải có ít nhất 8 ký tự';
  }

  if (password.length > 128) {
    return 'Mật khẩu không được quá 128 ký tự';
  }

  if (!/[a-zA-Z]/.test(password)) {
    return 'Mật khẩu phải chứa ít nhất 1 chữ cái';
  }

  if (!/[0-9]/.test(password) && !/[^a-zA-Z0-9]/.test(password)) {
    return 'Mật khẩu phải chứa ít nhất 1 chữ số hoặc ký tự đặc biệt';
  }

  return null;
};

/**
 * Che một phần email để hiển thị an toàn trên giao diện thông báo
 *
 * @param {string} email - Email gốc (ví dụ: user.name@gmail.com)
 * @returns {string} Email đã che (ví dụ: u***e@gmail.com)
 */
export const maskEmail = (email = '') => {
  if (!email || typeof email !== 'string') return '';
  const parts = email.split('@');
  if (parts.length !== 2) return email;

  const [name, domain] = parts;
  if (name.length <= 2) {
    return `${name[0]}*@${domain}`;
  }

  const first = name[0];
  const last = name[name.length - 1];
  return `${first}***${last}@${domain}`;
};
