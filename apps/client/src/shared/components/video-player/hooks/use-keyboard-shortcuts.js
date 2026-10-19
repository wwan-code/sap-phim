/**
 * @file use-keyboard-shortcuts.js
 * @module Components/VideoPlayer/Hooks
 * @description Hook quản lý phím tắt bàn phím chuẩn YouTube Player (Space, K, J, L, M, C, F, T, I, 0-9, Arrows, Comma/Period).
 */

import { useEffect } from 'react';

import { usePlayerStore } from './use-player-store';

/**
 * Hook xử lý phím tắt bàn phím
 *
 * @param {Object} params
 * @param {Function} params.togglePlay - Bật/dừng phát
 * @param {Function} params.seek - Tua tới thời gian cụ thể
 * @param {Function} params.seekRelative - Tua tương đối (±s)
 * @param {Function} params.changeVolume - Chỉnh âm lượng
 * @param {Function} params.toggleMute - Bật/tắt tiếng
 * @param {Function} params.toggleSubtitle - Bật/tắt phụ đề
 * @param {Function} params.toggleFullscreen - Bật/tắt toàn màn hình
 * @param {Function} params.toggleTheater - Bật/tắt rạp chiếu phim
 * @param {Function} params.togglePip - Bật/tắt PiP
 * @param {Function} params.triggerHud - Kích hoạt HUD
 * @param {Function} params.showControlsTemporarily - Hiển thị controls
 */
export function useKeyboardShortcuts({
  togglePlay,
  seek,
  seekRelative,
  changeVolume,
  toggleMute,
  toggleSubtitle,
  toggleFullscreen,
  toggleTheater,
  togglePip,
  triggerHud,
  showControlsTemporarily,
}) {
  const isShortcutsOpen = usePlayerStore((s) => s.isShortcutsOpen);
  const setIsShortcutsOpen = usePlayerStore((s) => s.setIsShortcutsOpen);
  const activeMenu = usePlayerStore((s) => s.activeMenu);
  const setActiveMenu = usePlayerStore((s) => s.setActiveMenu);

  useEffect(() => {
    const handleKeyDown = (e) => {
      // Bỏ qua nếu đang gõ vào input/textarea/select hoặc phần tử có contentEditable
      if (
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName) ||
        e.target.isContentEditable
      ) {
        return;
      }

      const store = usePlayerStore.getState();
      const { volume, duration, currentTime, isPlaying } = store;

      // 1. Phím tắt ? mở bảng trợ giúp phím tắt
      if (e.key === '?' || (e.code === 'Slash' && e.shiftKey)) {
        e.preventDefault();
        setIsShortcutsOpen(!isShortcutsOpen);
        showControlsTemporarily?.();
        return;
      }

      // 2. Phím Escape: đóng modals, menus hoặc thoát fullscreen
      if (e.key === 'Escape') {
        if (isShortcutsOpen) {
          e.preventDefault();
          setIsShortcutsOpen(false);
          return;
        }
        if (activeMenu) {
          e.preventDefault();
          setActiveMenu(null);
          return;
        }
        if (store.isFullscreen) {
          e.preventDefault();
          toggleFullscreen?.();
          return;
        }
      }

      // 3. Phím số 0 - 9: Tua nhanh theo % thời lượng (0% -> 90%)
      const isDigit = e.code.startsWith('Digit') || e.code.startsWith('Numpad');
      if (isDigit && duration > 0) {
        const numChar = e.code.replace('Digit', '').replace('Numpad', '');
        const num = parseInt(numChar, 10);
        if (!isNaN(num) && num >= 0 && num <= 9) {
          e.preventDefault();
          const targetTime = (num / 10) * duration;
          seek?.(targetTime);
          showControlsTemporarily?.();
          return;
        }
      }

      // 4. Các phím điều khiển chính chuẩn YouTube
      switch (e.code) {
        // Phát / Tạm dừng
        case 'Space':
        case 'KeyK':
          e.preventDefault();
          togglePlay?.();
          showControlsTemporarily?.();
          break;

        // Tua ±10 giây
        case 'KeyJ':
          e.preventDefault();
          seekRelative?.(-10);
          showControlsTemporarily?.();
          break;
        case 'KeyL':
          e.preventDefault();
          seekRelative?.(10);
          showControlsTemporarily?.();
          break;

        // Tua ±5 giây
        case 'ArrowLeft':
          e.preventDefault();
          seekRelative?.(-5);
          showControlsTemporarily?.();
          break;
        case 'ArrowRight':
          e.preventDefault();
          seekRelative?.(5);
          showControlsTemporarily?.();
          break;

        // Âm lượng ±5%
        case 'ArrowUp': {
          e.preventDefault();
          const nextVol = Math.min(1, volume + 0.05);
          changeVolume?.(nextVol);
          triggerHud?.('volume', {
            percent: Math.round(nextVol * 100),
            isMuted: false,
          });
          showControlsTemporarily?.();
          break;
        }
        case 'ArrowDown': {
          e.preventDefault();
          const nextVol = Math.max(0, volume - 0.05);
          changeVolume?.(nextVol);
          triggerHud?.('volume', {
            percent: Math.round(nextVol * 100),
            isMuted: nextVol === 0,
          });
          showControlsTemporarily?.();
          break;
        }

        // Bật / Tắt tiếng (Mute)
        case 'KeyM':
          e.preventDefault();
          toggleMute?.();
          showControlsTemporarily?.();
          break;

        // Bật / Tắt phụ đề (CC)
        case 'KeyC':
          e.preventDefault();
          toggleSubtitle?.();
          showControlsTemporarily?.();
          break;

        // Toàn màn hình (Fullscreen)
        case 'KeyF':
          e.preventDefault();
          toggleFullscreen?.();
          break;

        // Chế độ rạp chiếu phim (Theater Mode)
        case 'KeyT':
          e.preventDefault();
          toggleTheater?.();
          break;

        // Hình trong hình (PiP)
        case 'KeyI':
          e.preventDefault();
          togglePip?.();
          break;

        // Về đầu / Về cuối video
        case 'Home':
          e.preventDefault();
          seek?.(0);
          showControlsTemporarily?.();
          break;
        case 'End':
          if (duration > 0) {
            e.preventDefault();
            seek?.(duration);
            showControlsTemporarily?.();
          }
          break;

        // Frame step khi video đang dừng (0.04s ≈ 1 khung hình 24-25fps)
        case 'Comma':
          if (!isPlaying) {
            e.preventDefault();
            seek?.(Math.max(0, currentTime - 0.04));
            showControlsTemporarily?.();
          }
          break;
        case 'Period':
          if (!isPlaying && duration > 0) {
            e.preventDefault();
            seek?.(Math.min(duration, currentTime + 0.04));
            showControlsTemporarily?.();
          }
          break;

        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    togglePlay,
    seek,
    seekRelative,
    changeVolume,
    toggleMute,
    toggleSubtitle,
    toggleFullscreen,
    toggleTheater,
    togglePip,
    triggerHud,
    showControlsTemporarily,
    isShortcutsOpen,
    setIsShortcutsOpen,
    activeMenu,
    setActiveMenu,
  ]);
}

export default useKeyboardShortcuts;
