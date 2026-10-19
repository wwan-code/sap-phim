/**
 * @file Slider.jsx
 * @module Components/UI/Slider
 * @description Component thanh trượt (Slider / Range Slider) chuẩn Material 3 Expressive, hỗ trợ Pointer Capture, keyboard navigation, a11y và Design Tokens (--sp-*).
 */

import React, {
  forwardRef,
  memo,
  useId,
  useRef,
  useState,
  useCallback,
  useMemo,
  useEffect,
} from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';

import './slider.scss';

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS & UTILITIES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Làm tròn giá trị theo bước nhảy (step)
 */
const roundToStep = (val, min, max, step) => {
  if (step === null || step <= 0) {
    return Math.max(min, Math.min(max, val));
  }
  const stepCount = Math.round((val - min) / step);
  const steppedVal = min + stepCount * step;
  // Tránh lỗi sai số dấu phẩy động của JavaScript (0.1 + 0.2)
  const precision = (step.toString().split('.')[1] || '').length;
  const fixedVal = Number(steppedVal.toFixed(precision));
  return Math.max(min, Math.min(max, fixedVal));
};

/**
 * Chuyển đổi giá trị sang tỷ lệ phần trăm (0 - 100)
 */
const valueToPercent = (val, min, max) => {
  if (max === min) return 0;
  return Math.max(0, Math.min(100, ((val - min) / (max - min)) * 100));
};

/**
 * Chuyển đổi tỷ lệ phần trăm sang giá trị thực
 */
const percentToValue = (percent, min, max) => {
  return min + (percent / 100) * (max - min);
};

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @component Slider
 * @description Thanh trượt giá trị đơn hoặc khoảng (Range Slider) chuẩn Material 3 Expressive.
 */
const Slider = forwardRef((props, ref) => {
  const {
    'aria-label': ariaLabelProp,
    'aria-labelledby': ariaLabelledBy,
    'aria-describedby': ariaDescribedBy,
    ariaLabel,
    className,
    color = 'primary',
    defaultValue,
    disabled = false,
    formatValue,
    id: providedId,
    marks = false,
    max = 100,
    min = 0,
    minDistance = 0,
    name,
    onChange,
    onChangeCommitted,
    orientation = 'horizontal',
    readOnly = false,
    showTicks = false,
    size = 'medium',
    step = 1,
    thumbIcon,
    tickValues,
    value: valueProp,
    valueLabelDisplay = 'off',
    valueLabelFormat,
    ...rest
  } = props;

  const generatedId = useId();
  const sliderId = providedId || generatedId;
  const trackRef = useRef(null);

  // Chuẩn hóa size name (hỗ trợ cả sm/md/lg và small/medium/large)
  const normalizedSize = useMemo(() => {
    if (size === 'sm') return 'small';
    if (size === 'md') return 'medium';
    if (size === 'lg') return 'large';
    return size || 'medium';
  }, [size]);

  // Xác định chế độ Range Slider (mảng 2 phần tử) hay Single Value Slider
  const isRange = Array.isArray(valueProp) || Array.isArray(defaultValue);
  const isControlled = valueProp !== undefined;

  // ─────────────────────────────────────────────────────────────────────────
  // STATE MANAGEMENT
  // ─────────────────────────────────────────────────────────────────────────

  const [internalValues, setInternalValues] = useState(() => {
    if (valueProp !== undefined) {
      return Array.isArray(valueProp) ? [...valueProp] : [valueProp];
    }
    if (defaultValue !== undefined) {
      return Array.isArray(defaultValue) ? [...defaultValue] : [defaultValue];
    }
    return isRange ? [min, max] : [min];
  });

  const [activeThumbIndex, setActiveThumbIndex] = useState(null);
  const [focusedThumbIndex, setFocusedThumbIndex] = useState(null);
  const [isHovered, setIsHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Đồng bộ giá trị controlled
  useEffect(() => {
    if (valueProp !== undefined) {
      const next = Array.isArray(valueProp) ? [...valueProp] : [valueProp];
      setInternalValues(next);
    }
  }, [valueProp]);

  // Các giá trị hiện thời được clamp an toàn
  const rawValues = isControlled
    ? Array.isArray(valueProp)
      ? valueProp
      : [valueProp]
    : internalValues;

  const values = useMemo(() => {
    return rawValues.map((v) => roundToStep(v ?? min, min, max, step));
  }, [rawValues, min, max, step]);

  const latestValuesRef = useRef(values);
  latestValuesRef.current = values;

  // ─────────────────────────────────────────────────────────────────────────
  // VALUE FORMATTING & LABELS
  // ─────────────────────────────────────────────────────────────────────────

  const formatLabel = useCallback(
    (val, index) => {
      if (typeof valueLabelFormat === 'function') {
        return valueLabelFormat(val, index);
      }
      if (typeof formatValue === 'function') {
        return formatValue(val);
      }
      return val;
    },
    [valueLabelFormat, formatValue]
  );

  // ─────────────────────────────────────────────────────────────────────────
  // TICKS & MARKS GENERATION
  // ─────────────────────────────────────────────────────────────────────────

  const markList = useMemo(() => {
    if (!marks && !showTicks && !tickValues) return [];

    if (Array.isArray(marks)) {
      return marks.map((m) => ({
        value: m.value,
        percent: valueToPercent(m.value, min, max),
        label: m.label,
      }));
    }

    if (tickValues && Array.isArray(tickValues)) {
      return tickValues.map((tv) => ({
        value: tv,
        percent: valueToPercent(tv, min, max),
        label: typeof marks === 'object' && marks !== null ? marks[tv] : undefined,
      }));
    }

    if (showTicks || marks === true) {
      if (step === null || step <= 0) return [];
      const count = Math.floor((max - min) / step);
      if (count > 100) return []; // Tránh quá tải DOM nếu step quá nhỏ

      const list = [];
      for (let i = 0; i <= count; i++) {
        const val = min + i * step;
        list.push({
          value: val,
          percent: valueToPercent(val, min, max),
          label: undefined,
        });
      }
      return list;
    }

    return [];
  }, [marks, showTicks, tickValues, min, max, step]);

  // ─────────────────────────────────────────────────────────────────────────
  // VALUE MUTATION & EMISSION
  // ─────────────────────────────────────────────────────────────────────────

  const emitChange = useCallback(
    (nextValues, thumbIdx, event) => {
      if (!isControlled) {
        setInternalValues(nextValues);
      }
      const emittedValue = isRange ? nextValues : nextValues[0];
      onChange?.(event, emittedValue, thumbIdx);
    },
    [isControlled, isRange, onChange]
  );

  const emitChangeCommitted = useCallback(
    (nextValues, event) => {
      const emittedValue = isRange ? nextValues : nextValues[0];
      onChangeCommitted?.(event, emittedValue);
    },
    [isRange, onChangeCommitted]
  );

  const calculateNewValue = useCallback(
    (clientX, clientY) => {
      if (!trackRef.current) return min;

      const rect = trackRef.current.getBoundingClientRect();
      let percent;

      if (orientation === 'horizontal') {
        percent = ((clientX - rect.left) / rect.width) * 100;
      } else {
        percent = ((rect.bottom - clientY) / rect.height) * 100;
      }

      percent = Math.max(0, Math.min(100, percent));
      const exactVal = percentToValue(percent, min, max);
      return roundToStep(exactVal, min, max, step);
    },
    [min, max, step, orientation]
  );

  // ─────────────────────────────────────────────────────────────────────────
  // POINTER EVENTS & DRAG ENGINE (Pointer Capture API 60fps)
  // ─────────────────────────────────────────────────────────────────────────

  const handlePointerDown = useCallback(
    (e) => {
      if (disabled || readOnly) return;
      if (e.button !== 0) return; // Chỉ nhận chuột trái hoặc touch

      const currentTarget = e.currentTarget;
      currentTarget.setPointerCapture(e.pointerId);

      const clickedValue = calculateNewValue(e.clientX, e.clientY);
      const curVals = [...latestValuesRef.current];

      // Tìm thumb gần nhất nếu là Range Slider
      let targetThumbIdx = 0;
      if (isRange) {
        const dist0 = Math.abs(curVals[0] - clickedValue);
        const dist1 = Math.abs(curVals[1] - clickedValue);
        if (dist1 < dist0) {
          targetThumbIdx = 1;
        } else if (dist1 === dist0) {
          targetThumbIdx = clickedValue > curVals[0] ? 1 : 0;
        }
      }

      // Giới hạn giá trị theo minDistance
      let clampedTargetVal = clickedValue;
      if (isRange) {
        if (targetThumbIdx === 0) {
          clampedTargetVal = Math.min(clickedValue, curVals[1] - minDistance);
        } else {
          clampedTargetVal = Math.max(clickedValue, curVals[0] + minDistance);
        }
      }

      curVals[targetThumbIdx] = clampedTargetVal;

      setActiveThumbIndex(targetThumbIdx);
      setFocusedThumbIndex(targetThumbIdx);
      setIsDragging(true);

      emitChange(curVals, targetThumbIdx, e);
    },
    [disabled, readOnly, isRange, minDistance, calculateNewValue, emitChange]
  );

  const handlePointerMove = useCallback(
    (e) => {
      if (!isDragging || activeThumbIndex === null || disabled || readOnly) return;

      const newValue = calculateNewValue(e.clientX, e.clientY);
      const curVals = [...latestValuesRef.current];

      let clampedVal = newValue;
      if (isRange) {
        if (activeThumbIndex === 0) {
          clampedVal = Math.min(newValue, curVals[1] - minDistance);
        } else {
          clampedVal = Math.max(newValue, curVals[0] + minDistance);
        }
      }

      if (curVals[activeThumbIndex] !== clampedVal) {
        curVals[activeThumbIndex] = clampedVal;
        emitChange(curVals, activeThumbIndex, e);
      }
    },
    [isDragging, activeThumbIndex, disabled, readOnly, isRange, minDistance, calculateNewValue, emitChange]
  );

  const handlePointerUp = useCallback(
    (e) => {
      if (isDragging) {
        try {
          if (e.currentTarget.hasPointerCapture(e.pointerId)) {
            e.currentTarget.releasePointerCapture(e.pointerId);
          }
        } catch {
          // Bỏ qua lỗi nếu pointer capture đã tự động giải phóng
        }

        setIsDragging(false);
        setActiveThumbIndex(null);
        emitChangeCommitted(latestValuesRef.current, e);
      }
    },
    [isDragging, emitChangeCommitted]
  );

  // ─────────────────────────────────────────────────────────────────────────
  // KEYBOARD NAVIGATION
  // ─────────────────────────────────────────────────────────────────────────

  const handleKeyDown = useCallback(
    (index, e) => {
      if (disabled || readOnly) return;

      const multiplier = e.shiftKey ? 10 : 1;
      const stepVal = (step || 1) * multiplier;
      const curVals = [...latestValuesRef.current];
      let val = curVals[index];

      switch (e.key) {
        case 'ArrowRight':
        case 'ArrowUp':
          e.preventDefault();
          val = roundToStep(val + stepVal, min, max, step);
          break;
        case 'ArrowLeft':
        case 'ArrowDown':
          e.preventDefault();
          val = roundToStep(val - stepVal, min, max, step);
          break;
        case 'PageUp':
          e.preventDefault();
          val = roundToStep(val + stepVal * 10, min, max, step);
          break;
        case 'PageDown':
          e.preventDefault();
          val = roundToStep(val - stepVal * 10, min, max, step);
          break;
        case 'Home':
          e.preventDefault();
          val = isRange && index === 1 ? curVals[0] + minDistance : min;
          break;
        case 'End':
          e.preventDefault();
          val = isRange && index === 0 ? curVals[1] - minDistance : max;
          break;
        default:
          return;
      }

      // Áp dụng minDistance cho Range Slider
      if (isRange) {
        if (index === 0) {
          val = Math.min(val, curVals[1] - minDistance);
        } else {
          val = Math.max(val, curVals[0] + minDistance);
        }
      }

      if (curVals[index] !== val) {
        curVals[index] = val;
        emitChange(curVals, index, e);
        emitChangeCommitted(curVals, e);
      }
    },
    [disabled, readOnly, step, min, max, isRange, minDistance, emitChange, emitChangeCommitted]
  );

  // ─────────────────────────────────────────────────────────────────────────
  // COMPUTED CSS STYLES FOR TRACK FILL & THUMBS
  // ─────────────────────────────────────────────────────────────────────────

  const fillStyle = useMemo(() => {
    if (!isRange) {
      const p = valueToPercent(values[0], min, max);
      return orientation === 'horizontal'
        ? { left: '0%', width: `${p}%` }
        : { bottom: '0%', height: `${p}%` };
    }

    const p0 = valueToPercent(values[0], min, max);
    const p1 = valueToPercent(values[1], min, max);
    const start = Math.min(p0, p1);
    const length = Math.abs(p1 - p0);

    return orientation === 'horizontal'
      ? { left: `${start}%`, width: `${length}%` }
      : { bottom: `${start}%`, height: `${length}%` };
  }, [isRange, values, min, max, orientation]);

  // ─────────────────────────────────────────────────────────────────────────
  // CLASS NAMES
  // ─────────────────────────────────────────────────────────────────────────

  const rootClasses = classNames(
    'slider',
    `slider--${orientation}`,
    `slider--size-${normalizedSize}`,
    `slider--color-${color}`,
    {
      'slider--disabled': disabled,
      'slider--readonly': readOnly,
      'slider--dragging': isDragging,
      'slider--focused': focusedThumbIndex !== null,
      'slider--hovered': isHovered,
      'slider--has-marks': markList.length > 0,
      'slider--range': isRange,
    },
    className
  );

  const effectiveAriaLabel = ariaLabelProp || ariaLabel || (name ? `Thanh trượt ${name}` : 'Thanh trượt');

  return (
    <div
      ref={ref}
      id={sliderId}
      className={rootClasses}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      {...rest}
    >
      {/* Track & Drag Container */}
      <div
        ref={trackRef}
        className="slider__track-container"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {/* Track Background */}
        <div className="slider__track slider__track--bg" aria-hidden="true" />

        {/* Track Active Fill */}
        <div
          className="slider__track slider__track--fill"
          style={fillStyle}
          aria-hidden="true"
        />

        {/* Discrete Ticks & Marks */}
        {markList.length > 0 && (
          <div className="slider__marks" aria-hidden="true">
            {markList.map((m, idx) => {
              const isActive = isRange
                ? m.value >= values[0] && m.value <= values[1]
                : m.value <= values[0];

              const markPos =
                orientation === 'horizontal'
                  ? { left: `${m.percent}%` }
                  : { bottom: `${m.percent}%` };

              return (
                <div
                  key={`mark-${m.value}-${idx}`}
                  className={classNames('slider__mark', {
                    'slider__mark--active': isActive,
                    'slider__mark--has-label': Boolean(m.label),
                  })}
                  style={markPos}
                >
                  <div className="slider__mark-tick" />
                  {m.label && (
                    <span className="slider__mark-label">{m.label}</span>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Thumbs & Pin Value Indicators */}
        {values.map((val, index) => {
          const percent = valueToPercent(val, min, max);
          const thumbPos =
            orientation === 'horizontal'
              ? { left: `${percent}%` }
              : { bottom: `${percent}%` };

          const isThumbFocused = focusedThumbIndex === index;
          const isThumbActive = activeThumbIndex === index;

          const isLabelVisible =
            valueLabelDisplay === 'on' ||
            (valueLabelDisplay === 'auto' &&
              (isThumbActive || isThumbFocused || (isHovered && !disabled)));

          const singleThumbIcon = Array.isArray(thumbIcon)
            ? thumbIcon[index]
            : thumbIcon;

          return (
            <div
              key={`thumb-${index}`}
              className={classNames('slider__thumb', {
                'slider__thumb--active': isThumbActive,
                'slider__thumb--focused': isThumbFocused,
              })}
              style={thumbPos}
              role="slider"
              tabIndex={disabled ? -1 : 0}
              aria-label={isRange ? `${effectiveAriaLabel} - Điểm ${index === 0 ? 'đầu' : 'cuối'}` : effectiveAriaLabel}
              aria-labelledby={ariaLabelledBy}
              aria-describedby={ariaDescribedBy}
              aria-valuemin={isRange && index === 1 ? values[0] + minDistance : min}
              aria-valuemax={isRange && index === 0 ? values[1] - minDistance : max}
              aria-valuenow={val}
              aria-valuetext={formatLabel(val, index)}
              aria-disabled={disabled ? 'true' : undefined}
              aria-readonly={readOnly ? 'true' : undefined}
              aria-orientation={orientation}
              onKeyDown={(e) => handleKeyDown(index, e)}
              onFocus={() => setFocusedThumbIndex(index)}
              onBlur={() => setFocusedThumbIndex(null)}
            >
              {/* Invisible 44x44px Touch Target Expander */}
              <div className="slider__touch-target" aria-hidden="true" />

              {/* State Layer (Hover / Focus / Active Ripple) */}
              <div className="slider__state-layer" aria-hidden="true" />

              {/* Thumb Center Core */}
              <div className="slider__thumb-core">
                {singleThumbIcon && (
                  <div className="slider__thumb-icon" aria-hidden="true">
                    {singleThumbIcon}
                  </div>
                )}
              </div>

              {/* Material 3 Pin / Balloon Value Indicator */}
              {isLabelVisible && (
                <div className="slider__pin" role="tooltip" aria-hidden="true">
                  <div className="slider__pin-bubble">
                    <span className="slider__pin-value">
                      {formatLabel(val, index)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Hidden inputs for HTML form compatibility */}
      {name &&
        values.map((v, i) => (
          <input
            key={`input-${name}-${i}`}
            type="hidden"
            name={isRange ? `${name}[${i}]` : name}
            value={v}
          />
        ))}
    </div>
  );
});

Slider.displayName = 'Slider';

Slider.propTypes = {
  /** ARIA label accessibility */
  'aria-label': PropTypes.string,
  /** ARIA describedby */
  'aria-describedby': PropTypes.string,
  /** ARIA labelledby */
  'aria-labelledby': PropTypes.string,
  /** ARIA label (prop thay thế) */
  ariaLabel: PropTypes.string,
  /** CSS class bổ sung */
  className: PropTypes.string,
  /** Bộ màu chủ đề Material 3 */
  color: PropTypes.oneOf([
    'primary',
    'accent',
    'secondary',
    'success',
    'warning',
    'error',
    'danger',
    'neutral',
  ]),
  /** Giá trị mặc định (uncontrolled): number hoặc [min, max] */
  defaultValue: PropTypes.oneOfType([
    PropTypes.number,
    PropTypes.arrayOf(PropTypes.number),
  ]),
  /** Vô hiệu hóa slider */
  disabled: PropTypes.bool,
  /** Hàm định dạng giá trị nhãn hiển thị */
  formatValue: PropTypes.func,
  /** ID HTML */
  id: PropTypes.string,
  /** Đánh dấu các mốc giá trị (boolean hoặc mảng { value, label }) */
  marks: PropTypes.oneOfType([
    PropTypes.bool,
    PropTypes.arrayOf(
      PropTypes.shape({
        label: PropTypes.node,
        value: PropTypes.number.isRequired,
      })
    ),
  ]),
  /** Giá trị tối đa */
  max: PropTypes.number,
  /** Giá trị tối thiểu */
  min: PropTypes.number,
  /** Khoảng cách tối thiểu giữa 2 thumbs khi ở chế độ Range Slider */
  minDistance: PropTypes.number,
  /** Tên trường (form input name) */
  name: PropTypes.string,
  /** Callback khi giá trị thay đổi trong quá trình kéo hoặc gõ phím */
  onChange: PropTypes.func,
  /** Callback khi kết thúc thao tác kéo (pointerup / keydown commit) */
  onChangeCommitted: PropTypes.func,
  /** Hướng thanh trượt (ngang hoặc dọc) */
  orientation: PropTypes.oneOf(['horizontal', 'vertical']),
  /** Chế độ chỉ đọc */
  readOnly: PropTypes.bool,
  /** Hiển thị các vạch tick nhỏ theo step */
  showTicks: PropTypes.bool,
  /** Kích thước thanh trượt */
  size: PropTypes.oneOf(['small', 'medium', 'large', 'sm', 'md', 'lg']),
  /** Bước nhảy giá trị (hoặc null nếu liên tục) */
  step: PropTypes.number,
  /** Icon tùy biến hiển thị bên trong thumb */
  thumbIcon: PropTypes.oneOfType([
    PropTypes.node,
    PropTypes.arrayOf(PropTypes.node),
  ]),
  /** Danh sách giá trị cụ thể để hiển thị ticks */
  tickValues: PropTypes.arrayOf(PropTypes.number),
  /** Giá trị thanh trượt (controlled): number hoặc [min, max] */
  value: PropTypes.oneOfType([
    PropTypes.number,
    PropTypes.arrayOf(PropTypes.number),
  ]),
  /** Chế độ hiển thị nhãn giá trị (Pin/Balloon Tooltip) */
  valueLabelDisplay: PropTypes.oneOf(['auto', 'on', 'off']),
  /** Hàm định dạng giá trị trong Pin Tooltip */
  valueLabelFormat: PropTypes.func,
};

export default memo(Slider);