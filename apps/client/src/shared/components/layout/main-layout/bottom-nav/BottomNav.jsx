/**
 * @file BottomNav.jsx
 * @module Components/Layout/BottomNav/BottomNav
 * @component BottomNav
 * @description Component điều hướng thanh đáy (Bottom Navigation) dành riêng cho giao diện di động chuẩn Material 3 Expressive.
 */

import React, { memo } from 'react';
import { NavLink } from 'react-router-dom';
import classNames from 'classnames';
import { Compass, Home, Search, User } from 'lucide-react';

import { ROUTES } from '@/shared/constants/routes.constants';
import { useDeviceType } from '@/hooks/ui/use-device-type';

import './bottom-nav.scss';

/**
 * Danh sách các điểm đến điều hướng cốt lõi trên ứng dụng di động
 */
const NAV_ITEMS = [
  {
    name: 'Trang chủ',
    path: ROUTES.HOME,
    icon: Home,
    exact: true,
  },
  {
    name: 'Khám phá',
    path: ROUTES.CATALOG,
    icon: Compass,
  },
  {
    name: 'Tìm kiếm',
    path: ROUTES.SEARCH,
    icon: Search,
  },
  {
    name: 'Tài khoản',
    path: ROUTES.ACCOUNT,
    icon: User,
  },
];

/**
 * @component BottomNav
 * @description Component điều hướng gắn đáy màn hình (App-like) chuẩn Material 3 Tonal Surface.
 */
export const BottomNav = () => {
  const { isMobile } = useDeviceType();

  // Giải phóng React DOM tree trên màn hình Tablet / Desktop
  if (!isMobile) return null;

  return (
    <nav className="app-bottom-nav" aria-label="Điều hướng chính di động">
      <ul className="app-bottom-nav__list" role="menubar">
        {NAV_ITEMS.map((item) => {
          const IconComponent = item.icon;

          return (
            <li key={item.path} className="app-bottom-nav__item" role="none">
              <NavLink
                to={item.path}
                end={item.exact}
                className={({ isActive }) =>
                  classNames('app-bottom-nav__link', {
                    'app-bottom-nav__link--active': isActive,
                  })
                }
                aria-label={item.name}
              >
                {({ isActive }) => (
                  <>
                    <IconComponent
                      size={20}
                      strokeWidth={isActive ? 2.4 : 1.8}
                      className="app-bottom-nav__icon"
                      aria-hidden="true"
                    />
                    <span className="app-bottom-nav__label">{item.name}</span>
                  </>
                )}
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};

export default memo(BottomNav);
