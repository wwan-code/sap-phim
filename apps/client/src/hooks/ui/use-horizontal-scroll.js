/**
 * @file use-horizontal-scroll.js
 * @module Hooks/UI/UseHorizontalScroll
 * @description Hook quản lý các vùng chứa cuộn ngang với tính năng cuộn theo khung nhìn và phát hiện hỗ trợ cảm ứng.
 */


import { useRef, useState, useCallback, useEffect } from 'react';

/**
 * @param {Object} options
 * @param {number} options.scrollAmount - Pixels to scroll per click (default: container width * 0.8)
 * @param {string} options.behavior - Scroll behavior: 'smooth' | 'auto'
 * @returns {Object} { containerRef, scrollLeft, scrollRight, canScrollLeft, canScrollRight }
 */
export const useHorizontalScroll = (options = {}) => {
  const { behavior = 'smooth' } = options;
  const containerRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollState = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;

    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanScrollLeft(scrollLeft > 2);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 2);
  }, []);

  // Observe scroll + resize changes
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // Initial check with a small delay for layout to settle
    const timer = setTimeout(updateScrollState, 100);

    el.addEventListener('scroll', updateScrollState, { passive: true });

    const resizeObserver = new ResizeObserver(updateScrollState);
    resizeObserver.observe(el);

    return () => {
      clearTimeout(timer);
      el.removeEventListener('scroll', updateScrollState);
      resizeObserver.disconnect();
    };
  }, [updateScrollState]);

  const scrollLeft = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const amount = options.scrollAmount || el.clientWidth * 0.8;
    el.scrollBy({ left: -amount, behavior });
  }, [behavior, options.scrollAmount]);

  const scrollRight = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const amount = options.scrollAmount || el.clientWidth * 0.8;
    el.scrollBy({ left: amount, behavior });
  }, [behavior, options.scrollAmount]);

  return {
    containerRef,
    scrollLeft,
    scrollRight,
    canScrollLeft,
    canScrollRight,
    updateScrollState,
  };
};

// Exported as named export
