/**
 * @file AdminLayout.jsx
 * @module Admin/Layout/AdminLayout
 * @description Master layout quản trị với sidebar thích ứng, header, hỗ trợ truy cập và thanh tải chuyển trang tăng dần.
 */

import React, { useEffect, useCallback, useRef, memo } from 'react';
import { Outlet, useLocation } from 'react-router-dom';

import { useDeviceType } from '@/hooks/ui/use-device-type';
import { useLockBodyScroll } from '@/hooks/ui/use-lock-body-scroll';
import { useAdminUIStore } from '@/admin/store/use-admin-ui-store';
import AdminSeo from '@/admin/shared/components/seo/AdminSeo';
import JobProgressWidget from '@/admin/shared/components/widgets/job-progress-widget/JobProgressWidget';
import { WIDGET_VARIANTS } from '@/admin/shared/components/widgets/job-progress-widget/job-progress-widget.constants';

import TopLoadingBar from './components/TopLoadingBar';
import { useAdminPageLoading } from './hooks/use-admin-page-loading';
import AdminSidebar from './sidebar/AdminSidebar';
import AdminHeader from './header/AdminHeader';
import { AdminHeaderProvider } from './header/context/admin-header.context';

import './admin-layout.scss';

/**
 * @component AdminLayout
 * @description Master Layout Container cho Admin Portal (Dumb UI)
 */
export const AdminLayout = memo(() => {
  const { isMobileSidebarOpen, setMobileSidebarOpen } = useAdminUIStore();
  const location = useLocation();
  const isNavigating = useAdminPageLoading();
  const { isMobile, isTabletPortrait, isTabletLandscape, isDesktop } = useDeviceType();

  // 1. Phân tầng Responsive 4 cấp độ:
  // - Mobile (< 768px) & Tablet Portrait (768px - 1023px): Slide-out Drawer (280px + Backdrop)
  // - Tablet Landscape (1024px - 1279px): Adaptive Navigation Rail (76px + Flyout)
  // - Desktop & Ultrawide (>= 1280px): Docked Collapsible Sidebar (270px / 76px)
  const isDrawerMode = isMobile || isTabletPortrait;
  const isRailMode = isTabletLandscape;
  const isDesktopMode = isDesktop;

  const mainContentRef = useRef(null);

  // 2. Tự động đóng Drawer khi người dùng chuyển trang
  useEffect(() => {
    if (isDrawerMode && isMobileSidebarOpen) {
      setMobileSidebarOpen(false);
    }
  }, [location.pathname, isDrawerMode, setMobileSidebarOpen]);

  // 3. Khóa cuộn trang (Body Scroll Lock) khi Drawer đang mở
  useLockBodyScroll(isDrawerMode && isMobileSidebarOpen);

  // 4. Xử lý phím tắt ESC đóng Drawer khi đang mở
  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Escape' && isDrawerMode && isMobileSidebarOpen) {
        e.preventDefault();
        setMobileSidebarOpen(false);
      }
    },
    [isDrawerMode, isMobileSidebarOpen, setMobileSidebarOpen]
  );

  useEffect(() => {
    if (isDrawerMode && isMobileSidebarOpen) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isDrawerMode, isMobileSidebarOpen, handleKeyDown]);

  const handleCloseDrawer = useCallback(() => {
    setMobileSidebarOpen(false);
  }, [setMobileSidebarOpen]);

  return (
    <AdminHeaderProvider>
      {/* Dynamic SEO Head Title & Robots for Admin Pages */}
      <AdminSeo />

      <div className='admin-layout'>
        {/* 0. Invisible Interface A11y Skip Link */}
        <a href='#admin-main-content' className='admin-layout__skip-link'>
          Chuyển đến nội dung chính
        </a>

        {/* Thanh tải gọn nhẹ, phản hồi cả lúc gửi biểu mẫu và chuyển trang. */}
        <TopLoadingBar isNavigating={isNavigating} />

        {/* 2. Mobile & Tablet Portrait Backdrop Overlay (< 1024px) */}
        {isDrawerMode && isMobileSidebarOpen && (
          <div
            className='admin-layout__backdrop'
            onClick={handleCloseDrawer}
            role='presentation'
            aria-hidden='true'
          />
        )}

        {/* 3. Master Sidebar Container */}
        <div
          className={
            'admin-layout__sidebar-wrapper ' +
            (isDrawerMode ? 'admin-layout__sidebar-wrapper--drawer ' : '') +
            (isRailMode ? 'admin-layout__sidebar-wrapper--rail ' : '') +
            (isDesktopMode ? 'admin-layout__sidebar-wrapper--desktop ' : '') +
            (isDrawerMode && isMobileSidebarOpen ? 'admin-layout__sidebar-wrapper--mobile-open' : '')
          }
        >
          <AdminSidebar
            isDrawerMode={isDrawerMode}
            isRailMode={isRailMode}
            isDesktopMode={isDesktopMode}
          />
        </div>

        {/* 4. Main Content Area */}
        <div className='admin-layout__main'>
          <AdminHeader
            isDrawerMode={isDrawerMode}
            isRailMode={isRailMode}
            onToggleMobileSidebar={() => setMobileSidebarOpen(!isMobileSidebarOpen)}
          />

          <main
            ref={mainContentRef}
            className='admin-layout__content'
            id='admin-main-content'
            role='main'
            tabIndex={-1}
            aria-label='Nội dung quản trị'
            aria-busy={isNavigating}
          >
            <div className='admin-layout__content-inner'>
              <Outlet />
            </div>
          </main>
        </div>

        {/* 5. Realtime Persistent Background Job Monitor Widget */}
        <JobProgressWidget variant={WIDGET_VARIANTS.FLOATING} />
      </div>
    </AdminHeaderProvider>
  );
});

AdminLayout.displayName = 'AdminLayout';

export default AdminLayout;
