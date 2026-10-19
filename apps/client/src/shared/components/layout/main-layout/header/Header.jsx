/**
 * @file Header.jsx
 * @module Components/Layout/Header/Header
 * @component Header
 * @description Component Header chính lắp ráp các subcomponents (Logo, Nav, Search, Actions, MobileDrawer) theo chuẩn Material 3 Expressive.
 */

import React, { memo } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';

import { useDeviceType } from '@/hooks/ui/use-device-type';
import { useTheme } from '@/shared/contexts/ThemeContext';
import { useAuth } from '@/hooks/use-auth';

import HeaderActions from './components/HeaderActions';
import HeaderDrawer from './components/HeaderDrawer';
import HeaderLogo from './components/HeaderLogo';
import HeaderNav from './components/HeaderNav';
import HeaderSearch from './components/HeaderSearch';
import useHeaderState from './hooks/use-header-state';

import './header.scss';

/**
 * @component Header
 * @description Thanh tiêu đề chính của Sạp Phim (Anime) hỗ trợ Adaptive Solid Scroll Elevation, Dual-Theme, responsive Desktop/Tablet/Mobile.
 */
const Header = memo(({
  notifications,
  unreadNotificationCount,
  notificationsLoading,
  onMarkAllNotificationsRead,
  insetLeft = 0,
}) => {
  const { resolvedTheme, toggleTheme } = useTheme();
  const deviceInfo = useDeviceType({
    breakpoints: { mobile: 768, tablet: 1280, desktop: 1280, ultrawide: Infinity },
  });
  const { user, isAuthenticated, isAdmin, logout } = useAuth();

  const {
    isScrolled,
    scrollProgress,
    mobileDrawerOpen,
    accountMenuOpen,
    notificationsOpen,
    toggleMobileDrawer,
    closeMobileDrawer,
    openAccountMenu,
    closeAccountMenu,
    openNotifications,
    closeNotifications,
  } = useHeaderState();

  const { isMobile, isTablet, isDesktop } = deviceInfo;

  const headerClasses = classNames('app-header', {
    'app-header--scrolled': isScrolled,
    'app-header--drawer-open': mobileDrawerOpen,
  });

  const headerStyle = {
    '--header-bg-opacity': scrollProgress,
    ...(insetLeft ? { '--header-inset-left': `${insetLeft}px` } : {}),
  };

  return (
    <>
      <a href="#app-main-content" className="app-header__skip-link">
        Bỏ qua đến nội dung chính
      </a>

      <header className={headerClasses} id="app-main-header" style={headerStyle}>
        <div className="app-header__container">
          <HeaderLogo />

          {isDesktop && <HeaderSearch />}
          {isDesktop && <HeaderNav />}

          <HeaderActions
            user={user}
            isAuthenticated={isAuthenticated}
            isAdmin={isAdmin}
            resolvedTheme={resolvedTheme}
            toggleTheme={toggleTheme}
            isMobile={isMobile}
            isTablet={isTablet}
            isDesktop={isDesktop}
            accountMenuOpen={accountMenuOpen}
            onOpenAccountMenu={openAccountMenu}
            onCloseAccountMenu={closeAccountMenu}
            notifications={notifications}
            unreadNotificationCount={unreadNotificationCount}
            notificationsLoading={notificationsLoading}
            notificationsOpen={notificationsOpen}
            onOpenNotifications={openNotifications}
            onCloseNotifications={closeNotifications}
            onMarkAllNotificationsRead={onMarkAllNotificationsRead}
            onLogout={logout}
            toggleMobileDrawer={toggleMobileDrawer}
            mobileDrawerOpen={mobileDrawerOpen}
          />
        </div>
      </header>

      {isTablet && (
        <HeaderDrawer
          open={mobileDrawerOpen}
          onClose={closeMobileDrawer}
          user={user}
          isAuthenticated={isAuthenticated}
          isAdmin={isAdmin}
          onLogout={logout}
        />
      )}
    </>
  );
});

Header.displayName = 'Header';

Header.propTypes = {
  /** Danh sách thông báo người dùng */
  notifications: PropTypes.array,
  /** Số lượng thông báo chưa đọc */
  unreadNotificationCount: PropTypes.number,
  /** Trạng thái đang tải thông báo */
  notificationsLoading: PropTypes.bool,
  /** Handler đánh dấu tất cả thông báo đã đọc */
  onMarkAllNotificationsRead: PropTypes.func,
  /** Khoảng cách lùi vào từ bên trái (khi có sidebar) */
  insetLeft: PropTypes.number,
};

export default Header;