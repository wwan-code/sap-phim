/**
 * @file IconButton.jsx
 * @module Components/UI/IconButton
 * @description Component nút icon (IconButton) chuẩn Material 3 Expressive (standard, filled, tonal, outlined), vùng chạm thông minh và Design Tokens (--sp-*).
 */

import React, { forwardRef, memo } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { Loader2 } from 'lucide-react';

import ButtonBase from '@/shared/components/ui/button-base';

import './icon-button.scss';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

/** Kích thước icon Loader2 tương ứng theo từng size IconButton */
const SPINNER_SIZE_MAP = {
  small: 14,
  medium: 18,
  large: 22,
};

const STANDARD_COLORS = ['default', 'inherit', 'primary', 'secondary', 'error', 'danger', 'warning', 'success', 'info'];

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @component IconButton
 * @description Nút bấm dạng icon hình tròn chuẩn Material 3 Expressive với vùng chạm tối ưu.
 */
const IconButton = forwardRef((props, ref) => {
  const {
    centerRipple = false,
    children,
    className,
    classes = {},
    color = 'default',
    disabled = false,
    disableFocusRipple = false,
    disableRipple = false,
    edge = false,
    loading = false,
    loadingIndicator: loadingIndicatorProp,
    size = 'medium',
    style,
    sx,
    variant = 'standard',
    ...other
  } = props;

  // ─────────────────────────────────────────────────────────────────────────
  // STYLING & LOGIC
  // ─────────────────────────────────────────────────────────────────────────

  const normalizedColor = color === 'danger' ? 'error' : color;
  const isStandardColor = STANDARD_COLORS.includes(normalizedColor);
  const spinnerSize = SPINNER_SIZE_MAP[size] || 18;

  const defaultSpinner = (
    <Loader2
      className="icon-button__spinner"
      size={spinnerSize}
      aria-hidden="true"
    />
  );

  const loadingIndicator = loadingIndicatorProp || defaultSpinner;

  const rootClasses = classNames(
    'icon-button',
    classes.root,
    className,
    `icon-button--variant-${variant}`,
    `icon-button--size-${size}`,
    {
      [`icon-button--color-${normalizedColor}`]: isStandardColor && normalizedColor !== 'default',
      'icon-button--color-inherit': normalizedColor === 'inherit',
      'icon-button--color-custom': !isStandardColor && color,
      [`icon-button--edge-${edge}`]: Boolean(edge),
      'icon-button--disabled': disabled || loading,
      'icon-button--loading': loading,
    }
  );

  const mergedStyle = {
    ...(typeof sx === 'object' ? sx : {}),
    ...style,
  };

  if (!isStandardColor && color) {
    mergedStyle['--sp-icon-btn-custom-color'] = color;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <ButtonBase
      ref={ref}
      className={rootClasses}
      centerRipple={centerRipple}
      disabled={disabled || loading}
      disableRipple={disableRipple}
      focusRipple={!disableFocusRipple}
      focusVisibleClassName="icon-button--focus-visible"
      style={Object.keys(mergedStyle).length > 0 ? mergedStyle : undefined}
      {...other}
    >
      <span className={classNames('icon-button__icon', classes.icon)}>
        {children}
      </span>

      {loading && (
        <span className={classNames('icon-button__loading-indicator', classes.loadingIndicator)}>
          {loadingIndicator}
        </span>
      )}
    </ButtonBase>
  );
});

IconButton.displayName = 'IconButton';

IconButton.propTypes = {
  /** Hiệu ứng ripple bắt đầu từ tâm nút tròn */
  centerRipple: PropTypes.bool,
  /** Icon hoặc element hiển thị bên trong nút */
  children: PropTypes.node,
  /** Ghi đè class nội bộ (BEM keys: root, icon, loadingIndicator) */
  classes: PropTypes.object,
  /** Class tùy chỉnh bổ sung */
  className: PropTypes.string,
  /** Màu sắc của icon button (default, primary, secondary, error, danger, warning, success, info, inherit hoặc HEX) */
  color: PropTypes.string,
  /** Vô hiệu hóa nút */
  disabled: PropTypes.bool,
  /** Tắt hiệu ứng ripple khi focus bàn phím */
  disableFocusRipple: PropTypes.bool,
  /** Tắt hiệu ứng ripple khi click */
  disableRipple: PropTypes.bool,
  /** Căn lề nút cho khớp với cạnh container ('start' | 'end' | false) */
  edge: PropTypes.oneOf(['start', 'end', false]),
  /** Trạng thái đang tải */
  loading: PropTypes.bool,
  /** Icon/phần tử hiển thị thay thế khi đang tải */
  loadingIndicator: PropTypes.node,
  /** Kích thước nút */
  size: PropTypes.oneOf(['small', 'medium', 'large']),
  /** Inline style tùy chỉnh */
  style: PropTypes.object,
  /** System prop cho style */
  sx: PropTypes.oneOfType([PropTypes.object, PropTypes.array, PropTypes.func]),
  /** Biến thể hiển thị Material 3 */
  variant: PropTypes.oneOf(['standard', 'filled', 'tonal', 'outlined']),
};

export default memo(IconButton);
