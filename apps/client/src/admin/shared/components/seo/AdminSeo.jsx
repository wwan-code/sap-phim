/**
 * @file AdminSeo.jsx
 * @module Admin/Shared/Components/Seo/AdminSeo
 * @component AdminSeo
 * @description Component quản lý thẻ meta SEO toàn cục dành riêng cho Admin Portal. Tự động ánh xạ pathname sang label từ ADMIN_ROUTE_CONFIGS (SSOT), ép cứng noindex cho trang quản trị, và hỗ trợ override tiêu đề tùy biến.
 */

import React from 'react';
import PropTypes from 'prop-types';
import { Helmet } from 'react-helmet-async';
import { useLocation } from 'react-router-dom';

import { ADMIN_ROUTE_CONFIGS } from '@/admin/router/admin-routes.config';

const SITE_ADMIN_SUFFIX = 'Admin – Sạp Phim';

/**
 * Xây dựng flat lookup map: pathname string -> label string
 * Bao gồm: top-level, children (to), subRoutes (path động với :id)
 * @returns {Array<{pattern: RegExp|string, label: string, isDynamic: boolean}>}
 */
const buildRouteMap = () => {
  const entries = [];

  const addEntry = (pathStr, label) => {
    if (!pathStr || !label) return;
    // Route động chứa ':id' hoặc param → tạo regex
    if (pathStr.includes(':')) {
      const regexStr = pathStr.replace(/:[^/]+/g, '[^/]+');
      entries.push({ pattern: new RegExp(`^${regexStr}$`), label, isDynamic: true });
    } else {
      entries.push({ pattern: pathStr, label, isDynamic: false });
    }
  };

  ADMIN_ROUTE_CONFIGS.forEach((config) => {
    // Top-level (path + label)
    if (config.path) addEntry(config.path, config.label);

    // Children (to/path + label)
    if (Array.isArray(config.children)) {
      config.children.forEach((child) => {
        const p = child.to || child.path;
        if (p) addEntry(p, child.label);
      });
    }

    // SubRoutes động (path có :id, lấy label từ parent + "Chỉnh sửa" / "Chi tiết")
    if (Array.isArray(config.subRoutes)) {
      config.subRoutes.forEach((sub) => {
        if (!sub.path) return;
        let subLabel = config.label;
        if (sub.path.includes('edit')) subLabel = `Chỉnh sửa ${config.label || 'nội dung'}`;
        else if (sub.path.includes('detail')) subLabel = `Chi tiết ${config.label || 'nội dung'}`;
        else if (sub.path.includes('create')) subLabel = `Thêm ${config.label || 'mới'}`;
        addEntry(sub.path, subLabel);
      });
    }
  });

  return entries;
};

const ROUTE_MAP = buildRouteMap();

/**
 * Tìm label phù hợp với pathname hiện tại.
 * Ưu tiên: exact match trước, dynamic match sau.
 * @param {string} pathname
 * @returns {string|null}
 */
const resolveLabel = (pathname) => {
  if (!pathname) return null;

  // 1. Exact match (static routes)
  const exact = ROUTE_MAP.find((e) => !e.isDynamic && e.pattern === pathname);
  if (exact) return exact.label;

  // 2. Dynamic match (regex routes), dùng pattern dài nhất (most specific)
  const dynamicMatches = ROUTE_MAP.filter(
    (e) => e.isDynamic && e.pattern.test(pathname)
  );
  if (dynamicMatches.length > 0) {
    dynamicMatches.sort((a, b) => b.pattern.source.length - a.pattern.source.length);
    return dynamicMatches[0].label;
  }

  return null;
};

/**
 * @component AdminSeo
 * @description Đặt trong AdminLayout — tự động sinh title theo route, cứng noindex. Có thể override bằng props `title` khi cần.
 */
export const AdminSeo = ({ title }) => {
  const { pathname } = useLocation();

  const dynamicLabel = resolveLabel(pathname);
  const activeTitle = title || dynamicLabel;
  const pageTitle = activeTitle ? `${activeTitle} | ${SITE_ADMIN_SUFFIX}` : SITE_ADMIN_SUFFIX;

  return (
    <Helmet>
      <title>{pageTitle}</title>
      <meta name="robots" content="noindex,nofollow" />
    </Helmet>
  );
};

AdminSeo.propTypes = {
  /** Tiêu đề trang tùy chỉnh (nếu không truyền, tự động nhận diện theo pathname) */
  title: PropTypes.string,
};

AdminSeo.displayName = 'AdminSeo';

export default AdminSeo;
