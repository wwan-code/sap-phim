/**
 * @file use-player-gestures.js
 * @module Components/VideoPlayer/Hooks
 * @description Hook quản lý cử chỉ cảm ứng (Touch Gestures) và nhấp chuột (Desktop Clicks) chuẩn YouTube:
 * - Mobile: Single-tap toggle UI, Double-tap tua ±10s hai bên, Long-press giữ tăng tốc 2x, Swipe âm lượng/tua toàn màn hình.
 * - Desktop: Single-click bật/dừng phát, Double-click bật/tắt toàn màn hình.
 */

import { useRef, useCallback } from 'react';

import { usePlayerStore } from './use-player-store';

/**
 * Hook nhận diện và xử lý cử chỉ trên video container
 *
 * @param {Object} params
 * @param {React.RefObject} params.containerRef - Ref tới container video
 * @param {boolean} params.isMobile - Cờ xác định thiết bị di động
 * @param {Function} params.onToggleControls - Bật/tắt hiển thị controls
 * @param {Function} params.onTogglePlay - Chuyển đổi phát/tạm dừng
 * @param {Function} params.onSeekRelative - Tua tương đối (±10s)
 * @param {Function} params.onSeek - Tua tới mốc thời gian cụ thể
 * @param {Function} params.onChangeVolume - Thay đổi âm lượng
 * @param {Function} params.onToggleFullscreen - Bật/tắt toàn màn hình
 * @param {Function} params.triggerHud - Kích hoạt hiệu ứng HUD
 * @param {Function} params.showControlsTemporarily - Hiển thị controls có hẹn giờ
 * @param {React.RefObject} [params.lastTouchTimeRef] - Ref chia sẻ mốc thời gian touch
 * @returns {Object} Event handlers gắn vào container
 */
export function usePlayerGestures({
  containerRef,
  isMobile = false,
  onToggleControls,
  onTogglePlay,
  onSeekRelative,
  onSeek,
  onChangeVolume,
  onToggleFullscreen,
  triggerHud,
  showControlsTemporarily,
  lastTouchTimeRef: externalLastTouchTimeRef,
}) {
  const internalTouchTimeRef = useRef(0);
  const lastTouchTimeRef = externalLastTouchTimeRef || internalTouchTimeRef;

  const startSpeed2x = usePlayerStore((s) => s.startSpeed2x);
  const stopSpeed2x = usePlayerStore((s) => s.stopSpeed2x);
  const triggerScreenLockPrompt = usePlayerStore((s) => s.triggerScreenLockPrompt);

  // Trạng thái theo dõi cử chỉ cảm ứng & chuột
  const touchStateRef = useRef({
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
    startTime: 0,
    gestureType: null, // 'tap' | 'swipe-vertical' | 'swipe-horizontal' | 'speed-2x'
    startVolume: 1,
    startSeekTime: 0,
    hasMoved: false,
    lastTapTime: 0,
    lastTapX: 0,
    tapTimeout: null,
    longPressTimer: null,
    isLongPressActive: false,
  });

  // Desktop click state (xử lý single-click vs double-click fullscreen)
  const desktopClickRef = useRef({
    lastClickTime: 0,
    clickTimer: null,
  });

  // ════════════════════════════════════════
  // 1. TOUCH EVENTS (MOBILE & TABLET)
  // ════════════════════════════════════════

  const handleTouchStart = useCallback((e) => {
    lastTouchTimeRef.current = Date.now();

    const target = e.target;
    // Bỏ qua nếu chạm vào controls hoặc các overlays tương tác
    if (
      target.closest('.player-mobile-controls__bottom-bar') ||
      target.closest('.player-mobile-controls__top-bar') ||
      target.closest('.player-mobile-controls__center-stage') ||
      target.closest('.player-controls') ||
      target.closest('.player-top-bar') ||
      target.closest('.player-seekbar') ||
      target.closest('.player-bottom-sheet') ||
      target.closest('.player-resume-banner') ||
      target.closest('.player-skip-intro') ||
      target.closest('.player-next-episode-card') ||
      target.closest('.player-screen-lock-overlay') ||
      target.closest('button') ||
      target.closest('input')
    ) {
      return;
    }

    if (!e.touches || e.touches.length === 0) return;

    const touch = e.touches[0];
    const now = Date.now();
    const state = touchStateRef.current;
    const store = usePlayerStore.getState();

    state.startX = touch.clientX;
    state.startY = touch.clientY;
    state.currentX = touch.clientX;
    state.currentY = touch.clientY;
    state.startTime = now;
    state.gestureType = null;
    state.startVolume = store.volume;
    state.startSeekTime = store.currentTime;
    state.hasMoved = false;
    state.isLongPressActive = false;

    // Hẹn giờ kích hoạt YouTube Long-Press 2x Speed khi chạm giữ ≥ 500ms
    if (!store.isScreenLocked && store.isPlaying) {
      if (state.longPressTimer) {
        clearTimeout(state.longPressTimer);
      }
      state.longPressTimer = setTimeout(() => {
        if (!state.hasMoved) {
          state.isLongPressActive = true;
          state.gestureType = 'speed-2x';
          startSpeed2x();
          triggerHud?.('speed-2x', '2x');
        }
      }, 500);
    }
  }, [lastTouchTimeRef, startSpeed2x, triggerHud]);

  const handleTouchMove = useCallback((e) => {
    const store = usePlayerStore.getState();
    if (store.isScreenLocked) return;

    if (!e.touches || e.touches.length === 0) return;
    const touch = e.touches[0];
    const state = touchStateRef.current;

    const deltaX = touch.clientX - state.startX;
    const deltaY = touch.clientY - state.startY;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    if (absX > 10 || absY > 10) {
      state.hasMoved = true;
      // Hủy long press nếu ngón tay di chuyển
      if (state.longPressTimer) {
        clearTimeout(state.longPressTimer);
        state.longPressTimer = null;
      }
    }

    // Nếu đang trong trạng thái long-press 2x, không chuyển sang gesture vuốt
    if (state.isLongPressActive) {
      return;
    }

    // Xác định loại cử chỉ vuốt
    if (!state.gestureType && (absX > 20 || absY > 20)) {
      const containerRect = containerRef.current?.getBoundingClientRect();
      const containerWidth = containerRect?.width || window.innerWidth;
      const isRightSide = state.startX > containerWidth * 0.5;

      if (absY > absX * 1.3 && isRightSide) {
        state.gestureType = 'swipe-vertical';
      } else if (absX > absY * 1.3 && store.isFullscreen && store.duration > 0) {
        state.gestureType = 'swipe-horizontal';
      }
    }

    // 1. Vuốt dọc: Âm lượng
    if (state.gestureType === 'swipe-vertical') {
      e.preventDefault();
      const containerHeight =
        containerRef.current?.clientHeight || window.innerHeight;
      const volumeDelta = -deltaY / (containerHeight * 0.75);
      const newVol = Math.min(1, Math.max(0, state.startVolume + volumeDelta));
      onChangeVolume?.(newVol);
      triggerHud?.('volume', {
        percent: Math.round(newVol * 100),
        isMuted: newVol === 0,
      });
    }

    // 2. Vuốt ngang: Tua thời gian khi xem toàn màn hình
    if (state.gestureType === 'swipe-horizontal' && store.duration > 0) {
      e.preventDefault();
      const containerWidth =
        containerRef.current?.clientWidth || window.innerWidth;
      const maxScrubRange = Math.min(store.duration * 0.3, 180);
      const timeDelta = (deltaX / containerWidth) * maxScrubRange;
      const targetTime = Math.min(
        store.duration,
        Math.max(0, state.startSeekTime + timeDelta),
      );

      triggerHud?.(
        timeDelta >= 0 ? 'seek-forward' : 'seek-backward',
        Math.round(Math.abs(timeDelta)),
      );
      state.currentSeekPreview = targetTime;
    }

    state.currentX = touch.clientX;
    state.currentY = touch.clientY;
  }, [containerRef, onChangeVolume, triggerHud]);

  const handleTouchEnd = useCallback(() => {
    const state = touchStateRef.current;
    const store = usePlayerStore.getState();
    const now = Date.now();
    const touchDuration = now - state.startTime;

    // Hủy timer long press nếu có
    if (state.longPressTimer) {
      clearTimeout(state.longPressTimer);
      state.longPressTimer = null;
    }

    // Kết thúc Long-press 2x Speed
    if (state.isLongPressActive) {
      state.isLongPressActive = false;
      stopSpeed2x();
      triggerHud?.('speed-2x', null);
      lastTouchTimeRef.current = Date.now();
      return;
    }

    // Khi màn hình bị khóa: Chỉ nhận diện chạm để hiển thị nút mở khóa
    if (store.isScreenLocked) {
      if (!state.hasMoved && touchDuration < 350) {
        triggerScreenLockPrompt?.();
      }
      state.hasMoved = false;
      lastTouchTimeRef.current = Date.now();
      return;
    }

    // 1. Kết thúc vuốt ngang tua thời gian
    if (
      state.gestureType === 'swipe-horizontal' &&
      typeof state.currentSeekPreview === 'number'
    ) {
      onSeek?.(state.currentSeekPreview);
      state.currentSeekPreview = null;
      state.gestureType = null;
      showControlsTemporarily?.();
      lastTouchTimeRef.current = Date.now();
      return;
    }

    // 2. Kết thúc vuốt dọc âm lượng
    if (state.gestureType === 'swipe-vertical') {
      state.gestureType = null;
      showControlsTemporarily?.();
      lastTouchTimeRef.current = Date.now();
      return;
    }

    // 3. Xử lý Chạm (Tap) & Chạm đúp (Double-Tap)
    if (!state.hasMoved && touchDuration < 350) {
      const containerRect = containerRef.current?.getBoundingClientRect();
      const width = containerRect?.width || window.innerWidth;
      const tapX = state.startX - (containerRect?.left || 0);

      const timeSinceLastTap = now - state.lastTapTime;
      const distanceXFromLastTap = Math.abs(state.startX - state.lastTapX);

      // Nhận diện Double-Tap (< 320ms và khoảng cách < 60px)
      if (timeSinceLastTap < 320 && distanceXFromLastTap < 60) {
        if (state.tapTimeout) {
          clearTimeout(state.tapTimeout);
          state.tapTimeout = null;
        }

        // 3 phân vùng ngang
        if (tapX < width * 0.38) {
          // 1/3 bên trái: Tua lùi 10s
          onSeekRelative?.(-10);
        } else if (tapX > width * 0.62) {
          // 1/3 bên phải: Tua tới 10s
          onSeekRelative?.(10);
        } else {
          // 1/3 ở giữa: Play/Pause
          onTogglePlay?.();
        }

        showControlsTemporarily?.();
        state.lastTapTime = 0;
        lastTouchTimeRef.current = Date.now();
        return;
      }

      state.lastTapTime = now;
      state.lastTapX = state.startX;

      // Single-Tap: Chờ 180ms để phân biệt với double-tap trước khi toggle UI
      state.tapTimeout = setTimeout(() => {
        state.tapTimeout = null;
        lastTouchTimeRef.current = Date.now();
        onToggleControls?.();
      }, 180);
    }

    lastTouchTimeRef.current = Date.now();
  }, [
    containerRef,
    onSeek,
    onSeekRelative,
    onToggleControls,
    onTogglePlay,
    showControlsTemporarily,
    stopSpeed2x,
    triggerHud,
    triggerScreenLockPrompt,
    lastTouchTimeRef,
  ]);

  // ════════════════════════════════════════
  // 2. DESKTOP CLICK & DOUBLE CLICK
  // ════════════════════════════════════════

  const handleContainerClick = useCallback((e) => {
    // 1. Chặn Ghost Click sau thao tác chạm trên màn hình cảm ứng
    if (
      lastTouchTimeRef?.current &&
      Date.now() - lastTouchTimeRef.current < 600
    ) {
      return;
    }

    const store = usePlayerStore.getState();
    if (store.isScreenLocked) {
      triggerScreenLockPrompt?.();
      return;
    }

    // 2. Bỏ qua nếu click vào controls, popovers, overlays
    if (
      e.target.closest('.player-controls') ||
      e.target.closest('.player-mobile-controls__top-bar') ||
      e.target.closest('.player-mobile-controls__center-stage') ||
      e.target.closest('.player-mobile-controls__bottom-bar') ||
      e.target.closest('.player-top-bar') ||
      e.target.closest('.player-resume-banner') ||
      e.target.closest('.player-settings__popover') ||
      e.target.closest('.player-bottom-sheet') ||
      e.target.closest('.player-skip-intro') ||
      e.target.closest('.player-next-episode-card') ||
      e.target.closest('.player-screen-lock-overlay') ||
      e.target.closest('button') ||
      e.target.closest('input')
    ) {
      return;
    }

    // 3. Phân tách theo nền tảng:
    // Trên Mobile: Tap vào màn hình dùng để Bật/Tắt controls
    if (isMobile) {
      onToggleControls?.();
      return;
    }

    // Trên Desktop: Nhận diện Single-Click (Play/Pause) và Double-Click (Toggle Fullscreen)
    const now = Date.now();
    const clickState = desktopClickRef.current;
    const timeSinceLastClick = now - clickState.lastClickTime;

    if (timeSinceLastClick < 260) {
      // Double Click: Toggle Fullscreen
      if (clickState.clickTimer) {
        clearTimeout(clickState.clickTimer);
        clickState.clickTimer = null;
      }
      clickState.lastClickTime = 0;
      onToggleFullscreen?.();
    } else {
      // Single Click: Play/Pause sau khi xác nhận không có click thứ 2
      clickState.lastClickTime = now;
      clickState.clickTimer = setTimeout(() => {
        clickState.clickTimer = null;
        onTogglePlay?.();
        showControlsTemporarily?.();
      }, 240);
    }
  }, [
    isMobile,
    lastTouchTimeRef,
    onToggleControls,
    onTogglePlay,
    onToggleFullscreen,
    showControlsTemporarily,
    triggerScreenLockPrompt,
  ]);

  return {
    handleContainerClick,
    gestureHandlers: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
      onTouchCancel: handleTouchEnd,
    },
    lastTouchTimeRef,
  };
}

export default usePlayerGestures;
