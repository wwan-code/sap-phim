/**
 * @file use-header-state.js
 * @module Components/Layout/Header/Hooks/UseHeaderState
 * @description Custom hook quản lý trạng thái UI của Header (cuộn trang, mobile drawer và dropdowns).
 * @returns {object} Trạng thái UI và các hàm điều khiển
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useLockBodyScroll } from '@/hooks/ui/use-lock-body-scroll';

const SCROLL_THRESHOLD_PX = 16;
const SCROLL_FADE_DISTANCE_PX = 100;

/**
 * @hook useHeaderState
 * @description Hook quản lý trạng thái hiển thị và tương tác của Header
 * @returns {object}
 */
export const useHeaderState = () => {
  const [isScrolled, setIsScrolled] = useState(() =>
    typeof window !== 'undefined' ? window.scrollY > SCROLL_THRESHOLD_PX : false
  );
  const [scrollProgress, setScrollProgress] = useState(() =>
    typeof window !== 'undefined'
      ? Math.min(window.scrollY / SCROLL_FADE_DISTANCE_PX, 1)
      : 0
  );
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const location = useLocation();
  const isTicking = useRef(false);

  // ─── Theo dõi cuộn trang (rAF-throttled, passive) ───
  useEffect(() => {
    const handleScroll = () => {
      if (isTicking.current) return;
      isTicking.current = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        setIsScrolled(y > SCROLL_THRESHOLD_PX);
        setScrollProgress(Math.min(y / SCROLL_FADE_DISTANCE_PX, 1));
        isTicking.current = false;
      });
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // ─── Đóng toàn bộ overlay khi điều hướng sang route khác ───
  useEffect(() => {
    setMobileDrawerOpen(false);
    setAccountMenuOpen(false);
    setNotificationsOpen(false);
  }, [location.pathname]);

  // ─── Khoá cuộn trang khi Mobile Drawer mở ───
  useLockBodyScroll(mobileDrawerOpen);

  // ─── Phím Escape để đóng overlay đang mở ───
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key !== 'Escape') return;
      if (mobileDrawerOpen) setMobileDrawerOpen(false);
      else if (notificationsOpen) setNotificationsOpen(false);
      else if (accountMenuOpen) setAccountMenuOpen(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileDrawerOpen, accountMenuOpen, notificationsOpen]);

  const toggleMobileDrawer = useCallback(() => setMobileDrawerOpen((prev) => !prev), []);
  const closeMobileDrawer = useCallback(() => setMobileDrawerOpen(false), []);

  const openAccountMenu = useCallback(() => setAccountMenuOpen(true), []);
  const closeAccountMenu = useCallback(() => setAccountMenuOpen(false), []);

  const openNotifications = useCallback(() => {
    setNotificationsOpen(true);
    setAccountMenuOpen(false);
  }, []);
  const closeNotifications = useCallback(() => setNotificationsOpen(false), []);

  return {
    isScrolled,
    scrollProgress,
    mobileDrawerOpen,
    accountMenuOpen,
    notificationsOpen,
    toggleMobileDrawer,
    closeMobileDrawer,
    openAccountMenu,
    closeAccountMenu,
    openNotifications,
    closeNotifications,
  };
};

export default useHeaderState;