/**
 * Middleware Xác thực Dữ liệu (Validator Middleware)
 *
 * @file validator.middleware.js
 * @module Middlewares
 * @description Cung cấp công cụ xác thực dữ liệu đầu vào dựa trên Joi Schema và tự động làm sạch XSS.
 * Hỗ trợ xác thực linh hoạt cho Body, Query và Params của yêu cầu HTTP.
 *
 * @note Mọi dữ liệu sau khi xác thực đều được làm sạch để chống tấn công Scripting.
 */

import xss from "xss";

// ════════════════════════════════════════
// CẤU HÌNH LÀM SẠCH XSS (XSS SANITIZER)
// ════════════════════════════════════════

/**
 * Cấu hình bộ lọc XSS: Loại bỏ hoàn toàn các thẻ HTML để đảm bảo an toàn tuyệt đối.
 */
const xssOptions = {
  whiteList: {}, // Không cho phép bất kỳ thẻ HTML nào
  stripIgnoreTag: true,
  stripIgnoreTagBody: ["script", "style"],
};
const myXss = new xss.FilterXSS(xssOptions);

/**
 * Đệ quy làm sạch các chuỗi ký tự trong Đối tượng hoặc Mảng để ngăn chặn tấn công XSS.
 *
 * @param {any} obj - Dữ liệu cần xử lý khử độc
 * @returns {any} Dữ liệu đã được làm sạch
 */
const sanitizeObject = (obj) => {
  if (obj === null || obj === undefined) return obj;

  if (typeof obj === "string") {
    return myXss.process(obj);
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeObject(item));
  }

  if (typeof obj === "object" && !(obj instanceof Date)) {
    const sanitizedObj = {};
    for (const [key, value] of Object.entries(obj)) {
      sanitizedObj[key] = sanitizeObject(value);
    }
    return sanitizedObj;
  }

  return obj;
};

// ════════════════════════════════════════
// MIDDLEWARE XỬ LÝ (CORE VALIDATOR)
// ════════════════════════════════════════

/**
 * Khởi tạo Middleware xác thực dữ liệu dựa trên Joi Schema.
 *
 * @param {import('joi').Schema} schema - Schema định nghĩa cấu trúc dữ liệu
 * @param {string} [source="body"] - Nguồn dữ liệu cần xác thực ('body', 'query', 'params')
 * @returns {Function} Express Middleware
 */
export const validate = (schema, source = "body", options = {}) => {
  return (req, res, next) => {
    const data = req[source];
    const { error, value } = schema.validate(data, {
      abortEarly: false,
      stripUnknown: true,
      allowUnknown: false,
      ...options,
    });

    if (error) {
      if (typeof req.cleanupUploadedFiles === "function") {
        Promise.resolve(req.cleanupUploadedFiles()).catch(() => {});
      }

      const details = error.details.map((detail) => ({
        field: detail.path.join("."),
        message: detail.message.replace(/"/g, ""),
      }));

      return res.status(422).json({
        success: false,
        message: "Dữ liệu gửi lên không hợp lệ",
        error: {
          code: "VALIDATION_ERROR",
          details,
        },
      });
    }

    // Tiến hành làm sạch XSS sau khi dữ liệu đã vượt qua bước xác thực cấu trúc
    const sanitizedValue = sanitizeObject(value);

    // Gán dữ liệu đã được chuẩn hóa vào Request để các Controller sử dụng trực tiếp
    if (source === "query") {
      req.validatedQuery = sanitizedValue;
    } else if (source === "params") {
      req.validatedParams = sanitizedValue;
    } else {
      req[source] = sanitizedValue;
    }

    next();
  };
};

/**
 * Tiện ích xác thực các tham số truy vấn (Query Parameters).
 * Ví dụ: /api/movies?page=1&limit=10
 */
export const validateQuery = (schema) => validate(schema, "query");

/**
 * Tiện ích xác thực các tham số đường dẫn (Route Parameters).
 * Ví dụ: /api/movies/:id
 */
export const validateParams = (schema) => validate(schema, "params");
