/**
 * @file use-unsaved-movie-guard.js
 * @module Admin/Modules/Movies/Hooks
 * @description Hook bảo vệ dữ liệu chưa lưu (Unsaved Changes) cho Movie Form.
 * Chặn F5 (beforeunload) và chặn điều hướng nội bộ (useBlocker) nếu form bị bẩn hoặc có job nền đang chạy.
 */

import { useEffect, useCallback, useRef } from 'react';
import { useBlocker } from 'react-router-dom';

/**
 * Hook quản lý cảnh báo mất dữ liệu chưa lưu
 * @param {Object} options Options cấu hình
 * @param {boolean} options.isDirty Trạng thái form đã thay đổi
 * @param {boolean} options.isJobRunning Trạng thái đang có job ảnh ngầm chạy
 * @param {boolean|React.MutableRefObject<boolean>} options.allowNavigation Cho phép bỏ qua chặn điều hướng khi submit thành công
 */
export const useUnsavedMovieGuard = ({ isDirty = false, isJobRunning = false, allowNavigation = false }) => {
  // Đồng bộ trạng thái allowNavigation qua Ref để đảm bảo phản hồi tức thì khi gọi navigate()
  const allowNavRef = useRef(false);

  useEffect(() => {
    const isAllowed =
      typeof allowNavigation === 'object' && allowNavigation !== null && 'current' in allowNavigation
        ? allowNavigation.current
        : Boolean(allowNavigation);
    allowNavRef.current = isAllowed;
  }, [allowNavigation]);

  const isNavAllowed = () => {
    if (typeof allowNavigation === 'object' && allowNavigation !== null && 'current' in allowNavigation) {
      return Boolean(allowNavigation.current);
    }
    return Boolean(allowNavigation) || allowNavRef.current;
  };

  const shouldBlock = isDirty || isJobRunning;

  // 1. Chặn reload trình duyệt / đóng tab (Native beforeunload)
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (shouldBlock && !isNavAllowed()) {
        e.preventDefault();
        e.returnValue = ''; // Bắt buộc cho các trình duyệt hiện đại
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [shouldBlock, allowNavigation]);

  // 2. Chặn điều hướng nội bộ (React Router v6/v7)
  const blocker = useBlocker(
    useCallback(
      ({ currentLocation, nextLocation }) => {
        if (isNavAllowed()) {
          return false;
        }
        return shouldBlock && currentLocation.pathname !== nextLocation.pathname;
      },
      [shouldBlock, allowNavigation]
    )
  );

  return {
    blocker,
    isBlocked: blocker.state === 'blocked',
    confirmNavigation: () => blocker.proceed?.(),
    cancelNavigation: () => blocker.reset?.(),
  };
};
