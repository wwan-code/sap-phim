/**
 * @file use-device-type.js
 * @module Hooks/UI/UseDeviceType
 * @description Hook nhận diện thiết bị thông minh — đồng bộ hoàn toàn với SCSS breakpoints.
 * Hỗ trợ 4 tầng (mobile / tablet / desktop / ultrawide), tablet sub-types,
 * pointer & hover detection (CSS Level 4), Retina display, và orientation.
 */

import {
  useState,
  useEffect,
  useLayoutEffect,
  useMemo,
  useCallback,
} from "react";

// =============================================================================
// BREAKPOINTS — Đồng bộ 1:1 với SCSS _variables.scss
// =============================================================================

export const BREAKPOINTS = {
  sm: 576,    // $breakpoint-sm
  md: 768,    // $breakpoint-md  — ranh giới mobile / tablet
  lg: 1024,   // $breakpoint-lg  — ranh giới tablet-portrait / tablet-landscape
  xl: 1280,   // $breakpoint-xl  — ranh giới tablet / desktop
  xxl: 1440,  // $breakpoint-2xl
  xxxl: 1600, // $breakpoint-3xl — ranh giới desktop / ultrawide
};

const isServer = typeof window === "undefined";

// =============================================================================
// INTERNAL HELPERS
// =============================================================================

const debounce = (func, wait) => {
  let timeoutId;
  const debounced = (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), wait);
  };
  debounced.cancel = () => clearTimeout(timeoutId);
  return debounced;
};

const shallowEqualDeviceInfo = (a, b) => {
  if (a === b) return true;
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  for (const key of keysA) {
    if (a[key] !== b[key]) return false;
  }
  return true;
};

const getInputCapabilities = () => {
  if (isServer || !window.matchMedia) {
    return { isTouch: false, isCoarsePointer: false, isFinePointer: true, hasHover: true };
  }

  const isTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
  const isCoarsePointer = window.matchMedia("(pointer: coarse)").matches;
  const isFinePointer = window.matchMedia("(pointer: fine)").matches;
  const hasHover = window.matchMedia("(hover: hover)").matches;

  return { isTouch, isCoarsePointer, isFinePointer, hasHover };
};

/**
 * Detect pixel density
 */
const getDisplayDensity = () => {
  if (isServer) return { pixelRatio: 1, isRetina: false };

  const pixelRatio = window.devicePixelRatio || 1;
  return { pixelRatio, isRetina: pixelRatio >= 2 };
};

const computeDeviceInfo = (bp) => {
  if (isServer) {
    return {
      type: "desktop",
      width: 0,
      height: 0,
      orientation: "landscape",
      isMobile: false,
      isMobileSmall: false,
      isSmallMobile: false,
      isMobileLarge: false,
      isTablet: false,
      isTabletPortrait: false,
      isTabletLandscape: false,
      isDesktop: true,
      isUltrawide: false,
      ...getInputCapabilities(),
      ...getDisplayDensity(),
    };
  }

  const width = window.innerWidth;
  const height = window.innerHeight;
  const orientation = width > height ? "landscape" : "portrait";

  // Xác định type dựa trên breakpoints
  let type = "desktop";
  if (width < bp.mobile) {
    type = "mobile";
  } else if (width < bp.tablet) {
    type = "tablet";
  } else if (bp.ultrawide !== undefined && bp.ultrawide !== Infinity && width >= bp.ultrawide) {
    type = "ultrawide";
  } else {
    type = "desktop";
  }

  const isMobile = type === "mobile";
  const isMobileSmall = width < BREAKPOINTS.sm;
  const isMobileLarge = isMobile && !isMobileSmall;
  const isTablet = type === "tablet";
  const isDesktop = type === "desktop" || type === "ultrawide";
  const isUltrawide = type === "ultrawide";

  // Tablet sub-types — chỉ có ý nghĩa khi breakpoints mặc định
  const isTabletPortrait = isTablet && width < (bp.tabletLandscape || BREAKPOINTS.lg);
  const isTabletLandscape = isTablet && width >= (bp.tabletLandscape || BREAKPOINTS.lg);

  return {
    type,
    width,
    height,
    orientation,
    isMobile,
    isMobileSmall,
    isSmallMobile: isMobileSmall,
    isMobileLarge,
    isTablet,
    isTabletPortrait,
    isTabletLandscape,
    isDesktop,
    isUltrawide,
    ...getInputCapabilities(),
    ...getDisplayDensity(),
  };
};

const normalizeBreakpoints = (custom) => {
  if (!custom) {
    return {
      mobile: BREAKPOINTS.md,
      tablet: BREAKPOINTS.xl,
      tabletLandscape: BREAKPOINTS.lg,
      ultrawide: BREAKPOINTS.xxxl,
    };
  }

  return {
    mobile: custom.mobile ?? BREAKPOINTS.md,
    tablet: custom.tablet ?? BREAKPOINTS.xl,
    tabletLandscape: custom.tabletLandscape ?? BREAKPOINTS.lg,
    ultrawide: custom.ultrawide ?? BREAKPOINTS.xxxl,
  };
};

// =============================================================================
// MAIN HOOK
// =============================================================================

/**
 * Hook nhận diện thiết bị thông minh.
 *
 * @param {Object} [options] - Cấu hình tùy chọn.
 * @param {Object} [options.breakpoints] - Custom breakpoints (backward-compatible).
 * @param {number} [options.debounceDelay=150] - Delay cho resize fallback (ms).
 * @param {boolean} [options.useMatchMedia=true] - Dùng matchMedia API (hiệu năng cao).
 * @returns {Object} Device information object.
 */
export const useDeviceType = (options = {}) => {
  const {
    breakpoints: customBreakpoints,
    debounceDelay = 150,
    useMatchMedia = true,
  } = options;

  const useIsomorphicLayoutEffect = isServer ? useEffect : useLayoutEffect;

  // Chuẩn hóa breakpoints 1 lần.
  const bp = useMemo(
    () => normalizeBreakpoints(customBreakpoints),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      customBreakpoints?.mobile,
      customBreakpoints?.tablet,
      customBreakpoints?.tabletLandscape,
      customBreakpoints?.ultrawide,
    ],
  );

  const [deviceInfo, setDeviceInfo] = useState(() => computeDeviceInfo(bp));

  const updateDeviceInfo = useCallback(() => {
    setDeviceInfo((prev) => {
      const next = computeDeviceInfo(bp);
      return shallowEqualDeviceInfo(prev, next) ? prev : next;
    });
  }, [bp]);

  const debouncedUpdate = useMemo(
    () => debounce(updateDeviceInfo, debounceDelay),
    [updateDeviceInfo, debounceDelay],
  );

  useIsomorphicLayoutEffect(() => {
    if (isServer) return;

    // --- matchMedia listeners (chính) ---
    if (useMatchMedia && window.matchMedia) {
      const boundaryValues = Array.from(
        new Set(
          [bp.mobile, bp.tabletLandscape, bp.tablet, bp.ultrawide].filter(
            (value) => Number.isFinite(value),
          ),
        ),
      );

      const queries = [
        ...boundaryValues.map((value) =>
          window.matchMedia(`(min-width: ${value}px)`),
        ),
        // Pointer & hover — thay đổi khi user cắm/rút chuột, stylus, v.v.
        window.matchMedia("(pointer: coarse)"),
        window.matchMedia("(hover: hover)"),
        // Orientation
        window.matchMedia("(orientation: portrait)"),
      ];

      const handleChange = () => updateDeviceInfo();

      queries.forEach((mq) => {
        if (mq.addEventListener) {
          mq.addEventListener("change", handleChange);
        } else {
          mq.addListener(handleChange);
        }
      });

      return () => {
        queries.forEach((mq) => {
          if (mq.removeEventListener) {
            mq.removeEventListener("change", handleChange);
          } else {
            mq.removeListener(handleChange);
          }
        });
      };
    }

    // --- Fallback: resize + orientationchange ---
    window.addEventListener("resize", debouncedUpdate);
    window.addEventListener("orientationchange", updateDeviceInfo);

    return () => {
      window.removeEventListener("resize", debouncedUpdate);
      window.removeEventListener("orientationchange", updateDeviceInfo);
      debouncedUpdate.cancel();
    };
  }, [bp, debouncedUpdate, updateDeviceInfo, useMatchMedia]);

  return deviceInfo;
};