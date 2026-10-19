/**
 * @file use-playback-resume.js
 * @module Components/VideoPlayer/Hooks
 * @description Hook quản lý tiến trình phát phim (Playback Resume) tối ưu I/O với cơ chế Throttle 5s + Debounce 2s khi pause/seek.
 */

import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Hook quản lý lưu và khôi phục tiến trình xem video
 *
 * @param {Object} params
 * @param {string|number} params.episodeId - ID tập phim
 * @param {number} params.currentTime - Thời gian hiện tại
 * @param {number} params.duration - Thời lượng video
 * @param {boolean} params.isPlaying - Trạng thái đang phát
 * @param {Function} params.onSeek - Hàm tua video
 * @returns {Object}
 */
export function usePlaybackResume({
  episodeId,
  currentTime = 0,
  duration = 0,
  isPlaying = false,
  onSeek,
}) {
  const [savedTime, setSavedTime] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const autoDismissTimerRef = useRef(null);
  const hasPromptedRef = useRef(false);
  const lastSaveTimeRef = useRef(0);
  const debounceSaveTimerRef = useRef(null);
  const currentTimeRef = useRef(currentTime);
  const durationRef = useRef(duration);

  currentTimeRef.current = currentTime;
  durationRef.current = duration;

  const storageKey = episodeId ? `sap_phim_playback_resume_${episodeId}` : null;

  // 1. Kiểm tra tiến trình đã lưu khi component mount hoặc đổi episodeId
  useEffect(() => {
    if (!storageKey) {
      setSavedTime(null);
      setIsOpen(false);
      return;
    }

    hasPromptedRef.current = false;

    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const time = parseFloat(stored);
        // Chỉ gợi ý nếu đã xem hơn 10 giây
        if (!isNaN(time) && time > 10 && !hasPromptedRef.current) {
          setSavedTime(time);
          setIsOpen(true);
          hasPromptedRef.current = true;

          // Tự động đóng banner sau 9 giây
          if (autoDismissTimerRef.current) {
            clearTimeout(autoDismissTimerRef.current);
          }
          autoDismissTimerRef.current = setTimeout(() => {
            setIsOpen(false);
          }, 9000);
        }
      }
    } catch (e) {
      console.warn('[PlaybackResume] LocalStorage read error:', e);
    }

    return () => {
      if (autoDismissTimerRef.current) {
        clearTimeout(autoDismissTimerRef.current);
      }
    };
  }, [storageKey]);

  // Hàm thực hiện lưu an toàn vào localStorage
  const saveProgress = useCallback(() => {
    if (!storageKey) return;
    const cur = currentTimeRef.current;
    const dur = durationRef.current;

    // Nếu đã xem hơn 10s và còn cách đoạn kết ít nhất 15s -> Lưu
    if (cur > 10 && dur > 0 && dur - cur > 15) {
      try {
        localStorage.setItem(storageKey, Math.floor(cur).toString());
        lastSaveTimeRef.current = Date.now();
      } catch (e) {
        // QuotaExceeded hoặc Private mode
      }
    } else if (dur > 0 && dur - cur <= 15) {
      // Đã xem hết phim -> Xóa tiến trình
      try {
        localStorage.removeItem(storageKey);
      } catch (e) {
        // Ignore
      }
    }
  }, [storageKey]);

  // 2. Throttle lưu tiến trình định kỳ mỗi 5 giây khi đang phát
  useEffect(() => {
    if (!isPlaying || !storageKey) return;

    const interval = setInterval(() => {
      const now = Date.now();
      if (now - lastSaveTimeRef.current >= 4800) {
        saveProgress();
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [isPlaying, storageKey, saveProgress]);

  // 3. Debounce lưu tiến trình 2 giây khi Pause
  useEffect(() => {
    if (isPlaying || !storageKey) return;

    if (debounceSaveTimerRef.current) {
      clearTimeout(debounceSaveTimerRef.current);
    }

    debounceSaveTimerRef.current = setTimeout(() => {
      saveProgress();
    }, 2000);

    return () => {
      if (debounceSaveTimerRef.current) {
        clearTimeout(debounceSaveTimerRef.current);
      }
    };
  }, [isPlaying, storageKey, saveProgress]);

  // 4. Lưu ngay khi người dùng đóng tab / điều hướng trang (beforeunload)
  useEffect(() => {
    if (!storageKey) return;

    const handleBeforeUnload = () => {
      saveProgress();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      saveProgress();
    };
  }, [storageKey, saveProgress]);

  const handleResume = useCallback(() => {
    if (savedTime && onSeek) {
      onSeek(savedTime);
    }
    setIsOpen(false);
    if (autoDismissTimerRef.current) {
      clearTimeout(autoDismissTimerRef.current);
    }
  }, [savedTime, onSeek]);

  const handleRestart = useCallback(() => {
    if (storageKey) {
      try {
        localStorage.removeItem(storageKey);
      } catch (e) {
        // Ignore
      }
    }
    if (onSeek) {
      onSeek(0);
    }
    setIsOpen(false);
    if (autoDismissTimerRef.current) {
      clearTimeout(autoDismissTimerRef.current);
    }
  }, [storageKey, onSeek]);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    if (autoDismissTimerRef.current) {
      clearTimeout(autoDismissTimerRef.current);
    }
  }, []);

  return {
    isOpen,
    savedTime,
    handleResume,
    handleRestart,
    handleClose,
  };
}

export default usePlaybackResume;
