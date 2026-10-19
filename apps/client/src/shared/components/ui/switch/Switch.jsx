/**
 * @file Switch.jsx
 * @module Components/UI/Switch
 * @description Component Switch (Công tắc gạt) chuẩn Material 3 Expressive, hỗ trợ Label, Description, Async Loading, Semantic Colors và Tooltip.
 */

import React, {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { Loader2 } from 'lucide-react';

import Tooltip from '@/shared/components/ui/tooltip';

import './switch.scss';

const STANDARD_COLORS = [
  'default',
  'primary',
  'accent',
  'secondary',
  'success',
  'warning',
  'error',
  'danger',
  'info',
  'neutral',
];

/**
 * @component Switch
 * @description Component công tắc gạt tương tác Material 3 Expressive.
 */
const Switch = forwardRef((props, ref) => {
  const {
    checked,
    checkedIcon,
    className,
    color = 'primary',
    defaultChecked = false,
    description,
    disabled = false,
    icon,
    id: customId,
    label,
    labelPlacement = 'end',
    loading = false,
    name,
    onChange,
    optimistic = false,
    readOnly = false,
    required = false,
    size = 'medium',
    slotProps = {},
    style,
    sublabel,
    tooltip,
    tooltipProps,
    value,
    ...rest
  } = props;

  const inputRef = useRef(null);
  const isControlled = checked !== undefined;
  const [internalChecked, setInternalChecked] = useState(() => Boolean(defaultChecked));
  const [optimisticChecked, setOptimisticChecked] = useState(null);
  const [isFocusedVisible, setIsFocusedVisible] = useState(false);

  const generatedId = useId();
  const switchId = customId || `sp-switch-${generatedId}`;
  const descriptionId = `${switchId}-desc`;

  // Reset optimistic state when controlled prop updates
  useEffect(() => {
    setOptimisticChecked(null);
  }, [checked]);

  const currentChecked = isControlled
    ? (optimisticChecked !== null ? optimisticChecked : Boolean(checked))
    : internalChecked;

  const isStandardColor = STANDARD_COLORS.includes(color);
  const normalizedColor = color === 'error' ? 'danger' : color;
  const effectiveDescription = description || sublabel;
  const isInteractiveDisabled = disabled || loading;

  const setInputRef = useCallback((node) => {
    inputRef.current = node;

    if (typeof ref === 'function') {
      ref(node);
    } else if (ref) {
      ref.current = node;
    }
  }, [ref]);

  // Handle toggle change
  const handleChange = (event) => {
    if (isInteractiveDisabled || readOnly) return;

    const newChecked = event.target.checked;
    if (!isControlled) {
      setInternalChecked(newChecked);
    } else if (optimistic) {
      setOptimisticChecked(newChecked);
    }

    onChange?.(event, newChecked);
    slotProps.input?.onChange?.(event, newChecked);
  };

  const handleFocus = (event) => {
    if (event.target.matches(':focus-visible')) {
      setIsFocusedVisible(true);
    }
    slotProps.input?.onFocus?.(event);
  };

  const handleBlur = (event) => {
    setIsFocusedVisible(false);
    slotProps.input?.onBlur?.(event);
  };

  // Icon Resolution
  const currentIcon = currentChecked ? (checkedIcon || icon) : icon;
  const hasIcon = Boolean(currentIcon);

  const renderThumbContent = () => {
    if (loading) {
      const spinnerSize = size === 'small' ? 10 : size === 'large' ? 16 : 12;
      return <Loader2 className="switch__spinner" size={spinnerSize} aria-hidden="true" />;
    }

    if (!hasIcon) return null;

    if (React.isValidElement(currentIcon)) {
      return (
        <span className="switch__icon-container">
          {React.cloneElement(currentIcon, {
            className: classNames('switch__icon', currentIcon.props.className, {
              'switch__icon--checked': currentChecked,
              'switch__icon--unchecked': !currentChecked,
            }),
            'aria-hidden': 'true',
          })}
        </span>
      );
    }

    return <span className="switch__icon-container">{currentIcon}</span>;
  };

  // Style composition
  const mergedStyle = {
    ...(!isStandardColor && color && color !== 'default' ? { '--switch-custom-color': color } : {}),
    ...style,
    ...slotProps.root?.style,
  };

  const switchClasses = classNames(
    'switch',
    `switch--size-${size}`,
    {
      'switch--checked': currentChecked,
      'switch--disabled': disabled,
      'switch--loading': loading,
      'switch--focus-visible': isFocusedVisible,
      'switch--color-custom': !isStandardColor && color && color !== 'default',
      [`switch--color-${normalizedColor}`]: isStandardColor && normalizedColor !== 'default',
    },
    slotProps.switch?.className
  );

  const switchControl = (
    <span className={label ? switchClasses : undefined}>
      <input
        {...rest}
        {...slotProps.input}
        ref={setInputRef}
        type="checkbox"
        role="switch"
        id={switchId}
        name={name}
        value={value}
        checked={currentChecked}
        disabled={isInteractiveDisabled}
        readOnly={readOnly}
        required={required}
        aria-checked={currentChecked}
        aria-busy={loading ? 'true' : undefined}
        aria-describedby={effectiveDescription ? descriptionId : undefined}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        className={classNames('switch__input', slotProps.input?.className)}
      />

      <span className="switch__track" />

      <span className="switch__thumb-wrapper" aria-hidden="true">
        <span
          className={classNames('switch__thumb', {
            'switch__thumb--with-icon': hasIcon || loading,
          })}
        >
          {renderThumbContent()}
        </span>
      </span>
    </span>
  );

  // Helper bọc Tooltip nếu có prop `tooltip`
  const withTooltip = (node) => {
    if (!tooltip) return node;
    return (
      <Tooltip title={tooltip} placement="top" {...tooltipProps}>
        {node}
      </Tooltip>
    );
  };

  // Trường hợp có Label hoặc Description
  if (label || effectiveDescription) {
    const rootClasses = classNames(
      'switch-wrapper',
      `switch-wrapper--placement-${labelPlacement}`,
      {
        'switch-wrapper--disabled': disabled,
        'switch-wrapper--loading': loading,
      },
      className,
      slotProps.root?.className
    );

    return withTooltip(
      <label
        {...slotProps.root}
        htmlFor={switchId}
        className={rootClasses}
        style={Object.keys(mergedStyle).length > 0 ? mergedStyle : undefined}
      >
        {switchControl}

        <span className="switch__label-group">
          {label && (
            <span className={classNames('switch__label', slotProps.label?.className)}>
              {typeof label === 'function' ? label(currentChecked) : label}
            </span>
          )}
          {effectiveDescription && (
            <span id={descriptionId} className="switch__description">
              {effectiveDescription}
            </span>
          )}
        </span>
      </label>
    );
  }

  // Trường hợp Switch độc lập (không có Label)
  const standaloneClasses = classNames(
    switchClasses,
    className,
    slotProps.root?.className
  );

  return withTooltip(
    <span
      {...slotProps.root}
      className={standaloneClasses}
      style={Object.keys(mergedStyle).length > 0 ? mergedStyle : undefined}
    >
      {switchControl}
    </span>
  );
});

Switch.displayName = 'Switch';

Switch.propTypes = {
  /** Trạng thái bật/tắt (Controlled) */
  checked: PropTypes.bool,
  /** Icon hiển thị trong thumb khi Switch ở trạng thái Checked */
  checkedIcon: PropTypes.node,
  /** CSS class bổ sung cho phần tử root */
  className: PropTypes.string,
  /** Biến thể màu sắc Material 3 (primary, accent, success, warning, error, info, neutral) hoặc mã màu custom */
  color: PropTypes.string,
  /** Trạng thái bật/tắt mặc định (Uncontrolled) */
  defaultChecked: PropTypes.bool,
  /** Dòng mô tả chi tiết / phụ chú bên dưới nhãn chính */
  description: PropTypes.node,
  /** Vô hiệu hóa tương tác Switch */
  disabled: PropTypes.bool,
  /** Icon hiển thị trong thumb khi Switch ở trạng thái Unchecked */
  icon: PropTypes.node,
  /** ID HTML tùy chỉnh (mặc định tự sinh) */
  id: PropTypes.string,
  /** Nhãn hiển thị cho Switch (chuỗi, React node hoặc render function `(checked) => node`) */
  label: PropTypes.oneOfType([PropTypes.node, PropTypes.func]),
  /** Vị trí hiển thị của nhãn so với Switch */
  labelPlacement: PropTypes.oneOf(['start', 'end', 'top', 'bottom']),
  /** Hiển thị micro-spinner loading và vô hiệu hóa tương tác trong khi xử lý bất đồng bộ */
  loading: PropTypes.bool,
  /** Thuộc tính name của input HTML */
  name: PropTypes.string,
  /** Callback kích hoạt khi trạng thái thay đổi: `(event, checked) => void` */
  onChange: PropTypes.func,
  /** Kích hoạt cập nhật UI lạc quan (Optimistic Update) ngay khi click */
  optimistic: PropTypes.bool,
  /** Chỉ đọc, không cho phép thay đổi trạng thái */
  readOnly: PropTypes.bool,
  /** Đánh dấu trường bắt buộc */
  required: PropTypes.bool,
  /** Kích thước Switch chuẩn Material 3 */
  size: PropTypes.oneOf(['small', 'medium', 'large']),
  /** Tùy biến props cho các slot con (root, input, label, switch) */
  slotProps: PropTypes.shape({
    input: PropTypes.object,
    label: PropTypes.object,
    root: PropTypes.object,
    switch: PropTypes.object,
  }),
  /** Inline styles tùy biến cho phần tử root */
  style: PropTypes.object,
  /** Alias của description */
  sublabel: PropTypes.node,
  /** Nội dung chú giải hiển thị khi hover (Tích hợp Tooltip) */
  tooltip: PropTypes.node,
  /** Props bổ sung truyền xuống component Tooltip */
  tooltipProps: PropTypes.object,
  /** Giá trị của input HTML */
  value: PropTypes.any,
};

export default memo(Switch);
