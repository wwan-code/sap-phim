/**
 * @file use-admin-header-state.js
 * @module Admin/Layout/Header/Hooks/UseAdminHeaderState
 * @description Hook quản lý trạng thái UI của Admin Header (Command Palette overlay, phím tắt toàn cục Ctrl+K/Cmd+K).
 */

import { useState, useCallback, useEffect } from 'react';

/**
 * @hook useAdminHeaderState
 * @description Quản lý trạng thái mở/đóng modal tìm kiếm Command Palette
 * @returns {object} Trạng thái UI và các hàm điều khiển
 */
export const useAdminHeaderState = () => {
  const [searchOpen, setSearchOpen] = useState(false);

  const openSearch = useCallback(() => {
    setSearchOpen(true);
  }, []);

  const closeSearch = useCallback(() => {
    setSearchOpen(false);
  }, []);

  const toggleSearch = useCallback(() => {
    setSearchOpen((prev) => !prev);
  }, []);

  // Global keyboard shortcut: Ctrl+K / Cmd+K
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return {
    searchOpen,
    openSearch,
    closeSearch,
    toggleSearch,
  };
};

export default useAdminHeaderState;
