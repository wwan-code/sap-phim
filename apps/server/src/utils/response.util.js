/**
 * @file response.util.js
 * @module Utils
 * @description Chuẩn hóa định dạng phản hồi API để giữ tính nhất quán giữa backend và frontend.
 */

export const responseUtil = {
  // ════════════════════════════════════════
  // PHẢN HỒI THÀNH CÔNG (SUCCESS)
  // ════════════════════════════════════════

  /**
   * Trả về phản hồi thành công (HTTP 2xx).
   *
   * @param {Object} res - Đối tượng Response của Express.
   * @param {*} [data=null] - Dữ liệu nghiệp vụ trả về cho Client.
   * @param {string} [message="Thao tác thành công"] - Thông báo tóm tắt kết quả.
   * @param {number} [statusCode=200] - Mã trạng thái HTTP.
   * @param {Object} [meta=null] - Các thông tin bổ sung ngoài luồng dữ liệu chính.
   */
  success(res, data = null, message = "Thao tác thành công", statusCode = 200, meta = null) {
    return res.status(statusCode).json({
      success: true,
      message,
      data,
      ...(meta && { meta }),
    });
  },

  // ════════════════════════════════════════
  // PHẢN HỒI LỖI (ERROR)
  // ════════════════════════════════════════

  /**
   * Trả về phản hồi lỗi (HTTP 4xx / 5xx).
   *
   * @param {Object} res - Đối tượng Response của Express.
   * @param {string} [message="Lỗi hệ thống"] - Thông điệp lỗi hiển thị cho người dùng.
   * @param {number} [statusCode=500] - Mã lỗi HTTP.
   * @param {Error} [error=null] - Đối tượng lỗi kỹ thuật để truy vết.
   */
  error(res, message = "Lỗi xảy ra", statusCode = 500, error = null) {
    const errorCode =
      error?.errorCode || error?.code || (statusCode >= 500 ? "INTERNAL_ERROR" : null);
    const payload = {
      success: false,
      message,
    };

    if (errorCode) {
      payload.code = errorCode;
    }

    // Chỉ đính kèm thông tin kỹ thuật chi tiết trong môi trường Development
    if (error && process.env.NODE_ENV === "development") {
      payload.error = {
        code: errorCode || "INTERNAL_ERROR",
        details: error.details || error.message || null,
        stack: error.stack || null,
      };
    }

    return res.status(statusCode).json(payload);
  },

  // ════════════════════════════════════════
  // PHẢN HỒI PHÂN TRANG (PAGINATION)
  // ════════════════════════════════════════

  /**
   * Trả về phản hồi cho danh sách dữ liệu có hỗ trợ phân trang.
   *
   * @param {Object} res - Đối tượng Response của Express.
   * @param {Object} options - Cấu hình phân trang (items, total, page, limit).
   */
  paginated(
    res,
    { items, total, page, limit, message = "Lấy dữ liệu thành công", meta = null },
  ) {
    return res.status(200).json({
      success: true,
      message,
      data: {
        items,
        pagination: {
          total,
          page: parseInt(page, 10),
          limit: parseInt(limit, 10),
          totalPages: Math.ceil(total / limit),
        },
        ...(meta && { meta }),
      },
    });
  },
};

export default responseUtil;
