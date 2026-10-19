/**
 * @file use-controls-visibility.js
 * @module Components/VideoPlayer/Hooks
 * @description Hook quản lý hiển thị/ẩn thanh điều khiển video player theo chuẩn YouTube & Invisible Interface.
 * Tự động ẩn sau 3s (Desktop) / 3.5s (Mobile), giữ hiển thị khi tạm dừng, mở menu cài đặt, hoặc đang kéo tua timeline.
 */

import { useEffect, useRef, useCallback } from 'react';

import { usePlayerStore } from './use-player-store';

/**
 * Hook quản lý độ hiển thị của Controls
 *
 * @param {Object} params
 * @param {boolean} params.isMobile - Xác định giao diện mobile
 * @param {React.RefObject} params.lastTouchTimeRef - Ref lưu mốc thời gian touch cuối cùng
 * @returns {Object} Visibility state và handlers
 */
export function useControlsVisibility({ isMobile = false, lastTouchTimeRef }) {
  const hideControlsTimerRef = useRef(null);

  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const isControlsVisible = usePlayerStore((s) => s.isControlsVisible);
  const isScreenLocked = usePlayerStore((s) => s.isScreenLocked);
  const activeMenu = usePlayerStore((s) => s.activeMenu);
  const isSeeking = usePlayerStore((s) => s.isSeeking);

  const setIsControlsVisible = usePlayerStore((s) => s.setIsControlsVisible);
  const triggerScreenLockPrompt = usePlayerStore((s) => s.triggerScreenLockPrompt);

  // Điều kiện giữ Controls luôn hiển thị (Hold Condition)
  const shouldHoldVisible =
    !isPlaying || isScreenLocked || activeMenu !== null || isSeeking;

  // Hiển thị Controls tạm thời và hẹn giờ tự động ẩn
  const showControlsTemporarily = useCallback(() => {
    if (isScreenLocked) return;

    setIsControlsVisible(true);
    if (hideControlsTimerRef.current) {
      clearTimeout(hideControlsTimerRef.current);
    }

    if (!shouldHoldVisible) {
      const delay = isMobile ? 3500 : 3000;
      hideControlsTimerRef.current = setTimeout(() => {
        if (usePlayerStore.getState().isPlaying && !shouldHoldVisible) {
          setIsControlsVisible(false);
        }
      }, delay);
    }
  }, [isMobile, isScreenLocked, shouldHoldVisible, setIsControlsVisible]);

  // Giữ controls hiển thị liên tục khi thỏa mãn điều kiện hold
  useEffect(() => {
    if (shouldHoldVisible) {
      if (hideControlsTimerRef.current) {
        clearTimeout(hideControlsTimerRef.current);
      }
      if (!isScreenLocked) {
        setIsControlsVisible(true);
      }
    } else if (isPlaying) {
      // Khi bắt đầu phát lại và không còn hold condition, bắt đầu hẹn giờ ẩn
      showControlsTemporarily();
    }
  }, [shouldHoldVisible, isPlaying, isScreenLocked, setIsControlsVisible, showControlsTemporarily]);

  // Bật / tắt hiển thị controls chủ động
  const toggleControlsVisibility = useCallback(() => {
    if (isScreenLocked) {
      triggerScreenLockPrompt?.();
      return;
    }

    if (hideControlsTimerRef.current) {
      clearTimeout(hideControlsTimerRef.current);
    }

    const nextVisible = !isControlsVisible;
    setIsControlsVisible(nextVisible);

    if (nextVisible && isPlaying && !shouldHoldVisible) {
      const delay = isMobile ? 3500 : 3000;
      hideControlsTimerRef.current = setTimeout(() => {
        setIsControlsVisible(false);
      }, delay);
    }
  }, [
    isControlsVisible,
    isMobile,
    isPlaying,
    isScreenLocked,
    shouldHoldVisible,
    setIsControlsVisible,
    triggerScreenLockPrompt,
  ]);

  // Handler di chuột (MouseMove) có chặn Ghost Click sau Touch
  const handleMouseMove = useCallback(() => {
    if (
      lastTouchTimeRef?.current &&
      Date.now() - lastTouchTimeRef.current < 600
    ) {
      return;
    }
    showControlsTemporarily();
  }, [lastTouchTimeRef, showControlsTemporarily]);

  // Handler rời chuột (MouseLeave)
  const handleMouseLeave = useCallback(() => {
    if (
      lastTouchTimeRef?.current &&
      Date.now() - lastTouchTimeRef.current < 600
    ) {
      return;
    }
    if (isPlaying && !shouldHoldVisible) {
      showControlsTemporarily();
    }
  }, [isPlaying, lastTouchTimeRef, shouldHoldVisible, showControlsTemporarily]);

  // Tự động ẩn con trỏ chuột khi Controls ẩn và đang phát video trên Desktop
  const isCursorHidden = !isControlsVisible && isPlaying && !isMobile;

  // Dọn dẹp timer khi unmount
  useEffect(() => {
    return () => {
      if (hideControlsTimerRef.current) {
        clearTimeout(hideControlsTimerRef.current);
      }
    };
  }, []);

  return {
    isControlsVisible,
    showControlsTemporarily,
    toggleControlsVisibility,
    handleMouseMove,
    handleMouseLeave,
    isCursorHidden,
  };
}

export default useControlsVisibility;
