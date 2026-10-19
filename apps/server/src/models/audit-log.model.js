/**
 * @file audit-log.model.js
 * @module Model_AuditLog
 * @description Model Sequelize cho bảng audit_logs.
 */

import { DataTypes } from "sequelize";
import sequelize from "../config/database.config.js";

/**
 * @model AuditLog
 *
 * @property {UUID} id - ID duy nhất của bản ghi nhật ký
 * @property {string} event_type - Loại sự kiện (ví dụ: auth.login.success, auth.password.change)
 * @property {string} event_category - Danh mục sự kiện (authentication, security, session, v.v.)
 * @property {string} severity - Mức độ nghiêm trọng (info, warn, error, critical)
 * @property {UUID} user_id - ID người dùng thực hiện hành động
 * @property {string} username - Tên đăng nhập tại thời điểm xảy ra sự kiện
 * @property {string} email - Email tại thời điểm xảy ra sự kiện
 * @property {string} ip_address - Địa chỉ IP của yêu cầu
 * @property {string} user_agent - Thông tin trình duyệt/thiết bị
 * @property {string} device_fingerprint - Dấu vân tay thiết bị của client
 * @property {string} request_id - ID định danh yêu cầu để truy vết (Tracing)
 * @property {Object} location - Dữ liệu địa lý (quốc gia, thành phố, v.v.)
 * @property {Object} metadata - Dữ liệu bổ sung đặc thù của sự kiện
 * @property {string} description - Mô tả chi tiết sự kiện
 * @property {string} status - Kết quả thực hiện (success, failure, v.v.)
 * @property {string} error_code - Mã lỗi nếu trạng thái là thất bại
 * @property {string} error_message - Chi tiết lỗi nếu trạng thái là thất bại
 * @property {number} response_time_ms - Thời gian xử lý yêu cầu (ms)
 * @property {string} environment - Môi trường xảy ra sự kiện (production, development)
 */
const AuditLog = sequelize.define(
  "AuditLog",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    // Thông tin sự kiện
    event_type: {
      type: DataTypes.STRING(50),
      allowNull: false,
      comment: "Loại sự kiện (ví dụ: auth.login.success)",
    },

    event_category: {
      type: DataTypes.ENUM(
        "authentication",
        "authorization",
        "security",
        "password",
        "session",
        "user",
        "admin",
        "system",
      ),
      allowNull: false,
      comment: "Danh mục sự kiện cấp cao để lọc",
    },

    severity: {
      type: DataTypes.ENUM("info", "warn", "error", "critical"),
      defaultValue: "info",
      allowNull: false,
      comment: "Mức độ nghiêm trọng của sự kiện",
    },

    // Thông tin người dùng
    user_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: "users",
        key: "id",
      },
      comment: "Người dùng kích hoạt sự kiện (null nếu chưa định danh)",
    },

    username: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: "Tên đăng nhập tại thời điểm xảy ra sự kiện",
    },

    email: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: "Email tại thời điểm xảy ra sự kiện",
    },

    // Ngữ cảnh yêu cầu
    ip_address: {
      type: DataTypes.STRING(45),
      allowNull: true,
      comment: "Địa chỉ IPv4 hoặc IPv6",
    },

    user_agent: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Chuỗi user agent của trình duyệt/client",
    },

    device_fingerprint: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: "Dấu vân tay thiết bị phía client",
    },

    request_id: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: "ID tương quan yêu cầu để truy vết",
    },

    // Thông tin vị trí
    location: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: "Dữ liệu địa lý: { quốc gia, thành phố, lat, lng, múi giờ }",
    },

    // Chi tiết sự kiện
    metadata: {
      type: DataTypes.JSONB,
      defaultValue: {},
      comment: "Dữ liệu bổ sung đặc thù của sự kiện (JSON linh hoạt)",
    },

    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Mô tả sự kiện cho người đọc",
    },

    // Trạng thái và kết quả
    status: {
      type: DataTypes.ENUM("success", "failure", "pending", "blocked"),
      allowNull: false,
      defaultValue: "success",
      comment: "Kết quả của sự kiện",
    },

    error_code: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: "Mã lỗi nếu trạng thái là thất bại",
    },

    error_message: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Chi tiết lỗi nếu trạng thái là thất bại",
    },

    // Hiệu năng
    response_time_ms: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "Thời gian xử lý yêu cầu tính bằng mili giây",
    },

    // Môi trường
    environment: {
      type: DataTypes.STRING(20),
      allowNull: true,
      defaultValue: process.env.NODE_ENV || "development",
      comment: "Môi trường xảy ra sự kiện",
    },
  },
  {
    tableName: "audit_logs",
    timestamps: true,
    underscored: true,
    updatedAt: false, // Nhật ký audit là bất biến
    indexes: [
      {
        fields: ["user_id"],
        name: "idx_audit_logs_user_id",
      },
      {
        fields: ["event_type"],
        name: "idx_audit_logs_event_type",
      },
      {
        fields: ["event_category"],
        name: "idx_audit_logs_event_category",
      },
      {
        fields: ["severity"],
        name: "idx_audit_logs_severity",
      },
      {
        fields: ["status"],
        name: "idx_audit_logs_status",
      },
      {
        fields: ["created_at"],
        name: "idx_audit_logs_created_at",
      },
      {
        fields: ["ip_address"],
        name: "idx_audit_logs_ip_address",
      },
      {
        fields: ["device_fingerprint"],
        name: "idx_audit_logs_device_fingerprint",
      },
      // Các chỉ mục kết hợp cho truy vấn phổ biến
      {
        fields: ["user_id", "event_category", "created_at"],
        name: "idx_audit_logs_user_events",
      },
      {
        fields: ["event_type", "status", "created_at"],
        name: "idx_audit_logs_event_status",
      },
      {
        fields: ["severity", "created_at"],
        name: "idx_audit_logs_severity_time",
        comment: "Dành cho các truy vấn giám sát bảo mật",
      },
    ],
  },
);

// Phương thức thể hiện (Instance methods)

/**
 * Lấy tóm tắt sự kiện đã được định dạng
 *
 * @description Trả về dữ liệu tóm tắt để hiển thị nhanh trên giao diện
 * @returns {Object} Dữ liệu tóm tắt
 */
AuditLog.prototype.getSummary = function () {
  return {
    id: this.id,
    event: this.event_type,
    category: this.event_category,
    severity: this.severity,
    status: this.status,
    user: this.username || this.email || "Ẩn danh",
    ip: this.ip_address,
    timestamp: this.created_at,
  };
};

/**
 * Kiểm tra xem đây có phải là sự kiện bảo mật quan trọng không
 *
 * @returns {boolean} True nếu là sự kiện bảo mật hoặc mức độ nghiêm trọng là critical
 */
AuditLog.prototype.isSecurityEvent = function () {
  const securityEvents = [
    "auth.login.failed",
    "auth.account.locked",
    "auth.token.reuse",
    "security.suspicious.activity",
    "security.brute.force",
    "security.ip.blocked",
  ];

  return (
    securityEvents.includes(this.event_type) || this.severity === "critical"
  );
};

/**
 * Kiểm tra xem sự kiện có trạng thái thất bại hoặc bị chặn không
 *
 * @returns {boolean}
 */
AuditLog.prototype.isFailed = function () {
  return this.status === "failure" || this.status === "blocked";
};

// Phương thức tĩnh (Static methods)

/**
 * Ghi lại một sự kiện audit mới
 *
 * @description Phương thức tiện ích để tạo nhanh bản ghi nhật ký
 * @param {Object} params - Các tham số của sự kiện
 * @returns {Promise<AuditLog>} Bản ghi vừa được tạo
 */
AuditLog.logEvent = async function (params) {
  const {
    eventType,
    eventCategory = "system",
    severity = "info",
    userId = null,
    username = null,
    email = null,
    ipAddress = null,
    userAgent = null,
    deviceFingerprint = null,
    metadata = {},
    description = null,
    status = "success",
    errorCode = null,
    errorMessage = null,
    requestId = null,
    responseTimeMs = null,
  } = params;

  return await AuditLog.create({
    event_type: eventType,
    event_category: eventCategory,
    severity,
    user_id: userId,
    username,
    email,
    ip_address: ipAddress,
    user_agent: userAgent,
    device_fingerprint: deviceFingerprint,
    metadata,
    description,
    status,
    error_code: errorCode,
    error_message: errorMessage,
    request_id: requestId,
    response_time_ms: responseTimeMs,
  });
};

/**
 * Lấy các sự kiện bảo mật quan trọng gần đây
 *
 * @param {number} [limit=50] - Số lượng bản ghi tối đa
 * @param {number} [hours=24] - Khoảng thời gian truy vấn (giờ)
 * @returns {Promise<AuditLog[]>} Danh sách các sự kiện cảnh báo hoặc lỗi
 */
AuditLog.getRecentSecurityEvents = async function (limit = 50, hours = 24) {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);

  return await AuditLog.findAll({
    where: {
      severity: {
        [sequelize.Sequelize.Op.in]: ["warn", "error", "critical"],
      },
      created_at: {
        [sequelize.Sequelize.Op.gte]: since,
      },
    },
    order: [["created_at", "DESC"]],
    limit,
  });
};

/**
 * Đếm số lần đăng nhập thất bại theo địa chỉ IP
 *
 * @param {string} ipAddress - Địa chỉ IP cần kiểm tra
 * @param {number} [hours=1] - Khoảng thời gian kiểm tra (giờ)
 * @returns {Promise<number>} Số lần thất bại
 */
AuditLog.getFailedLoginsByIP = async function (ipAddress, hours = 1) {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);

  return await AuditLog.count({
    where: {
      event_type: "auth.login.failed",
      ip_address: ipAddress,
      created_at: {
        [sequelize.Sequelize.Op.gte]: since,
      },
    },
  });
};

/**
 * Đếm số lần đăng nhập thất bại của một người dùng
 *
 * @param {UUID} userId - ID của người dùng
 * @param {number} [hours=1] - Khoảng thời gian kiểm tra (giờ)
 * @returns {Promise<number>} Số lần thất bại
 */
AuditLog.getFailedLoginsByUser = async function (userId, hours = 1) {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);

  return await AuditLog.count({
    where: {
      event_type: "auth.login.failed",
      user_id: userId,
      created_at: {
        [sequelize.Sequelize.Op.gte]: since,
      },
    },
  });
};

/**
 * Lấy dòng thời gian hoạt động của người dùng
 *
 * @param {UUID} userId - ID người dùng
 * @param {number} [limit=100] - Số lượng hành động tối đa
 * @returns {Promise<AuditLog[]>}
 */
AuditLog.getUserTimeline = async function (userId, limit = 100) {
  return await AuditLog.findAll({
    where: { user_id: userId },
    order: [["created_at", "DESC"]],
    limit,
  });
};

/**
 * Lấy thống kê tổng quan về nhật ký audit
 *
 * @param {Date} [startDate] - Ngày bắt đầu
 * @param {Date} [endDate] - Ngày kết thúc
 * @returns {Promise<Object>} Dữ liệu thống kê (tổng số, tỷ lệ thành công, v.v.)
 */
AuditLog.getStatistics = async function (startDate, endDate) {
  const where = {};

  if (startDate && endDate) {
    where.created_at = {
      [sequelize.Sequelize.Op.between]: [startDate, endDate],
    };
  } else if (startDate) {
    where.created_at = {
      [sequelize.Sequelize.Op.gte]: startDate,
    };
  }

  const [
    totalEvents,
    successfulEvents,
    failedEvents,
    securityEvents,
    criticalEvents,
  ] = await Promise.all([
    AuditLog.count({ where }),
    AuditLog.count({ where: { ...where, status: "success" } }),
    AuditLog.count({ where: { ...where, status: "failure" } }),
    AuditLog.count({ where: { ...where, event_category: "security" } }),
    AuditLog.count({ where: { ...where, severity: "critical" } }),
  ]);

  return {
    totalEvents,
    successfulEvents,
    failedEvents,
    securityEvents,
    criticalEvents,
    successRate:
      totalEvents > 0 ? ((successfulEvents / totalEvents) * 100).toFixed(2) : 0,
  };
};

/**
 * Dọn dẹp các nhật ký audit cũ theo chính sách lưu trữ
 *
 * @param {number} [retentionDays=90] - Số ngày giữ lại bản ghi
 * @returns {Promise<number>} Số bản ghi đã xóa
 */
AuditLog.cleanupOldLogs = async function (retentionDays = 90) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

  // Giữ lại các sự kiện nghiêm trọng (critical) lâu hơn
  const result = await AuditLog.destroy({
    where: {
      severity: {
        [sequelize.Sequelize.Op.notIn]: ["critical"],
      },
      created_at: {
        [sequelize.Sequelize.Op.lt]: cutoffDate,
      },
    },
  });

  return result;
};

/**
 * Phát hiện hành vi bất thường dựa trên mẫu (Pattern Detection)
 *
 * @param {UUID} userId - ID người dùng cần kiểm tra
 * @param {number} [hours=24] - Khoảng thời gian theo dõi (giờ)
 * @returns {Promise<Object>} Kết quả phân tích hành vi bất thường
 */
AuditLog.detectSuspiciousActivity = async function (userId, hours = 24) {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);

  const [failedLogins, multipleIPs, rapidActions] = await Promise.all([
    // Quá nhiều lần đăng nhập thất bại
    AuditLog.count({
      where: {
        user_id: userId,
        event_type: "auth.login.failed",
        created_at: { [sequelize.Sequelize.Op.gte]: since },
      },
    }),

    // Thực hiện hành động từ quá nhiều địa chỉ IP khác nhau
    AuditLog.count({
      where: {
        user_id: userId,
        created_at: { [sequelize.Sequelize.Op.gte]: since },
      },
      distinct: true,
      col: "ip_address",
    }),

    // Các hành động xảy ra quá nhanh liên tục
    AuditLog.findAll({
      where: {
        user_id: userId,
        created_at: { [sequelize.Sequelize.Op.gte]: since },
      },
      attributes: ["created_at"],
      order: [["created_at", "ASC"]],
    }),
  ]);

  const suspicious = {
    excessiveFailedLogins: failedLogins > 10,
    multipleLocations: multipleIPs > 5,
    rapidActions: false,
  };

  // Kiểm tra các hành động dồn dập (ví dụ: hơn 50 hành động trong 1 phút)
  if (rapidActions.length > 0) {
    let maxActionsPerMinute = 0;
    for (let i = 0; i < rapidActions.length - 1; i++) {
      const minuteStart = new Date(rapidActions[i].created_at);
      const minuteEnd = new Date(minuteStart.getTime() + 60000);

      let count = 0;
      for (let j = i; j < rapidActions.length; j++) {
        if (rapidActions[j].created_at <= minuteEnd) {
          count++;
        } else {
          break;
        }
      }

      maxActionsPerMinute = Math.max(maxActionsPerMinute, count);
    }

    suspicious.rapidActions = maxActionsPerMinute > 50;
  }

  return {
    isSuspicious: Object.values(suspicious).some((v) => v === true),
    details: suspicious,
    stats: {
      failedLogins,
      uniqueIPs: multipleIPs,
      totalActions: rapidActions.length,
    },
  };
};

export default AuditLog;
