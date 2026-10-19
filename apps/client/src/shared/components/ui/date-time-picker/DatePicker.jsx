/**
 * @file DatePicker.jsx
 * @module Components/UI/DateTimePicker/DatePicker
 * @component DatePicker
 * @description Component bộ chọn ngày hoàn chỉnh, tự động chuyển đổi Desktop Popover và Mobile Bottom Sheet.
 */

import React from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { X } from 'lucide-react';

import DateField from './components/DateField';
import DateCalendar from './components/DateCalendar';
import { useDatePicker } from './hooks/use-date-picker';
import './date-picker.scss';

/**
 * @component DatePicker
 * @description Thành phần chọn ngày hoàn chỉnh. Thích ứng giữa Desktop (Popover) và Mobile (Bottom Sheet).
 */
const DatePicker = (props) => {
  const {
    className,
    closeOnSelect = true,
    defaultValue,
    disabled = false,
    disableFuture,
    disablePast,
    error,
    format = 'DD/MM/YYYY',
    fullWidth = false,
    helperText,
    label,
    maxDate,
    minDate,
    onChange,
    onError,
    readOnly = false,
    shouldDisableDate,
    showActions = false,
    size = 'medium',
    value: controlledValue,
    variant = 'outlined',
    ...rest
  } = props;

  const {
    dropdown,
    handleClear,
    handleClose,
    handleToday,
    handleToggle,
    handleValueChange,
    isMobileOrTablet,
    isOpen,
    value,
  } = useDatePicker({
    value: controlledValue,
    defaultValue,
    onChange,
    disabled,
    readOnly,
    closeOnSelect: !showActions && closeOnSelect,
    onError,
    disablePast,
    disableFuture,
    minDate,
    maxDate,
    shouldDisableDate,
  });

  const calendarProps = {
    value,
    onChange: handleValueChange,
    minDate,
    maxDate,
    disablePast,
    disableFuture,
    shouldDisableDate,
  };

  const renderActionBar = () => (
    <div className="date-picker__actions">
      <button
        type="button"
        className="date-picker__action-btn date-picker__action-btn--clear"
        onClick={handleClear}
      >
        Xóa
      </button>
      <button
        type="button"
        className="date-picker__action-btn date-picker__action-btn--today"
        onClick={handleToday}
      >
        Hôm nay
      </button>
      <button
        type="button"
        className="date-picker__action-btn date-picker__action-btn--confirm"
        onClick={handleClose}
      >
        Xong
      </button>
    </div>
  );

  return (
    <div
      className={classNames(
        'date-picker',
        {
          'date-picker--full-width': fullWidth,
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
        <DateField
          value={value}
          format={format}
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

      {/* 2. Universal Floating Portal (Desktop Popover & Mobile Bottom Sheet) */}
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
                  ? 'date-picker__bottom-sheet'
                  : 'date-picker__popover',
              })}
            >
              {/* Mobile Handlebar & Header */}
              {isMobileOrTablet && (
                <>
                  <div className="date-picker__handlebar" aria-hidden="true" />
                  <div className="date-picker__sheet-header">
                    <span className="date-picker__sheet-title">
                      {label || 'Chọn ngày'}
                    </span>
                    <button
                      type="button"
                      className="date-picker__sheet-close"
                      onClick={handleClose}
                      aria-label="Đóng"
                    >
                      <X size={18} />
                    </button>
                  </div>
                </>
              )}

              {/* Calendar Body */}
              <div className="date-picker__modal-body">
                <DateCalendar {...calendarProps} />
              </div>

              {/* Action Bar */}
              {(showActions || isMobileOrTablet) && renderActionBar()}
            </div>
          </dropdown.FloatingFocusManager>
        </dropdown.FloatingPortal>
      )}
    </div>
  );
};

DatePicker.propTypes = {
  /** CSS class bổ sung */
  className: PropTypes.string,
  /** Tự động đóng sau khi chọn */
  closeOnSelect: PropTypes.bool,
  /** Giá trị mặc định */
  defaultValue: PropTypes.instanceOf(Date),
  /** Trạng thái vô hiệu hóa toàn bộ component */
  disabled: PropTypes.bool,
  /** Vô hiệu hóa ngày trong tương lai */
  disableFuture: PropTypes.bool,
  /** Vô hiệu hóa ngày trong quá khứ */
  disablePast: PropTypes.bool,
  /** Hiển thị trạng thái lỗi */
  error: PropTypes.bool,
  /** Định dạng ngày hiển thị (VD: DD/MM/YYYY) */
  format: PropTypes.string,
  /** Chiều rộng đầy đủ container */
  fullWidth: PropTypes.bool,
  /** Văn bản trợ giúp hoặc thông báo lỗi */
  helperText: PropTypes.node,
  /** Nhãn của trường nhập liệu */
  label: PropTypes.node,
  /** Ngày tối đa có thể chọn */
  maxDate: PropTypes.instanceOf(Date),
  /** Ngày tối thiểu có thể chọn */
  minDate: PropTypes.instanceOf(Date),
  /** Sự kiện khi thay đổi ngày */
  onChange: PropTypes.func,
  /** Callback khi có lỗi validation */
  onError: PropTypes.func,
  /** Trạng thái chỉ đọc */
  readOnly: PropTypes.bool,
  /** Hàm tùy chỉnh để vô hiệu hóa một ngày cụ thể */
  shouldDisableDate: PropTypes.func,
  /** Hiển thị thanh nút thao tác nhanh (Hôm nay, Xóa, Xong) */
  showActions: PropTypes.bool,
  /** Kích thước component */
  size: PropTypes.oneOf(['small', 'medium', 'large']),
  /** Giá trị ngày (Date object) */
  value: PropTypes.instanceOf(Date),
  /** Biến thể giao diện TextField */
  variant: PropTypes.oneOf(['outlined', 'filled', 'standard']),
};

export default React.memo(DatePicker);
