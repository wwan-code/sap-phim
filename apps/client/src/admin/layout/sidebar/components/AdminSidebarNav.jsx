/**
 * @file AdminSidebarNav.jsx
 * @module Admin/Layout/Sidebar/Components/AdminSidebarNav
 * @component AdminSidebarNav
 * @description Subcomponent chứa vùng cuộn danh sách các mục menu và submenu điều hướng trong Admin Sidebar dạng liền mạch theo Mockup.
 */

import React, { memo } from 'react';
import PropTypes from 'prop-types';
import AdminSidebarNavItem from './AdminSidebarNavItem';

/**
 * @component AdminSidebarNav
 * @description Container chứa danh sách các menu & submenu điều hướng (Dumb UI)
 */
export const AdminSidebarNav = memo(({
  sections = [],
  isRouteActive,
  isCollapsed = false,
  onItemClick,
  onPrefetchRoute,
}) => {
  return (
    <div className='admin-sidebar__nav-container'>
      {sections.map((sec) => (
        <div key={sec.id} className='admin-sidebar__section'>
          <ul className='admin-sidebar__menu' role='menu' aria-label={sec.title || 'Thanh điều hướng'}>
            {sec.items.map((item) => (
              <AdminSidebarNavItem
                key={item.id}
                item={item}
                isActive={isRouteActive ? isRouteActive(item.to) : false}
                isCollapsed={isCollapsed}
                onClick={onItemClick}
                onPrefetch={onPrefetchRoute}
              />
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
});

AdminSidebarNav.displayName = 'AdminSidebarNav';

AdminSidebarNav.propTypes = {
  sections: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      title: PropTypes.string,
      items: PropTypes.array.isRequired,
    })
  ),
  isRouteActive: PropTypes.func,
  isCollapsed: PropTypes.bool,
  onItemClick: PropTypes.func,
  onPrefetchRoute: PropTypes.func,
};

export default AdminSidebarNav;
