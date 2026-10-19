/**
 * @file HeaderActions.jsx
 * @module Components/Layout/Header/Components/HeaderActions
 * @component HeaderActions
 * @description Subcomponent nhóm các nút bấm hành động trên Header (tìm kiếm tablet, CTA tải app, thông báo, tài khoản, theme toggle và hamburger drawer).
 */

import React, { lazy, memo, Suspense, useCallback } from 'react';
import PropTypes from 'prop-types';
import { Download, Menu, Moon, Sun, User, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import Avatar from '@/shared/components/ui/avatar/Avatar';
import Button from '@/shared/components/ui/button/Button';
import IconButton from '@/shared/components/ui/icon-button/IconButton';
import { ROUTES } from '@/shared/constants/routes.constants';

import HeaderSearch from './HeaderSearch';
import HeaderNotifications from './HeaderNotifications';

const HeaderAccountMenu = lazy(() => import('./HeaderAccountMenu'));

/**
 * @component HeaderActions
 * @description Nhóm các nút tác vụ phía bên phải của Header
 */
const HeaderActions = memo(({
  user,
  isAuthenticated,
  isAdmin,
  resolvedTheme,
  toggleTheme,
  isMobile,
  isTablet,
  isDesktop,
  accountMenuOpen,
  onOpenAccountMenu,
  onCloseAccountMenu,
  notifications,
  unreadNotificationCount,
  notificationsLoading,
  notificationsOpen,
  onOpenNotifications,
  onCloseNotifications,
  onMarkAllNotificationsRead,
  onLogout,
  toggleMobileDrawer,
  mobileDrawerOpen,
}) => {
  const navigate = useNavigate();

  const handleMemberClick = useCallback(() => {
    navigate(ROUTES.LOGIN);
  }, [navigate]);

  return (
    <div className="app-header__actions">
      {isTablet && !isMobile && <HeaderSearch compact />}

      {isAuthenticated && (
        <HeaderNotifications
          notifications={notifications}
          unreadCount={unreadNotificationCount}
          isLoading={notificationsLoading}
          isOpen={notificationsOpen}
          onOpen={onOpenNotifications}
          onClose={onCloseNotifications}
          onMarkAllRead={onMarkAllNotificationsRead}
        />
      )}

      <IconButton
        variant="tonal"
        size="medium"
        onClick={toggleTheme}
        aria-label={resolvedTheme === 'dark' ? 'Chuyển sang Giao diện Sáng' : 'Chuyển sang Giao diện Tối'}
        className="app-header__action-btn app-header__theme-toggle"
      >
        {resolvedTheme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
      </IconButton>

      {isDesktop && <div className="app-header__divider" />}

      <div className="app-header__auth-container">
        {isAuthenticated ? (
          <Suspense
            fallback={
              <div className="app-header__profile-trigger-wrapper">
                <button type="button" className="app-header__profile-trigger" aria-label="Menu tài khoản">
                  <Avatar
                    src={user?.avatar_url}
                    name={user?.displayName || user?.username}
                    size="md"
                  />
                </button>
              </div>
            }
          >
            <HeaderAccountMenu
              user={user}
              isAdmin={isAdmin}
              isOpen={accountMenuOpen}
              onOpen={onOpenAccountMenu}
              onClose={onCloseAccountMenu}
              onLogout={onLogout}
            />
          </Suspense>
        ) : isMobile ? (
          <IconButton
            variant="filled"
            color="primary"
            size="medium"
            className="app-header__member-btn"
            onClick={handleMemberClick}
            aria-label="Đăng nhập tài khoản"
          >
            <User size={18} />
          </IconButton>
        ) : (
          <Button
            variant="filled"
            color="primary"
            size="medium"
            className="app-header__member-btn"
            onClick={handleMemberClick}
            startIcon={<User size={16} />}
          >
            Thành viên
          </Button>
        )}
      </div>

      {isTablet && (
        <IconButton
          variant="tonal"
          size="medium"
          onClick={toggleMobileDrawer}
          aria-label={mobileDrawerOpen ? 'Đóng menu điều hướng' : 'Mở menu điều hướng'}
          aria-expanded={mobileDrawerOpen}
          className="app-header__action-btn app-header__hamburger-btn"
        >
          {mobileDrawerOpen ? <X size={20} /> : <Menu size={20} />}
        </IconButton>
      )}
    </div>
  );
});

HeaderActions.displayName = 'HeaderActions';

HeaderActions.propTypes = {
  user: PropTypes.object,
  isAuthenticated: PropTypes.bool.isRequired,
  isAdmin: PropTypes.bool.isRequired,
  resolvedTheme: PropTypes.oneOf(['light', 'dark']).isRequired,
  toggleTheme: PropTypes.func.isRequired,
  isMobile: PropTypes.bool.isRequired,
  isTablet: PropTypes.bool.isRequired,
  isDesktop: PropTypes.bool.isRequired,
  accountMenuOpen: PropTypes.bool.isRequired,
  onOpenAccountMenu: PropTypes.func.isRequired,
  onCloseAccountMenu: PropTypes.func.isRequired,
  notifications: PropTypes.array,
  unreadNotificationCount: PropTypes.number,
  notificationsLoading: PropTypes.bool,
  notificationsOpen: PropTypes.bool.isRequired,
  onOpenNotifications: PropTypes.func.isRequired,
  onCloseNotifications: PropTypes.func.isRequired,
  onMarkAllNotificationsRead: PropTypes.func,
  onLogout: PropTypes.func.isRequired,
  toggleMobileDrawer: PropTypes.func.isRequired,
  mobileDrawerOpen: PropTypes.bool.isRequired,
};

export default HeaderActions;