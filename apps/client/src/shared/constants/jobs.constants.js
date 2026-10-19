/**
 * @file jobs.constants.js
 * @module Shared/Constants/Jobs
 * @description Hằng số trạng thái tác vụ nền (Background Jobs), stages và nhãn hiển thị dùng chung toàn hệ thống.
 */

export const JOB_STATUSES = Object.freeze({
  QUEUED:          'queued',
  PROCESSING:      'processing',
  RECONNECTING:    'reconnecting',
  COMPLETED:       'completed',
  PARTIAL_FAILURE: 'partial_failure',
  FAILED:          'failed',
  ERROR:           'error',
  CANCELLED:       'cancelled',
});

export const JOB_STATUS_VARIANTS = Object.freeze({
  [JOB_STATUSES.QUEUED]:          'info',
  [JOB_STATUSES.PROCESSING]:      'primary',
  [JOB_STATUSES.RECONNECTING]:    'warning',
  [JOB_STATUSES.COMPLETED]:       'success',
  [JOB_STATUSES.PARTIAL_FAILURE]: 'warning',
  [JOB_STATUSES.FAILED]:          'error',
  [JOB_STATUSES.ERROR]:           'error',
  [JOB_STATUSES.CANCELLED]:       'neutral',
});

export const JOB_STATUS_LABELS = Object.freeze({
  [JOB_STATUSES.QUEUED]:          'Đang chờ',
  [JOB_STATUSES.PROCESSING]:      'Đang xử lý',
  [JOB_STATUSES.RECONNECTING]:    'Đang kết nối',
  [JOB_STATUSES.COMPLETED]:       'Hoàn thành',
  [JOB_STATUSES.PARTIAL_FAILURE]: 'Lỗi một phần',
  [JOB_STATUSES.FAILED]:          'Thất bại',
  [JOB_STATUSES.ERROR]:           'Lỗi',
  [JOB_STATUSES.CANCELLED]:       'Đã hủy',
});

export const STAGE_LABELS = Object.freeze({
  upload_images:     'Tải lên hình ảnh',
  optimize_webp:     'Tối ưu hóa WebP',
  resize_images:     'Thay đổi kích thước ảnh',
  extract_metadata:  'Trích xuất siêu dữ liệu',
  generate_blurhash: 'Tạo BlurHash',
  extract_palette:   'Trích xuất bảng màu',
  cdn_sync:          'Đồng bộ CDN',
  cleanup:           'Dọn dẹp tạm thời',
  completed:         'Hoàn tất xử lý',
  failed:            'Xử lý thất bại',

  VALIDATING:        'Xác thực dữ liệu',
  CHECKING_SLUG:     'Kiểm tra đường dẫn SEO',
  SAVING_DATABASE:   'Lưu thông tin tác phẩm',
  SAVING_GENRES:     'Liên kết thể loại',
  COMMITTING:        'Đồng bộ cơ sở dữ liệu',
  PREPARING_IMAGES:  'Chuẩn bị tập tin hình ảnh',
  QUEUED:            'Đã đưa vào hàng đợi',
  ANALYZING:         'Phân tích định dạng ảnh',
  PREPROCESSING:     'Tiền xử lý hình ảnh',
  UPSCALING:         'Nâng cấp độ phân giải & Tối ưu WebP',
  STORING:           'Lưu trữ media & Tạo liên kết',
  IMAGE_START:       'Bắt đầu xử lý hình ảnh',
  IMAGE_DONE:        'Hoàn tất xử lý ảnh',

  EVIDENCE_COLLECTION:   'Thu thập dữ liệu đa nguồn',
  STARTED:               'Bắt đầu tra cứu',
  RETRYING:              'Đang chờ thử lại',
  CANCELLED:             'Đã hủy yêu cầu',
  SECONDARY_EVIDENCE_SEARCH: 'Đối chiếu thêm nguồn dữ liệu',
  LLM_REFINEMENT:        'Bổ sung kết quả từ chứng cứ mới',
  ENTITY_MATCHING:       'Đối soát thực thể cơ sở dữ liệu',
  LLM_REASONING:         'Tổng hợp & Dịch thuật AI',
  SELF_AUDIT_VALIDATION: 'Tự kiểm toán & Chấm điểm tin cậy',
  COMPLETED:             'Hoàn tất xử lý',
  FAILED:                'Xử lý thất bại',
});

export const WIDGET_VARIANTS = Object.freeze({
  CARD:     'card',
  BANNER:   'banner',
  FLOATING: 'floating',
});

export const COPY_FEEDBACK_TIMEOUT_MS = 2500;
