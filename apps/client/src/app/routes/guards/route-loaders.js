/**
 * @file route-loaders.js
 * @module Routes/Guards/RouteLoaders
 * @description Pre-render route loaders của React Router v6.4+ xử lý kiểm tra Authentication & Authorization (Roles/Permissions) với cơ chế Fast-Path in-memory 0ms.
 */

import { redirect } from 'react-router-dom';
import { store, waitForRehydration } from '@/store';
import { ROUTES } from '@/shared/constants/routes.constants';
import { ROLES } from '@/shared/constants/roles.constants';
import { restoreSession } from '@/shared/utils/token-manager';

/**
 * Lấy auth state từ Redux store
 */
const getAuth = () => {
  const state = store.getState();
  return state?.auth || { isAuthenticated: false, user: null };
};

/**
 * Kiểm tra danh sách roles của user với danh sách roles yêu cầu
 */
const checkRole = (userRoleSlugs, requiredRoles) => {
  if (!requiredRoles || requiredRoles.length === 0) return true;
  const roles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];
  return roles.some((role) => userRoleSlugs.includes(role));
};

/**
 * Đảm bảo session được phục hồi trước khi kiểm tra auth (Fast-Path Optimization).
 * Nếu đã authenticated in-memory (khi chuyển trang nội bộ), trả về ngay lập tức (0ms).
 */
const ensureSessionRestored = async () => {
  const currentAuth = getAuth();
  if (currentAuth.isAuthenticated) return;

  await waitForRehydration;
  const rehydratedAuth = getAuth();
  if (rehydratedAuth.isAuthenticated) return;

  await restoreSession();
};

/**
 * 1. Guest Only Guard
 * Chỉ dành cho khách (Login, Register). Nếu đã đăng nhập, đẩy về Home hoặc redirectUrl.
 */
export const guestLoader = async ({ request }) => {
  await ensureSessionRestored();
  const { isAuthenticated } = getAuth();

  if (isAuthenticated) {
    const url = new URL(request.url);
    // Cho phép truy cập trang xác thực email và đặt lại mật khẩu kể cả khi đang có session
    if (
      url.pathname.startsWith(ROUTES.VERIFY_EMAIL) ||
      url.pathname.startsWith('/verify-email') ||
      url.pathname.startsWith(ROUTES.RESET_PW) ||
      url.pathname.startsWith('/reset-password')
    ) {
      return null;
    }
    const redirectTo = url.searchParams.get('redirectTo');
    return redirect(redirectTo || ROUTES.HOME);
  }
  return null;
};

/**
 * 2. Require Auth Guard
 * Bắt buộc phải đăng nhập. Nếu chưa, đẩy về Login kèm theo url hiện tại để redirect về sau.
 */
export const requireAuthLoader = async ({ request }) => {
  await ensureSessionRestored();
  const { isAuthenticated } = getAuth();
  const url = new URL(request.url);

  if (!isAuthenticated) {
    const targetUrl = url.pathname + url.search;
    return redirect(`${ROUTES.LOGIN}?redirectTo=${encodeURIComponent(targetUrl)}`);
  }

  return null;
};

/**
 * 3. Require Role Guard
 * Kiểm tra role ở loader layer. Nếu không đủ role, throw Response 403.
 */
export const requireRoleLoader = (requiredRoles) => {
  return async ({ request }) => {
    await ensureSessionRestored();
    const { isAuthenticated, user } = getAuth();
    const url = new URL(request.url);

    if (!isAuthenticated) {
      const targetUrl = url.pathname + url.search;
      return redirect(`${ROUTES.LOGIN}?redirectTo=${encodeURIComponent(targetUrl)}`);
    }

    const userRoleSlugs = (user?.roles || []).map((r) =>
      typeof r === 'object' && r !== null ? (r.slug || r.name || '') : String(r)
    );

    if (userRoleSlugs.includes(ROLES.BOSS)) {
      return null;
    }

    if (!checkRole(userRoleSlugs, requiredRoles)) {
      throw new Response('Forbidden: Access Denied', { status: 403 });
    }

    return null;
  };
};

/**
 * 4. Require Permission Guard
 * Kiểm tra permission cụ thể. Nếu thiếu quyền, throw Response 403.
 */
export const requirePermissionLoader = (requiredPermission) => {
  return async ({ request }) => {
    await ensureSessionRestored();
    const { isAuthenticated, user } = getAuth();
    const url = new URL(request.url);

    if (!isAuthenticated) {
      const targetUrl = url.pathname + url.search;
      return redirect(`${ROUTES.LOGIN}?redirectTo=${encodeURIComponent(targetUrl)}`);
    }

    const userRoleSlugs = (user?.roles || []).map((r) =>
      typeof r === 'object' && r !== null ? (r.slug || r.name || '') : String(r)
    );

    if (userRoleSlugs.includes(ROLES.BOSS)) {
      return null;
    }

    const permissions = user?.permissions || [];
    if (!permissions.includes(requiredPermission)) {
      throw new Response('Forbidden: Insufficient Permissions', { status: 403 });
    }

    return null;
  };
};
