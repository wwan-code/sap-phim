/**
 * @file use-authorized-admin-routes.js
 * @module Admin/Layout/Header/Hooks/UseAuthorizedAdminRoutes
 * @description Custom hook lọc danh sách routes Admin theo phân quyền tài khoản (Roles & Permissions) từ SSOT Manifest `ADMIN_ROUTE_CONFIGS`.
 */

import { useMemo } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { ADMIN_ROUTE_CONFIGS } from '@/admin/router/admin-routes.config';

/**
 * @hook useAuthorizedAdminRoutes
 * @description Lọc admin routes theo quyền của user hiện tại
 * @returns {Array} Danh sách route configs đã lọc
 */
export const useAuthorizedAdminRoutes = () => {
  const { isBoss, permissions = [] } = useAuth();

  const authorizedRoutes = useMemo(() => {
    return ADMIN_ROUTE_CONFIGS.filter((item) => {
      if (isBoss) return true;
      if (!item.permission) return true;
      return permissions.includes(item.permission);
    }).map((item) => ({
      id: item.id,
      label: item.label,
      path: item.path,
      icon: item.icon,
      section: item.section,
      children: Array.isArray(item.children)
        ? item.children.filter((child) => {
          if (isBoss) return true;
          if (!child.permission) return true;
          return permissions.includes(child.permission);
        })
        : [],
    }));
  }, [isBoss, permissions]);

  return authorizedRoutes;
};

export default useAuthorizedAdminRoutes;
