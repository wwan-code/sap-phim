/**
 * @file use-token-manager.js
 * @module Hooks/UseTokenManager
 * @description Hook khởi tạo TokenManager sau khi Redux rehydrate hoàn tất và xử lý tự động làm mới phiên làm việc.
 */

import { useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import toast from 'react-hot-toast';
import { selectIsAuthenticated, selectAuthStatus } from '@/store/slices/auth.slice';
import { initTokenManager, restoreSession, cleanup } from '@/shared/utils/token-manager';
import { router } from '@/app/routes/router';
import { ROUTES } from '@/shared/constants/routes.constants';

/**
 * Khởi tạo Token Refresh Manager sau khi Redux state đã được rehydrate.
 * Đồng thời quản lý redirect khi session hết hạn và thông báo toast một lần.
 *
 * @returns {void}
 */
export const useTokenManager = () => {
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const authStatus = useSelector(selectAuthStatus);
  const initDoneRef = useRef(false);
  const bootRestoreDoneRef = useRef(false);
  const toastShownRef = useRef(false);

  // 1. Khởi tạo và dọn dẹp token-manager
  useEffect(() => {
    if (!initDoneRef.current) {
      initDoneRef.current = true;
      try {
        initTokenManager();
      } catch (error) {
        console.error('[useTokenManager] Lỗi khi khởi tạo token manager:', error);
      }
    }

    return () => {
      // Dọn dẹp timers khi unmount
      cleanup();
    };
  }, []);

  // 2. Khôi phục session khi khởi động nếu chưa authenticated
  useEffect(() => {
    if (!isAuthenticated && !bootRestoreDoneRef.current) {
      bootRestoreDoneRef.current = true;
      restoreSession().catch((error) => {
        if (import.meta.env.DEV) {
          console.info('[useTokenManager] Bỏ qua khôi phục phiên im lặng:', error?.message);
        }
      });
    }
  }, [isAuthenticated]);

  // 3. Khởi chạy token-manager khi trạng thái authenticated thay đổi
  useEffect(() => {
    if (isAuthenticated) {
      initTokenManager();
    }
  }, [isAuthenticated]);

  // 4. Xử lý thông báo và chuyển hướng khi phiên đăng nhập hết hạn
  useEffect(() => {
    if (authStatus === 'expired') {
      if (!toastShownRef.current) {
        toastShownRef.current = true;
        toast.error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.', {
          id: 'session-expired-toast',
        });

        // Lấy đường dẫn hiện tại làm returnUrl
        const currentPath = window.location.pathname + window.location.search;
        router.navigate(`${ROUTES.LOGIN}?returnUrl=${encodeURIComponent(currentPath)}`, {
          replace: true,
        });
      }
    } else {
      toastShownRef.current = false;
    }
  }, [authStatus]);

  // 5. Xử lý chuyển hướng khi đăng xuất (hoặc hết hạn phiên) từ các tab khác
  useEffect(() => {
    if (!isAuthenticated && authStatus !== 'initializing') {
      const currentPath = window.location.pathname;
      const isProfile = currentPath.startsWith('/profile') || currentPath.startsWith('/settings');
      const isWallet = currentPath.startsWith('/wallet') || currentPath.startsWith('/vip');
      const isAdmin = currentPath.startsWith('/admin');
      const isProtectedRoute = isAdmin || isProfile || isWallet;

      if (isProtectedRoute) {
        router.navigate(`${ROUTES.LOGIN}?returnUrl=${encodeURIComponent(currentPath + window.location.search)}`, {
          replace: true,
        });
      }
    }
  }, [isAuthenticated, authStatus]);
};

export default useTokenManager;
