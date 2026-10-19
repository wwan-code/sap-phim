/**
 * @file use-top-loading-bar.js
 * @module Admin/Layout/Hooks
 * @description Điều phối thanh tải tăng dần theo lượt chuyển trang, hoàn tất và dọn dẹp lịch hiển thị.
 */

import { useEffect, useRef, useState } from 'react';

const SHOW_DELAY_MS = 100;
const MIN_VISIBLE_MS = 220;
const TICK_INTERVAL_MS = 300;
const INITIAL_PROGRESS = 10;
const PENDING_PROGRESS_LIMIT = 94;
const COMPLETION_HOLD_MS = 250;
const FADE_DURATION_MS = 180;

const IDLE_STATE = { phase: 'idle', progress: 0 };

/**
 * @hook useTopLoadingBar
 * @description Tiến dần và chậm lại trong lúc chờ, chỉ chạy đầy sau khi trang sẵn sàng.
 * @param {boolean} isNavigating - Trạng thái chuyển trang và tải dữ liệu từ layout.
 * @returns {{phase: 'idle'|'pending'|'loading'|'complete'|'fading', progress: number}} Trạng thái và độ dài trực quan; không phải phần trăm dữ liệu đã tải.
 */
export const useTopLoadingBar = (isNavigating) => {
  const [state, setState] = useState(IDLE_STATE);
  const stateRef = useRef(IDLE_STATE);
  const visibleSinceRef = useRef(0);

  useEffect(() => {
    let showTimer;
    let tickTimer;
    let completeTimer;
    let fadeTimer;
    let hideTimer;

    const publish = (nextState) => {
      stateRef.current = nextState;
      setState(nextState);
    };

    const startLoading = () => {
      const isContinuing = stateRef.current.phase === 'loading';
      const progress = isContinuing ? stateRef.current.progress : INITIAL_PROGRESS;

      if (!isContinuing) visibleSinceRef.current = performance.now();
      publish({ phase: 'loading', progress });

      tickTimer = setInterval(() => {
        const current = stateRef.current.progress;
        const next = current + (PENDING_PROGRESS_LIMIT - current) * 0.18;
        const progress = next >= PENDING_PROGRESS_LIMIT - 0.2
          ? PENDING_PROGRESS_LIMIT
          : next;

        publish({ phase: 'loading', progress });
        if (progress === PENDING_PROGRESS_LIMIT) clearInterval(tickTimer);
      }, TICK_INTERVAL_MS);
    };

    const complete = () => {
      publish({ phase: 'complete', progress: 100 });
      fadeTimer = setTimeout(() => {
        publish({ phase: 'fading', progress: 100 });
      }, COMPLETION_HOLD_MS);
      hideTimer = setTimeout(() => {
        publish(IDLE_STATE);
      }, COMPLETION_HOLD_MS + FADE_DURATION_MS);
    };

    if (isNavigating) {
      if (stateRef.current.phase === 'loading') {
        startLoading();
      } else {
        // Một lượt mới bắt đầu sau khi ẩn lượt đã hoàn tất, tránh vạch chạy ngược.
        publish({ phase: 'pending', progress: INITIAL_PROGRESS });
        showTimer = setTimeout(startLoading, SHOW_DELAY_MS);
      }
    } else if (stateRef.current.phase === 'loading') {
      const remaining = Math.max(0, MIN_VISIBLE_MS - (performance.now() - visibleSinceRef.current));
      completeTimer = setTimeout(complete, remaining);
    } else if (stateRef.current.phase === 'pending') {
      publish(IDLE_STATE);
    } else if (stateRef.current.phase === 'complete' || stateRef.current.phase === 'fading') {
      complete();
    }

    return () => {
      clearTimeout(showTimer);
      clearInterval(tickTimer);
      clearTimeout(completeTimer);
      clearTimeout(fadeTimer);
      clearTimeout(hideTimer);
    };
  }, [isNavigating]);

  return state;
};
