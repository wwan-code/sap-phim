/**
 * @file AdminHeaderUserMenu.jsx
 * @module Admin/Layout/Header/Components/AdminHeaderUserMenu
 * @component AdminHeaderUserMenu
 * @description Subcomponent avatar trigger (sử dụng Avatar chuẩn) và Dropdown Menu quản trị viên (Profile, Settings, Về trang chủ, Đăng xuất) chuẩn Material 3 Expressive.
 */

import React, { memo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import PropTypes from 'prop-types';
import { User, Settings, Globe, LogOut } from 'lucide-react';

import Avatar from '@/shared/components/ui/avatar/Avatar';
import { ROUTES } from '@/shared/constants/routes.constants';
import { useFloatingDropdown } from '@/hooks/ui/use-floating-dropdown';

/**
 * @component AdminHeaderUserMenu
 * @description Avatar trigger với dropdown menu qua FloatingPortal (Dumb UI)
 */
const AdminHeaderUserMenu = ({ user, onLogout }) => {
  const dropdown = useFloatingDropdown({
    placement: 'bottom-end',
    offset: 8,
    trigger: 'click',
    adaptToDevice: false,
    usePortal: true,
  });

  const {
    isOpen,
    isMounted,
    refs,
    context,
    floatingStyles,
    getReferenceProps,
    getFloatingProps,
    setIsOpen,
    FloatingPortal,
    FloatingFocusManager,
    portalId,
    focusTrap,
  } = dropdown;

  const displayName = user?.fullName || user?.username || 'Quản trị viên';
  const email = user?.email || 'admin@sapphim.vn';
  const avatarUrl = user?.avatar_url || user?.avatar;

  const handleMenuAction = useCallback(
    (callback) => {
      setIsOpen(false);
      callback?.();
    },
    [setIsOpen]
  );

  return (
    <div className='admin-header__user-menu-wrapper'>
      {/* Avatar Trigger */}
      <button
        ref={refs.setReference}
        {...getReferenceProps()}
        className={'admin-header__avatar-trigger ' + (isOpen ? 'admin-header__avatar-trigger--active' : '')}
        aria-label='Mở menu tài khoản quản trị'
        aria-expanded={isOpen}
        aria-haspopup='true'
        type='button'
      >
        <Avatar
          src={avatarUrl}
          name={displayName}
          size='sm'
          status='online'
          className='admin-header__user-avatar-comp'
        />
      </button>

      {/* Dropdown Menu */}
      {isMounted && (
        <FloatingPortal id={portalId}>
          <FloatingFocusManager context={context} modal={focusTrap}>
            <div
              ref={refs.setFloating}
              style={{
                ...floatingStyles,
                width: 270,
              }}
              {...getFloatingProps({
                className: 'admin-header__dropdown admin-header__user-dropdown',
                role: 'menu',
                'aria-label': 'Menu tài khoản',
              })}
            >
              {/* User Info Header */}
              <div className='admin-header__user-dropdown-header'>
                <Avatar
                  src={avatarUrl}
                  name={displayName}
                  size='md'
                  status='online'
                />
                <div className='admin-header__user-dropdown-info'>
                  <p className='admin-header__user-dropdown-name'>{displayName}</p>
                  {email && <p className='admin-header__user-dropdown-email'>{email}</p>}
                </div>
              </div>

              <div className='admin-header__dropdown-divider' aria-hidden='true' />

              {/* Menu Items */}
              <ul className='admin-header__user-dropdown-list' role='none'>
                <li role='none'>
                  <Link
                    to={ROUTES.ACCOUNT}
                    className='admin-header__user-dropdown-item'
                    role='menuitem'
                    onClick={() => setIsOpen(false)}
                  >
                    <User size={16} aria-hidden='true' />
                    <span>Tài khoản cá nhân</span>
                  </Link>
                </li>
                <li role='none'>
                  <Link
                    to={ROUTES.ADMIN.SETTINGS}
                    className='admin-header__user-dropdown-item'
                    role='menuitem'
                    onClick={() => setIsOpen(false)}
                  >
                    <Settings size={16} aria-hidden='true' />
                    <span>Cài đặt hệ thống</span>
                  </Link>
                </li>
                <li role='none'>
                  <Link
                    to={ROUTES.HOME}
                    className='admin-header__user-dropdown-item'
                    role='menuitem'
                    target='_blank'
                    rel='noreferrer'
                    onClick={() => setIsOpen(false)}
                  >
                    <Globe size={16} aria-hidden='true' />
                    <span>Về trang chủ Sạp Phim</span>
                  </Link>
                </li>
              </ul>

              <div className='admin-header__dropdown-divider' aria-hidden='true' />

              {/* Logout Button */}
              <div className='admin-header__user-dropdown-footer'>
                <button
                  className='admin-header__user-dropdown-logout'
                  role='menuitem'
                  type='button'
                  onClick={() => handleMenuAction(onLogout)}
                >
                  <LogOut size={16} aria-hidden='true' />
                  <span>Đăng xuất</span>
                </button>
              </div>
            </div>
          </FloatingFocusManager>
        </FloatingPortal>
      )}
    </div>
  );
};

AdminHeaderUserMenu.displayName = 'AdminHeaderUserMenu';

AdminHeaderUserMenu.propTypes = {
  user: PropTypes.shape({
    fullName: PropTypes.string,
    username: PropTypes.string,
    email: PropTypes.string,
    avatar_url: PropTypes.string,
    avatar: PropTypes.string,
  }),
  onLogout: PropTypes.func.isRequired,
};

export default memo(AdminHeaderUserMenu);
