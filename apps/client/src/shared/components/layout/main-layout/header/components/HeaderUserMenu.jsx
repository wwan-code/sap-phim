/**
 * @file HeaderUserMenu.jsx
 * @module Components/Layout/Header/Components/HeaderUserMenu
 * @component HeaderUserMenu
 * @description Subcomponent menu dropdown thông tin và lối tắt cá nhân của người dùng sau khi đăng nhập theo chuẩn Material 3.
 */

import React, { memo } from 'react';
import { Link } from 'react-router-dom';
import PropTypes from 'prop-types';
import { LayoutDashboard, User, Wallet, Crown, LogOut } from 'lucide-react';

import Avatar from '@/shared/components/ui/avatar/Avatar';
import { ROUTES } from '@/shared/constants/routes.constants';

/**
 * @component HeaderUserMenu
 * @description Dropdown hiển thị thông tin tài khoản và danh sách tác vụ người dùng
 */
const HeaderUserMenu = memo(({ user, isAdmin, onLogout, dropdown, onClose }) => {
  const {
    isMounted,
    floatingStyles,
    refs,
    context,
    getFloatingProps,
    FloatingPortal,
    FloatingFocusManager,
    portalId,
    focusTrap,
  } = dropdown;

  if (!isMounted) return null;

  const displayName = user?.displayName || user?.username || 'Thành viên';
  const email = user?.email || '';

  return (
    <FloatingPortal id={portalId}>
      <FloatingFocusManager context={context} modal={focusTrap}>
        <div
          ref={refs.setFloating}
          style={floatingStyles}
          {...getFloatingProps({
            className: 'app-header__user-dropdown',
            role: 'menu',
            'aria-label': 'Menu người dùng',
          })}
        >
          <div className="app-header__user-dropdown-header">
            <Avatar
              src={user?.avatar_url}
              name={displayName}
              alt={displayName}
              size="md"
            />
            <div className="app-header__user-dropdown-info">
              <p className="app-header__user-dropdown-name">{displayName}</p>
              {email && <p className="app-header__user-dropdown-email">{email}</p>}
            </div>
          </div>

          <div className="app-header__user-dropdown-divider" />

          <ul className="app-header__user-dropdown-list" role="none">
            {isAdmin && (
              <li role="none">
                <Link
                  to={ROUTES.ADMIN.ROOT}
                  className="app-header__user-dropdown-item app-header__user-dropdown-item--admin"
                  onClick={onClose}
                  role="menuitem"
                >
                  <LayoutDashboard size={16} className="app-header__user-dropdown-icon" />
                  <span>Quản trị hệ thống</span>
                </Link>
              </li>
            )}

            <li role="none">
              <Link
                to={ROUTES.ACCOUNT}
                className="app-header__user-dropdown-item"
                onClick={onClose}
                role="menuitem"
              >
                <User size={16} className="app-header__user-dropdown-icon" />
                <span>Tài khoản</span>
              </Link>
            </li>

            <li role="none">
              <Link
                to={ROUTES.WALLET}
                className="app-header__user-dropdown-item"
                onClick={onClose}
                role="menuitem"
              >
                <Wallet size={16} className="app-header__user-dropdown-icon" />
                <span>Ví tiền & Nạp xu</span>
              </Link>
            </li>

            <li role="none">
              <Link
                to={ROUTES.VIP}
                className="app-header__user-dropdown-item app-header__user-dropdown-item--vip"
                onClick={onClose}
                role="menuitem"
              >
                <Crown size={16} className="app-header__user-dropdown-icon" />
                <span>Gói VIP Đặc quyền</span>
              </Link>
            </li>
          </ul>

          <div className="app-header__user-dropdown-divider" />

          <div className="app-header__user-dropdown-footer">
            <button
              type="button"
              className="app-header__user-dropdown-logout-btn"
              onClick={(e) => {
                onClose();
                onLogout?.(e);
              }}
              role="menuitem"
            >
              <LogOut size={16} className="app-header__user-dropdown-icon" />
              <span>Đăng xuất</span>
            </button>
          </div>
        </div>
      </FloatingFocusManager>
    </FloatingPortal>
  );
});

HeaderUserMenu.displayName = 'HeaderUserMenu';

HeaderUserMenu.propTypes = {
  user: PropTypes.object,
  isAdmin: PropTypes.bool,
  onLogout: PropTypes.func.isRequired,
  dropdown: PropTypes.object.isRequired,
  onClose: PropTypes.func.isRequired,
};

export default HeaderUserMenu;