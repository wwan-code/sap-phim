/**
 * @file AdminSidebarBrand.jsx
 * @module Admin/Layout/Sidebar/Components/AdminSidebarBrand
 * @component AdminSidebarBrand
 * @description Subcomponent hiển thị Brand Logo, Badge quản trị, nút thu gọn/mở rộng Desktop và nút đóng Mobile drawer cho Admin Sidebar.
 */

import React, { memo } from 'react';
import PropTypes from 'prop-types';
import { NavLink } from 'react-router-dom';
import { PanelLeftClose, PanelLeftOpen, X } from 'lucide-react';

import BrandLogo from '@/shared/components/common/brand-logo/BrandLogo';
import IconButton from '@/shared/components/ui/icon-button/IconButton';
import Tooltip from '@/shared/components/ui/tooltip/Tooltip';
import { ROUTES } from '@/shared/constants/routes.constants';

/**
 * @component AdminSidebarBrand
 * @description Subcomponent logo & toggle của Admin Sidebar (Dumb UI)
 */
export const AdminSidebarBrand = memo(({
  isCollapsed = false,
  isDrawerMode = false,
  isRailMode = false,
  onToggleCollapse,
  onCloseMobile,
  onPrefetchDashboard,
}) => {
  return (
    <div className={'admin-sidebar__brand ' + (isCollapsed ? 'admin-sidebar__brand--collapsed' : '')}>
      <div className='admin-sidebar__brand-inner'>
        <NavLink
          to={ROUTES.ADMIN.DASHBOARD}
          className='admin-sidebar__logo'
          onClick={onCloseMobile}
          onMouseEnter={onPrefetchDashboard}
          onFocus={onPrefetchDashboard}
          title='Về Dashboard Quản trị'
          aria-label='Sạp Phim Admin Portal Dashboard'
        >
          {isCollapsed ? (
            <div className='admin-sidebar__logo-icon-wrap'>
              <BrandLogo variant='icon-only' width={36} height={36} />
            </div>
          ) : (
            <div className='admin-sidebar__logo-content'>
              <div className='admin-sidebar__logo-icon-wrap'>
                <BrandLogo variant='icon-only' width={34} height={34} />
              </div>
              <div className='admin-sidebar__logo-text'>
                <span className='admin-sidebar__brand-name'>SẠP PHIM</span>
                <span className='admin-sidebar__brand-badge'>ADMIN PORTAL</span>
              </div>
            </div>
          )}
        </NavLink>

        {/* Desktop Collapse Toggle Button (Hidden on Drawer and Rail modes) */}
        {onToggleCollapse && !isDrawerMode && !isRailMode && (
          <Tooltip title={isCollapsed ? 'Mở thanh bên' : 'Đóng thanh bên'} placement='right'>
            <IconButton
              size='small'
              variant='standard'
              className={'admin-sidebar__collapse-btn ' + (isCollapsed ? 'admin-sidebar__collapse-btn--collapsed' : '')}
              onClick={onToggleCollapse}
              aria-label={isCollapsed ? 'Mở thanh điều hướng' : 'Đóng thanh điều hướng'}
            >
              {isCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
            </IconButton>
          </Tooltip>
        )}
      </div>

      {/* Mobile Drawer Close Button */}
      {onCloseMobile && isDrawerMode && (
        <IconButton
          size='medium'
          variant='standard'
          className='admin-sidebar__mobile-close-btn'
          onClick={onCloseMobile}
          aria-label='Đóng menu điều hướng'
        >
          <X size={20} />
        </IconButton>
      )}
    </div>
  );
});

AdminSidebarBrand.displayName = 'AdminSidebarBrand';

AdminSidebarBrand.propTypes = {
  isCollapsed: PropTypes.bool,
  isDrawerMode: PropTypes.bool,
  isRailMode: PropTypes.bool,
  onToggleCollapse: PropTypes.func,
  onCloseMobile: PropTypes.func,
  onPrefetchDashboard: PropTypes.func,
};

export default AdminSidebarBrand;
