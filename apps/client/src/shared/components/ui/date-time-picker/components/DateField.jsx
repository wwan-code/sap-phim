/**
 * @file DateField.jsx
 * @module Components/UI/DateTimePicker/Components/DateField
 * @component DateField
 * @description Component trường nhập liệu ngày tháng có hỗ trợ mask (DD/MM/YYYY) và icon lịch.
 */

import React, { forwardRef, useImperativeHandle } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { Calendar } from 'lucide-react';

import TextField from '@/shared/components/ui/text-field';
import { useDateMasking } from '@/hooks/ui/use-date-masking';

/**
 * @component DateField
 * @description Trường nhập liệu ngày tháng có hỗ trợ mask (DD/MM/YYYY) và biểu tượng lịch để mở bộ chọn.
 */
const DateField = forwardRef((props, ref) => {
  const {
    disabled,
    error,
    format = 'DD/MM/YYYY',
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

  const {
    handleBlur,
    handleClick: maskHandleClick,
    handleFocus,
    handleKeyDown,
    inputRef,
    inputStr,
  } = useDateMasking({
    value,
    format,
    onDateChange: onChange,
    disabled,
    readOnly,
    ampm: false,
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
          <Calendar
            size={18}
            className={classNames('date-picker__calendar-icon', {
              'date-picker__calendar-icon--disabled': disabled || readOnly,
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

DateField.displayName = 'DateField';

DateField.propTypes = {
  /** Trạng thái vô hiệu hóa */
  disabled: PropTypes.bool,
  /** Trạng thái lỗi */
  error: PropTypes.bool,
  /** Định dạng ngày hiển thị */
  format: PropTypes.string,
  /** Chiều rộng đầy đủ */
  fullWidth: PropTypes.bool,
  /** Văn bản hướng dẫn/lỗi */
  helperText: PropTypes.node,
  /** Thuộc tính bổ sung cho Input */
  InputProps: PropTypes.object,
  /** Nhãn trường nhập liệu */
  label: PropTypes.node,
  /** Sự kiện blur */
  onBlur: PropTypes.func,
  /** Sự kiện thay đổi ngày */
  onChange: PropTypes.func,
  /** Sự kiện click vào field */
  onClick: PropTypes.func,
  /** Sự kiện focus */
  onFocus: PropTypes.func,
  /** Sự kiện click vào biểu tượng lịch */
  onIconClick: PropTypes.func,
  /** Trạng thái chỉ đọc */
  readOnly: PropTypes.bool,
  /** Kích thước trường nhập liệu */
  size: PropTypes.oneOf(['small', 'medium', 'large']),
  /** Giá trị ngày (Date object) */
  value: PropTypes.instanceOf(Date),
  /** Biến thể giao diện TextField */
  variant: PropTypes.oneOf(['outlined', 'filled', 'standard']),
};

export default React.memo(DateField);
