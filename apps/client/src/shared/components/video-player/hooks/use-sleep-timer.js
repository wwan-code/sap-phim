/**
 * @file use-sleep-timer.js
 * @module Components/VideoPlayer/Hooks
 * @description Hook quản lý tính năng Hẹn giờ đi ngủ (Sleep Timer): đếm ngược thời gian, phát hiện hết tập phim và kích hoạt Overlay đánh thức/tiếp tục.
 */

import { useState, useEffect, useRef, useCallback } from 'react';

export const SLEEP_TIMER_OPTIONS = [
  { value: null, label: 'Tắt' },
  { value: 15, label: '15 phút' },
  { value: 30, label: '30 phút' },
  { value: 45, label: '45 phút' },
  { value: 60, label: '60 phút' },
  { value: 'end_of_episode', label: 'Khi hết tập phim' },
];

/**
 * Hook quản lý bộ hẹn giờ tắt video
 *
 * @param {Object} params
 * @param {boolean} params.isPlaying - Trạng thái video đang phát
 * @param {number} params.currentTime - Thời gian hiện tại
 * @param {number} params.duration - Thời lượng video
 * @param {Function} params.onPause - Hàm tạm dừng video
 * @param {Function} params.onPlay - Hàm tiếp tục phát video
 * @returns {Object}
 */
export function useSleepTimer({
  isPlaying = false,
  currentTime = 0,
  duration = 0,
  onPause,
  onPlay,
}) {
  const [sleepTimerOption, setSleepTimerOption] = useState(null);
  const [remainingSeconds, setRemainingSeconds] = useState(null);
  const [isSleepOverlayOpen, setIsSleepOverlayOpen] = useState(false);

  const timerRef = useRef(null);

  // Khi người dùng chọn một mức thời gian mới
  const handleSelectOption = useCallback((option) => {
    setSleepTimerOption(option);
    if (typeof option === 'number') {
      setRemainingSeconds(option * 60);
    } else {
      setRemainingSeconds(null);
    }
  }, []);

  // 1. Đếm ngược cho các tùy chọn theo phút (15, 30, 45, 60)
  useEffect(() => {
    if (typeof sleepTimerOption !== 'number' || remainingSeconds === null) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    if (remainingSeconds <= 0) {
      // Hết giờ -> Tạm dừng video và hiển thị Overlay
      onPause?.();
      setIsSleepOverlayOpen(true);
      setSleepTimerOption(null);
      setRemainingSeconds(null);
      return;
    }

    // Chỉ trừ thời gian khi video đang phát
    if (!isPlaying) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    timerRef.current = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [sleepTimerOption, remainingSeconds, isPlaying, onPause]);

  // 2. Xử lý tùy chọn 'end_of_episode'
  useEffect(() => {
    if (sleepTimerOption !== 'end_of_episode' || duration <= 0) return;

    if (duration - currentTime <= 1) {
      onPause?.();
      setIsSleepOverlayOpen(true);
      setSleepTimerOption(null);
    }
  }, [sleepTimerOption, currentTime, duration, onPause]);

  // Hành động: Tiếp tục xem từ Overlay
  const handleWakeUp = useCallback(() => {
    setIsSleepOverlayOpen(false);
    onPlay?.();
  }, [onPlay]);

  // Hành động: Đóng Overlay (giữ video tạm dừng)
  const handleDismissSleepOverlay = useCallback(() => {
    setIsSleepOverlayOpen(false);
  }, []);

  return {
    sleepTimerOption,
    setSleepTimerOption: handleSelectOption,
    remainingSeconds,
    isSleepOverlayOpen,
    handleWakeUp,
    handleDismissSleepOverlay,
  };
}

export default useSleepTimer;
