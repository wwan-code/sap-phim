import axios from "axios";
import { logger } from "./utils/logger.js";
import env from "./config/env.config.js";

const VIDEO_SERVER_URL = env.videoServer.url || "http://localhost:3002";

/**
 * Khởi tạo Instance Axios cho Video Server với các cấu hình mặc định
 */
const videoServerClient = axios.create({
  baseURL: VIDEO_SERVER_URL,
  timeout: 60000, // Thời gian chờ mặc định 60 giây cho các tác vụ video
  headers: {
    "Content-Type": "application/json",
    "x-internal-key": env.videoServer.internalKey || "", // Khóa xác thực giữa các Server nội bộ
  },
});

/**
 * Interceptor xử lý lỗi tập trung cho các yêu cầu gửi đến Video Server
 */
videoServerClient.interceptors.response.use(
  (response) => response,
  (error) => {
    logger.error("[VideoServerClient] Yêu cầu gửi đến Video Server thất bại:", {
      url: error.config?.url,
      method: error.config?.method,
      status: error.response?.status,
      message: error.message,
    });
    throw error;
  },
);

// ════════════════════════════════════════
// DỊCH VỤ ĐIỀU PHỐI (ORCHESTRATOR)
// ════════════════════════════════════════

/**
 * Đối tượng cung cấp các dịch vụ giao tiếp với máy chủ xử lý Video.
 */
export const videoServerService = {
  /**
   * Khởi tạo một yêu cầu xử lý video mới (Video Processing Job).
   *
   * @param {Object} jobData - Thông tin chi tiết của Job
   * @param {string} jobData.episodeId - ID của tập phim
   * @param {string} jobData.movieId - ID của bộ phim
   * @param {string} jobData.userId - ID người dùng thực hiện yêu cầu
   * @param {string} jobData.inputPath - Đường dẫn tệp tin gốc cần xử lý
   * @param {string} jobData.outputDir - Thư mục lưu trữ kết quả sau khi xử lý
   * @param {number} [jobData.maxRetries=3] - Số lần thử lại tối đa khi thất bại
   * @returns {Promise<Object>} Dữ liệu phản hồi từ Video Server
   * @throws {Error} Khi không thể khởi tạo Job xử lý
   */
  async createJob(jobData) {
    try {
      const response = await videoServerClient.post("/api/jobs", {
        episode_id: jobData.episodeId,
        movie_id: jobData.movieId,
        user_id: jobData.userId,
        input_path: jobData.inputPath,
        output_dir: jobData.outputDir,
        max_retries: jobData.maxRetries || 3,
      });

      logger.info(`[VideoServerClient] Đã khởi tạo Video Job thành công: ${response.data.data?.job_id}`, {
        episode_id: jobData.episodeId,
      });

      return response.data;
    } catch (error) {
      logger.error(`[VideoServerClient] Lỗi khi tạo Video Job: ${error.message}`);
      throw new Error(`Không thể khởi tạo tiến trình xử lý video: ${error.message}`);
    }
  },

  /**
   * Truy vấn trạng thái hiện tại của một Job xử lý video theo mã Job.
   *
   * @param {string} jobId - Mã định danh của Job
   * @returns {Promise<Object>} Thông tin trạng thái chi tiết (pending, processing, completed, failed)
   */
  async getJobStatus(jobId) {
    try {
      const response = await videoServerClient.get(`/api/jobs/${jobId}/status`);
      return response.data;
    } catch (error) {
      logger.error(`[VideoServerClient] Lỗi khi truy vấn trạng thái Job ${jobId}: ${error.message}`);
      throw error;
    }
  },

  /**
   * Gửi yêu cầu thực hiện lại (Retry) một Job đã bị thất bại trước đó.
   *
   * @param {string} jobId - Mã định danh của Job cần chạy lại
   * @returns {Promise<Object>} Kết quả phản hồi yêu cầu thử lại
   */
  async retryJob(jobId) {
    try {
      const response = await videoServerClient.post(`/api/jobs/${jobId}/retry`);
      logger.info(`[VideoServerClient] Đã gửi yêu cầu thử lại cho Video Job: ${jobId}`);
      return response.data;
    } catch (error) {
      logger.error(`[VideoServerClient] Lỗi khi yêu cầu thử lại Job ${jobId}: ${error.message}`);
      throw error;
    }
  },

  /**
   * Lấy số liệu thống kê tổng quát của hàng đợi xử lý video trên máy chủ.
   *
   * @returns {Promise<Object>} Thống kê số lượng Job theo từng trạng thái
   */
  async getQueueStats() {
    try {
      const response = await videoServerClient.get("/api/jobs/queue/stats");
      return response.data;
    } catch (error) {
      logger.error(`[VideoServerClient] Lỗi khi truy vấn thống kê hàng đợi: ${error.message}`);
      throw error;
    }
  },

  /**
   * Thực hiện kiểm tra tình trạng sức khỏe (Health Check) chi tiết của Video Server.
   * Bao gồm kiểm tra kết nối DB, Redis và dung lượng ổ đĩa.
   *
   * @returns {Promise<Object>} Báo cáo tình trạng sức khỏe máy chủ
   */
  async checkHealth() {
    try {
      const response = await videoServerClient.get("/health/detailed");
      return response.data;
    } catch (error) {
      logger.warn(`[VideoServerClient] Kiểm tra sức khỏe Video Server thất bại: ${error.message}`);
      return {
        success: false,
        error: error.message,
        available: false,
      };
    }
  },

  /**
   * Kiểm tra nhanh tính khả dụng (Live Check) của Video Server.
   *
   * @returns {Promise<boolean>} True nếu Server đang phản hồi
   */
  async isAvailable() {
    try {
      const response = await videoServerClient.get("/health/live", {
        timeout: 5000, // Chỉ đợi tối đa 5 giây cho kiểm tra nhanh
      });
      return response.data?.alive === true;
    } catch {
      return false;
    }
  },

  // ════════════════════════════════════════
  // QUẢN LÝ PHỤ ĐỀ (SUBTITLES)
  // ════════════════════════════════════════

  /**
   * Tải tệp tin phụ đề lên máy chủ video cho một tập phim cụ thể.
   *
   * @param {FormData} formData - Dữ liệu chứa tệp tin và thông tin định danh (episodeId, language, ...)
   * @returns {Promise<Object>} Kết quả tải lên
   */
  async uploadSubtitle(formData) {
    try {
      const response = await videoServerClient.post(
        "/api/v1/subtitles/upload",
        formData,
        {
          headers: {
            ...(typeof formData.getHeaders === "function"
              ? formData.getHeaders()
              : { "Content-Type": "multipart/form-data" }),
          },
          timeout: 30000,
        },
      );
      return response.data;
    } catch (error) {
      logger.error(`[VideoServerClient] Lỗi khi tải phụ đề lên Video Server: ${error.message}`);
      throw error;
    }
  },

  /**
   * Lấy danh sách toàn bộ các tệp phụ đề hiện có của một tập phim.
   *
   * @param {string} episodeId - ID tập phim
   * @param {string} movieId - ID bộ phim (để xác định thư mục lưu trữ)
   * @returns {Promise<Object>} Danh sách thông tin phụ đề
   */
  async listSubtitles(episodeId, movieId) {
    try {
      const response = await videoServerClient.get(
        `/api/v1/subtitles/${episodeId}`,
        {
          params: { movieId },
        },
      );
      return response.data;
    } catch (error) {
      logger.error(`[VideoServerClient] Lỗi khi lấy danh sách phụ đề cho tập ${episodeId}: ${error.message}`);
      throw error;
    }
  },

  /**
   * Xóa vĩnh viễn một tệp phụ đề cụ thể trên máy chủ video.
   *
   * @param {string} episodeId - ID tập phim
   * @param {string} language - Mã ngôn ngữ của phụ đề cần xóa
   * @param {string} movieId - ID bộ phim
   * @returns {Promise<Object>} Kết quả xử lý xóa
   */
  async deleteSubtitle(episodeId, language, movieId) {
    try {
      const response = await videoServerClient.delete(
        `/api/v1/subtitles/${episodeId}/${language}`,
        {
          params: { movieId },
        },
      );
      return response.data;
    } catch (error) {
      logger.error(
        `[VideoServerClient] Lỗi khi xóa phụ đề (${language}) cho tập ${episodeId}: ${error.message}`,
      );
      throw error;
    }
  },
};

export default videoServerService;

