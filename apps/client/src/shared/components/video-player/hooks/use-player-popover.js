/**
 * @file use-player-popover.js
 * @module Components/VideoPlayer/Hooks
 * @description Hook quản lý popover đa tầng trong Video Player (Settings, Subtitles) tái sử dụng useFloatingDropdown chuẩn Aesthetic OS.
 */

import { useState, useEffect } from 'react';

import { useFloatingDropdown } from '@/hooks/ui/use-floating-dropdown';

/**
 * @hook usePlayerPopover
 * @description Hook quản lý trạng thái popover, điều hướng view con và đồng bộ hiệu ứng chuyển động
 * @param {object} [options={}]
 * @param {string} [options.initialView='main'] View khởi tạo ban đầu
 * @param {string} [options.placement='top-end'] Vị trí popover
 * @param {number} [options.offset=14] Khoảng cách tới trigger button
 * @returns {object} Trạng thái popover, view và các props điều khiển từ useFloatingDropdown
 */
export const usePlayerPopover = ({
  initialView = 'main',
  placement = 'top-end',
  offset = 14,
} = {}) => {
  const [view, setView] = useState(initialView);
  const [slideDirection, setSlideDirection] = useState('forward');

  const dropdown = useFloatingDropdown({
    placement,
    offset,
    strategy: 'absolute',
    usePortal: false,
    adaptToDevice: false,
    openDuration: 240,
    closeDuration: 160,
    enableSizeMiddleware: false,
  });

  const { isOpen, floatingStyles, recalc } = dropdown;

  const navigateToView = (newView, direction = 'forward') => {
    setSlideDirection(direction);
    setView(newView);
  };

  // Cập nhật lại vị trí khi view thay đổi
  useEffect(() => {
    recalc?.();
  }, [view, recalc]);

  // Reset về view mặc định sau khi popover đóng hoàn tất
  useEffect(() => {
    if (!isOpen) {
      const resetTimer = setTimeout(() => {
        setView(initialView);
        setSlideDirection('forward');
      }, 200);
      return () => clearTimeout(resetTimer);
    }
  }, [isOpen, initialView]);

  // Đảm bảo popover luôn neo đáy phía trên nút trigger, mở rộng mượt mà lên trên
  const anchoredFloatingStyles = {
    ...floatingStyles,
    top: 'auto',
    bottom: `calc(100% + ${offset}px)`,
    right: 0,
    left: 'auto',
    maxHeight: '360px',
  };

  return {
    ...dropdown,
    floatingStyles: anchoredFloatingStyles,
    view,
    setView,
    navigateToView,
    slideDirection,
  };
};

export default usePlayerPopover;
