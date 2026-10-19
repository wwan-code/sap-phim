/**
 * @file use-focus-trap.js
 * @module Hooks/UI/UseFocusTrap
 * @description Hook khoanh vùng và giữ tiêu điểm bàn phím (focus trap) bên trong khung chứa khi active.
 */

import { useEffect, useRef } from "react";

/**
 * Selector containing all valid focusable elements.
 * Avoids :not([disabled]) for fieldset[disabled] compatibility.
 */
const FOCUSABLE_SELECTORS = [
  'a[href]:not([tabindex="-1"])',
  'button:not([disabled]):not([tabindex="-1"])',
  'input:not([disabled]):not([tabindex="-1"])',
  'select:not([disabled]):not([tabindex="-1"])',
  'textarea:not([disabled]):not([tabindex="-1"])',
  'details > summary:not([tabindex="-1"])',
  '[contenteditable]:not([contenteditable="false"]):not([tabindex="-1"])',
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

/**
 * Get a list of focusable elements inside a container.
 * Live query each time to handle dynamic content.
 */
const getFocusableElements = (container) => {
  if (!container) return [];
  return Array.from(container.querySelectorAll(FOCUSABLE_SELECTORS)).filter(
    (el) => !el.closest("[hidden]") && !el.closest('[aria-hidden="true"]'),
  );
};

/**
 * useFocusTrap
 *
 * Hook to trap focus inside the container when active.
 * - Queries focusable elements LIVE every Tab press to handle dynamic content.
 * - Restores focus to the previous element when deactivated.
 * - Uses requestAnimationFrame to focus after enter animation completes.
 *
 * @param {boolean} active - Enable/disable focus trap
 * @param {Object} options
 * @param {boolean} [options.autoFocus=true] - Auto focus first element
 * @param {boolean} [options.restoreFocus=true] - Restore focus on deactivate
 * @returns {React.RefObject} - Ref attached to the container element
 */
export const useFocusTrap = (
  active = true,
  { autoFocus = true, restoreFocus = true } = {},
) => {
  const containerRef = useRef(null);
  const previousFocusRef = useRef(null);
  const rafRef = useRef(null);

  useEffect(() => {
    if (!active) return;

    // Save the currently focused element before the trap is activated
    previousFocusRef.current = document.activeElement;

    const container = containerRef.current;
    if (!container) return;

    // Focus the first element after the animation finishes rendering
    if (autoFocus) {
      rafRef.current = requestAnimationFrame(() => {
        const focusable = getFocusableElements(container);
        const target = focusable[0] ?? container;
        target.focus({ preventScroll: true });
      });
    }

    const handleKeyDown = (e) => {
      if (e.key !== "Tab") return;

      // Live query - handles dynamic content added after render
      const focusable = getFocusableElements(container);
      if (focusable.length === 0) {
        e.preventDefault();
        container.focus({ preventScroll: true });
        return;
      }

      const firstEl = focusable[0];
      const lastEl = focusable[focusable.length - 1];
      const activeEl = document.activeElement;
      const isInsideContainer = container.contains(activeEl);

      if (e.shiftKey) {
        // Shift+Tab: if at first element or outside container -> wrap to last
        if (!isInsideContainer || activeEl === firstEl) {
          e.preventDefault();
          lastEl.focus({ preventScroll: true });
        }
      } else {
        // Tab: if at last element or outside container -> wrap to first
        if (!isInsideContainer || activeEl === lastEl) {
          e.preventDefault();
          firstEl.focus({ preventScroll: true });
        }
      }
    };

    // Use capture phase to prioritize focus trap handling
    container.addEventListener("keydown", handleKeyDown, true);

    return () => {
      cancelAnimationFrame(rafRef.current);
      container.removeEventListener("keydown", handleKeyDown, true);

      // Restore focus
      if (restoreFocus) {
        const target = previousFocusRef.current;
        if (target && typeof target.focus === "function") {
          // Slight delay to prevent conflict with exit animations
          requestAnimationFrame(() => {
            try {
              target.focus({ preventScroll: true });
            } catch {
              // Element might have been unmounted
            }
          });
        }
      }
    };
  }, [active, autoFocus, restoreFocus]);

  return containerRef;
};
