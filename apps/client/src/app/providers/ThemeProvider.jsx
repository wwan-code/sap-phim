/**
 * @file ThemeProvider.jsx
 * @module App/Providers/ThemeProvider
 * @description Provider quản lý Theme hệ thống tích hợp View Transitions API (Circular Ripple Reveal) chuẩn hóa với React flushSync và CSS Fallback cho Aesthetic OS.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import PropTypes from 'prop-types';

import { ThemeContext } from '@/shared/contexts/ThemeContext';

const THEME_STORAGE_KEY = 'sap-phim-theme';

/**
 * @component ThemeProvider
 * @description Provider cung cấp trạng thái Theme (Dark/Light/System) với hiệu ứng chuyển đổi lan tỏa hình tròn đồng bộ và siêu mượt.
 */
export const ThemeProvider = ({ children }) => {
  const [theme, setThemeState] = useState(() => {
    try {
      return localStorage.getItem(THEME_STORAGE_KEY) || 'dark';
    } catch {
      return 'dark';
    }
  });

  const getSystemTheme = useCallback(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }, []);

  const resolvedTheme = useMemo(() => {
    if (theme === 'system') return getSystemTheme();
    return theme === 'light' ? 'light' : 'dark';
  }, [theme, getSystemTheme]);

  const applyThemeToDOM = useCallback((appliedTheme) => {
    document.documentElement.setAttribute('data-theme', appliedTheme);
    const metaTheme =
      document.getElementById('app-theme-color') ||
      document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute('content', appliedTheme === 'dark' ? '#07080a' : '#f8f9fc');
    }
  }, []);

  // Đồng bộ theme vào DOM lúc khởi tạo ban đầu
  useEffect(() => {
    applyThemeToDOM(resolvedTheme);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Bỏ qua lỗi quota localStorage
    }
  }, [theme, resolvedTheme, applyThemeToDOM]);

  // Lắng nghe thay đổi theme từ hệ điều hành (OS system change)
  useEffect(() => {
    if (theme !== 'system' || typeof window === 'undefined' || !window.matchMedia) return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      applyThemeToDOM(getSystemTheme());
    };

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    } else {
      mediaQuery.addListener(handleChange);
      return () => mediaQuery.removeListener(handleChange);
    }
  }, [theme, getSystemTheme, applyThemeToDOM]);

  const fallbackTimeoutRef = useRef(null);

  /**
   * Điều phối hoạt ảnh chuyển đổi Theme (View Transitions API / Fallback CSS)
   */
  const performThemeChange = useCallback(
    async (nextTheme, event, commitFn) => {
      const nextResolved = nextTheme === 'system' ? getSystemTheme() : nextTheme;

      // Nếu theme sau chuyển đổi trùng với theme hiện tại, chỉ commit state
      if (nextResolved === resolvedTheme) {
        commitFn();
        return;
      }

      const isViewTransitionSupported =
        typeof document !== 'undefined' &&
        'startViewTransition' in document &&
        typeof document.startViewTransition === 'function';

      const prefersReducedMotion =
        typeof window !== 'undefined' &&
        window.matchMedia &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      // 1. Engine View Transitions API (Circular Ripple Reveal)
      if (isViewTransitionSupported && !prefersReducedMotion) {
        let x = window.innerWidth / 2;
        let y = window.innerHeight / 2;

        if (
          event &&
          typeof event.clientX === 'number' &&
          typeof event.clientY === 'number' &&
          (event.clientX !== 0 || event.clientY !== 0)
        ) {
          x = event.clientX;
          y = event.clientY;
        } else if (event?.currentTarget && typeof event.currentTarget.getBoundingClientRect === 'function') {
          const rect = event.currentTarget.getBoundingClientRect();
          x = rect.left + rect.width / 2;
          y = rect.top + rect.height / 2;
        } else if (event?.target && typeof event.target.getBoundingClientRect === 'function') {
          const rect = event.target.getBoundingClientRect();
          x = rect.left + rect.width / 2;
          y = rect.top + rect.height / 2;
        }

        const endRadius = Math.hypot(
          Math.max(x, window.innerWidth - x),
          Math.max(y, window.innerHeight - y)
        );

        const transition = document.startViewTransition(() => {
          flushSync(() => {
            commitFn();
            applyThemeToDOM(nextResolved);
          });
        });

        try {
          await transition.ready;
          document.documentElement.animate(
            {
              clipPath: [
                `circle(0px at ${x}px ${y}px)`,
                `circle(${endRadius}px at ${x}px ${y}px)`,
              ],
            },
            {
              duration: 450,
              easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
              pseudoElement: '::view-transition-new(root)',
            }
          );
        } catch {
          // Bỏ qua lỗi nếu transition bị hủy
        }
        return;
      }

      // 2. Engine CSS Transition Fallback (khi không hỗ trợ View Transitions)
      if (!prefersReducedMotion) {
        if (fallbackTimeoutRef.current) {
          clearTimeout(fallbackTimeoutRef.current);
        }
        document.documentElement.setAttribute('data-theme-transitioning', 'true');
        flushSync(() => {
          commitFn();
          applyThemeToDOM(nextResolved);
        });

        fallbackTimeoutRef.current = setTimeout(() => {
          document.documentElement.removeAttribute('data-theme-transitioning');
        }, 300);
        return;
      }

      // 3. Chuyển đổi tức thì khi bật reduced-motion
      commitFn();
      applyThemeToDOM(nextResolved);
    },
    [getSystemTheme, resolvedTheme, applyThemeToDOM]
  );

  const toggleTheme = useCallback(
    (event) => {
      const next = resolvedTheme === 'dark' ? 'light' : 'dark';
      performThemeChange(next, event, () => setThemeState(next));
    },
    [resolvedTheme, performThemeChange]
  );

  const setTheme = useCallback(
    (newTheme, event) => {
      if (['dark', 'light', 'system'].includes(newTheme)) {
        performThemeChange(newTheme, event, () => setThemeState(newTheme));
      }
    },
    [performThemeChange]
  );

  const contextValue = useMemo(
    () => ({
      theme,
      resolvedTheme,
      isDark: resolvedTheme === 'dark',
      toggleTheme,
      setTheme,
    }),
    [theme, resolvedTheme, toggleTheme, setTheme]
  );

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
};

ThemeProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

export default ThemeProvider;
