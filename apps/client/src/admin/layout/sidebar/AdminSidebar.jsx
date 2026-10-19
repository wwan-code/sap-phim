/**
 * @file AdminSidebar.jsx
 * @module Admin/Layout/Sidebar/AdminSidebar
 * @component AdminSidebar
 * @description Master Sidebar component cho Admin Portal theo chuẩn The Aesthetic OS & Material 3 Expressive, kết nối SSOT Navigation Manifest thông qua hook useAdminNavigation, hỗ trợ 4 tầng Responsive (Drawer trên Mobile/Tablet Portrait, Rail trên Tablet Landscape, Docked trên Desktop).
 */

import React, { memo, useCallback } from 'react';
import PropTypes from 'prop-types';
import { useSelector } from 'react-redux';

import { selectCurrentUser, selectPrimaryRole } from '@/store/slices/auth.slice';
import { useAdminUIStore } from '@/admin/store/use-admin-ui-store';
import { useAdminNavigation } from '@/admin/shared/hooks/use-admin-navigation';
import { ROUTES } from '@/shared/constants/routes.constants';

import AdminSidebarBrand from './components/AdminSidebarBrand';
import AdminSidebarNav from './components/AdminSidebarNav';
import AdminSidebarFooter from './components/AdminSidebarFooter';

import './admin-sidebar.scss';

/**
 * @component AdminSidebar
 * @description Master Admin Sidebar Navigation Component (Dumb UI)
 */
export const AdminSidebar = memo(({
  isDrawerMode = false,
  isRailMode = false,
  isDesktopMode = true,
}) => {
  const {
    isSidebarCollapsed,
    toggleSidebar,
    isMobileSidebarOpen,
    setMobileSidebarOpen,
  } = useAdminUIStore();
  const { navigationSections, isRouteActive, prefetchRoute } = useAdminNavigation();
  const user = useSelector(selectCurrentUser);
  const primaryRole = useSelector(selectPrimaryRole);

  // 1. Xác định trạng thái effectiveCollapsed:
  // - Drawer mode (< 1024px): Luôn mở rộng 280px (false)
  // - Rail mode (1024px - 1279px): Luôn thu gọn 76px (true)
  // - Desktop mode (>= 1280px): Tuân theo isSidebarCollapsed lưu trong localStorage
  const effectiveCollapsed = isDrawerMode ? false : isRailMode ? true : isSidebarCollapsed;

  const handleCloseMobile = useCallback(() => {
    if (isDrawerMode) {
      setMobileSidebarOpen(false);
    }
  }, [isDrawerMode, setMobileSidebarOpen]);

  return (
    <aside
      className={
        'admin-sidebar ' +
        (effectiveCollapsed ? 'admin-sidebar--collapsed ' : '') +
        (isDrawerMode ? 'admin-sidebar--drawer ' : '') +
        (isRailMode ? 'admin-sidebar--rail ' : '') +
        (isDrawerMode && isMobileSidebarOpen ? 'admin-sidebar--mobile-open' : '')
      }
      aria-label='Thanh điều hướng quản trị'
      role='navigation'
    >
      {/* Header Brand & Toggles */}
      <AdminSidebarBrand
        isCollapsed={effectiveCollapsed}
        isDrawerMode={isDrawerMode}
        isRailMode={isRailMode}
        onToggleCollapse={isDesktopMode ? toggleSidebar : undefined}
        onCloseMobile={isDrawerMode ? handleCloseMobile : undefined}
        onPrefetchDashboard={() => prefetchRoute(ROUTES.ADMIN.DASHBOARD)}
      />

      {/* Navigation Sections */}
      <AdminSidebarNav
        sections={navigationSections}
        isRouteActive={isRouteActive}
        isCollapsed={effectiveCollapsed}
        onItemClick={isDrawerMode ? handleCloseMobile : undefined}
        onPrefetchRoute={prefetchRoute}
      />

      {/* Footer Profile & Client Link */}
      <AdminSidebarFooter
        user={user}
        roleName={primaryRole?.name || 'Administrator'}
        isCollapsed={effectiveCollapsed}
      />
    </aside>
  );
});

AdminSidebar.displayName = 'AdminSidebar';

AdminSidebar.propTypes = {
  isDrawerMode: PropTypes.bool,
  isRailMode: PropTypes.bool,
  isDesktopMode: PropTypes.bool,
};

export default AdminSidebar;
