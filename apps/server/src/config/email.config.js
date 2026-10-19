/**
 * Cấu hình Email (Email Configuration)
 *
 * @name email.config.js
 * @module Config
 * @description Quản lý cấu hình SMTP, khởi tạo Transporter, định nghĩa các mẫu email
 * và cung cấp dịch vụ gửi email cho toàn bộ hệ thống.
 */

import nodemailer from "nodemailer";
import { env } from "./env.config.js";
import { logger } from "../utils/logger.js";

/**
 * Cấu hình SMTP nội bộ
 *
 * @description Thiết lập các thông số kết nối SMTP, Connection Pool và Rate Limit.
 */
const smtpConfig = {
  host: env.email.host,
  port: env.email.port,
  secure: env.email.port === 465, // Sử dụng SSL cho cổng 465
  auth: {
    user: env.email.user,
    pass: env.email.password,
  },

  // Tối ưu hóa kết nối bằng cơ chế Connection Pool
  pool: true,
  maxConnections: 5,
  maxMessages: 100,
  rateDelta: 1000,
  rateLimit: 10, // Giới hạn 10 email/giây để tránh bị đánh dấu spam

  // Các thiết lập thời gian chờ (Timeouts)
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 30000,
};

let transporter = null;

/**
 * Khởi tạo hoặc lấy Instance của Email Transporter
 *
 * @description Áp dụng mẫu thiết kế Singleton để tái sử dụng kết nối SMTP.
 * @returns {Object} Nodemailer Transporter
 */
export const getEmailTransporter = () => {
  if (!transporter) {
    transporter = nodemailer.createTransport(smtpConfig);

    // Kiểm tra tính khả dụng của máy chủ SMTP ngay khi khởi tạo
    transporter.verify((error) => {
      if (error) {
        logger.error(`[EmailConfig] Lỗi khởi tạo Email Transporter: ${error.message}`);
      } else {
        logger.info("[EmailConfig] Hệ thống Email đã sẵn sàng");
      }
    });
  }
  return transporter;
};

/**
 * Thiết lập chung cho Email
 *
 * @description Định nghĩa thông tin người gửi, URL cơ sở và danh sách tiêu đề email.
 */
export const emailConfig = {
  from: {
    name: env.appName || "Sạp Phim",
    address: env.email.from || "noreply@wwan.vn",
  },

  templates: {
    baseUrl: env.clientUrl || "http://localhost:3000",
    logoUrl: env.logoUrl || "https://wwan.vn/logo.png",
  },

  subjects: {
    verification: "[Sạp Phim] Xác thực email của bạn",
    passwordReset: "[Sạp Phim] Đặt lại mật khẩu",
    welcomeEmail: "[Sạp Phim] Chào mừng bạn đến với Sạp Phim!",
    newsletter: "[Sạp Phim] Bản tin tháng này",
    paymentRequestPending: "[Sạp Phim] Yêu cầu nạp tiền mới cần phê duyệt",
    paymentApproved: "[Sạp Phim] Nạp tiền thành công",
    paymentRejected: "[Sạp Phim] Yêu cầu nạp tiền bị từ chối",
  },
};

/**
 * Hàm tiện ích gửi Email
 *
 * @description Thực hiện gửi email với các tùy chọn nội dung và tệp đính kèm.
 * @param {Object} options - Tùy chọn gửi email (to, subject, text, html, attachments)
 * @returns {Promise<Object>} Kết quả gửi email
 */
export const sendEmail = async (options) => {
  const { to, subject, text, html, attachments = [] } = options;
  const transport = getEmailTransporter();

  const mailOptions = {
    from: `"${emailConfig.from.name}" <${emailConfig.from.address}>`,
    to,
    subject,
    text,
    html,
    attachments,
  };

  try {
    const info = await transport.sendMail(mailOptions);
    logger.info(`[EmailConfig] Email đã gửi tới ${to} [ID: ${info.messageId}]`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    logger.error(`[EmailConfig] Lỗi khi gửi Email tới ${to}: ${error.message}`);
    return { success: false, error: error.message };
  }
};

/**
 * Các mẫu Email HTML (Email Templates)
 *
 * @description Định nghĩa cấu trúc nội dung HTML cho các loại email khác nhau.
 */
export const emailTemplates = {
  /**
   * Mẫu xác thực tài khoản mới
   *
   * @param {Object} data - Dữ liệu cần điền vào mẫu
   * @returns {Object} Đối tượng chứa subject và html
   */
  verification: (data) => ({
    subject: emailConfig.subjects.verification,
    html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eee; padding: 20px; border-radius: 8px;">
                <h2 style="color: #333; text-align: center;">Xác thực Email</h2>
                <p>Xin chào <strong>${data.name}</strong>,</p>
                <p>Cảm ơn bạn đã đăng ký tài khoản tại Sạp Phim. Vui lòng nhấn vào nút bên dưới để xác thực địa chỉ email của bạn:</p>
                <div style="text-align: center; margin: 30px 0;">
                  <a href="${data.verifyUrl}" style="display: inline-block; padding: 12px 24px; background-color: #007bff; color: white; text-decoration: none; border-radius: 4px; font-weight: bold;">
                      Xác thực ngay
                  </a>
                </div>
                <p>Hoặc sao chép đường dẫn sau vào trình duyệt:</p>
                <p style="word-break: break-all; color: #666; font-size: 13px;">${data.verifyUrl}</p>
                <p style="color: #d9534f;"><i>Lưu ý: Liên kết này sẽ hết hạn sau 24 giờ.</i></p>
                <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
                <p style="color: #999; font-size: 12px; text-align: center;">Đây là email tự động từ hệ thống Sạp Phim, vui lòng không trả lời email này.</p>
            </div>
        `,
  }),

  /**
   * Mẫu khôi phục mật khẩu
   *
   * @param {Object} data - Dữ liệu cần điền vào mẫu
   * @returns {Object} Đối tượng chứa subject và html
   */
  passwordReset: (data) => ({
    subject: emailConfig.subjects.passwordReset,
    html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eee; padding: 20px; border-radius: 8px;">
                <h2 style="color: #d9534f; text-align: center;">Đặt lại mật khẩu</h2>
                <p>Xin chào <strong>${data.name}</strong>,</p>
                <p>Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn. Nhấn vào nút bên dưới để tạo mật khẩu mới:</p>
                <div style="text-align: center; margin: 30px 0;">
                  <a href="${data.resetUrl}" style="display: inline-block; padding: 12px 24px; background-color: #dc3545; color: white; text-decoration: none; border-radius: 4px; font-weight: bold;">
                      Đặt lại mật khẩu
                  </a>
                </div>
                <p>Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email này. Tài khoản của bạn vẫn được bảo mật.</p>
                <p style="color: #d9534f;"><i>Lưu ý: Liên kết này sẽ hết hạn sau 30 phút.</i></p>
                <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
                <p style="color: #999; font-size: 12px; text-align: center;">Hệ thống Sạp Phim - Xem phim chất lượng cao</p>
            </div>
        `,
  }),

  /**
   * Thông báo yêu cầu nạp tiền (Gửi cho Quản trị viên)
   *
   * @param {Object} data - Dữ liệu giao dịch
   * @returns {Object} Đối tượng chứa subject và html
   */
  paymentRequestPending: (data) => ({
    subject: emailConfig.subjects.paymentRequestPending,
    html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eee; padding: 20px; border-radius: 8px;">
                <h2 style="color: #333;">Yêu cầu nạp tiền mới</h2>
                <p>Hệ thống ghi nhận một yêu cầu nạp tiền mới đang chờ phê duyệt:</p>
                
                <div style="background-color: #f9f9f9; padding: 15px; border-radius: 4px; margin: 20px 0; border-left: 4px solid #ff9800;">
                  <p><strong>Thông tin giao dịch:</strong></p>
                  <p>• Mã: <strong>${data.transactionCode}</strong></p>
                  <p>• Người dùng: ${data.userName} (${data.userEmail})</p>
                  <p>• Số tiền: <span style="color: #d9534f; font-weight: bold;">${data.amountVnd} VND</span></p>
                  <p>• Thời gian: ${data.requestedAt}</p>
                </div>

                <div style="text-align: center; margin: 20px 0;">
                  <a href="${data.approvalUrl}" style="display: inline-block; padding: 12px 24px; background-color: #28a745; color: white; text-decoration: none; border-radius: 4px; font-weight: bold;">
                    Đi đến trang Phê duyệt
                  </a>
                </div>

                <p><strong>Thông tin chuyển khoản dự kiến:</strong></p>
                <p style="color: #666; font-size: 14px;">
                  ${data.bankName} | ${data.accountHolder} | ${data.accountNumber}
                </p>
            </div>
        `,
  }),

  /**
   * Thông báo nạp tiền thành công (Gửi cho Người dùng)
   *
   * @param {Object} data - Dữ liệu kết quả nạp tiền
   * @returns {Object} Đối tượng chứa subject và html
   */
  paymentApproved: (data) => ({
    subject: emailConfig.subjects.paymentApproved,
    html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eee; padding: 20px; border-radius: 8px;">
                <h2 style="color: #28a745; text-align: center;">Nạp tiền thành công!</h2>
                <p>Chúc mừng <strong>${data.userName}</strong>,</p>
                <p>Yêu cầu nạp tiền của bạn đã được quản trị viên phê duyệt. Số dư S-Coin đã được cập nhật:</p>
                
                <div style="background-color: #e8f5e9; padding: 20px; border-radius: 4px; margin: 20px 0; text-align: center;">
                  <p style="margin: 0; color: #666;">Số S-Coin nhận được:</p>
                  <h1 style="margin: 10px 0; color: #2196F3;">+${data.rapcoinAmount} S-Coin</h1>
                  <p style="margin: 0;">Số dư hiện tại: <strong>${data.newBalance} S-Coin</strong></p>
                </div>

                <div style="text-align: center; margin: 25px 0;">
                  <a href="${data.walletUrl}" style="display: inline-block; padding: 12px 24px; background-color: #2196F3; color: white; text-decoration: none; border-radius: 4px; font-weight: bold;">
                    Xem Ví của tôi
                  </a>
                </div>

                <p style="color: #666; font-size: 14px; text-align: center;">
                  Cảm ơn bạn đã ủng hộ Sạp Phim. Chúc bạn có những giây phút xem phim vui vẻ!
                </p>
            </div>
        `,
  }),

  /**
   * Thông báo yêu cầu nạp tiền bị từ chối
   *
   * @param {Object} data - Lý do từ chối và thông tin giao dịch
   * @returns {Object} Đối tượng chứa subject và html
   */
  paymentRejected: (data) => ({
    subject: emailConfig.subjects.paymentRejected,
    html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eee; padding: 20px; border-radius: 8px;">
                <h2 style="color: #dc3545; text-align: center;">Yêu cầu nạp tiền bị từ chối</h2>
                <p>Xin chào <strong>${data.userName}</strong>,</p>
                <p>Rất tiếc, yêu cầu nạp tiền (Mã: ${data.transactionCode}) của bạn đã không được phê duyệt.</p>
                
                <div style="background-color: #fff3cd; padding: 15px; border-radius: 4px; margin: 20px 0; border-left: 4px solid #dc3545;">
                  <p><strong>Lý do từ chối:</strong></p>
                  <p style="color: #333;">${data.rejectionReason}</p>
                </div>

                <p>Nếu bạn có bất kỳ thắc mắc nào, vui lòng liên hệ với bộ phận hỗ trợ của chúng tôi.</p>
                <div style="text-align: center; margin: 25px 0;">
                  <a href="${data.contactUrl}" style="display: inline-block; padding: 12px 24px; background-color: #6c757d; color: white; text-decoration: none; border-radius: 4px; font-weight: bold;">
                    Liên hệ Hỗ trợ
                  </a>
                </div>
            </div>
        `,
  }),
};

export default { emailConfig, sendEmail, emailTemplates, getEmailTransporter };

