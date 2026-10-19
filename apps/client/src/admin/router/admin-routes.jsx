/**
 * @file admin-routes.jsx
 * @module Admin/Router/AdminRoutes
 * @description Export danh sách adminRoutes cho React Router v7 Data Router và công cụ prefetch module, xây dựng tự động từ SSOT Manifest (admin-routes.config.js).
 */

import {
  ADMIN_ROUTE_CONFIGS,
  ADMIN_NAV_SECTIONS,
  buildAdminRoutes,
  buildAdminNavigation,
  adminModuleMap,
  prefetchAdminRoute,
} from './admin-routes.config';

/**
 * Danh sách routes con bên trong nhánh /admin (sinh tự động từ SSOT Manifest)
 */
export const adminRoutes = buildAdminRoutes(ADMIN_ROUTE_CONFIGS);

export {
  ADMIN_ROUTE_CONFIGS,
  ADMIN_NAV_SECTIONS,
  buildAdminRoutes,
  buildAdminNavigation,
  adminModuleMap,
  prefetchAdminRoute,
};

export default adminRoutes;
