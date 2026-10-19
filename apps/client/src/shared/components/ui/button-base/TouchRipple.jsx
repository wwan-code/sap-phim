/**
 * @file TouchRipple.jsx
 * @module Components/UI/ButtonBase/TouchRipple
 * @description Subcomponent xử lý hiệu ứng gợn sóng (Material 3 Ripple Effect 60fps) khi tương tác nút bấm.
 */

import React, { forwardRef, useRef, useImperativeHandle, useCallback, useEffect, memo } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';

import './button-base.scss';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

/** Thời gian animation exit (ms) khớp với CSS keyframe */
const EXIT_DURATION_MS = 350;

/** Thời gian chờ thêm để dọn dẹp bộ nhớ an toàn (ms) */
const CLEANUP_GRACE_MS = 100;

// ─────────────────────────────────────────────────────────────────────────────
// UTILITIES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Tính toán vị trí và đường kính của ripple dựa trên tọa độ tương tác và container.
 * 
 * @param {HTMLElement} element - Container DOM node
 * @param {Event|Object} event - Sự kiện tương tác (MouseEvent, TouchEvent, SyntheticEvent)
 * @param {boolean} [center=false] - Nếu true, ripple bắt đầu từ tâm nút
 * @returns {{ rippleX: number, rippleY: number, rippleSize: number }}
 */
const getRippleMetrics = (element, event, center = false) => {
  const rect = element.getBoundingClientRect();

  let rippleX = 0;
  let rippleY = 0;

  if (
    center ||
    !event ||
    (event.clientX === 0 && event.clientY === 0) ||
    (!event.clientX && !event.touches)
  ) {
    // Keyboard hoặc programmatic invocation -> Tọa độ tâm
    rippleX = Math.round(rect.width / 2);
    rippleY = Math.round(rect.height / 2);
  } else {
    const clientX = event.touches && event.touches.length > 0 ? event.touches[0].clientX : event.clientX;
    const clientY = event.touches && event.touches.length > 0 ? event.touches[0].clientY : event.clientY;
    rippleX = Math.round(clientX - rect.left);
    rippleY = Math.round(clientY - rect.top);
  }

  // Đường kính đảm bảo phủ kín 4 góc container từ điểm tương tác
  const sizeX = Math.max(Math.abs(element.clientWidth - rippleX), rippleX) * 2 + 2;
  const sizeY = Math.max(Math.abs(element.clientHeight - rippleY), rippleY) * 2 + 2;
  const rippleSize = Math.sqrt(sizeX ** 2 + sizeY ** 2);

  return { rippleX, rippleY, rippleSize };
};

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @component TouchRipple
 * @description Quản lý trực tiếp các ripple node trong DOM để đảm bảo hiệu năng 60fps, không gây re-render React.
 */
const TouchRipple = forwardRef((props, ref) => {
  const {
    center: centerProp = false,
    classes = {},
    className,
    ...other
  } = props;

  const containerRef = useRef(null);

  /** Danh sách các ripple đang hoạt động trong DOM (FIFO) */
  const activeRipples = useRef([]);

  /** Map lưu timers dọn dẹp fallback */
  const fallbackTimers = useRef(new Map());

  // ─────────────────────────────────────────────────────────────────────────
  // HELPERS & MEMORY CLEANUP
  // ─────────────────────────────────────────────────────────────────────────

  /** Dọn dẹp 1 ripple node cụ thể khỏi DOM */
  const destroyRipple = useCallback((outerSpan) => {
    const container = containerRef.current;
    if (container && outerSpan.parentNode === container) {
      container.removeChild(outerSpan);
    }

    const timerId = fallbackTimers.current.get(outerSpan);
    if (timerId !== undefined) {
      clearTimeout(timerId);
      fallbackTimers.current.delete(outerSpan);
    }

    activeRipples.current = activeRipples.current.filter((r) => r.outer !== outerSpan);
  }, []);

  /** Xóa toàn bộ ripples ngay lập tức */
  const clearAllRipples = useCallback(() => {
    const container = containerRef.current;

    fallbackTimers.current.forEach((timerId) => clearTimeout(timerId));
    fallbackTimers.current.clear();

    if (container) {
      const children = Array.from(container.querySelectorAll('.touch-ripple__child'));
      children.forEach((child) => {
        if (child.parentNode === container) {
          container.removeChild(child);
        }
      });
    }

    activeRipples.current = [];
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // EFFECTS
  // ─────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        clearAllRipples();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearAllRipples();
    };
  }, [clearAllRipples]);

  // ─────────────────────────────────────────────────────────────────────────
  // IMPERATIVE API
  // ─────────────────────────────────────────────────────────────────────────

  /** Bắt đầu tạo ripple khi pointer down */
  const start = useCallback((event = {}, options = {}, cb) => {
    const { pulsate = false, center = centerProp || options.pulsate } = options;
    const container = containerRef.current;
    if (!container) return;

    const { rippleX, rippleY, rippleSize } = getRippleMetrics(container, event, center);

    // Tạo outer container span định vị
    const outerSpan = document.createElement('span');
    outerSpan.className = classNames('touch-ripple__child', {
      'touch-ripple__child--pulsate': pulsate,
    });
    outerSpan.style.width = `${rippleSize}px`;
    outerSpan.style.height = `${rippleSize}px`;
    outerSpan.style.top = `${rippleY - rippleSize / 2}px`;
    outerSpan.style.left = `${rippleX - rippleSize / 2}px`;

    // Tạo inner colored span hiển thị màu currentColor
    const innerSpan = document.createElement('span');
    innerSpan.className = 'touch-ripple__child-inner';
    outerSpan.appendChild(innerSpan);

    activeRipples.current.push({ outer: outerSpan, pulsate });
    container.appendChild(outerSpan);

    cb?.();
  }, [centerProp]);

  /** Kết thúc ripple và bắt đầu hiệu ứng fade out */
  const stop = useCallback((_event, cb) => {
    const entry = activeRipples.current.find(
      (r) => !r.outer.classList.contains('touch-ripple__child--leaving')
    );

    if (!entry) {
      cb?.();
      return;
    }

    const { outer } = entry;
    outer.classList.add('touch-ripple__child--leaving');

    const onAnimEnd = (e) => {
      if (e.animationName === 'sp-ripple-exit') {
        outer.removeEventListener('animationend', onAnimEnd);
        destroyRipple(outer);
      }
    };
    outer.addEventListener('animationend', onAnimEnd);

    const fallbackTimerId = setTimeout(() => {
      outer.removeEventListener('animationend', onAnimEnd);
      destroyRipple(outer);
    }, EXIT_DURATION_MS + CLEANUP_GRACE_MS);

    fallbackTimers.current.set(outer, fallbackTimerId);
    cb?.();
  }, [destroyRipple]);

  /** Kích hoạt hiệu ứng pulsate (dùng cho focus keyboard) */
  const pulsate = useCallback(() => {
    start({}, { pulsate: true });
  }, [start]);

  useImperativeHandle(ref, () => ({ start, stop, pulsate }), [start, stop, pulsate]);

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <span
      ref={containerRef}
      className={classNames('touch-ripple', classes.root, className)}
      aria-hidden="true"
      {...other}
    />
  );
});

TouchRipple.displayName = 'TouchRipple';

TouchRipple.propTypes = {
  /** Nếu true, ripple luôn bắt đầu từ tâm nút */
  center: PropTypes.bool,
  /** Ghi đè class nội bộ */
  classes: PropTypes.object,
  /** Class tùy chỉnh bổ sung */
  className: PropTypes.string,
};

export default memo(TouchRipple);
