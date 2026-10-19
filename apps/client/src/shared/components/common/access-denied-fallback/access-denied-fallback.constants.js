/**
 * @file access-denied-fallback.constants.js
 * @module Components/Common/AccessDeniedFallback/AccessDeniedFallbackConstants
 * @description Định nghĩa các cấu hình dữ liệu tĩnh (thông tin gói nâng cấp theo vai trò & framer-motion variants) cho AccessDeniedFallback.
 */

/** Thông tin nâng cấp theo vai trò */
export const UPGRADE_INFO_MAP = Object.freeze({
  premium_user: {
    title: 'Nâng cấp Premium',
    subtitle: 'Trải nghiệm điện ảnh đỉnh cao không giới hạn',
    benefits: [
      'Xem phim chất lượng 4K / Full HD không quảng cáo',
      'Tạo bộ sưu tập Phim & Danh sách xem không giới hạn',
      'Tải phim về máy xem ngoại tuyến mượt mà',
      'Ưu tiên băng thông máy chủ tốc độ cao',
    ],
  },
  vip_member: {
    title: 'Hội viên VIP',
    subtitle: 'Đặc quyền trải nghiệm điện ảnh độc quyền và sớm nhất',
    benefits: [
      'Bao gồm toàn bộ đặc quyền Premium cao cấp',
      'Xem sớm các tập phim mới phát hành trước 48 giờ',
      'Huy hiệu VIP nổi bật trên hồ sơ và bình luận',
      'Hỗ trợ ưu tiên chuyên biệt 24/7',
    ],
  },
  admin: {
    title: 'Khu vực quản trị',
    subtitle: 'Chức năng này chỉ dành riêng cho Quản trị viên (Admin)',
    benefits: [],
  },
  moderator: {
    title: 'Khu vực kiểm duyệt',
    subtitle: 'Chức năng này chỉ dành riêng cho Kiểm duyệt viên (Moderator)',
    benefits: [],
  },
});

/**
 * Cấu hình animation Framer Motion (Material 3 Expressive Easing).
 */
export const ANIMATION = Object.freeze({
  container: {
    initial: { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.35, ease: [0.32, 0.72, 0, 1] },
  },
  icon: {
    initial: { scale: 0.8, opacity: 0 },
    animate: { scale: 1, opacity: 1 },
    transition: { delay: 0.1, duration: 0.3, ease: [0.34, 1.56, 0.64, 1] },
  },
  benefits: {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    transition: { delay: 0.2, duration: 0.3 },
  },
});

/**
 * Tạo animation config cho từng benefit item theo index
 * @param {number} index - Vị trí của item trong danh sách
 * @returns {object} Framer Motion variant props
 */
export const getBenefitAnimation = (index) => ({
  initial: { opacity: 0, x: -8 },
  animate: { opacity: 1, x: 0 },
  transition: { delay: 0.25 + index * 0.06, duration: 0.25 },
});
