/**
 * @file DateTimeField.jsx
 * @module Components/UI/DateTimePicker/Components/DateTimeField
 * @component DateTimeField
 * @description Component trường nhập liệu ngày giờ có hỗ trợ mask và icon lịch/đồng hồ.
 */

import React, { forwardRef, useImperativeHandle } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { CalendarClock } from 'lucide-react';

import TextField from '@/shared/components/ui/text-field';
import { useDateMasking } from '@/hooks/ui/use-date-masking';

/**
 * @component DateTimeField
 * @description Trường nhập liệu ngày và giờ có hỗ trợ mask và biểu tượng lịch+đồng hồ.
 */
const DateTimeField = forwardRef((props, ref) => {
  const {
    ampm = false,
    disabled,
    error,
    format,
    fullWidth,
    helperText,
    InputProps = {},
    label,
    onBlur: externalOnBlur,
    onChange,
    onClick,
    onFocus: externalOnFocus,
    onIconClick,
    readOnly,
    size,
    value,
    variant,
    ...rest
  } = props;

  // Xác định định dạng dựa trên ampm nếu không được truyền vào
  const resolvedFormat = format || (ampm ? 'DD/MM/YYYY hh:mm a' : 'DD/MM/YYYY HH:mm');

  const {
    handleBlur,
    handleClick: maskHandleClick,
    handleFocus,
    handleKeyDown,
    inputRef,
    inputStr,
  } = useDateMasking({
    value,
    format: resolvedFormat,
    onDateChange: onChange,
    disabled,
    readOnly,
    ampm,
  });

  // Expose input ref to parent
  useImperativeHandle(ref, () => inputRef.current);

  const handleFocusComposed = (e) => {
    handleFocus(e);
    externalOnFocus?.(e);
  };

  const handleBlurComposed = (e) => {
    handleBlur(e);
    externalOnBlur?.(e);
  };

  const handleClick = (e) => {
    maskHandleClick(e);
  };

  return (
    <TextField
      ref={inputRef}
      value={inputStr}
      label={label}
      disabled={disabled}
      readOnly={readOnly}
      error={error}
      helperText={helperText}
      variant={variant}
      size={size}
      fullWidth={fullWidth}
      onClick={handleClick}
      onFocus={handleFocusComposed}
      onBlur={handleBlurComposed}
      onKeyDown={handleKeyDown}
      InputProps={{
        ...InputProps,
        endAdornment: (
          <CalendarClock
            size={18}
            className={classNames('date-time-picker__calendar-icon', {
              'date-time-picker__calendar-icon--disabled': disabled || readOnly,
            })}
            onClick={
              !disabled && !readOnly
                ? (e) => {
                    e.stopPropagation();
                    (onIconClick || onClick)?.(e);
                  }
                : undefined
            }
          />
        ),
      }}
      {...rest}
    />
  );
});

DateTimeField.displayName = 'DateTimeField';

DateTimeField.propTypes = {
  /** Sử dụng định dạng 12 giờ (AM/PM) */
  ampm: PropTypes.bool,
  /** Trạng thái vô hiệu hóa */
  disabled: PropTypes.bool,
  /** Trạng thái lỗi */
  error: PropTypes.bool,
  /** Định dạng hiển thị */
  format: PropTypes.string,
  /** Chiều rộng đầy đủ */
  fullWidth: PropTypes.bool,
  /** Văn bản trợ giúp/lỗi */
  helperText: PropTypes.node,
  /** Thuộc tính bổ sung cho Input */
  InputProps: PropTypes.object,
  /** Nhãn của trường nhập liệu */
  label: PropTypes.node,
  /** Sự kiện blur */
  onBlur: PropTypes.func,
  /** Sự kiện thay đổi ngày giờ */
  onChange: PropTypes.func,
  /** Sự kiện click vào field */
  onClick: PropTypes.func,
  /** Sự kiện focus */
  onFocus: PropTypes.func,
  /** Sự kiện click vào biểu tượng lịch+đồng hồ */
  onIconClick: PropTypes.func,
  /** Trạng thái chỉ đọc */
  readOnly: PropTypes.bool,
  /** Kích thước component */
  size: PropTypes.oneOf(['small', 'medium', 'large']),
  /** Giá trị ngày giờ (Date object) */
  value: PropTypes.instanceOf(Date),
  /** Biến thể TextField */
  variant: PropTypes.oneOf(['outlined', 'filled', 'standard']),
};

export default React.memo(DateTimeField);
