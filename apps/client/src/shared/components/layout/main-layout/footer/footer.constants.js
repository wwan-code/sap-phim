/**
 * @file footer.constants.js
 * @module Components/Layout/Footer/Constants
 * @description Định nghĩa các hằng số liên kết điều hướng, mạng xã hội và thông tin SEO cho Footer.
 */

import { ROUTES } from '@/shared/constants/routes.constants';

/**
 * Danh sách liên kết điều hướng chính trong Footer
 */
export const FOOTER_NAV_LINKS = [
  { label: 'Trang chủ', to: ROUTES.HOME },
  { label: 'Phim lẻ', to: `${ROUTES.CATALOG}?type=single` },
  { label: 'Phim bộ', to: `${ROUTES.CATALOG}?type=series` },
  { label: 'Mới cập nhật', to: `${ROUTES.CATALOG}?sort=latest` },
  { label: 'Bảng xếp hạng', to: `${ROUTES.CATALOG}?sort=views` },
  { label: 'Lịch chiếu phim', to: `${ROUTES.CATALOG}?sort=schedule` },
  { label: 'VIP Đặc quyền', to: ROUTES.VIP },
  { label: 'Điều khoản sử dụng', to: '/terms' },
  { label: 'Chính sách bảo mật', to: '/privacy' },
];

/**
 * Danh sách mạng xã hội và kênh cộng đồng
 */
export const FOOTER_SOCIAL_LINKS = [
  {
    id: 'facebook',
    label: 'Theo dõi Facebook Sạp Phim',
    href: 'https://facebook.com',
    iconType: 'facebook',
  },
  {
    id: 'twitter',
    label: 'Theo dõi Twitter / X Sạp Phim',
    href: 'https://twitter.com',
    iconType: 'twitter',
  },
  {
    id: 'discord',
    label: 'Tham gia Discord Cộng đồng Sạp Phim',
    href: 'https://discord.gg',
    iconType: 'discord',
  },
  {
    id: 'youtube',
    label: 'Kênh YouTube Sạp Phim Trailer',
    href: 'https://youtube.com',
    iconType: 'youtube',
  },
];

/**
 * Lời mô tả chân trang tối ưu SEO
 * @param {number} year - Năm hiện tại
 * @returns {string} Đoạn văn bản giới thiệu
 */
export const getFooterDescription = (year) =>
  `Sạp Phim - Nền tảng xem phim & anime online chất lượng cao miễn phí Vietsub, thuyết minh, lồng tiếng Full HD và 4K. Kho phim đồ sộ, cập nhật tập mới nhanh nhất từng phút từ Nhật Bản, Hàn Quốc, Trung Quốc, Âu Mỹ... Trải nghiệm xem phim mượt mà và sống động ${year}!`;
