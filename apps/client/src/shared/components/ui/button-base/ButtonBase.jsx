/**
 * @file ButtonBase.jsx
 * @module Components/UI/ButtonBase
 * @description Component nền tảng cho mọi nút bấm (quản lý tương tác cảm ứng, hiệu ứng ripple, focus-visible polyfill và chuẩn tiếp cận a11y).
 */

import React, {
  forwardRef,
  useRef,
  useImperativeHandle,
  useState,
  useCallback,
  useEffect,
  memo,
} from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';

import TouchRipple from './TouchRipple';

import './button-base.scss';

// ─────────────────────────────────────────────────────────────────────────────
// GLOBAL STATE (Focus-visible Keyboard Tracking)
// ─────────────────────────────────────────────────────────────────────────────

/** Theo dõi chế độ nhập liệu toàn cục (Bàn phím vs Chuột/Touch) */
let isKeyboardMode = false;

if (typeof document !== 'undefined') {
  document.addEventListener(
    'keydown',
    (e) => {
      if (['Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'Enter'].includes(e.key)) {
        isKeyboardMode = true;
      }
    },
    true
  );

  document.addEventListener(
    'mousedown',
    () => {
      isKeyboardMode = false;
    },
    true
  );

  document.addEventListener(
    'touchstart',
    () => {
      isKeyboardMode = false;
    },
    true
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @component ButtonBase
 * @description Xử lý nền tảng tương tác của mọi button (Ripple, Tab navigation, Polymorphism).
 */
const ButtonBase = forwardRef((props, ref) => {
  const {
    action,
    as,
    centerRipple = false,
    children,
    className,
    classes = {},
    component = 'button',
    disabled = false,
    disableRipple = false,
    disableTouchRipple = false,
    focusRipple = false,
    focusVisibleClassName = 'button-base--focus-visible',
    LinkComponent = 'a',
    href,
    onBlur,
    onClick,
    onContextMenu,
    onDragLeave,
    onFocus,
    onFocusVisible,
    onKeyDown,
    onKeyUp,
    onMouseDown,
    onMouseLeave,
    onMouseUp,
    onTouchEnd,
    onTouchMove,
    onTouchStart,
    style,
    sx,
    tabIndex = 0,
    TouchRippleProps,
    touchRippleRef,
    type = 'button',
    ...other
  } = props;

  // ─────────────────────────────────────────────────────────────────────────
  // REFS & STATE
  // ─────────────────────────────────────────────────────────────────────────

  const buttonRef = useRef(null);
  const rippleRef = useRef(null);
  const [focusVisible, setFocusVisible] = useState(false);
  const focusVisibleRef = useRef(false);

  useEffect(() => {
    focusVisibleRef.current = focusVisible;
  }, [focusVisible]);

  useImperativeHandle(ref, () => buttonRef.current, []);

  // Expose imperative API cho component cha
  useImperativeHandle(
    action,
    () => ({
      focusVisible: () => {
        focusVisibleRef.current = true;
        setFocusVisible(true);
        buttonRef.current?.focus();
      },
    }),
    []
  );

  // Tự động chuyển đổi sang Link nếu có href hoặc to
  let ComponentProp = as || component;
  if (ComponentProp === 'button' && (href || other.to)) {
    ComponentProp = LinkComponent;
  }

  const mergedStyle = { ...(typeof sx === 'object' ? sx : {}), ...style };

  // ─────────────────────────────────────────────────────────────────────────
  // RIPPLE HANDLERS
  // ─────────────────────────────────────────────────────────────────────────

  const handleMouseDown = useCallback(
    (e) => {
      if (!disableTouchRipple && !disableRipple && rippleRef.current) {
        rippleRef.current.start(e);
      }
      onMouseDown?.(e);
    },
    [disableTouchRipple, disableRipple, onMouseDown]
  );

  const handleMouseUp = useCallback(
    (e) => {
      if (!disableTouchRipple && !disableRipple && rippleRef.current) {
        rippleRef.current.stop(e);
      }
      onMouseUp?.(e);
    },
    [disableTouchRipple, disableRipple, onMouseUp]
  );

  const handleMouseLeave = useCallback(
    (e) => {
      if (!disableTouchRipple && !disableRipple && rippleRef.current) {
        rippleRef.current.stop(e);
      }
      onMouseLeave?.(e);
    },
    [disableTouchRipple, disableRipple, onMouseLeave]
  );

  const handleTouchStart = useCallback(
    (e) => {
      if (!disableTouchRipple && !disableRipple && rippleRef.current) {
        rippleRef.current.start(e);
      }
      onTouchStart?.(e);
    },
    [disableTouchRipple, disableRipple, onTouchStart]
  );

  const handleTouchEnd = useCallback(
    (e) => {
      if (!disableTouchRipple && !disableRipple && rippleRef.current) {
        rippleRef.current.stop(e);
      }
      onTouchEnd?.(e);
    },
    [disableTouchRipple, disableRipple, onTouchEnd]
  );

  const handleTouchMove = useCallback(
    (e) => {
      if (!disableTouchRipple && !disableRipple && rippleRef.current) {
        rippleRef.current.stop(e);
      }
      onTouchMove?.(e);
    },
    [disableTouchRipple, disableRipple, onTouchMove]
  );

  const handleDragLeave = useCallback(
    (e) => {
      if (!disableTouchRipple && !disableRipple && rippleRef.current) {
        rippleRef.current.stop(e);
      }
      onDragLeave?.(e);
    },
    [disableTouchRipple, disableRipple, onDragLeave]
  );

  // ─────────────────────────────────────────────────────────────────────────
  // FOCUS HANDLERS
  // ─────────────────────────────────────────────────────────────────────────

  const handleFocus = useCallback(
    (event) => {
      if (isKeyboardMode && !focusVisibleRef.current) {
        focusVisibleRef.current = true;
        setFocusVisible(true);
        onFocusVisible?.(event);

        if (focusRipple && !disableRipple && rippleRef.current) {
          rippleRef.current.pulsate(event);
        }
      }
      onFocus?.(event);
    },
    [focusRipple, disableRipple, onFocus, onFocusVisible]
  );

  const handleBlur = useCallback(
    (event) => {
      if (focusVisibleRef.current) {
        focusVisibleRef.current = false;
        setFocusVisible(false);
        if (focusRipple && !disableRipple && rippleRef.current) {
          rippleRef.current.stop(event);
        }
      }
      onBlur?.(event);
    },
    [focusRipple, disableRipple, onBlur]
  );

  // ─────────────────────────────────────────────────────────────────────────
  // KEYBOARD HANDLERS
  // ─────────────────────────────────────────────────────────────────────────

  const handleKeyDown = useCallback(
    (event) => {
      if (focusVisibleRef.current && event.key === 'Enter' && !disableRipple && rippleRef.current) {
        rippleRef.current.stop(event, () => {
          rippleRef.current.start(event);
        });
      }
      onKeyDown?.(event);
    },
    [disableRipple, onKeyDown]
  );

  const handleKeyUp = useCallback(
    (event) => {
      if (focusVisibleRef.current && (event.key === ' ' || event.key === 'Spacebar') && !disableRipple && rippleRef.current) {
        rippleRef.current.stop(event);
      }
      onKeyUp?.(event);
    },
    [disableRipple, onKeyUp]
  );

  const rippleRefCallback = useCallback(
    (node) => {
      rippleRef.current = node;
      if (typeof touchRippleRef === 'function') {
        touchRippleRef(node);
      } else if (touchRippleRef) {
        touchRippleRef.current = node;
      }
    },
    [touchRippleRef]
  );

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  const rootClasses = classNames(
    'button-base',
    classes.root,
    className,
    {
      'button-base--disabled': disabled,
      [focusVisibleClassName]: focusVisible,
    }
  );

  const componentProps = {};
  if (ComponentProp === 'button') {
    componentProps.type = type;
    componentProps.disabled = disabled;
  } else {
    if (ComponentProp !== 'a' || !href) {
      componentProps.role = 'button';
    }
    componentProps['aria-disabled'] = disabled ? 'true' : undefined;
  }

  return (
    <ComponentProp
      ref={buttonRef}
      className={rootClasses}
      style={Object.keys(mergedStyle).length > 0 ? mergedStyle : undefined}
      onBlur={handleBlur}
      onClick={onClick}
      onContextMenu={onContextMenu}
      onFocus={handleFocus}
      onKeyDown={handleKeyDown}
      onKeyUp={handleKeyUp}
      onMouseDown={handleMouseDown}
      onMouseLeave={handleMouseLeave}
      onMouseUp={handleMouseUp}
      onDragLeave={handleDragLeave}
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchMove}
      onTouchStart={handleTouchStart}
      tabIndex={disabled ? -1 : tabIndex}
      href={href}
      {...componentProps}
      {...other}
    >
      {children}
      {!disableRipple && !disabled && (
        <TouchRipple
          ref={rippleRefCallback}
          center={centerRipple}
          {...TouchRippleProps}
        />
      )}
    </ComponentProp>
  );
});

ButtonBase.displayName = 'ButtonBase';

ButtonBase.propTypes = {
  /** Ref để thao tác imperative các hành động */
  action: PropTypes.oneOfType([
    PropTypes.func,
    PropTypes.shape({ current: PropTypes.object }),
  ]),
  /** Alias cho component prop */
  as: PropTypes.elementType,
  /** Nếu true, ripple lan toả từ tâm */
  centerRipple: PropTypes.bool,
  /** Nội dung bên trong nút */
  children: PropTypes.node,
  /** Ghi đè class nội bộ */
  classes: PropTypes.object,
  /** Class tùy chỉnh */
  className: PropTypes.string,
  /** Root component tag/element */
  component: PropTypes.elementType,
  /** Trạng thái vô hiệu hóa */
  disabled: PropTypes.bool,
  /** Tắt ripple hoàn toàn */
  disableRipple: PropTypes.bool,
  /** Tắt ripple khi chạm */
  disableTouchRipple: PropTypes.bool,
  /** Bật hiệu ứng ripple khi focus bằng phím */
  focusRipple: PropTypes.bool,
  /** Class khi focus bằng phím */
  focusVisibleClassName: PropTypes.string,
  /** Đường dẫn nếu hoạt động như liên kết */
  href: PropTypes.string,
  /** Component dùng cho link (ví dụ: Link từ react-router) */
  LinkComponent: PropTypes.elementType,
  onBlur: PropTypes.func,
  onClick: PropTypes.func,
  onContextMenu: PropTypes.func,
  onDragLeave: PropTypes.func,
  onFocus: PropTypes.func,
  onFocusVisible: PropTypes.func,
  onKeyDown: PropTypes.func,
  onKeyUp: PropTypes.func,
  onMouseDown: PropTypes.func,
  onMouseLeave: PropTypes.func,
  onMouseUp: PropTypes.func,
  onTouchEnd: PropTypes.func,
  onTouchMove: PropTypes.func,
  onTouchStart: PropTypes.func,
  /** Inline style tùy chỉnh */
  style: PropTypes.object,
  /** System props cho style */
  sx: PropTypes.oneOfType([PropTypes.object, PropTypes.array, PropTypes.func]),
  /** Thứ tự tab trong cây DOM */
  tabIndex: PropTypes.number,
  /** Props truyền trực tiếp cho TouchRipple */
  TouchRippleProps: PropTypes.object,
  /** Ref cho TouchRipple */
  touchRippleRef: PropTypes.oneOfType([
    PropTypes.func,
    PropTypes.shape({ current: PropTypes.object }),
  ]),
  /** HTML button type */
  type: PropTypes.string,
};

export default memo(ButtonBase);
