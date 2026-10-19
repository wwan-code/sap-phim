/**
 * @file index.js
 * @module Admin
 * @description Barrel export tập trung cho toàn bộ module Admin (Layouts, Header, Sidebar, Stores, Router Manifest, Sub-domain Modules).
 */

export { AdminLayout } from './layout/AdminLayout';
export { AdminSidebar } from './layout/sidebar/AdminSidebar';
export { AdminHeader } from './layout/header/AdminHeader';
export { AdminHeaderProvider, useAdminHeader, useAdminPageHeader } from './layout/header/context/admin-header.context';
export { useAdminUIStore } from './store/use-admin-ui-store';
export { useAdminNavigation } from './shared/hooks/use-admin-navigation';
export {
  adminRoutes,
  ADMIN_ROUTE_CONFIGS,
  ADMIN_NAV_SECTIONS,
  buildAdminRoutes,
  buildAdminNavigation,
  adminModuleMap,
  prefetchAdminRoute,
} from './router/admin-routes';
