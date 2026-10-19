/**
 * @file HeaderAccountMenu.jsx
 * @module Components/Layout/Header/Components/HeaderAccountMenu
 * @component HeaderAccountMenu
 * @description Subcomponent avatar trigger kết nối với HeaderUserMenu dropdown qua Floating UI.
 */

import React, { memo } from 'react';
import PropTypes from 'prop-types';

import Avatar from '@/shared/components/ui/avatar/Avatar';
import { useFloatingDropdown } from '@/hooks/ui/use-floating-dropdown';

import HeaderUserMenu from './HeaderUserMenu';

/**
 * @component HeaderAccountMenu
 * @description Nút kích hoạt avatar và popover menu tài khoản người dùng
 */
const HeaderAccountMenu = memo(({
  user,
  isAdmin,
  isOpen,
  onOpen,
  onClose,
  onLogout,
}) => {
  const userDropdown = useFloatingDropdown({
    placement: 'bottom-end',
    isOpen,
    onOpenChange: (open) => (open ? onOpen() : onClose()),
    offset: 12,
    adaptToDevice: true,
    deviceBehaviors: {
      mobile: {
        fullWidth: false,
        bottomSheet: false,
      },
    },
  });

  const displayName = user?.displayName || user?.username || 'Avatar';

  return (
    <div className="app-header__profile-trigger-wrapper">
      <button
        ref={userDropdown.refs.setReference}
        type="button"
        {...userDropdown.getReferenceProps()}
        className="app-header__profile-trigger"
        aria-label="Menu tài khoản người dùng"
        aria-haspopup="menu"
        aria-expanded={isOpen}
      >
        <Avatar
          src={user?.avatar_url}
          name={displayName}
          alt={displayName}
          size="md"
          className="app-header__avatar"
        />
      </button>
      <HeaderUserMenu
        user={user}
        isAdmin={isAdmin}
        onLogout={onLogout}
        dropdown={userDropdown}
        onClose={onClose}
      />
    </div>
  );
});

HeaderAccountMenu.displayName = 'HeaderAccountMenu';

HeaderAccountMenu.propTypes = {
  user: PropTypes.object,
  isAdmin: PropTypes.bool.isRequired,
  isOpen: PropTypes.bool.isRequired,
  onOpen: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
  onLogout: PropTypes.func.isRequired,
};

export default HeaderAccountMenu;