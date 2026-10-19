/**
 * @file CircularProgress.jsx
 * @module Components/UI/CircularProgress
 * @description Component tiến trình dạng vòng tròn (CircularProgress) chuẩn Material 3 Expressive, hỗ trợ cả 2 chế độ indeterminate & determinate, nội dung căn giữa (Center Label) và Design Tokens (--sp-*).
 */

import React, { forwardRef, memo, useMemo } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';

import './circular-progress.scss';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS & HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** Kích thước ViewBox chuẩn cho hệ tọa độ SVG */
const VIEWBOX_SIZE = 44;

/** Bảng kích thước định sẵn (Presets) */
const SIZE_PRESETS = {
  small: { size: 24, thickness: 2.8, fontSize: '9px' },
  medium: { size: 40, thickness: 3.6, fontSize: '12px' },
  large: { size: 56, thickness: 4.4, fontSize: '16px' },
  xl: { size: 72, thickness: 5.2, fontSize: '20px' },
};

const STANDARD_COLORS = [
  'primary',
  'accent',
  'secondary',
  'success',
  'warning',
  'error',
  'danger',
  'info',
  'neutral',
  'inherit',
];

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @component CircularProgress
 * @description Component tiến trình vòng tròn chuẩn Material 3 Expressive
 */
const CircularProgress = forwardRef((props, ref) => {
  const {
    children,
    className,
    color = 'primary',
    disableShrink = false,
    enableTrackSlot = true,
    max = 100,
    min = 0,
    size = 'medium',
    strokeLinecap = 'round',
    style,
    thickness,
    trackColor,
    value = 0,
    variant = 'indeterminate',
    ...rest
  } = props;

  // ─────────────────────────────────────────────────────────────────────────
  // COMPUTED PROPERTIES & STYLES
  // ─────────────────────────────────────────────────────────────────────────

  // Chuẩn hóa color
  const normalizedColor = useMemo(() => {
    if (color === 'danger') return 'error';
    if (color === 'secondary') return 'accent';
    return color || 'primary';
  }, [color]);

  const isPresetColor = STANDARD_COLORS.includes(normalizedColor);

  // Chuẩn hóa size và thickness
  const { pixelSize, effectiveThickness, centerFontSize } = useMemo(() => {
    if (typeof size === 'string' && SIZE_PRESETS[size]) {
      const preset = SIZE_PRESETS[size];
      return {
        pixelSize: `${preset.size}px`,
        effectiveThickness: thickness || preset.thickness,
        centerFontSize: preset.fontSize,
      };
    }

    const numSize = typeof size === 'number' ? size : parseFloat(size) || 40;
    const computedThickness = thickness || Number((numSize * (3.6 / 40)).toFixed(2));
    const computedFontSize = `${Math.max(10, Math.round(numSize * 0.3))}px`;

    return {
      pixelSize: typeof size === 'number' ? `${size}px` : size,
      effectiveThickness: computedThickness,
      centerFontSize: computedFontSize,
    };
  }, [size, thickness]);

  // Bán kính và chu vi đường tròn SVG
  const radius = (VIEWBOX_SIZE - effectiveThickness) / 2;
  const circumference = 2 * Math.PI * radius;

  // Tính toán tỷ lệ phần trăm và stroke offset cho chế độ determinate
  const relVal = useMemo(() => {
    if (variant !== 'determinate') return 0;
    if (max <= min) return 0;
    const clamped = Math.min(Math.max(min, value), max);
    return ((clamped - min) / (max - min)) * 100;
  }, [variant, value, min, max]);

  const strokeDashoffset = useMemo(() => {
    if (variant !== 'determinate') return undefined;
    const offset = ((100 - relVal) / 100) * circumference;
    return `${offset.toFixed(3)}px`;
  }, [variant, relVal, circumference]);

  const rootStyle = useMemo(() => {
    return {
      width: pixelSize,
      height: pixelSize,
      ...(!isPresetColor && { color: normalizedColor }),
      ...style,
    };
  }, [pixelSize, isPresetColor, normalizedColor, style]);

  const circleStyle = useMemo(() => {
    if (variant === 'determinate') {
      return {
        strokeDasharray: circumference.toFixed(3),
        strokeDashoffset,
      };
    }
    return undefined;
  }, [variant, circumference, strokeDashoffset]);

  // Thuộc tính Accessibility
  const a11yProps = useMemo(() => {
    if (variant === 'determinate') {
      return {
        'aria-valuenow': Math.round(relVal),
        'aria-valuemin': min,
        'aria-valuemax': max,
      };
    }
    return {
      'aria-busy': 'true',
    };
  }, [variant, relVal, min, max]);

  // ─────────────────────────────────────────────────────────────────────────
  // CLASS COMPOSITION
  // ─────────────────────────────────────────────────────────────────────────

  const rootClasses = classNames(
    'circular-progress',
    `circular-progress--${variant}`,
    {
      [`circular-progress--color-${normalizedColor}`]: isPresetColor,
      'circular-progress--has-children': Boolean(children),
    },
    className
  );

  return (
    <span
      ref={ref}
      className={rootClasses}
      style={rootStyle}
      role="progressbar"
      {...a11yProps}
      {...rest}
    >
      <svg
        className="circular-progress__svg"
        viewBox={`${VIEWBOX_SIZE / 2} ${VIEWBOX_SIZE / 2} ${VIEWBOX_SIZE} ${VIEWBOX_SIZE}`}
        aria-hidden="true"
      >
        {/* 1. Track Slot nền phía dưới */}
        {enableTrackSlot && (
          <circle
            className="circular-progress__track"
            style={trackColor ? { stroke: trackColor, opacity: 1 } : undefined}
            cx={VIEWBOX_SIZE}
            cy={VIEWBOX_SIZE}
            r={radius}
            fill="none"
            strokeWidth={effectiveThickness}
          />
        )}

        {/* 2. Đường tiến trình chính */}
        <circle
          className={classNames('circular-progress__circle', {
            'circular-progress__circle--disable-shrink': disableShrink,
          })}
          style={circleStyle}
          cx={VIEWBOX_SIZE}
          cy={VIEWBOX_SIZE}
          r={radius}
          fill="none"
          strokeWidth={effectiveThickness}
          strokeLinecap={strokeLinecap}
        />
      </svg>

      {/* 3. Center Content / Label */}
      {children && (
        <span
          className="circular-progress__label"
          style={{ fontSize: centerFontSize }}
          aria-hidden="true"
        >
          {children}
        </span>
      )}
    </span>
  );
});

CircularProgress.displayName = 'CircularProgress';

CircularProgress.propTypes = {
  /** Nội dung hiển thị căn giữa bên trong vòng tròn (text, icon, percentage) */
  children: PropTypes.node,
  /** CSS class bổ sung */
  className: PropTypes.string,
  /** Bộ màu sắc thái Material 3 hoặc mã màu CSS tùy chỉnh */
  color: PropTypes.string,
  /** Tắt hiệu ứng co giãn nét vẽ trong chế độ indeterminate */
  disableShrink: PropTypes.bool,
  /** Bật/tắt đường ray nền mờ phía dưới */
  enableTrackSlot: PropTypes.bool,
  /** Giá trị tiến trình tối đa (determinate mode) */
  max: PropTypes.number,
  /** Giá trị tiến trình tối thiểu (determinate mode) */
  min: PropTypes.number,
  /** Kích thước vòng tròn: small (24px), medium (40px), large (56px), xl (72px) hoặc số pixel */
  size: PropTypes.oneOfType([
    PropTypes.oneOf(['small', 'medium', 'large', 'xl']),
    PropTypes.number,
    PropTypes.string,
  ]),
  /** Kiểu bo đầu nét vẽ SVG */
  strokeLinecap: PropTypes.oneOf(['round', 'butt', 'square']),
  /** Inline style tùy chỉnh */
  style: PropTypes.object,
  /** Độ dày của đường nét vẽ (thickness) */
  thickness: PropTypes.number,
  /** Màu sắc tùy biến cho đường ray nền */
  trackColor: PropTypes.string,
  /** Giá trị tiến trình (determinate mode) */
  value: PropTypes.number,
  /** Biến thể tiến trình: xoay liên tục (indeterminate) hoặc theo giá trị (determinate) */
  variant: PropTypes.oneOf(['determinate', 'indeterminate']),
};

export default memo(CircularProgress);
