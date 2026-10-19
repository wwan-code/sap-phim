/**
 * @file use-admin-navigation.js
 * @module Admin/Shared/Hooks/UseAdminNavigation
 * @description Hook quản lý dữ liệu thanh điều hướng Admin Portal: lọc danh mục và menu con theo Role/Permission, kiểm tra Active Route và kích hoạt Idle/Hover Prefetching.
 */

import { useMemo, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { selectUserRoles, selectUserPermissions } from '@/store/slices/auth.slice';
import { ROLES } from '@/shared/constants/roles.constants';
import { ROUTES } from '@/shared/constants/routes.constants';
import {
  buildAdminNavigation,
  ADMIN_ROUTE_CONFIGS,
  ADMIN_NAV_SECTIONS,
  prefetchAdminRoute,
} from '../../router/admin-routes.config';

/**
 * @hook useAdminNavigation
 * @description Quản lý logic phân quyền, trạng thái active và prefetching cho Admin Sidebar
 * @returns {{
 *   navigationSections: Array,
 *   isRouteActive: (path: string) => boolean,
 *   prefetchRoute: (path: string) => void,
 *   isBoss: boolean
 * }}
 */
export const useAdminNavigation = () => {
  const location = useLocation();
  const userRoles = useSelector(selectUserRoles);
  const userPermissions = useSelector(selectUserPermissions);

  const isBoss = useMemo(() => {
    return Array.isArray(userRoles) && userRoles.includes(ROLES.BOSS);
  }, [userRoles]);

  // Sinh toàn bộ navigation structure từ manifest
  const rawSections = useMemo(() => {
    return buildAdminNavigation(ADMIN_ROUTE_CONFIGS, ADMIN_NAV_SECTIONS);
  }, []);

  // Lọc navigation theo quyền hạn người dùng (cả cha lẫn con)
  const navigationSections = useMemo(() => {
    return rawSections
      .map((sec) => {
        const visibleItems = sec.items
          .filter((item) => {
            if (isBoss) return true;
            if (!item.permission) return true;
            return Array.isArray(userPermissions) && userPermissions.includes(item.permission);
          })
          .map((item) => {
            if (!Array.isArray(item.children)) return item;
            const visibleChildren = item.children.filter((child) => {
              if (isBoss) return true;
              if (!child.permission) return true;
              return Array.isArray(userPermissions) && userPermissions.includes(child.permission);
            });
            return { ...item, children: visibleChildren };
          });
        return { ...sec, items: visibleItems };
      })
      .filter((sec) => sec.items.length > 0);
  }, [rawSections, isBoss, userPermissions]);

  /**
   * Kiểm tra path có đang active hay không
   */
  const isRouteActive = useCallback(
    (path) => {
      if (!path) return false;
      if (path === ROUTES.ADMIN.DASHBOARD) {
        return location.pathname === path || location.pathname === ROUTES.ADMIN.ROOT;
      }
      return location.pathname === path || location.pathname.startsWith(path);
    },
    [location.pathname]
  );

  /**
   * Kích hoạt prefetch cho một route
   */
  const prefetchRoute = useCallback((path) => {
    prefetchAdminRoute(path);
  }, []);

  // Idle prefetching các trang thường dùng sau khi Admin layout mount
  useEffect(() => {
    const idlePrefetch = () => {
      prefetchAdminRoute(ROUTES.ADMIN.MOVIES);
      prefetchAdminRoute(ROUTES.ADMIN.MOVIE_CREATE);
      prefetchAdminRoute(ROUTES.ADMIN.EPISODES);
      prefetchAdminRoute(ROUTES.ADMIN.GENRES);
      prefetchAdminRoute(ROUTES.ADMIN.CATEGORIES);
    };

    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      const handle = window.requestIdleCallback(idlePrefetch, { timeout: 2000 });
      return () => window.cancelIdleCallback(handle);
    }
    const timer = setTimeout(idlePrefetch, 1500);
    return () => clearTimeout(timer);
  }, []);

  return {
    navigationSections,
    isRouteActive,
    prefetchRoute,
    isBoss,
  };
};

export default useAdminNavigation;
