/**
 * Hằng số Tập phim (Episode Constants)
 *
 * @description Quản lý các giá trị hằng số dùng chung cho toàn bộ module Episode.
 * Hỗ trợ cấu hình nhanh các giới hạn (Limit) và thời gian sống (TTL) của khóa tải lên.
 */

// ════════════════════════════════════════
// CẤU HÌNH TẢI LÊN & XỬ LÝ (UPLOAD & PROCESSING)
// ════════════════════════════════════════

/** Thời gian sống của khóa tải lên (giây) - Mặc định 1 giờ */
export const UPLOAD_LOCK_TTL = 3600;

/** Số lần thử lại tối đa khi xử lý video thất bại */
export const MAX_RETRIES = 3;

/** Các định dạng video được hỗ trợ tải lên */
export const SUPPORTED_VIDEO_FORMATS = ["mp4", "mkv", "avi", "mov", "webm"];

/** Kích thước video tối đa cho phép (MB) - Mặc định 5GB */
export const MAX_VIDEO_SIZE_MB = 5000;

/** Kích thước video tối đa cho phép tính bằng Bytes */
export const MAX_VIDEO_SIZE_BYTES = MAX_VIDEO_SIZE_MB * 1024 * 1024;

// ════════════════════════════════════════
// TRẠNG THÁI & PHÂN LOẠI (ENUMS)
// ════════════════════════════════════════

/** Trạng thái xử lý video */
export const EPISODE_STATUS = {
  PENDING: "pending",
  UPLOADING: "uploading",
  UPLOADED: "uploaded",
  PROCESSING: "processing",
  READY: "ready",
  FAILED: "failed",
};

/** Trạng thái xuất bản tập phim */
export const PUBLISH_STATE = {
  DRAFT: "draft",
  PUBLISHED: "published",
  PRIVATE: "private",
};

// ════════════════════════════════════════
// THÔNG BÁO LỖI TIẾNG VIỆT
// ════════════════════════════════════════

export const VIETNAMESE_ERROR_MESSAGES = {
  MOVIE_NOT_FOUND: "Không tìm thấy phim",
  EPISODE_NOT_FOUND: "Không tìm thấy tập phim",
  EPISODE_EXISTS: "Tập phim này đã tồn tại",
  EPISODE_PROCESSING: "Tập phim đang được xử lý",
  MOVIE_ID_REQUIRED: "ID phim là bắt buộc",
  EPISODE_NUMBER_REQUIRED: "Số tập là bắt buộc",
  EPISODE_NUMBER_MIN: "Số tập phải lớn hơn 0",
  TITLE_MAX_LENGTH: "Tiêu đề không được vượt quá 255 ký tự",
  INVALID_FILE_FORMAT: "Định dạng file không hợp lệ",
  FILE_TOO_LARGE: "File video vượt quá kích thước cho phép",
  VIDEO_REQUIRED: "File video là bắt buộc",
  PROCESSING_FAILED: "Xử lý video thất bại",
  MAX_RETRIES_EXCEEDED: "Đã vượt quá số lần thử lại tối đa",
};