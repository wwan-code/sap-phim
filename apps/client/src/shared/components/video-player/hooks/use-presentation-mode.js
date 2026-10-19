/**
 * @file use-presentation-mode.js
 * @module Components/VideoPlayer/Hooks
 * @description Hook quản lý các chế độ hiển thị (Presentation Mode): Toàn màn hình (Fullscreen),
 * Chế độ rạp chiếu phim (Theater Mode) và Hình trong hình (Picture-in-Picture).
 */

import { useEffect, useCallback } from 'react';

import { usePlayerStore } from './use-player-store';

/**
 * Hook quản lý chế độ trình chiếu video
 *
 * @param {Object} params
 * @param {React.RefObject} params.containerRef - Ref tới container trình phát
 * @param {HTMLVideoElement|null} params.videoElement - Thẻ video element
 * @param {React.RefObject} params.videoRef - Ref dự phòng tới thẻ video
 * @param {boolean} params.isMobile - Cờ xác định thiết bị di động
 * @param {Function} [params.onTheaterChange] - Callback thông báo khi thay đổi chế độ rạp phim
 * @returns {Object} State và handlers trình chiếu
 */
export function usePresentationMode({
  containerRef,
  videoElement,
  videoRef,
  isMobile = false,
  onTheaterChange,
}) {
  const isFullscreen = usePlayerStore((s) => s.isFullscreen);
  const isTheater = usePlayerStore((s) => s.isTheater);
  const isPip = usePlayerStore((s) => s.isPip);

  const setIsFullscreen = usePlayerStore((s) => s.setIsFullscreen);
  const setIsTheater = usePlayerStore((s) => s.setIsTheater);
  const setIsPip = usePlayerStore((s) => s.setIsPip);

  // 1. Chuyển đổi Toàn màn hình (Fullscreen)
  const toggleFullscreen = useCallback(async () => {
    const container = containerRef?.current;
    if (!container) return;

    try {
      if (!document.fullscreenElement) {
        await container.requestFullscreen();
        if (isMobile && typeof window !== 'undefined' && window.screen?.orientation?.lock) {
          try {
            await window.screen.orientation.lock('landscape').catch(() => {});
          } catch {
            // Trình duyệt không hỗ trợ hoặc bị chặn
          }
        }
      } else {
        await document.exitFullscreen();
        if (isMobile && typeof window !== 'undefined' && window.screen?.orientation?.unlock) {
          try {
            window.screen.orientation.unlock();
          } catch {
            // Ignore
          }
        }
      }
    } catch (err) {
      console.warn('[PresentationMode] Fullscreen error:', err);
    }
  }, [containerRef, isMobile]);

  // 2. Chuyển đổi Chế độ rạp phim (Theater Mode)
  const toggleTheater = useCallback(() => {
    const nextTheater = !isTheater;
    setIsTheater(nextTheater);
    onTheaterChange?.(nextTheater);
  }, [isTheater, setIsTheater, onTheaterChange]);

  // 3. Chuyển đổi Hình trong hình (Picture-in-Picture)
  const togglePip = useCallback(async () => {
    const video = videoElement || videoRef?.current;
    if (!video) return;

    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (
        document.pictureInPictureEnabled &&
        video.requestPictureInPicture
      ) {
        await video.requestPictureInPicture();
      }
    } catch (err) {
      console.warn('[PresentationMode] PiP error:', err);
    }
  }, [videoElement, videoRef]);

  // ── Lắng nghe sự kiện Fullscreen từ trình duyệt ──
  useEffect(() => {
    const handleFullscreenChange = () => {
      const activeFs = Boolean(document.fullscreenElement);
      setIsFullscreen(activeFs);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, [setIsFullscreen]);

  // ── Lắng nghe sự kiện Picture-in-Picture từ video element ──
  useEffect(() => {
    const video = videoElement || videoRef?.current;
    if (!video) return;

    const onEnterPip = () => setIsPip(true);
    const onLeavePip = () => setIsPip(false);

    video.addEventListener('enterpictureinpicture', onEnterPip);
    video.addEventListener('leavepictureinpicture', onLeavePip);

    return () => {
      video.removeEventListener('enterpictureinpicture', onEnterPip);
      video.removeEventListener('leavepictureinpicture', onLeavePip);
    };
  }, [videoElement, videoRef, setIsPip]);

  return {
    isFullscreen,
    isTheater,
    isPip,
    toggleFullscreen,
    toggleTheater,
    togglePip,
  };
}

export default usePresentationMode;
