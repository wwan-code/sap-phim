/**
 * @file use-auth.js
 * @module Hooks/UseAuth
 * @description Hook truy xuất trạng thái xác thực, thông tin người dùng và phân quyền từ Redux Store, tích hợp quy trình đăng xuất toàn diện và chuyển hướng an toàn.
 * @returns {object} Thông tin auth và các handler (login, logout, v.v.)
 */

import { useCallback, useState } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  selectCurrentUser,
  selectIsAuthenticated,
  selectAuthLoading,
  selectAuthError,
  selectHasAnyRole,
  selectHasRole,
  selectUserRoles,
  selectUserPermissions,
  selectAuthStatus,
} from '@/store/slices/auth.slice';
import authService from '@/shared/services/auth.service';
import { performLogout } from '@/shared/utils/token-manager';
import { ROUTES } from '@/shared/constants/routes.constants';
import { ROLES } from '@/shared/constants/roles.constants';

const ADMIN_ROLES = [ROLES.BOSS, ROLES.ADMIN, ROLES.MODERATOR];

/**
 * @hook useAuth
 * @description Hook cung cấp thông tin xác thực và các tác vụ tài khoản
 * @returns {{
 *   user: object|null,
 *   isAuthenticated: boolean,
 *   isLoading: boolean,
 *   isLoggingOut: boolean,
 *   error: any,
 *   isAdmin: boolean,
 *   authStatus: string,
 *   logout: () => Promise<void>
 * }}
 */
export const useAuth = () => {
  const navigate = useNavigate();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const user = useSelector(selectCurrentUser);
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const isLoading = useSelector(selectAuthLoading);
  const error = useSelector(selectAuthError);
  const authStatus = useSelector(selectAuthStatus);
  const isAdmin = useSelector(selectHasAnyRole(ADMIN_ROLES));
  const isBoss = useSelector(selectHasRole(ROLES.BOSS));
  const roles = useSelector(selectUserRoles);
  const permissions = useSelector(selectUserPermissions);

  const handleLogout = useCallback(async () => {
    setIsLoggingOut(true);
    try {
      await authService.logout();
    } catch (err) {
      if (import.meta.env.DEV) {
        console.warn('[useAuth] API logout thất bại, tiến hành dọn dẹp client state:', err?.message);
      }
      performLogout();
    } finally {
      setIsLoggingOut(false);

      // Kiểm tra chuyển hướng an toàn nếu đang ở các trang yêu cầu quyền đăng nhập
      const currentPath = window.location.pathname;
      const isProtected =
        currentPath.startsWith('/admin') ||
        currentPath.startsWith(ROUTES.ACCOUNT) ||
        currentPath.startsWith('/profile') ||
        currentPath.startsWith('/settings') ||
        currentPath.startsWith(ROUTES.WALLET) ||
        currentPath.startsWith(ROUTES.VIP);

      if (isProtected) {
        navigate(ROUTES.LOGIN, { replace: true });
      }
    }
  }, [navigate]);

  return {
    user,
    isAuthenticated,
    isLoading: isLoading || isLoggingOut,
    isLoggingOut,
    error,
    isAdmin,
    isBoss,
    roles,
    permissions,
    authStatus,
    logout: handleLogout,
  };
};

export default useAuth;
