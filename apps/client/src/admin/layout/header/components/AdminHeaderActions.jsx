/**
 * @file AdminHeaderActions.jsx
 * @module Admin/Layout/Header/Components/AdminHeaderActions
 * @component AdminHeaderActions
 * @description Subcomponent nhóm các nút hành động phía bên phải của Admin Header (Quick Create, Tablet Search, Theme Switcher, Notifications, User Menu) chuẩn Material 3 Expressive.
 */

import React, { memo } from 'react';
import PropTypes from 'prop-types';
import { Search, Sun, Moon } from 'lucide-react';

import Button from '@/shared/components/ui/button/Button';
import IconButton from '@/shared/components/ui/icon-button/IconButton';
import Tooltip from '@/shared/components/ui/tooltip/Tooltip';
import { useAdminHeaderContext } from '../context/admin-header.context';
import AdminHeaderQuickCreate from './AdminHeaderQuickCreate';
import AdminHeaderNotifications from './AdminHeaderNotifications';
import AdminHeaderUserMenu from './AdminHeaderUserMenu';

/**
 * @component AdminHeaderActions
 * @description Nhóm nút hành động bên phải Header (Dumb UI)
 */
const AdminHeaderActions = ({
  user,
  resolvedTheme,
  toggleTheme,
  onToggleSearch,
  onLogout,
}) => {
  const { headerConfig } = useAdminHeaderContext();
  const isDark = resolvedTheme === 'dark';

  return (
    <div className='admin-header__actions'>
      {/* 1. Primary Action Button or Quick Create Dropdown */}
      {headerConfig?.primaryAction ? (
        <Button
          variant='filled'
          color='primary'
          size='medium'
          onClick={headerConfig.primaryAction.onClick}
          disabled={headerConfig.primaryAction.disabled}
          startIcon={headerConfig.primaryAction.icon}
          className='admin-header__primary-btn'
        >
          {headerConfig.primaryAction.label}
        </Button>
      ) : (
        <AdminHeaderQuickCreate />
      )}

      {/* 2. Tablet & Mobile Search Trigger Button */}
      <Tooltip title='Tìm kiếm nhanh (Ctrl + K / ⌘K)'>
        <IconButton
          size='medium'
          variant='tonal'
          onClick={onToggleSearch}
          aria-label='Mở tìm kiếm nhanh'
          className='admin-header__search-circle-btn'
        >
          <Search size={18} />
        </IconButton>
      </Tooltip>

      {/* 3. Theme Switcher (Dark / Light Mode) */}
      <Tooltip title={isDark ? 'Chuyển sang Chế độ Sáng' : 'Chuyển sang Chế độ Tối'}>
        <IconButton
          size='medium'
          variant='tonal'
          onClick={toggleTheme}
          aria-label='Chuyển giao diện sáng tối'
          className='admin-header__theme-btn'
        >
          {isDark ? <Sun size={18} /> : <Moon size={18} />}
        </IconButton>
      </Tooltip>

      {/* 4. Notifications Dropdown */}
      <AdminHeaderNotifications />

      {/* 5. User Profile Menu */}
      <AdminHeaderUserMenu user={user} onLogout={onLogout} />
    </div>
  );
};

AdminHeaderActions.displayName = 'AdminHeaderActions';

AdminHeaderActions.propTypes = {
  user: PropTypes.object,
  resolvedTheme: PropTypes.string.isRequired,
  toggleTheme: PropTypes.func.isRequired,
  onToggleSearch: PropTypes.func.isRequired,
  onLogout: PropTypes.func.isRequired,
};

export default memo(AdminHeaderActions);
