/**
 * @file header-nav.constants.js
 * @module Components/Layout/Header/Constants/HeaderNavConstants
 * @description Dữ liệu tĩnh và helper functions điều hướng dùng chung cho HeaderNav (desktop) và HeaderDrawer (mobile/tablet).
 */

import { ROUTES } from '@/shared/constants/routes.constants';

export const HEADER_GENRES = [
  { name: 'Hành động', slug: 'action' },
  { name: 'Tình cảm', slug: 'romance' },
  { name: 'Hài hước', slug: 'comedy' },
  { name: 'Kỳ ảo', slug: 'fantasy' },
  { name: 'Viễn tưởng', slug: 'sci-fi' },
  { name: 'Kinh dị', slug: 'horror' },
  { name: 'Phiêu lưu', slug: 'adventure' },
  { name: 'Trinh thám', slug: 'mystery' },
].map((genre) => ({ ...genre, path: `${ROUTES.CATALOG}?genre=${genre.slug}` }));

export const HEADER_COUNTRIES = [
  { name: 'Trung Quốc', slug: 'china' },
  { name: 'Nhật Bản', slug: 'japan' },
  { name: 'Hàn Quốc', slug: 'korea' },
  { name: 'Âu Mỹ', slug: 'western' },
  { name: 'Thái Lan', slug: 'thailand' },
  { name: 'Việt Nam', slug: 'vietnam' },
].map((country) => ({ ...country, path: `${ROUTES.CATALOG}?country=${country.slug}` }));

export const HEADER_MORE_LINKS = [
  { name: 'Mới cập nhật', path: `${ROUTES.CATALOG}?sort=newest` },
  { name: 'Bảng xếp hạng', path: `${ROUTES.CATALOG}?sort=rating` },
  { name: 'Đang thịnh hành', path: `${ROUTES.CATALOG}?sort=trending` },
  { name: 'Anime mùa này', path: `${ROUTES.CATALOG}?season=spring` },
  { name: 'Lịch chiếu phim', path: `${ROUTES.CATALOG}?status=ongoing` },
  { name: 'VIP Đặc quyền', path: ROUTES.VIP },
];

/** Hai mục điều hướng cấp 1 luôn hiển thị trực tiếp trên thanh menu */
export const HEADER_PRIMARY_LINKS = [
  { name: 'Phim Lẻ', path: `${ROUTES.CATALOG}?type=movie`, matchQueryKey: 'type', matchQueryValue: 'movie' },
  { name: 'Phim Bộ', path: `${ROUTES.CATALOG}?type=series`, matchQueryKey: 'type', matchQueryValue: 'series' },
];

/**
 * Kiểm tra một link có đang "active" so với route hiện tại không.
 * So khớp cả pathname lẫn query param liên quan để tránh việc mọi link trỏ tới
 * cùng /catalog đều bị đánh dấu active cùng lúc.
 *
 * @param {string} pathname - Đường dẫn hiện tại
 * @param {URLSearchParams} searchParams - Search params hiện tại
 * @param {{ path: string }} link - Link cần kiểm tra
 * @returns {boolean}
 */
export const isHeaderLinkActive = (pathname, searchParams, link) => {
  if (!link?.path) return false;
  const [linkPath, linkQuery] = link.path.split('?');
  if (pathname !== linkPath) return false;
  if (!linkQuery) return true;

  const linkParams = new URLSearchParams(linkQuery);
  for (const [key, value] of linkParams.entries()) {
    if (searchParams.get(key) !== value) return false;
  }
  return true;
};