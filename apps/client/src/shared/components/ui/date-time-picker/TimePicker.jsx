/**
 * @file TimePicker.jsx
 * @module Components/UI/DateTimePicker/TimePicker
 * @component TimePicker
 * @description Component bộ chọn giờ hoàn chỉnh, tự động chuyển đổi Desktop Popover và Mobile Bottom Sheet.
 */

import React from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { X } from 'lucide-react';

import DigitalClock from './components/DigitalClock';
import TimeField from './components/TimeField';
import { useTimePickerControl } from './hooks/use-time-picker-control';
import './time-picker.scss';

/**
 * @component TimePicker
 * @description Thành phần chọn thời gian hoàn chỉnh. Thích ứng giao diện Desktop (Popover) và Mobile (Bottom Sheet).
 */
const TimePicker = (props) => {
  const {
    ampm = false,
    className,
    closeOnSelect = false,
    defaultValue,
    disabled = false,
    disableFuture,
    disablePast,
    error,
    format,
    fullWidth = false,
    helperText,
    label,
    maxTime,
    minTime,
    onChange,
    onError,
    readOnly = false,
    shouldDisableTime,
    size = 'medium',
    value: controlledValue,
    variant = 'outlined',
    ...rest
  } = props;

  const {
    dropdown,
    handleClear,
    handleClose,
    handleNow,
    handleToggle,
    handleValueChange,
    isMobileOrTablet,
    isOpen,
    value,
  } = useTimePickerControl({
    value: controlledValue,
    defaultValue,
    onChange,
    disabled,
    readOnly,
    closeOnSelect,
    onError,
    disablePast,
    disableFuture,
    minTime,
    maxTime,
    shouldDisableTime,
  });

  const resolvedFormat = format || (ampm ? 'hh:mm a' : 'HH:mm');

  const clockProps = {
    value,
    onChange: handleValueChange,
    ampm,
    minTime,
    maxTime,
    shouldDisableTime,
    disablePast,
    disableFuture,
  };

  const renderPickerContent = () => (
    <div className="time-picker__content">
      <div className="time-picker__time-wrapper">
        <DigitalClock {...clockProps} />
      </div>

      {/* Thanh nút hành động */}
      <div className="time-picker__actions">
        <button
          type="button"
          className="time-picker__action-btn time-picker__action-btn--clear"
          onClick={handleClear}
        >
          Xóa
        </button>
        <button
          type="button"
          className="time-picker__action-btn time-picker__action-btn--now"
          onClick={handleNow}
        >
          Hiện tại
        </button>
        <button
          type="button"
          className="time-picker__action-btn time-picker__action-btn--confirm"
          onClick={handleClose}
        >
          Xong
        </button>
      </div>
    </div>
  );

  return (
    <div
      className={classNames(
        'time-picker',
        {
          'time-picker--full-width': fullWidth,
        },
        className
      )}
    >
      {/* 1. Anchor Input Field */}
      <div
        ref={dropdown.refs.setReference}
        {...dropdown.getReferenceProps({
          onClick: (e) => {
            e.stopPropagation();
            handleToggle();
          },
        })}
      >
        <TimeField
          value={value}
          format={resolvedFormat}
          ampm={ampm}
          onChange={handleValueChange}
          onIconClick={handleToggle}
          label={label}
          disabled={disabled}
          readOnly={readOnly}
          error={error}
          helperText={helperText}
          variant={variant}
          size={size}
          fullWidth={fullWidth}
          {...rest}
        />
      </div>

      {/* 2. Universal Floating Portal */}
      {isOpen && dropdown.isMounted && (
        <dropdown.FloatingPortal id={dropdown.portalId}>
          {dropdown.modal && (
            <div
              style={dropdown.backdropStyles}
              onClick={handleClose}
              aria-hidden="true"
            />
          )}

          <dropdown.FloatingFocusManager
            context={dropdown.context}
            initialFocus={-1}
            returnFocus
            modal={dropdown.modal}
          >
            <div
              ref={dropdown.refs.setFloating}
              style={dropdown.floatingStyles}
              {...dropdown.getFloatingProps({
                className: isMobileOrTablet
                  ? 'time-picker__bottom-sheet'
                  : 'time-picker__popover',
              })}
            >
              {/* Mobile Handlebar & Header */}
              {isMobileOrTablet && (
                <>
                  <div className="time-picker__handlebar" aria-hidden="true" />
                  <div className="time-picker__sheet-header">
                    <span className="time-picker__sheet-title">
                      {label || 'Chọn giờ'}
                    </span>
                    <button
                      type="button"
                      className="time-picker__sheet-close"
                      onClick={handleClose}
                      aria-label="Đóng"
                    >
                      <X size={18} />
                    </button>
                  </div>
                </>
              )}

              {/* Picker Content with Clock & Action Bar */}
              <div className="time-picker__modal-body">
                {renderPickerContent()}
              </div>
            </div>
          </dropdown.FloatingFocusManager>
        </dropdown.FloatingPortal>
      )}
    </div>
  );
};

TimePicker.propTypes = {
  /** Sử dụng định dạng 12 giờ AM/PM */
  ampm: PropTypes.bool,
  /** CSS class bổ sung */
  className: PropTypes.string,
  /** Tự động đóng sau khi chọn */
  closeOnSelect: PropTypes.bool,
  /** Giá trị mặc định */
  defaultValue: PropTypes.instanceOf(Date),
  /** Trạng thái vô hiệu hóa toàn bộ component */
  disabled: PropTypes.bool,
  /** Vô hiệu hóa thời gian trong tương lai */
  disableFuture: PropTypes.bool,
  /** Vô hiệu hóa thời gian trong quá khứ */
  disablePast: PropTypes.bool,
  /** Hiển thị trạng thái lỗi */
  error: PropTypes.bool,
  /** Định dạng thời gian hiển thị (VD: HH:mm hoặc hh:mm a) */
  format: PropTypes.string,
  /** Chiều rộng đầy đủ container */
  fullWidth: PropTypes.bool,
  /** Văn bản trợ giúp hoặc thông báo lỗi */
  helperText: PropTypes.node,
  /** Nhãn của trường nhập liệu */
  label: PropTypes.node,
  /** Thời gian tối đa có thể chọn */
  maxTime: PropTypes.instanceOf(Date),
  /** Thời gian tối thiểu có thể chọn */
  minTime: PropTypes.instanceOf(Date),
  /** Sự kiện khi thay đổi thời gian */
  onChange: PropTypes.func,
  /** Callback khi có lỗi validation */
  onError: PropTypes.func,
  /** Trạng thái chỉ đọc */
  readOnly: PropTypes.bool,
  /** Hàm tùy chỉnh để vô hiệu hóa một thời điểm */
  shouldDisableTime: PropTypes.func,
  /** Kích thước component */
  size: PropTypes.oneOf(['small', 'medium', 'large']),
  /** Giá trị thời gian (Date object) */
  value: PropTypes.instanceOf(Date),
  /** Biến thể giao diện TextField */
  variant: PropTypes.oneOf(['outlined', 'filled', 'standard']),
};

export default React.memo(TimePicker);
