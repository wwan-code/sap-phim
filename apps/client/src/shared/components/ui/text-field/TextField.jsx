/**
 * @file TextField.jsx
 * @module Components/UI/TextField
 * @description Component trường nhập liệu (TextField) chuẩn Material 3 Expressive, hỗ trợ 3 biến thể (outlined, filled, standard), floating label, interactive adornments và Design Tokens (--sp-*).
 */

import React, { useState, forwardRef, useRef, useCallback, useMemo, useEffect, memo } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { X, Eye, EyeOff } from 'lucide-react';

import './text-field.scss';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

/** Các kiểu input HTML luôn bắt buộc label nổi lên (native picker) */
const ALWAYS_FLOATING_TYPES = ['date', 'time', 'datetime-local', 'month', 'week'];

/** Kích thước icon adornment tương ứng với size của TextField */
const ICON_SIZE_MAP = {
  small: 14,
  medium: 16,
  large: 18,
};

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @component TextField
 * @description Trường nhập liệu chuẩn Material 3 Expressive với 3 biến thể outlined, filled, standard.
 */
const TextField = forwardRef((props, ref) => {
  const {
    children,
    className,
    clearable = false,
    color,
    defaultValue,
    disabled = false,
    error = false,
    fullWidth = false,
    helperText,
    id,
    InputProps = {},
    inputProps = {},
    label,
    maxLength,
    multiline = false,
    name,
    onBlur,
    onChange,
    onClear,
    onFocus,
    placeholder,
    readOnly,
    required = false,
    rows,
    select = false,
    showPasswordToggle = false,
    size = 'medium',
    type = 'text',
    value,
    variant = 'outlined',
    ...rest
  } = props;

  // ─────────────────────────────────────────────────────────────────────────
  // STATE & REFS
  // ─────────────────────────────────────────────────────────────────────────

  const [isFocused, setIsFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isAutofilled, setIsAutofilled] = useState(false);
  const [internalValue, setInternalValue] = useState(() => {
    if (value !== undefined && value !== null) return value;
    if (defaultValue !== undefined && defaultValue !== null) return defaultValue;
    return '';
  });

  const isControlled = value !== undefined;
  const currentValue = isControlled ? (value ?? '') : internalValue;
  const inputRef = useRef(null);

  /** Kết hợp forwarded ref và internal ref */
  const setRefs = useCallback(
    (node) => {
      inputRef.current = node;
      if (typeof ref === 'function') ref(node);
      else if (ref) ref.current = node;
    },
    [ref]
  );

  // Đồng bộ giá trị uncontrolled khi DOM bị thay đổi bên ngoài (reset form)
  useEffect(() => {
    if (!isControlled && inputRef.current) {
      const domValue = inputRef.current.value;
      if (domValue !== internalValue) {
        setInternalValue(domValue);
      }
    }
  });

  // Tự động phát hiện và đồng bộ Browser Autofill (Chrome, Edge, Safari, Password Managers)
  useEffect(() => {
    const checkAutofill = () => {
      if (!inputRef.current) return;
      let isAutofillMatched = false;
      try {
        isAutofillMatched = Boolean(
          inputRef.current.matches?.(':-webkit-autofill') ||
          inputRef.current.matches?.(':autofill')
        );
      } catch {
        // Fallback cho môi trường test hoặc browser cũ không hỗ trợ pseudo selector trong matches
      }

      const domVal = inputRef.current.value;
      if (isAutofillMatched || (domVal && !currentValue)) {
        setIsAutofilled(true);
        if (domVal && !currentValue && onChange) {
          onChange({
            target: {
              name,
              value: domVal,
            },
          });
        }
      }
    };

    checkAutofill();
    const t1 = setTimeout(checkAutofill, 80);
    const t2 = setTimeout(checkAutofill, 250);
    const t3 = setTimeout(checkAutofill, 500);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [currentValue, name, onChange]);

  // ─────────────────────────────────────────────────────────────────────────
  // HANDLERS
  // ─────────────────────────────────────────────────────────────────────────

  const handleAnimationStart = useCallback(
    (e) => {
      if (e.animationName === 'onAutoFillStart') {
        setIsAutofilled(true);
        if (inputRef.current?.value && !currentValue && onChange) {
          onChange({
            target: {
              name,
              value: inputRef.current.value,
            },
          });
        }
      } else if (e.animationName === 'onAutoFillCancel') {
        setIsAutofilled(false);
      }
    },
    [currentValue, name, onChange]
  );

  const handleChange = useCallback(
    (e) => {
      if (isAutofilled) {
        setIsAutofilled(false);
      }
      if (!isControlled) {
        setInternalValue(e.target.value);
      }
      onChange?.(e);
    },
    [isAutofilled, isControlled, onChange]
  );

  const handleFocus = useCallback(
    (e) => {
      setIsFocused(true);
      onFocus?.(e);
    },
    [onFocus]
  );

  const handleBlur = useCallback(
    (e) => {
      setIsFocused(false);
      onBlur?.(e);
    },
    [onBlur]
  );

  const handleClear = useCallback(
    (e) => {
      e.stopPropagation();
      setIsAutofilled(false);
      if (!isControlled) {
        setInternalValue('');
      }
      if (inputRef.current) {
        inputRef.current.value = '';
        inputRef.current.focus();
      }
      onChange?.({
        target: {
          name,
          value: '',
        },
      });
      onClear?.();
    },
    [isControlled, onChange, onClear, name]
  );

  const handleTogglePassword = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setShowPassword((prev) => !prev);
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // COMPUTED PROPERTIES
  // ─────────────────────────────────────────────────────────────────────────

  const hasValue =
    (currentValue !== null &&
      currentValue !== undefined &&
      String(currentValue).length > 0) ||
    Boolean(inputRef.current?.value && String(inputRef.current.value).length > 0);

  const isFloating =
    isFocused ||
    hasValue ||
    isAutofilled ||
    ALWAYS_FLOATING_TYPES.includes(type) ||
    !label;

  const isError = Boolean(error);
  const displayHelperText = helperText || (typeof error === 'string' ? error : undefined);
  const helperTextId = id && displayHelperText ? `${id}-helper-text` : undefined;

  const effectiveType = type === 'password' && showPassword ? 'text' : type;
  const iconSize = ICON_SIZE_MAP[size] || 16;
  const isOverLimit = Boolean(maxLength && String(currentValue).length >= maxLength);

  // ─────────────────────────────────────────────────────────────────────────
  // CLASS COMPOSITION
  // ─────────────────────────────────────────────────────────────────────────

  const rootClasses = classNames(
    'text-field',
    `text-field--variant-${variant}`,
    `text-field--size-${size}`,
    {
      'text-field--full-width': fullWidth,
      'text-field--focused': isFocused,
      'text-field--floating': isFloating,
      'text-field--autofilled': isAutofilled,
      'text-field--has-value': hasValue,
      'text-field--has-start-adornment': Boolean(InputProps.startAdornment),
      'text-field--error': isError,
      'text-field--disabled': disabled,
      'text-field--no-label': !label,
      'text-field--multiline': multiline,
    },
    className
  );

  const inputClasses = classNames('text-field__input', {
    'text-field__input--has-start': Boolean(InputProps.startAdornment),
    'text-field__input--has-end':
      Boolean(InputProps.endAdornment) ||
      (clearable && currentValue) ||
      (type === 'password' && showPasswordToggle),
    'text-field__input--multiline': multiline,
  });

  const customStyles = useMemo(
    () => (color ? { '--sp-tf-custom-color': `var(--sp-color-${color}, ${color})` } : undefined),
    [color]
  );

  const InputElement = select ? 'select' : multiline ? 'textarea' : 'input';

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER HELPERS
  // ─────────────────────────────────────────────────────────────────────────

  const renderInput = () => (
    <InputElement
      ref={setRefs}
      id={id}
      name={name}
      type={select || multiline ? undefined : effectiveType}
      value={isControlled ? (value ?? '') : undefined}
      defaultValue={!isControlled ? defaultValue : undefined}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onAnimationStart={handleAnimationStart}
      disabled={disabled}
      readOnly={readOnly}
      required={required}
      className={inputClasses}
      rows={multiline ? rows || 4 : undefined}
      placeholder={placeholder}
      maxLength={maxLength}
      aria-invalid={isError ? 'true' : undefined}
      aria-describedby={helperTextId}
      {...inputProps}
      {...rest}
    >
      {select ? children : undefined}
    </InputElement>
  );

  const renderLabel = () =>
    label ? (
      <label className="text-field__label" htmlFor={id}>
        {label}
        {required && <span className="text-field__required-star" aria-hidden="true"> *</span>}
      </label>
    ) : null;

  return (
    <div className={rootClasses} style={customStyles}>
      <div className="text-field__wrapper">
        {variant === 'outlined' ? (
          <>
            <fieldset aria-hidden="true" className="text-field__outline">
              <legend
                className={classNames('text-field__legend', {
                  'text-field__legend--floating': isFloating,
                })}
              >
                {label ? (
                  <span className="text-field__legend-span">
                    {label}
                    {required && ' *'}
                  </span>
                ) : (
                  <span>&#8203;</span>
                )}
              </legend>
            </fieldset>
            {renderLabel()}
          </>
        ) : (
          <>
            {variant === 'filled' && <div className="text-field__state-layer" />}
            {renderLabel()}
          </>
        )}

        <div className="text-field__input-container">
          {InputProps.startAdornment && (
            <div className="text-field__adornment text-field__adornment--start">
              {InputProps.startAdornment}
            </div>
          )}

          {renderInput()}

          {(InputProps.endAdornment ||
            (clearable && currentValue && !disabled && !readOnly) ||
            (type === 'password' && showPasswordToggle && !disabled && !readOnly)) && (
            <div className="text-field__adornment text-field__adornment--end">
              <div className="text-field__end-adornments">
                {clearable && currentValue && !disabled && !readOnly && (
                  <button
                    type="button"
                    className="text-field__icon-btn text-field__clear-btn"
                    onClick={handleClear}
                    aria-label="Xóa nội dung"
                    tabIndex={-1}
                  >
                    <X size={iconSize} aria-hidden="true" />
                  </button>
                )}

                {type === 'password' && showPasswordToggle && !disabled && !readOnly && (
                  <button
                    type="button"
                    className="text-field__icon-btn text-field__password-toggle-btn"
                    onClick={handleTogglePassword}
                    aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <EyeOff size={iconSize} aria-hidden="true" />
                    ) : (
                      <Eye size={iconSize} aria-hidden="true" />
                    )}
                  </button>
                )}

                {InputProps.endAdornment}
              </div>
            </div>
          )}
        </div>

        {(variant === 'filled' || variant === 'standard') && (
          <div className="text-field__indicator" aria-hidden="true" />
        )}
      </div>

      {(displayHelperText || maxLength) && (
        <div className="text-field__footer">
          {displayHelperText ? (
            <div id={helperTextId} className="text-field__helper-text" role={isError ? 'alert' : undefined}>
              {displayHelperText}
            </div>
          ) : (
            <div />
          )}

          {maxLength && (
            <div
              className={classNames('text-field__counter', {
                'text-field__counter--limit': isOverLimit,
              })}
              aria-live="polite"
            >
              {String(currentValue).length} / {maxLength}
            </div>
          )}
        </div>
      )}
    </div>
  );
});

TextField.displayName = 'TextField';

TextField.propTypes = {
  /** Các phần tử con (chỉ dùng cho select mode) */
  children: PropTypes.node,
  /** CSS class bổ sung */
  className: PropTypes.string,
  /** Cho phép xóa nhanh nội dung ô nhập */
  clearable: PropTypes.bool,
  /** Màu chủ đề tùy chỉnh (token hoặc giá trị CSS) */
  color: PropTypes.string,
  /** Giá trị mặc định (uncontrolled) */
  defaultValue: PropTypes.any,
  /** Trạng thái vô hiệu hóa */
  disabled: PropTypes.bool,
  /** Trạng thái lỗi (boolean hoặc string thông báo lỗi) */
  error: PropTypes.oneOfType([PropTypes.bool, PropTypes.string]),
  /** Chiều rộng 100% full-width */
  fullWidth: PropTypes.bool,
  /** Văn bản trợ giúp / mô tả bên dưới */
  helperText: PropTypes.node,
  /** ID phần tử HTML */
  id: PropTypes.string,
  /** Props bổ sung cho Input wrapper (startAdornment, endAdornment) */
  InputProps: PropTypes.shape({
    startAdornment: PropTypes.node,
    endAdornment: PropTypes.node,
  }),
  /** Props bổ sung truyền thẳng cho thẻ <input> / <textarea> gốc */
  inputProps: PropTypes.object,
  /** Nhãn nổi của ô nhập */
  label: PropTypes.node,
  /** Độ dài tối đa và hiển thị bộ đếm ký tự */
  maxLength: PropTypes.number,
  /** Chế độ nhiều dòng (textarea) */
  multiline: PropTypes.bool,
  /** Tên trường (form submit key) */
  name: PropTypes.string,
  /** Callback khi blur */
  onBlur: PropTypes.func,
  /** Callback khi thay đổi giá trị */
  onChange: PropTypes.func,
  /** Callback khi nhấn nút xóa nhanh */
  onClear: PropTypes.func,
  /** Callback khi focus */
  onFocus: PropTypes.func,
  /** Văn bản gợi ý placeholder */
  placeholder: PropTypes.string,
  /** Trạng thái chỉ đọc (read-only) */
  readOnly: PropTypes.bool,
  /** Đánh dấu trường bắt buộc nhập */
  required: PropTypes.bool,
  /** Số dòng hiển thị cho multiline textarea */
  rows: PropTypes.number,
  /** Chế độ select danh sách (native) */
  select: PropTypes.bool,
  /** Hiển thị nút bật/tắt mật khẩu khi type="password" */
  showPasswordToggle: PropTypes.bool,
  /** Kích thước của TextField (small: 36px, medium: 48px, large: 56px) */
  size: PropTypes.oneOf(['small', 'medium', 'large']),
  /** Kiểu dữ liệu input HTML */
  type: PropTypes.string,
  /** Giá trị ô nhập (controlled) */
  value: PropTypes.any,
  /** Biến thể giao diện Material 3 Expressive */
  variant: PropTypes.oneOf(['outlined', 'filled', 'standard']),
};

export default memo(TextField);
