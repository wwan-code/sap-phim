/**
 * @file AdminSidebarFooter.jsx
 * @module Admin/Layout/Sidebar/Components/AdminSidebarFooter
 * @component AdminSidebarFooter
 * @description Subcomponent chân trang Admin Sidebar chứa thẻ User Mini Profile (sử dụng Avatar chuẩn Design System) và liên kết chuyển hướng về Trang chủ Client.
 */

import React, { memo } from 'react';
import PropTypes from 'prop-types';
import { NavLink } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';

import Avatar from '@/shared/components/ui/avatar/Avatar';
import Tooltip from '@/shared/components/ui/tooltip/Tooltip';
import { ROUTES } from '@/shared/constants/routes.constants';

/**
 * @component AdminSidebarFooter
 * @description Subcomponent chân trang của Admin Sidebar (Dumb UI)
 */
export const AdminSidebarFooter = memo(({
  user = null,
  roleName = 'Admin',
  isCollapsed = false,
}) => {
  const avatarUrl = user?.avatar_url || user?.avatar || null;
  const displayName = user?.fullName || user?.name || user?.username || 'Quản trị viên';

  const clientLinkContent = (
    <NavLink
      to={ROUTES.HOME}
      className='admin-sidebar__client-link'
      target='_blank'
      rel='noreferrer'
      aria-label='Về Trang chủ Sạp Phim (Mở tab mới)'
    >
      <ExternalLink size={16} aria-hidden='true' />
      {!isCollapsed && <span>Về Trang chủ Sạp Phim</span>}
    </NavLink>
  );

  return (
    <div className='admin-sidebar__footer'>
      {/* 1. User Profile Mini Badge */}
      {user && (
        <div className='admin-sidebar__user' title={isCollapsed ? `${displayName} (${roleName})` : undefined}>
          <Avatar
            src={avatarUrl}
            name={displayName}
            size='sm'
            status='online'
            className='admin-sidebar__user-avatar-comp'
          />
          {!isCollapsed && (
            <div className='admin-sidebar__user-info'>
              <span className='admin-sidebar__user-name'>{displayName}</span>
              <span className='admin-sidebar__user-role'>{roleName}</span>
            </div>
          )}
        </div>
      )}

      {/* 2. Link back to Client Home */}
      {isCollapsed ? (
        <Tooltip title='Về Trang chủ Sạp Phim' placement='right'>
          {clientLinkContent}
        </Tooltip>
      ) : (
        clientLinkContent
      )}
    </div>
  );
});

AdminSidebarFooter.displayName = 'AdminSidebarFooter';

AdminSidebarFooter.propTypes = {
  user: PropTypes.object,
  roleName: PropTypes.string,
  isCollapsed: PropTypes.bool,
};

export default AdminSidebarFooter;
