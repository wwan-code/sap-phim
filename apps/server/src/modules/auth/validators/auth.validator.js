/**
 * Trình Kiểm tra Xác thực (Auth Validator)
 * 
 * @description Các schemas kiểm tra dữ liệu (Validation) cho các yêu cầu liên quan đến xác thực.
 * Sử dụng Joi để đảm bảo tính toàn vẹn, định dạng và bảo mật của dữ liệu đầu vào (Input Validation).
 */
import Joi from "joi";
import {
  PASSWORD_POLICY,
  VALIDATION_REGEX,
} from "../../../constants/auth.constant.js";

// ════════════════════════════════════════
// KIỂM TRA TÙY CHỈNH (CUSTOM VALIDATORS)
// ════════════════════════════════════════

/**
 * Kiểm tra độ mạnh của mật khẩu.
 */
const validatePasswordStrength = (value, helpers) => {
  const { MIN_LENGTH, MAX_LENGTH, COMMON_PASSWORDS } = PASSWORD_POLICY;

  // Kiểm tra độ dài
  if (value.length < MIN_LENGTH) {
    return helpers.error("password.tooShort", { min: MIN_LENGTH });
  }

  if (value.length > MAX_LENGTH) {
    return helpers.error("password.tooLong", { max: MAX_LENGTH });
  }

  // Kiểm tra mật khẩu phổ biến
  if (COMMON_PASSWORDS.includes(value.toLowerCase())) {
    return helpers.error("password.common");
  }

  // Kiểm tra các yêu cầu ký tự
  const requirements = [];

  if (
    PASSWORD_POLICY.REQUIRE_UPPERCASE &&
    !VALIDATION_REGEX.PASSWORD_UPPERCASE.test(value)
  ) {
    requirements.push("chữ hoa");
  }

  if (
    PASSWORD_POLICY.REQUIRE_LOWERCASE &&
    !VALIDATION_REGEX.PASSWORD_LOWERCASE.test(value)
  ) {
    requirements.push("chữ thường");
  }

  if (
    PASSWORD_POLICY.REQUIRE_NUMBER &&
    !VALIDATION_REGEX.PASSWORD_NUMBER.test(value)
  ) {
    requirements.push("số");
  }

  if (
    PASSWORD_POLICY.REQUIRE_SPECIAL &&
    !VALIDATION_REGEX.PASSWORD_SPECIAL.test(value)
  ) {
    requirements.push("ký tự đặc biệt");
  }

  if (requirements.length > 0) {
    return helpers.error("password.requirements", {
      requirements: requirements.join(", "),
    });
  }

  return value;
};

/**
 * Kiểm tra định dạng tên đăng nhập.
 */
const validateUsername = (value, helpers) => {
  const trimmed = value.trim();

  // Kiểm tra định dạng Regex
  if (!VALIDATION_REGEX.USERNAME.test(trimmed)) {
    return helpers.error("username.invalid");
  }

  // Chặn các từ khóa nhạy cảm
  const offensiveWords = ["admin", "root", "system", "null", "undefined"];
  if (offensiveWords.some((word) => trimmed.toLowerCase().includes(word))) {
    return helpers.error("username.restricted");
  }

  return trimmed;
};

/**
 * Kiểm tra domain email.
 */
const validateEmail = (value, helpers) => {
  const email = value.toLowerCase().trim();

  // Kiểm tra định dạng
  if (!VALIDATION_REGEX.EMAIL.test(email)) {
    return helpers.error("email.invalid");
  }

  // Chặn email tạm thời (disposable)
  const disposableDomains = [
    "tempmail.com",
    "10minutemail.com",
    "guerrillamail.com",
  ];
  const domain = email.split("@")[1];

  if (disposableDomains.includes(domain)) {
    return helpers.error("email.disposable");
  }

  return email;
};

// ════════════════════════════════════════
// MỞ RỘNG JOI (JOI EXTENSIONS)
// ════════════════════════════════════════

const extendedJoi = Joi.extend({
  type: "password",
  base: Joi.string(),
  messages: {
    "password.tooShort": "Mật khẩu phải có ít nhất {{#min}} ký tự",
    "password.tooLong": "Mật khẩu không được quá {{#max}} ký tự",
    "password.common": "Mật khẩu này quá phổ biến và không an toàn",
    "password.requirements": "Mật khẩu phải chứa: {{#requirements}}",
  },
  validate(value, helpers) {
    const result = validatePasswordStrength(value, helpers);
    if (typeof result === "string") {
      return { value: result };
    }
    return result;
  },
});

// ════════════════════════════════════════
// SCHEMAS KIỂM TRA (VALIDATION SCHEMAS)
// ════════════════════════════════════════

export const authValidator = {
  /**
   * Schema kiểm tra yêu cầu đăng ký tài khoản mới
   */
  register: Joi.object({
    username: Joi.string()
      .min(3)
      .max(30)
      .custom(validateUsername)
      .required()
      .messages({
        "string.empty": "Tên đăng nhập không được để trống",
        "string.min": "Tên đăng nhập phải có ít nhất 3 ký tự",
        "string.max": "Tên đăng nhập không được quá 30 ký tự",
        "username.invalid":
          "Tên đăng nhập chỉ được chứa chữ cái, số, gạch dưới và gạch ngang",
        "username.restricted": "Tên đăng nhập này không được phép sử dụng",
      }),

    email: Joi.string().custom(validateEmail).required().messages({
      "string.empty": "Email không được để trống",
      "email.invalid": "Email không hợp lệ",
      "email.disposable": "Không chấp nhận email tạm thời",
    }),

    password: extendedJoi.password().required().messages({
      "string.empty": "Mật khẩu không được để trống",
    }),

    full_name: Joi.string()
      .min(2)
      .max(100)
      .trim()
      .allow("")
      .optional()
      .messages({
        "string.min": "Họ tên phải có ít nhất 2 ký tự",
        "string.max": "Họ tên không được quá 100 ký tự",
      }),

    acceptTerms: Joi.boolean().valid(true).optional().messages({
      "any.only": "Bạn phải đồng ý với điều khoản dịch vụ",
    }),

    deviceFingerprint: Joi.string().max(500).optional(),
  }),

  /**
   * Schema kiểm tra yêu cầu đăng nhập
   */
  login: Joi.object({
    identifier: Joi.string().required().messages({
      "string.empty": "Vui lòng nhập email hoặc tên đăng nhập",
    }),

    password: Joi.string().required().messages({
      "string.empty": "Vui lòng nhập mật khẩu",
    }),

    rememberMe: Joi.boolean().optional().default(false),

    deviceFingerprint: Joi.string().max(500).optional(),
  }),

  /**
   * Schema kiểm tra yêu cầu xác minh MFA trong luồng đăng nhập
   */
  mfaLoginVerify: Joi.object({
    mfaToken: Joi.string().trim().min(32).max(128).required().messages({
      "string.empty": "MFA token không được để trống",
      "string.min": "MFA token không hợp lệ",
      "string.max": "MFA token không hợp lệ",
    }),

    code: Joi.string()
      .trim()
      .min(6)
      .max(16)
      .pattern(/^[a-zA-Z0-9]+$/)
      .required()
      .messages({
        "string.empty": "Mã xác thực không được để trống",
        "string.pattern.base": "Mã xác thực không hợp lệ",
      }),
  }),

  /**
   * Schema kiểm tra yêu cầu làm mới Token (Refresh Token)
   */
  refreshToken: Joi.object({
    refreshToken: Joi.string().optional().messages({
      "string.empty": "Refresh token không được để trống",
    }),

    deviceFingerprint: Joi.string().max(500).optional(),
  }),

  /**
   * Schema kiểm tra yêu cầu đổi mật khẩu (Khi đã đăng nhập)
   */
  changePassword: Joi.object({
    current_password: Joi.string().required().messages({
      "string.empty": "Vui lòng nhập mật khẩu hiện tại",
    }),

    new_password: extendedJoi
      .password()
      .required()
      .invalid(Joi.ref("current_password"))
      .messages({
        "string.empty": "Vui lòng nhập mật khẩu mới",
        "any.invalid": "Mật khẩu mới phải khác mật khẩu hiện tại",
      }),

    confirm_password: Joi.string()
      .required()
      .valid(Joi.ref("new_password"))
      .messages({
        "any.only": "Mật khẩu xác nhận không khớp",
      }),

    logout_all: Joi.boolean().optional(),
  }),

  /**
   * Schema kiểm tra yêu cầu quên mật khẩu
   */
  forgotPassword: Joi.object({
    email: Joi.string().custom(validateEmail).required().messages({
      "string.empty": "Vui lòng nhập email",
      "email.invalid": "Email không hợp lệ",
    }),
  }),

  /**
   * Schema kiểm tra yêu cầu đặt lại mật khẩu (Dùng token từ email)
   */
  resetPassword: Joi.object({
    token: Joi.string()
      .length(64) // SHA-256 hex = 64 ký tự
      .required()
      .messages({
        "string.empty": "Token không được để trống",
        "string.length": "Token không hợp lệ",
      }),

    password: extendedJoi.password().required().messages({
      "string.empty": "Vui lòng nhập mật khẩu mới",
    }),

    confirm_password: Joi.string()
      .required()
      .valid(Joi.ref("password"))
      .messages({
        "string.empty": "Vui lòng xác nhận mật khẩu",
        "any.only": "Mật khẩu xác nhận không khớp",
      }),
  }),

  /**
   * Schema kiểm tra yêu cầu xác thực email
   */
  verifyEmail: Joi.object({
    token: Joi.string().length(64).required().messages({
      "string.empty": "Token xác thực không được để trống",
      "string.length": "Token xác thực không hợp lệ",
    }),
  }),

  /**
   * Schema kiểm tra yêu cầu gửi lại email xác thực
   */
  resendVerification: Joi.object({
    email: Joi.string().custom(validateEmail).required().messages({
      "string.empty": "Vui lòng nhập email",
      "email.invalid": "Email không hợp lệ",
    }),
  }),

  /**
   * Schema kiểm tra yêu cầu bật MFA
   */
  mfaEnable: Joi.object({
    code: Joi.string().pattern(/^\d{6}$/).required().messages({
      "string.empty": "Mã OTP không được để trống",
      "string.pattern.base": "Mã OTP phải gồm 6 chữ số",
    }),

    secret: Joi.string()
      .trim()
      .pattern(/^[A-Z2-7]+=*$/i)
      .min(16)
      .max(64)
      .required()
      .messages({
        "string.empty": "Secret MFA không được để trống",
        "string.pattern.base": "Secret MFA không hợp lệ",
      }),
  }),

  /**
   * Schema kiểm tra yêu cầu tắt MFA
   */
  mfaDisable: Joi.object({
    code: Joi.string().pattern(/^\d{6}$/).required().messages({
      "string.empty": "Mã OTP không được để trống",
      "string.pattern.base": "Mã OTP phải gồm 6 chữ số",
    }),
  }),

  /**
   * Schema kiểm tra yêu cầu thu hồi phiên đăng nhập
   */
  revokeSession: Joi.object({
    sessionId: Joi.number().integer().positive().required().messages({
      "number.base": "Session ID không hợp lệ",
      "number.positive": "Session ID phải là số dương",
      "any.required": "Session ID là bắt buộc",
    }),
  }),
};

export default authValidator;
