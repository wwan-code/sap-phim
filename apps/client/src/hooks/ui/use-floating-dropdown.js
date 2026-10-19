/**
 * @file use-floating-dropdown.js
 * @module Hooks/UI/UseFloatingDropdown
 * @description Hook quản lý menu thả xuống nổi (Floating Dropdown) hỗ trợ nhận diện thiết bị và hỗ trợ truy cập.
 */

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import {
  useFloating,
  autoUpdate,
  offset as offsetMiddleware,
  flip as flipMiddleware,
  shift as shiftMiddleware,
  size as sizeMiddleware,
  useTransitionStyles,
  useInteractions,
  useHover,
  useFocus,
  useClick,
  useRole,
  useDismiss,
  safePolygon,
  FloatingPortal,
  FloatingFocusManager,
  arrow as arrowMiddleware,
} from "@floating-ui/react";
import { useDeviceType } from "./use-device-type";

/**
 * Performance-optimized RAF scheduler for position updates
 */
class RAFScheduler {
  constructor() {
    this.rafId = null;
    this.callbacks = new Set();
  }

  schedule(callback) {
    this.callbacks.add(callback);
    if (!this.rafId) {
      this.rafId = requestAnimationFrame(() => this.flush());
    }
  }

  flush() {
    const callbacks = Array.from(this.callbacks);
    this.callbacks.clear();
    this.rafId = null;
    callbacks.forEach((cb) => cb());
  }

  cancel(callback) {
    this.callbacks.delete(callback);
    if (this.callbacks.size === 0 && this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  clear() {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
    }
    this.callbacks.clear();
    this.rafId = null;
  }
}

// Singleton scheduler for all dropdowns
const globalScheduler = new RAFScheduler();

// [FIX] Hằng số module-level cho các default dạng object/hàm.
// Nếu để `margin = { x: 16, y: 16 }` hay `deviceBehaviors = {}` làm default
// param trực tiếp, JS sẽ tạo ra một object MỚI mỗi lần hook được gọi mà
// caller không truyền field đó — khiến mọi `useMemo` phụ thuộc vào chúng
// (marginConfig, deviceConfig...) không bao giờ thực sự "nhớ" được gì, vì
// dependency luôn bị coi là "đổi". Đưa ra ngoài thành hằng số module-level
// giữ nguyên 1 reference duy nhất khi caller không truyền.
const DEFAULT_MARGIN = { x: 16, y: 16 };
const DEFAULT_DEVICE_BEHAVIORS = {};
const DEVICE_TYPE_OPTIONS = { debounceDelay: 100, useMatchMedia: true };

/**
 * Advanced scroll lock manager with passive event optimization
 */
const useScrollLock = (isActive, options = {}) => {
  const { allowTouchMove = null, reserveScrollBarGap = true } = options;

  useEffect(() => {
    if (!isActive) return;

    const originalOverflow = document.body.style.overflow;
    const originalPaddingRight = document.body.style.paddingRight;

    // Reserve scrollbar gap to prevent layout shift
    if (reserveScrollBarGap) {
      const scrollbarWidth =
        window.innerWidth - document.documentElement.clientWidth;
      if (scrollbarWidth > 0) {
        document.body.style.paddingRight = `${scrollbarWidth}px`;
      }
    }

    document.body.style.overflow = "hidden";

    // Prevent touch scrolling on mobile
    const preventScroll = (e) => {
      if (allowTouchMove && allowTouchMove(e.target)) {
        return;
      }
      e.preventDefault();
    };

    document.addEventListener("touchmove", preventScroll, { passive: false });

    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.paddingRight = originalPaddingRight;
      document.removeEventListener("touchmove", preventScroll);
    };
  }, [isActive, allowTouchMove, reserveScrollBarGap]);
};

/**
 * Floating Dropdown Hook
 *
 * A professional-grade hook for managing floating UI elements with device-aware behavior,
 * optimized performance, and comprehensive accessibility support.
 *
 * Key Features:
 * - Device-aware positioning and behavior (mobile/tablet/desktop)
 * - RAF-optimized position updates for 60fps performance
 * - Full accessibility support (ARIA, focus management)
 * - Smooth spring-based animations with device-specific durations
 * - Smart mobile adaptations (full-width, bottom sheet, scroll lock)
 * - Phase-based state machine for micro-interactions
 * - Portal rendering with z-index management
 * - Configurable viewport clamping and collision detection
 * - Focus trap for modal-like behavior
 * - Memory leak prevention and cleanup
 *
 * @param {Object} options - Configuration options
 * @param {import('@floating-ui/react').Placement} [options.placement='bottom-start'] - Preferred placement
 * @param {number|Object} [options.offset=8] - Distance from reference element
 * @param {Object} [options.margin={x:16, y:16}] - Viewport edge margins
 * @param {boolean} [options.observe=true] - Auto-update on scroll/resize
 * @param {string} [options.trigger='click'] - Interaction trigger ('click'|'hover'|'focus'|'manual')
 * @param {boolean} [options.isOpen] - Controlled open state
 * @param {Function} [options.onOpenChange] - Open state change callback
 * @param {number} [options.openDuration] - Opening animation duration (auto for device)
 * @param {number} [options.closeDuration] - Closing animation duration (auto for device)
 * @param {string} [options.strategy='fixed'] - CSS position strategy
 * @param {boolean} [options.enableScrollLock=true] - Lock body scroll when open
 * @param {boolean} [options.usePortal=true] - Render in portal
 * @param {string} [options.portalId='floating-root'] - Portal container ID
 * @param {boolean} [options.focusTrap=false] - Trap focus within dropdown
 * @param {boolean} [options.modal=false] - Modal behavior (backdrop + focus trap)
 * @param {Object} [options.deviceBehaviors] - Device-specific overrides
 * @param {number} [options.zIndex=1000] - Base z-index
 * @param {Function} [options.onPhaseChange] - Phase change callback
 * @param {boolean} [options.adaptToDevice=true] - Auto-adapt to device capabilities
 * @returns {Object} Hook API with refs, styles, and interaction props
 */
export const useFloatingDropdown = ({
  placement = "bottom-start",
  offset = 8,
  margin = DEFAULT_MARGIN,
  observe = true,
  trigger = "click",
  hoverDelay,
  isOpen: controlledIsOpen,
  onOpenChange: setControlledIsOpen,
  openDuration,
  closeDuration,
  strategy = "fixed",
  enableScrollLock = true,
  usePortal = true,
  portalId = "floating-root",
  focusTrap = false,
  modal = false,
  deviceBehaviors = DEFAULT_DEVICE_BEHAVIORS,
  zIndex = 1000,
  onPhaseChange,
  adaptToDevice = true,
  arrowRef = null,
  arrowPadding = 0,
  enableSizeMiddleware = true,
} = {}) => {
  const [uncontrolledIsOpen, setUncontrolledIsOpen] = useState(false);
  const updateCallbackRef = useRef(null);
  const mountTimeRef = useRef(Date.now());

  // Advanced device detection
  const deviceInfo = useDeviceType(DEVICE_TYPE_OPTIONS);

  const isOpen = controlledIsOpen ?? uncontrolledIsOpen;
  const setIsOpen = setControlledIsOpen ?? setUncontrolledIsOpen;

  // [FIX] Giữ `setIsOpen` mới nhất trong ref. Nếu `onOpenChange` được caller
  // truyền dạng inline function (rất phổ biến), `setIsOpen` sẽ đổi reference
  // mỗi render — nếu để nó trong dependency array của các effect bên dưới,
  // effect đó sẽ bị teardown/setup lại không cần thiết mỗi render trong lúc
  // dropdown đang mở. Đọc qua ref để không phải liệt kê nó vào deps.
  const setIsOpenRef = useRef(setIsOpen);
  setIsOpenRef.current = setIsOpen;

  // Device-adaptive durations
  const adaptiveDurations = useMemo(() => {
    if (openDuration !== undefined && closeDuration !== undefined) {
      return { open: openDuration, close: closeDuration };
    }

    // Faster animations on mobile for better perceived performance
    if (deviceInfo.isMobile) {
      return { open: 200, close: 120 };
    } else if (deviceInfo.isTablet) {
      return { open: 250, close: 150 };
    } else {
      return { open: 300, close: 180 };
    }
    // [FIX][PERF] Deps trước đây là cả object `deviceInfo` — mọi thay đổi
    // width/height/orientation/pixelRatio... trong CÙNG một hạng mục thiết
    // bị (vẫn `isMobile`/`isTablet` như cũ) cũng khiến object này được tính
    // lại và tạo ra REFERENCE MỚI, kéo theo mọi nơi dùng nó (backdropStyles,
    // hiệu ứng phase, useTransitionStyles...) coi như "đã đổi". Hẹp deps
    // xuống đúng 2 field responsive thực sự cần.
  }, [deviceInfo.isMobile, deviceInfo.isTablet, openDuration, closeDuration]);

  // Device-specific behaviors
  const deviceConfig = useMemo(() => {
    const defaults = {
      mobileSmall: {
        fullWidth: true,
        bottomSheet: false,
        placement: "bottom",
        maxHeight: "85vh",
        ...deviceBehaviors.mobileSmall,
      },
      mobileLarge: {
        fullWidth: false,
        bottomSheet: false,
        maxHeight: "75vh",
        ...deviceBehaviors.mobileLarge,
      },
      mobile: {
        fullWidth: true,
        bottomSheet: false,
        placement: "bottom",
        maxHeight: "85vh",
        ...deviceBehaviors.mobile,
      },
      tablet: {
        fullWidth: false,
        bottomSheet: false,
        maxHeight: "70vh",
        ...deviceBehaviors.tablet,
      },
      desktop: {
        fullWidth: false,
        bottomSheet: false,
        maxHeight: "600px",
        ...deviceBehaviors.desktop,
      },
    };

    if (deviceInfo.isMobileSmall) {
      return { ...defaults.mobile, ...defaults.mobileSmall };
    }
    if (deviceInfo.isMobileLarge || deviceInfo.isMobile) {
      return { ...defaults.mobile, bottomSheet: false, fullWidth: false, ...defaults.mobileLarge };
    }
    if (deviceInfo.isTablet) return defaults.tablet;
    return defaults.desktop;
    // [FIX][PERF] Hẹp deps xuống đúng 4 field boolean được đọc ở trên, thay
    // vì cả object `deviceInfo` — tránh tính lại (và tạo object mới) khi
    // width/orientation/pixelRatio đổi nhưng hạng mục thiết bị không đổi.
  }, [
    deviceInfo.isMobileSmall,
    deviceInfo.isMobileLarge,
    deviceInfo.isMobile,
    deviceInfo.isTablet,
    deviceBehaviors,
  ]);

  // Phase state machine with timing tracking
  const [phase, setPhase] = useState("idle");
  const phaseTimestampRef = useRef({});

  // [FIX] Giữ `onPhaseChange` mới nhất trong ref thay vì làm dependency của
  // `updatePhase`. Nếu caller truyền `onPhaseChange` dạng inline function,
  // trước đây `updatePhase` sẽ đổi identity MỖI RENDER, kéo theo effect
  // phase machine bên dưới (phụ thuộc `updatePhase`) cũng chạy lại liên tục.
  // Giờ `updatePhase` có deps rỗng — identity ổn định vĩnh viễn.
  const onPhaseChangeRef = useRef(onPhaseChange);
  onPhaseChangeRef.current = onPhaseChange;

  const updatePhase = useCallback((newPhase) => {
    setPhase((prev) => {
      if (prev !== newPhase) {
        phaseTimestampRef.current[newPhase] = Date.now();
        onPhaseChangeRef.current?.(newPhase, prev);
        return newPhase;
      }
      return prev;
    });
  }, []);

  // Enhanced phase tracking - using ref to avoid dependency on phase
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  // [FIX][BUG] Giữ duration mới nhất trong ref thay vì để trong dependency
  // của effect bên dưới. Bản gốc phụ thuộc `adaptiveDurations.open/close`,
  // gây 2 lỗi thật khi người dùng đổi kích thước cửa sổ (đổi breakpoint,
  // nên đổi duration) NGAY LÚC dropdown đang mở/đóng:
  //   1) Nếu đang ở trạng thái "open" ổn định, effect chạy lại và gọi
  //      updatePhase("opening") lần nữa dù không hề có một lần mở mới nào
  //      xảy ra — dropdown bị replay hiệu ứng "opening" một cách giả tạo.
  //   2) Nghiêm trọng hơn: nếu đổi duration ĐÚNG LÚC phase đang "closing",
  //      cleanup của lần effect trước sẽ clearTimeout() timer "closing →
  //      idle" cũ, còn lần effect mới thì thấy currentPhase === "closing"
  //      (không phải "open"/"opening") nên KHÔNG đặt lại timer nào cả —
  //      phase bị KẸT VĨNH VIỄN ở "closing", không bao giờ về "idle".
  // Chỉ để `isOpen` (và `updatePhase` nay đã ổn định) làm dependency giúp
  // effect chỉ chạy đúng lúc thật sự có một lần mở/đóng mới.
  const adaptiveDurationsRef = useRef(adaptiveDurations);
  adaptiveDurationsRef.current = adaptiveDurations;

  useEffect(() => {
    if (isOpen) {
      updatePhase("opening");
      const openTimer = setTimeout(() => {
        updatePhase("open");
      }, adaptiveDurationsRef.current.open);
      return () => clearTimeout(openTimer);
    } else {
      const currentPhase = phaseRef.current;
      if (currentPhase === "open" || currentPhase === "opening") {
        updatePhase("closing");
        const closeTimer = setTimeout(() => {
          updatePhase("idle");
        }, adaptiveDurationsRef.current.close);
        return () => clearTimeout(closeTimer);
      } else if (currentPhase === "pressing") {
        updatePhase("idle");
      }
    }
  }, [isOpen, updatePhase]);

  // [FIX][BUG] `allowTouchMove` phải ổn định identity. Bản gốc truyền một
  // arrow function inline ngay tại call site — bị tạo mới ở MỌI lần render,
  // và `useScrollLock` liệt kê nó trong dependency array của effect (khóa
  // scroll body). Hệ quả: mỗi khi component cha re-render trong lúc dropdown
  // đang mở, effect scroll-lock bị teardown rồi setup lại ngay — reset
  // `document.body.style.overflow`, tính lại scrollbar gap, gỡ/gắn lại
  // touchmove listener — hoàn toàn không cần thiết và có thể gây giật hình.
  const allowScrollWithinDropdown = useCallback((el) => {
    // Allow scrolling within the dropdown
    return el.closest("[data-floating-scroll]") !== null;
  }, []);

  // Advanced scroll lock with touch move allowance
  useScrollLock(isOpen && enableScrollLock && (deviceInfo.isMobile || modal), {
    allowTouchMove: allowScrollWithinDropdown,
    reserveScrollBarGap: !deviceInfo.isMobile,
  });

  // Parse configurations
  const offsetConfig = useMemo(() => {
    if (typeof offset === "number") {
      return { mainAxis: offset, crossAxis: 0 };
    }
    return { mainAxis: offset.mainAxis || 8, crossAxis: offset.crossAxis || 0 };
  }, [offset]);

  const marginConfig = useMemo(() => {
    return { x: margin.x || 16, y: margin.y || 16 };
  }, [margin]);

  // Adaptive placement for mobile
  const adaptivePlacement = useMemo(() => {
    if (adaptToDevice && deviceConfig.bottomSheet) {
      return "bottom";
    }
    if (adaptToDevice && deviceInfo.isMobile && deviceConfig.fullWidth) {
      return "bottom";
    }
    return placement;
    // [FIX][PERF] Hẹp deps xuống 2 field thật sự dùng của deviceConfig thay
    // vì cả object.
  }, [adaptToDevice, deviceConfig.bottomSheet, deviceConfig.fullWidth, deviceInfo.isMobile, placement]);

  // [FIX][PERF] QUAN TRỌNG: bọc `middleware` bằng useMemo với deps chính
  // xác. Tài liệu floating-ui khuyến cáo rõ mảng `middleware` truyền cho
  // `useFloating` PHẢI được memo hoá — nếu không, mảng bị coi là "mới" ở
  // mọi lần render, khiến `whileElementsMounted: autoUpdate` teardown rồi
  // subscribe lại toàn bộ scroll/resize listener của autoUpdate liên tục,
  // rất tốn kém (đặc biệt khi có nhiều ancestor scrollable). Bản gốc tạo
  // mảng này inline ngay trong object cấu hình của `useFloating` — luôn là
  // reference mới mỗi render.
  const middleware = useMemo(
    () =>
      [
        offsetMiddleware(offsetConfig),
        flipMiddleware({
          padding: marginConfig.y,
          fallbackPlacements: deviceInfo.isMobile
            ? ["bottom", "top"]
            : ["bottom-start", "top-start", "bottom-end", "top-end"],
        }),
        shiftMiddleware({
          padding: {
            top: marginConfig.y,
            bottom: marginConfig.y,
            left: marginConfig.x,
            right: marginConfig.x,
          },
        }),
        arrowRef ? arrowMiddleware({ element: arrowRef, padding: arrowPadding }) : null,
        enableSizeMiddleware
          ? sizeMiddleware({
            padding: marginConfig.y,
            apply({ availableHeight, availableWidth, elements }) {
              let maxHeight = availableHeight;
              if (deviceConfig.maxHeight) {
                const parsedConfigMax = parseInt(deviceConfig.maxHeight, 10);
                if (!isNaN(parsedConfigMax) && parsedConfigMax > 0) {
                  maxHeight = Math.min(availableHeight, parsedConfigMax);
                }
              }

              Object.assign(elements.floating.style, {
                maxHeight: `${maxHeight}px`,
                overflowY: "auto",
                ...(deviceConfig.bottomSheet ? {
                  width: "100%",
                  maxWidth: "100vw",
                } : deviceConfig.fullWidth ? {
                  width: `${availableWidth}px`,
                  maxWidth: "100vw",
                } : {}),
              });
            },
          })
          : null,
      ].filter(Boolean),
    [
      offsetConfig,
      marginConfig.y,
      marginConfig.x,
      deviceInfo.isMobile,
      arrowRef,
      arrowPadding,
      enableSizeMiddleware,
      deviceConfig.maxHeight,
      deviceConfig.bottomSheet,
      deviceConfig.fullWidth,
    ],
  );

  // Floating UI configuration
  const {
    x,
    y,
    strategy: positionStrategy,
    refs,
    context,
  } = useFloating({
    placement: adaptivePlacement,
    open: isOpen,
    onOpenChange: setIsOpen,
    strategy,
    whileElementsMounted: observe ? autoUpdate : undefined,
    middleware,
  });

  // [FIX][PERF] Bọc `initial`/`close` bằng useCallback với deps hẹp, đồng bộ
  // với phần còn lại — tránh tạo mới 2 hàm này ở mọi render khi không cần.
  const getInitialTransitionStyles = useCallback(
    ({ side }) => {
      if (deviceConfig.bottomSheet) {
        return {
          opacity: 0,
          transform: "translateY(100%)",
        };
      }

      const translateY = deviceInfo.isMobile ? 6 : 8;

      return {
        opacity: 0,
        transform:
          side === "bottom"
            ? `translateY(-${translateY}px)`
            : `translateY(${translateY}px)`,
      };
    },
    [deviceConfig.bottomSheet, deviceInfo.isMobile],
  );

  const getCloseTransitionStyles = useCallback(
    ({ side }) => {
      if (deviceConfig.bottomSheet) {
        return {
          opacity: 0,
          transform: "translateY(100%)",
        };
      }

      const translateY = deviceInfo.isMobile ? 4 : 6;

      return {
        opacity: 0,
        transform:
          side === "bottom"
            ? `translateY(-${translateY}px)`
            : `translateY(${translateY}px)`,
      };
    },
    [deviceConfig.bottomSheet, deviceInfo.isMobile],
  );

  // Smooth ease-in-out transition styles
  const { isMounted, styles: transitionStyles } = useTransitionStyles(context, {
    duration: adaptiveDurations,
    initial: getInitialTransitionStyles,
    open: {
      opacity: 1,
      transform: "translateY(0)",
    },
    close: getCloseTransitionStyles,
  });

  const parsedHoverDelay = useMemo(() => {
    if (hoverDelay !== undefined) return hoverDelay;
    return { open: 50, close: 150 };
  }, [hoverDelay]);

  // Interaction configuration with device-aware settings
  const hoverConfig = useMemo(
    () => ({
      enabled: trigger === "hover",
      delay: parsedHoverDelay,
      handleClose: safePolygon({ blockPointerEvents: true }),
      restMs: 20,
    }),
    [trigger, parsedHoverDelay],
  );

  const clickConfig = useMemo(
    () => ({
      enabled: trigger === "click" || trigger === "hover",
      toggle: true,
      ignoreMouse: false,
    }),
    [trigger],
  );

  // Interaction hooks
  const click = useClick(context, clickConfig);
  const hover = useHover(context, hoverConfig);
  const focus = useFocus(context, { enabled: trigger === "focus" });
  const role = useRole(context, { role: modal ? "dialog" : "menu" });
  // [FIX][BUG] `outsidePress` tắt ở đây (false) vì effect click-outside thủ
  // công ngay bên dưới đã tự xử lý toàn bộ việc đóng dropdown khi click ra
  // ngoài (comment gốc giải thích đây là cách làm để đảm bảo đóng được kể cả
  // trong modal/portal lồng nhau). Bản gốc bật CẢ HAI cơ chế cùng lúc
  // (`useDismiss({ outsidePress: true })` VÀ listener thủ công), nên một cú
  // click ra ngoài có thể gọi `setIsOpen(false)`/`onOpenChange` 2 LẦN —
  // nếu `onOpenChange` phía caller có side-effect (tracking, logging...) thì
  // side-effect đó cũng chạy trùng lặp. `escapeKey` không bị ảnh hưởng vì nó
  // là cơ chế độc lập với `outsidePress` trong floating-ui.
  const dismiss = useDismiss(context, {
    escapeKey: true,
    outsidePress: false,
    referencePress: false,
  });

  const { getReferenceProps, getFloatingProps } = useInteractions([
    click,
    hover,
    focus,
    role,
    dismiss,
  ]);

  // Robust capture-phase click-outside handler to ensure dropdown closes reliably even inside modals/portals
  useEffect(() => {
    if (!isOpen) return;

    const handleOutsideClick = (event) => {
      const referenceEl = refs.reference.current;
      const floatingEl = refs.floating.current;

      if (!referenceEl || !floatingEl) return;

      if (referenceEl.contains(event.target) || floatingEl.contains(event.target)) {
        return;
      }

      setIsOpenRef.current(false);
    };

    document.addEventListener("pointerdown", handleOutsideClick, true);
    return () => {
      document.removeEventListener("pointerdown", handleOutsideClick, true);
    };
    // [FIX][PERF] Bỏ `setIsOpen` khỏi deps — đọc qua `setIsOpenRef` (xem
    // định nghĩa phía trên). Nếu không, mỗi khi `onOpenChange` do caller
    // truyền vào là inline function, listener này bị gỡ/gắn lại mỗi render
    // trong lúc dropdown đang mở.
  }, [isOpen, refs.reference, refs.floating]);

  // Dynamic transform-origin calculation
  const transformOrigin = useMemo(() => {
    if (deviceConfig.bottomSheet) {
      return "bottom center";
    }

    const [side, align = "center"] = context.placement.split("-");
    const oppositeSide =
      {
        top: "bottom",
        bottom: "top",
        left: "right",
        right: "left",
      }[side] || "top";

    const alignment =
      {
        start: "left",
        end: "right",
        center: "center",
      }[align] || "center";

    return `${oppositeSide} ${alignment}`;
  }, [context.placement, deviceConfig.bottomSheet]);

  // RAF-optimized recalc with scheduler
  const recalc = useCallback(() => {
    if (updateCallbackRef.current) {
      globalScheduler.cancel(updateCallbackRef.current);
    }

    updateCallbackRef.current = () => {
      if (refs.floating.current && context.update) {
        context.update();
      }
    };

    globalScheduler.schedule(updateCallbackRef.current);
  }, [context, refs.floating]);

  // Cleanup scheduler on unmount
  useEffect(() => {
    return () => {
      if (updateCallbackRef.current) {
        globalScheduler.cancel(updateCallbackRef.current);
      }
    };
  }, []);

  // Enhanced floating styles with z-index and device adaptations
  const floatingStyles = useMemo(
    () => ({
      position: positionStrategy,
      top: deviceConfig.bottomSheet ? "auto" : (y ?? 0),
      left: deviceConfig.bottomSheet ? 0 : (x ?? 0),
      right: deviceConfig.bottomSheet ? 0 : "auto",
      bottom: deviceConfig.bottomSheet ? 0 : "auto",
      transformOrigin,
      zIndex: modal ? zIndex + 100 : zIndex,
      width: deviceConfig.bottomSheet || deviceConfig.fullWidth ? "100%" : "auto",
      maxWidth: "100vw",
      ...transitionStyles,
      ...(deviceConfig.bottomSheet && {
        borderBottomLeftRadius: 0,
        borderBottomRightRadius: 0,
      }),
    }),
    // [FIX][PERF] Hẹp deps xuống 2 field thật sự dùng của deviceConfig.
    [
      positionStrategy,
      x,
      y,
      transformOrigin,
      transitionStyles,
      modal,
      zIndex,
      deviceConfig.bottomSheet,
      deviceConfig.fullWidth,
    ],
  );

  // Backdrop styles for modal
  const backdropStyles = useMemo(
    () => ({
      position: "fixed",
      inset: 0,
      backgroundColor: "rgba(0, 0, 0, 0.5)",
      backdropFilter: "blur(4px)",
      zIndex: zIndex - 1,
      opacity: isOpen ? 1 : 0,
      transition: `opacity ${adaptiveDurations.open}ms cubic-bezier(0.4, 0, 0.2, 1)`,
    }),
    [isOpen, zIndex, adaptiveDurations.open],
  );

  // Performance metrics
  const metrics = useMemo(
    () => ({
      mountTime: mountTimeRef.current,
      deviceType: deviceInfo.type,
      isTouch: deviceInfo.isTouch,
      orientation: deviceInfo.orientation,
      phase,
      phaseTimestamps: phaseTimestampRef.current,
    }),
    // [FIX][PERF] Hẹp deps xuống 3 field thật sự dùng của deviceInfo thay vì
    // cả object — vd đổi pixelRatio (cắm thêm màn hình ngoài) sẽ không còn
    // làm `metrics` (và bất kỳ consumer nào so sánh nó) bị coi là "đổi".
    [deviceInfo.type, deviceInfo.isTouch, deviceInfo.orientation, phase],
  );

  // Store base props from interactions (these are already memoized internally)
  const baseReferenceProps = getReferenceProps();
  const baseFloatingProps = getFloatingProps();

  // [FIX][PERF] `baseReferenceProps`/`baseFloatingProps` là object MỚI ở mỗi
  // render (được gọi trực tiếp từ `getReferenceProps()`/`getFloatingProps()`
  // ngay phía trên). Bản gốc bọc `useCallback` nhưng lại để chính 2 object
  // này làm dependency — nghĩa là "memoization" đó không có tác dụng thật:
  // hàm vẫn bị tạo mới ở MỌI render dù có `useCallback`. Ở đây giữ giá trị
  // mới nhất qua ref rồi cho 2 hàm trả về deps rỗng — identity của
  // `getReferenceProps`/`getFloatingProps` (bản enhanced) giờ ổn định thật
  // sự, hữu ích nếu consumer truyền chúng xuống component con bọc
  // `React.memo`.
  const baseReferencePropsRef = useRef(baseReferenceProps);
  baseReferencePropsRef.current = baseReferenceProps;
  const baseFloatingPropsRef = useRef(baseFloatingProps);
  baseFloatingPropsRef.current = baseFloatingProps;
  const deviceTypeRef = useRef(deviceInfo.type);
  deviceTypeRef.current = deviceInfo.type;

  // Enhanced reference props with phase tracking - use callback to avoid recreating object
  const getEnhancedReferenceProps = useCallback((userProps = {}) => {
    const base = baseReferencePropsRef.current;
    return {
      ...base,
      ...userProps,
      onClick: (e) => {
        userProps.onClick?.(e);
        base.onClick?.(e);
      },
    };
  }, []);

  // Enhanced floating props with scroll data attribute
  const getEnhancedFloatingProps = useCallback((userProps = {}) => {
    return {
      ...baseFloatingPropsRef.current,
      ...userProps,
      "data-floating-scroll": true,
      "data-device-type": deviceTypeRef.current,
      "data-phase": phaseRef.current,
    };
  }, []);

  return {
    // Core state
    isOpen,
    setIsOpen,
    isMounted,
    phase,

    // Device information
    deviceInfo,
    deviceConfig,

    // Refs
    refs,
    context,

    // Styles
    floatingStyles,
    backdropStyles,
    transformOrigin,

    // Interaction props (pass optional user props to merge)
    getReferenceProps: getEnhancedReferenceProps,
    getFloatingProps: getEnhancedFloatingProps,

    // Portal configuration
    usePortal,
    portalId,

    // Focus management
    focusTrap: focusTrap || modal,
    modal,

    // Metadata
    placement: context.placement,
    strategy: positionStrategy,
    metrics,
    arrowData: refs.floating.current && context.middlewareData?.arrow ? context.middlewareData.arrow : null,

    // Utilities
    recalc,

    // Advanced features
    FloatingPortal,
    FloatingFocusManager,
  };
};