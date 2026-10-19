/**
 * @file Tooltip.jsx
 * @module Components/UI/Tooltip/Tooltip
 * @component Tooltip
 * @description Component chú giải (Tooltip) chuẩn Material 3 Expressive & The Aesthetic OS, API trực tiếp bao bọc phần tử kích hoạt (Trigger).
 */

import React, {
  cloneElement,
  forwardRef,
  isValidElement,
  useId,
  useRef,
  useCallback,
} from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { FloatingPortal, FloatingDelayGroup } from '@floating-ui/react';
import { motion, AnimatePresence } from 'framer-motion';

import { usePopperTooltip } from '@/hooks/ui/use-popper-tooltip';

import './tooltip.scss';

/**
 * Helper hợp nhất nhiều React Ref an toàn
 */
function mergeRefs(...refs) {
  return (node) => {
    refs.forEach((ref) => {
      if (!ref) return;
      if (typeof ref === 'function') {
        ref(node);
      } else if (typeof ref === 'object' && 'current' in ref) {
        ref.current = node;
      }
    });
  };
}

/**
 * Motion animation variants theo chuẩn The Aesthetic OS
 */
const motionVariants = {
  zoom: {
    initial: { opacity: 0, scale: 0.92 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.92 },
  },
  grow: {
    initial: { opacity: 0, scale: 0.75 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.75 },
  },
  fade: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
  },
  shift: (placement = 'top') => {
    const side = placement.split('-')[0];
    const offsetDistance = 6;
    const shiftMap = {
      top: { y: offsetDistance },
      bottom: { y: -offsetDistance },
      left: { x: offsetDistance },
      right: { x: -offsetDistance },
    };
    const shiftOffset = shiftMap[side] || { y: offsetDistance };
    return {
      initial: { opacity: 0, ...shiftOffset },
      animate: { opacity: 1, x: 0, y: 0 },
      exit: { opacity: 0, ...shiftOffset },
    };
  },
};

/**
 * @component Tooltip
 * @description Hiển thị chú giải văn bản hoặc nội dung ngắn khi người dùng hover, focus hoặc chạm giữ vào phần tử.
 */
const Tooltip = forwardRef((props, ref) => {
  const {
    arrow = true,
    autoBoundary = true,
    children,
    className,
    container,
    content,
    defaultOpen = false,
    disabled = false,
    enterDelay = 200,
    enterNextDelay = 0,
    flip = true,
    followCursor = false,
    id: externalId,
    interactive = false,
    leaveDelay = 0,
    maxWidth = 320,
    nowrap = false,
    offset = 8,
    onOpenChange,
    open: controlledOpen,
    placement = 'top',
    shift = true,
    size = 'medium',
    style,
    title,
    touch = 'longpress',
    transition = 'zoom',
    trigger = ['hover', 'focus'],
    variant = 'default',
    wrapDisabled = true,
    ...rest
  } = props;

  const generatedId = useId();
  const tooltipId = externalId || ('sp-tooltip-' + generatedId);
  const resolvedContent = title !== undefined ? title : content;

  const arrowRef = useRef(null);

  const {
    actualPlacement,
    context: _context,
    floatingStyles,
    getFloatingProps,
    getReferenceProps,
    isOpen,
    middlewareData,
    refs,
    transformOrigin,
  } = usePopperTooltip({
    arrowRef: arrow ? arrowRef : null,
    autoBoundary,
    defaultOpen,
    disabled: disabled || !resolvedContent,
    enterDelay,
    enterNextDelay,
    flip,
    followCursor,
    id: tooltipId,
    interactive,
    leaveDelay,
    offset,
    onOpenChange,
    open: controlledOpen,
    placement,
    shift,
    touch,
    trigger,
    ...rest,
  });

  // Base placement direction (top, bottom, left, right)
  const basePlacement = actualPlacement.split('-')[0];

  // Dynamic animation variant generator
  const selectedAnimation =
    transition === 'shift'
      ? motionVariants.shift(actualPlacement)
      : motionVariants[transition] || motionVariants.zoom;

  // Gán ref cho trigger element
  const setReferenceNode = useCallback(
    (node) => {
      refs.setReference(node);
      if (isValidElement(children)) {
        const childRef = children.ref;
        if (typeof childRef === 'function') {
          childRef(node);
        } else if (childRef && typeof childRef === 'object') {
          childRef.current = node;
        }
      }
    },
    [children, refs]
  );

  const isDisabled = disabled || !resolvedContent;

  // Tự động nhận diện child có prop disabled
  const isChildDisabled =
    isValidElement(children) &&
    (children.props.disabled === true || children.props['aria-disabled'] === true);

  let triggerElement = children;

  if (!isDisabled) {
    if (isChildDisabled && wrapDisabled) {
      // Wrap disabled element in a span so hover/focus work transparently
      triggerElement = (
        <span
          {...getReferenceProps({
            ref: refs.setReference,
            className: 'tooltip__disabled-wrapper',
            tabIndex: 0,
            role: 'button',
            'aria-disabled': 'true',
            'aria-describedby': isOpen ? tooltipId : undefined,
          })}
        >
          {cloneElement(children, {
            style: { pointerEvents: 'none', ...(children.props.style || {}) },
          })}
        </span>
      );
    } else if (isValidElement(children)) {
      triggerElement = cloneElement(
        children,
        getReferenceProps({
          ref: setReferenceNode,
          'aria-describedby': isOpen ? tooltipId : undefined,
          ...children.props,
        })
      );
    } else {
      triggerElement = (
        <span
          {...getReferenceProps({
            ref: refs.setReference,
            'aria-describedby': isOpen ? tooltipId : undefined,
          })}
        >
          {children}
        </span>
      );
    }
  }

  // Max width style resolution
  const resolvedMaxWidth =
    typeof maxWidth === 'number'
      ? (maxWidth + 'px')
      : maxWidth === 'none'
      ? 'none'
      : maxWidth;

  // Arrow position style calculation
  const arrowStyle = {};
  if (arrow && middlewareData?.arrow) {
    const { x, y } = middlewareData.arrow;
    if (x != null) arrowStyle.left = `${x}px`;
    if (y != null) arrowStyle.top = `${y}px`;
  }

  return (
    <>
      {triggerElement}

      <AnimatePresence>
        {isOpen && (
          <FloatingPortal root={container}>
            <div
              ref={mergeRefs(refs.setFloating, ref)}
              id={tooltipId}
              role="tooltip"
              style={{
                ...floatingStyles,
                maxWidth: resolvedMaxWidth,
                ...style,
              }}
              className={classNames(
                'tooltip',
                'tooltip--placement-' + basePlacement,
                'tooltip--variant-' + variant,
                'tooltip--size-' + size,
                {
                  'tooltip--interactive': interactive,
                  'tooltip--nowrap': nowrap,
                },
                className
              )}
              {...getFloatingProps()}
            >
              <motion.div
                initial={selectedAnimation.initial}
                animate={selectedAnimation.animate}
                exit={selectedAnimation.exit}
                transition={{
                  duration: 0.16,
                  ease: [0.16, 1, 0.3, 1], // --sp-motion-easing-neural
                }}
                style={{
                  transformOrigin,
                }}
                className="tooltip__animator"
              >
                <div className="tooltip__inner">
                  {resolvedContent}

                  {arrow && (
                    <span
                      ref={arrowRef}
                      className="tooltip__arrow"
                      style={arrowStyle}
                      aria-hidden="true"
                    />
                  )}
                </div>
              </motion.div>
            </div>
          </FloatingPortal>
        )}
      </AnimatePresence>
    </>
  );
});

Tooltip.displayName = 'Tooltip';

Tooltip.propTypes = {
  /** Hiển thị mũi tên chỉ hướng */
  arrow: PropTypes.bool,
  /** Tự động giới hạn kích thước theo màn hình */
  autoBoundary: PropTypes.bool,
  /** Phần tử kích hoạt hiển thị Tooltip (Anchor element) */
  children: PropTypes.node.isRequired,
  /** CSS class bổ sung cho Tooltip */
  className: PropTypes.string,
  /** Container để render FloatingPortal */
  container: PropTypes.any,
  /** Alias cho prop title */
  content: PropTypes.node,
  /** Trạng thái mở mặc định (Uncontrolled) */
  defaultOpen: PropTypes.bool,
  /** Vô hiệu hóa Tooltip */
  disabled: PropTypes.bool,
  /** Thời gian chờ trước khi hiển thị (ms) */
  enterDelay: PropTypes.number,
  /** Thời gian chờ hiển thị khi đã trong nhóm Delay Group (ms) */
  enterNextDelay: PropTypes.number,
  /** Tự động lật hướng khi chạm viền màn hình */
  flip: PropTypes.bool,
  /** Bám theo tọa độ con trỏ chuột (true, 'x', 'y') */
  followCursor: PropTypes.oneOfType([PropTypes.bool, PropTypes.oneOf(['x', 'y'])]),
  /** ID HTML tùy chỉnh (mặc định tự động sinh) */
  id: PropTypes.string,
  /** Cho phép hover và tương tác với nội dung bên trong tooltip */
  interactive: PropTypes.bool,
  /** Thời gian chờ trước khi ẩn (ms) */
  leaveDelay: PropTypes.number,
  /** Chiều rộng tối đa (px hoặc string) */
  maxWidth: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  /** Không ngắt dòng văn bản */
  nowrap: PropTypes.bool,
  /** Khoảng cách từ trigger đến tooltip (px hoặc [crossAxis, mainAxis]) */
  offset: PropTypes.oneOfType([
    PropTypes.number,
    PropTypes.arrayOf(PropTypes.number),
    PropTypes.object,
  ]),
  /** Callback khi trạng thái hiển thị thay đổi */
  onOpenChange: PropTypes.func,
  /** Trạng thái mở (Controlled) */
  open: PropTypes.bool,
  /** Vị trí ưu tiên hiển thị */
  placement: PropTypes.oneOf([
    'top',
    'top-start',
    'top-end',
    'bottom',
    'bottom-start',
    'bottom-end',
    'left',
    'left-start',
    'left-end',
    'right',
    'right-start',
    'right-end',
  ]),
  /** Tự động dịch chuyển để không bị tràn màn hình */
  shift: PropTypes.bool,
  /** Kích thước Tooltip */
  size: PropTypes.oneOf(['small', 'medium', 'large']),
  /** Style tùy biến cho Tooltip container */
  style: PropTypes.object,
  /** Nội dung chú giải hiển thị */
  title: PropTypes.node,
  /** Kiểu tương tác trên thiết bị cảm ứng Touch */
  touch: PropTypes.oneOf(['longpress', 'click', 'none']),
  /** Kiểu hiệu ứng chuyển động */
  transition: PropTypes.oneOf(['zoom', 'grow', 'fade', 'shift']),
  /** Các sự kiện kích hoạt hiển thị */
  trigger: PropTypes.oneOfType([
    PropTypes.oneOf(['hover', 'focus', 'click']),
    PropTypes.arrayOf(PropTypes.oneOf(['hover', 'focus', 'click'])),
  ]),
  /** Biến thể màu sắc Semantic & Aesthetic */
  variant: PropTypes.oneOf([
    'default',
    'primary',
    'accent',
    'success',
    'warning',
    'error',
    'info',
    'light',
    'neural',
  ]),
  /** Tự động bọc wrapper cho child element bị disabled */
  wrapDisabled: PropTypes.bool,
};

/**
 * @component TooltipGroup
 * @description Nhóm các Tooltip lân cận để lướt nhanh tức thì không delay
 */
export const TooltipGroup = ({ children, delay = 200, timeoutMs = 150 }) => {
  return (
    <FloatingDelayGroup delay={{ open: delay, close: timeoutMs }}>
      {children}
    </FloatingDelayGroup>
  );
};

TooltipGroup.propTypes = {
  children: PropTypes.node.isRequired,
  delay: PropTypes.number,
  timeoutMs: PropTypes.number,
};

export default React.memo(Tooltip);
