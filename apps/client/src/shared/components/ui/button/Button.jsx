/**
 * @file Button.jsx
 * @module Components/UI/Button
 * @description Component nút bấm chuẩn Material 3 Expressive (filled, elevated, tonal, outlined, text) kết hợp Design Tokens (--sp-*) và The Aesthetic OS.
 */

import React, { forwardRef, memo } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { Loader2 } from 'lucide-react';

import ButtonBase from '@/shared/components/ui/button-base';

import './button.scss';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

/** Kích thước icon Loader2 tương ứng theo từng size button */
const SPINNER_SIZE_MAP = {
  small: 14,
  medium: 18,
  large: 22,
};

const STANDARD_COLORS = ['inherit', 'primary', 'secondary', 'success', 'error', 'danger', 'warning', 'info'];

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @component Button
 * @description Component nút bấm Material 3 Expressive với 5 biến thể solid/tonal/outline/text.
 */
const Button = forwardRef((props, ref) => {
  const {
    children,
    className,
    classes = {},
    color = 'primary',
    disabled = false,
    disableElevation = false,
    disableFocusRipple = false,
    disableRipple = false,
    endIcon: endIconProp,
    fullWidth = false,
    href,
    loading = false,
    loadingIndicator: loadingIndicatorProp,
    loadingPosition = 'center',
    size = 'medium',
    startIcon: startIconProp,
    style,
    sx,
    type = 'button',
    variant = 'filled',
    ...other
  } = props;

  // ─────────────────────────────────────────────────────────────────────────
  // STYLING & LOGIC
  // ─────────────────────────────────────────────────────────────────────────

  const normalizedVariant = variant === 'outline' ? 'outlined' : variant === 'solid' ? 'filled' : (variant || 'filled');
  const normalizedColor = color === 'danger' ? 'error' : color === 'neutral' ? 'secondary' : color;
  const isStandardColor = STANDARD_COLORS.includes(normalizedColor);
  const centerLoading = loading && loadingPosition === 'center';
  const spinnerSize = SPINNER_SIZE_MAP[size] || 18;

  const defaultSpinner = (
    <Loader2
      className="btn__spinner"
      size={spinnerSize}
      aria-hidden="true"
    />
  );

  const loadingIndicator = loadingIndicatorProp || defaultSpinner;

  const startIcon = startIconProp && (
    <span
      className={classNames('btn__icon', 'btn__icon--start', classes.startIcon, {
        'btn__icon--invisible': centerLoading,
      })}
    >
      {startIconProp}
    </span>
  );

  const endIcon = endIconProp && (
    <span
      className={classNames('btn__icon', 'btn__icon--end', classes.endIcon, {
        'btn__icon--invisible': centerLoading,
      })}
    >
      {endIconProp}
    </span>
  );

  const rootClasses = classNames(
    'btn',
    classes.root,
    className,
    `btn--variant-${normalizedVariant}`,
    `btn--size-${size}`,
    {
      [`btn--color-${normalizedColor}`]: isStandardColor && normalizedColor !== 'inherit',
      'btn--color-inherit': normalizedColor === 'inherit',
      'btn--color-custom': !isStandardColor && color,
      'btn--disabled': disabled || loading,
      'btn--disable-elevation': disableElevation,
      'btn--full-width': fullWidth,
      'btn--loading': loading,
    }
  );

  const mergedStyle = {
    ...(typeof sx === 'object' ? sx : {}),
    ...style,
  };

  if (!isStandardColor && color) {
    mergedStyle['--sp-btn-custom-color'] = color;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <ButtonBase
      ref={ref}
      className={rootClasses}
      disabled={disabled || loading}
      disableRipple={disableRipple}
      focusRipple={!disableFocusRipple}
      focusVisibleClassName="btn--focus-visible"
      href={href}
      type={type}
      style={Object.keys(mergedStyle).length > 0 ? mergedStyle : undefined}
      {...other}
    >
      {loading && loadingPosition === 'start' && (
        <span
          className={classNames('btn__loading-indicator', 'btn__loading-indicator--start', classes.loadingIndicator)}
        >
          {loadingIndicator}
        </span>
      )}

      {startIcon}

      <span
        className={classNames('btn__label', classes.label, {
          'btn__label--invisible': centerLoading,
        })}
      >
        {children}
      </span>

      {loading && loadingPosition === 'center' && (
        <span
          className={classNames('btn__loading-indicator', 'btn__loading-indicator--center', classes.loadingIndicator)}
        >
          {loadingIndicator}
        </span>
      )}

      {endIcon}

      {loading && loadingPosition === 'end' && (
        <span
          className={classNames('btn__loading-indicator', 'btn__loading-indicator--end', classes.loadingIndicator)}
        >
          {loadingIndicator}
        </span>
      )}
    </ButtonBase>
  );
});

Button.displayName = 'Button';

Button.propTypes = {
  /** Nội dung hiển thị bên trong nút */
  children: PropTypes.node,
  /** Ghi đè class nội bộ (BEM keys: root, label, startIcon, endIcon, loadingIndicator) */
  classes: PropTypes.object,
  /** Class tùy chỉnh bổ sung */
  className: PropTypes.string,
  /** Màu sắc của nút (primary, secondary, success, error, danger, warning, info, inherit hoặc mã màu HEX/RGB) */
  color: PropTypes.string,
  /** Vô hiệu hóa nút */
  disabled: PropTypes.bool,
  /** Tắt hiệu ứng đổ bóng cho các biến thể filled/elevated */
  disableElevation: PropTypes.bool,
  /** Tắt hiệu ứng ripple khi focus bằng bàn phím */
  disableFocusRipple: PropTypes.bool,
  /** Tắt hiệu ứng ripple khi click */
  disableRipple: PropTypes.bool,
  /** Icon hiển thị ở cuối nút */
  endIcon: PropTypes.node,
  /** Chiều rộng 100% (full-width) */
  fullWidth: PropTypes.bool,
  /** Đường dẫn nếu nút hoạt động như thẻ liên kết <a> */
  href: PropTypes.string,
  /** Trạng thái đang tải */
  loading: PropTypes.bool,
  /** Phần tử hiển thị thay thế khi đang tải */
  loadingIndicator: PropTypes.node,
  /** Vị trí hiển thị loading indicator */
  loadingPosition: PropTypes.oneOf(['center', 'start', 'end']),
  /** Kích thước nút */
  size: PropTypes.oneOf(['small', 'medium', 'large']),
  /** Icon hiển thị ở đầu nút */
  startIcon: PropTypes.node,
  /** Style inline tùy chỉnh */
  style: PropTypes.object,
  /** System prop cho style */
  sx: PropTypes.oneOfType([PropTypes.object, PropTypes.array, PropTypes.func]),
  /** Thuộc tính button type HTML */
  type: PropTypes.string,
  /** Biến thể hiển thị Material 3 Expressive */
  variant: PropTypes.oneOf(['filled', 'elevated', 'tonal', 'outlined', 'text', 'outline', 'solid']),
};

export default memo(Button);
