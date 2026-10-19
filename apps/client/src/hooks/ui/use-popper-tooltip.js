/**
 * @file use-popper-tooltip.js
 * @module Hooks/UI/UsePopperTooltip
 * @description Custom hook quản lý định vị (Floating UI), tương tác người dùng, delay grouping và touch cho Tooltip.
 */

import { useState, useMemo, useRef, useCallback } from 'react';
import {
  useFloating,
  autoUpdate,
  offset as offsetMiddleware,
  flip as flipMiddleware,
  shift as shiftMiddleware,
  arrow as arrowMiddleware,
  size as sizeMiddleware,
  limitShift,
  useHover,
  useFocus,
  useRole,
  useDismiss,
  useClick,
  useClientPoint,
  useDelayGroup,
  useInteractions,
  safePolygon,
} from '@floating-ui/react';

/**
 * Tính toán Transform Origin dựa trên hướng placement thực tế
 * @param {string} placement - Vị trí của floating element
 * @returns {string} Transform Origin CSS
 */
export function getTransformOrigin(placement = 'top') {
  const [side, alignment] = placement.split('-');

  const originMap = {
    top: {
      default: 'bottom center',
      start: 'bottom left',
      end: 'bottom right',
    },
    bottom: {
      default: 'top center',
      start: 'top left',
      end: 'top right',
    },
    left: {
      default: 'right center',
      start: 'right top',
      end: 'right bottom',
    },
    right: {
      default: 'left center',
      start: 'left top',
      end: 'left bottom',
    },
  };

  const sideOrigins = originMap[side] || originMap.top;
  return sideOrigins[alignment] || sideOrigins.default;
}

/**
 * @hook usePopperTooltip
 * @description Quản lý vị trí Floating UI, sự kiện hover/focus/touch, interactive bridge và delay grouping cho Tooltip.
 * @param {object} options - Các tùy chọn điều khiển
 * @returns {object} Trạng thái, refs, floatingStyles, context và handlers
 */
export function usePopperTooltip({
  arrowElement = null,
  arrowRef = null,
  autoBoundary = true,
  defaultOpen = false,
  disabled = false,
  enterDelay = 200,
  enterNextDelay = 0,
  flip = true,
  followCursor = false,
  id: tooltipId,
  interactive = false,
  leaveDelay = 0,
  offset = 8,
  onOpenChange,
  open: controlledOpen,
  placement = 'top',
  shift = true,
  touch = 'longpress',
  trigger = ['hover', 'focus'],
  useGroup = true,
  ...floatingOptions
} = {}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const isControlled = controlledOpen !== undefined;
  const isOpen = disabled ? false : (isControlled ? controlledOpen : uncontrolledOpen);

  const longPressTimerRef = useRef(null);

  // Xử lý thay đổi trạng thái đóng/mở
  const handleOpenChange = useCallback(
    (nextOpen, event, reason) => {
      if (disabled) return;
      if (!isControlled) {
        setUncontrolledOpen(nextOpen);
      }
      onOpenChange?.(nextOpen, event, reason);
    },
    [disabled, isControlled, onOpenChange]
  );

  // Chuẩn hóa danh sách sự kiện kích hoạt
  const triggers = useMemo(
    () => (Array.isArray(trigger) ? trigger : [trigger]),
    [trigger]
  );

  // Chuẩn hóa cấu hình Offset (number, [crossAxis, mainAxis], hoặc object)
  const offsetConfig = useMemo(() => {
    if (typeof offset === 'number') {
      return { mainAxis: offset };
    }
    if (Array.isArray(offset)) {
      return { crossAxis: offset[0] ?? 0, mainAxis: offset[1] ?? 8 };
    }
    if (typeof offset === 'object' && offset !== null) {
      return offset;
    }
    return { mainAxis: 8 };
  }, [offset]);

  const targetArrow = arrowRef || arrowElement;

  // Floating UI Middlewares Pipeline
  const middleware = useMemo(() => {
    const list = [offsetMiddleware(offsetConfig)];

    if (flip) {
      list.push(
        flipMiddleware({
          fallbackAxisSideDirection: 'start',
          padding: 8,
        })
      );
    }

    if (shift) {
      list.push(
        shiftMiddleware({
          padding: 8,
          limiter: limitShift(),
        })
      );
    }

    if (targetArrow) {
      list.push(
        arrowMiddleware({
          element: targetArrow,
          padding: 10,
        })
      );
    }

    if (autoBoundary) {
      list.push(
        sizeMiddleware({
          padding: 8,
          apply({ availableWidth, availableHeight, elements }) {
            Object.assign(elements.floating.style, {
              maxWidth: String(Math.max(160, availableWidth)) + 'px',
              maxHeight: String(Math.max(120, availableHeight)) + 'px',
            });
          },
        })
      );
    }

    return list;
  }, [offsetConfig, flip, shift, targetArrow, autoBoundary]);

  // Floating UI Setup
  const data = useFloating({
    placement,
    open: isOpen,
    onOpenChange: handleOpenChange,
    whileElementsMounted: autoUpdate,
    middleware,
    ...floatingOptions,
  });

  const { context } = data;

  // Tích hợp Delay Group nếu nằm trong TooltipGroup
  const delayGroup = useDelayGroup(context, {
    id: tooltipId,
    enabled: Boolean(useGroup),
  });

  // Tương tác Hover & Safe Polygon cho Interactive Tooltip
  const hover = useHover(context, {
    enabled: !disabled && triggers.includes('hover'),
    delay: {
      open: delayGroup.isInstantPhase ? enterNextDelay : enterDelay,
      close: leaveDelay,
    },
    handleClose: interactive ? safePolygon({ requireIntent: false, buffer: 1 }) : null,
    move: false,
    mouseOnly: touch !== 'hover',
  });

  // Tương tác Focus
  const focus = useFocus(context, {
    enabled: !disabled && triggers.includes('focus'),
  });

  // Tương tác Click
  const click = useClick(context, {
    enabled: !disabled && triggers.includes('click'),
  });

  // Đóng khi click ngoài hoặc nhấn ESC
  const dismiss = useDismiss(context, {
    enabled: !disabled,
    escapeKey: true,
    outsidePress: true,
  });

  // Tương tác Follow Cursor (clientPoint)
  const clientPoint = useClientPoint(context, {
    enabled: Boolean(followCursor) && !disabled,
    axis: typeof followCursor === 'string' ? followCursor : undefined,
  });

  // Accessibility Role
  const role = useRole(context, { role: 'tooltip' });

  // Gom tương tác Floating UI
  const { getReferenceProps, getFloatingProps } = useInteractions([
    hover,
    focus,
    click,
    dismiss,
    clientPoint,
    role,
  ]);

  // Touch Handlers (Longpress / Click)
  const handleTouchStart = useCallback(() => {
    if (disabled || touch !== 'longpress') return;
    longPressTimerRef.current = setTimeout(() => {
      handleOpenChange(true);
    }, 500);
  }, [disabled, touch, handleOpenChange]);

  const handleTouchEnd = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  // Tính toán transform origin động
  const transformOrigin = useMemo(
    () => getTransformOrigin(data.placement),
    [data.placement]
  );

  return {
    isOpen,
    setIsOpen: handleOpenChange,
    refs: data.refs,
    floatingStyles: data.floatingStyles,
    placement: data.placement,
    actualPlacement: data.placement,
    middlewareData: data.middlewareData,
    context,
    transformOrigin,
    getReferenceProps: (userProps = {}) =>
      getReferenceProps({
        ...userProps,
        onTouchStart: (e) => {
          handleTouchStart();
          userProps.onTouchStart?.(e);
        },
        onTouchEnd: (e) => {
          handleTouchEnd();
          userProps.onTouchEnd?.(e);
        },
        onTouchCancel: (e) => {
          handleTouchEnd();
          userProps.onTouchCancel?.(e);
        },
      }),
    getFloatingProps,
  };
}
