/**
 * Middleware Giám sát Hệ thống (Monitoring Middleware)
 *
 * @file monitoring.middleware.js
 * @module Middlewares
 * @description Thu thập các chỉ số kỹ thuật (Metrics) về hiệu năng HTTP phục vụ cho Prometheus và Grafana.
 * Theo dõi thời gian phản hồi, số lượng yêu cầu và trạng thái lỗi của hệ thống.
 *
 * @note Metrics này được xuất khẩu qua endpoint /metrics cho máy chủ Prometheus thu thập (Scrape).
 */

import client from "prom-client";

/**
 * Registry trung tâm để quản lý tất cả các chỉ số của ứng dụng.
 */
export const register = new client.Registry();

register.setDefaultLabels({
  app: "sap-phim-api",
});

// Khởi tạo thu thập các chỉ số mặc định của Node.js (CPU, Memory, Event Loop).
// Test smoke không cần interval nền vì sẽ giữ tiến trình Node sống sau khi server đã đóng.
if (process.env.NODE_ENV !== "test") {
  client.collectDefaultMetrics({ register });
}

/**
 * Chỉ số: Thời gian xử lý yêu cầu HTTP (Histogram)
 * Phân tích phân phối thời gian phản hồi của các API.
 */
export const httpRequestDurationMicroseconds = new client.Histogram({
  name: "http_request_duration_seconds",
  help: "Thời gian xử lý yêu cầu HTTP tính bằng giây",
  labelNames: ["method", "route", "status_code"],
  buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10], // Từ 100ms đến 10s
});

/**
 * Chỉ số: Tổng số lượng yêu cầu HTTP (Counter)
 * Thống kê lưu lượng truy cập dựa trên phương thức và mã trạng thái.
 */
export const httpRequestsTotal = new client.Counter({
  name: "http_requests_total",
  help: "Tổng số lượng yêu cầu HTTP đã xử lý",
  labelNames: ["method", "route", "status_code"],
});

// Đăng ký các chỉ số tùy chỉnh vào Registry
register.registerMetric(httpRequestDurationMicroseconds);
register.registerMetric(httpRequestsTotal);

/**
 * Middleware thu thập Metrics cho từng yêu cầu HTTP.
 * Ghi lại phương thức, đường dẫn, mã trạng thái và tính toán thời gian thực thi.
 *
 * @param {Object} req - Express Request
 * @param {Object} res - Express Response
 * @param {Function} next - Next Middleware
 */
export const monitoringMiddleware = (req, res, next) => {
  const start = Date.now();

  res.on("finish", () => {
    const duration = (Date.now() - start) / 1000;
    const statusCode = res.statusCode;

    // Normalize route: dùng route template thay vì actual path để tránh cardinality explosion
    // VD: "/api/v1/movies/naruto-shippuden" -> "/api/v1/movies/:slug"
    let route;
    if (req.route?.path) {
      route = `${req.baseUrl || ""}${req.route.path}`;
    } else {
      route = req.path
        .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "/:id")
        .replace(/\/\d+/g, "/:num");
    }

    // Cập nhật tổng số lượng yêu cầu
    httpRequestsTotal.inc({
      method: req.method,
      route,
      status_code: statusCode,
    });

    // Cập nhật thời gian xử lý yêu cầu
    httpRequestDurationMicroseconds.observe(
      {
        method: req.method,
        route,
        status_code: statusCode,
      },
      duration,
    );
  });

  next();
};
