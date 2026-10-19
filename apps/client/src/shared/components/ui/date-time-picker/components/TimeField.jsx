/**
 * @file TimeField.jsx
 * @module Components/UI/DateTimePicker/Components/TimeField
 * @component TimeField
 * @description Component trường nhập liệu thời gian hỗ trợ mask (HH:mm / hh:mm a) và icon đồng hồ.
 */

import React, { forwardRef, useImperativeHandle } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { Clock } from 'lucide-react';

import TextField from '@/shared/components/ui/text-field';
import { useDateMasking } from '@/hooks/ui/use-date-masking';

/**
 * @component TimeField
 * @description Trường nhập liệu thời gian hỗ trợ mask định dạng HH:mm hoặc hh:mm a.
 */
const TimeField = forwardRef((props, ref) => {
  const {
    ampm = false,
    disabled,
    error,
    format = 'HH:mm',
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

  const resolvedFormat = format || (ampm ? 'hh:mm a' : 'HH:mm');

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
          <Clock
            size={18}
            className={classNames('time-picker__clock-icon', {
              'time-picker__clock-icon--disabled': disabled || readOnly,
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

TimeField.displayName = 'TimeField';

TimeField.propTypes = {
  /** Sử dụng định dạng 12 giờ AM/PM */
  ampm: PropTypes.bool,
  /** Trạng thái vô hiệu hóa */
  disabled: PropTypes.bool,
  /** Trạng thái lỗi */
  error: PropTypes.bool,
  /** Định dạng thời gian hiển thị (VD: HH:mm hoặc hh:mm a) */
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
  /** Sự kiện thay đổi giá trị */
  onChange: PropTypes.func,
  /** Sự kiện click vào field */
  onClick: PropTypes.func,
  /** Sự kiện focus */
  onFocus: PropTypes.func,
  /** Sự kiện click vào biểu tượng đồng hồ */
  onIconClick: PropTypes.func,
  /** Trạng thái chỉ đọc */
  readOnly: PropTypes.bool,
  /** Kích thước trường nhập liệu */
  size: PropTypes.oneOf(['small', 'medium', 'large']),
  /** Giá trị thời gian (Date object) */
  value: PropTypes.instanceOf(Date),
  /** Biến thể giao diện TextField */
  variant: PropTypes.oneOf(['outlined', 'filled', 'standard']),
};

export default React.memo(TimeField);
