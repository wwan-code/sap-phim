/**
 * @file use-lock-body-scroll.js
 * @module Hooks/UI/UseLockBodyScroll
 * @description Hook khóa cuộn trang (body scroll) khi mở modal hoặc overlay, tự động ngăn chặn trượt bố cục.
 */

import { useLayoutEffect } from "react";

/**
 * Module-level reference counter để xử lý nhiều modal mở đồng thời.
 * Chỉ lock khi modal đầu tiên mở, chỉ unlock khi modal cuối cùng đóng.
 */
let lockCount = 0;

/**
 * Tính chiều rộng scrollbar để tránh layout shift khi overflow: hidden.
 */
const getScrollbarWidth = () => {
  // Trường hợp không có scrollbar (mobile overlay scrollbar)
  if (typeof window === "undefined") return 0;
  return window.innerWidth - document.documentElement.clientWidth;
};

/**
 * useLockBodyScroll
 *
 * Khóa scroll của body khi modal/overlay mở.
 * Hỗ trợ nhiều modal đồng thời qua reference counting.
 * Tự động bù scrollbar width để tránh layout shift (nội dung bị giật).
 *
 * @param {boolean} isLocked - true khi cần lock
 */
export const useLockBodyScroll = (isLocked = true) => {
  useLayoutEffect(() => {
    if (!isLocked) return;

    lockCount++;

    if (lockCount === 1) {
      const scrollbarWidth = getScrollbarWidth();
      const body = document.body;

      // Lưu style gốc để restore chính xác
      const originalOverflow = body.style.overflow;
      const originalPaddingRight = body.style.paddingRight;

      // Set CSS variable để các fixed element (header, toolbar) cũng bù scrollbar
      document.documentElement.style.setProperty(
        "--modal-scrollbar-width",
        `${scrollbarWidth}px`,
      );

      body.style.overflow = "hidden";
      // Bù scrollbar width tránh layout shift
      if (scrollbarWidth > 0) {
        body.style.paddingRight = `${scrollbarWidth}px`;
      }

      // Cleanup cho lockCount = 0 (lưu qua closure)
      body.dataset.scrollLockOriginalOverflow = originalOverflow;
      body.dataset.scrollLockOriginalPadding = originalPaddingRight;
    }

    return () => {
      lockCount--;

      if (lockCount === 0) {
        const body = document.body;
        body.style.overflow = body.dataset.scrollLockOriginalOverflow ?? "";
        body.style.paddingRight = body.dataset.scrollLockOriginalPadding ?? "";
        delete body.dataset.scrollLockOriginalOverflow;
        delete body.dataset.scrollLockOriginalPadding;
        document.documentElement.style.removeProperty(
          "--modal-scrollbar-width",
        );
      }
    };
  }, [isLocked]);
};
