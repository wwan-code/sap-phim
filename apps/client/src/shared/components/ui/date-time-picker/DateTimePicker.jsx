/**
 * @file DateTimePicker.jsx
 * @module Components/UI/DateTimePicker/DateTimePicker
 * @component DateTimePicker
 * @description Component chọn ngày và giờ hoàn chỉnh, hỗ trợ tab chuyển đổi giữa Lịch và Đồng hồ số.
 */

import React from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, Clock, X } from 'lucide-react';

import DateTimeField from './components/DateTimeField';
import DateCalendar from './components/DateCalendar';
import DigitalClock from './components/DigitalClock';
import { useDateTimePicker } from './hooks/use-date-time-picker';
import './date-time-picker.scss';

/**
 * @component DateTimePicker
 * @description Cho phép chọn đồng thời ngày và giờ. Giao diện tab chuyển đổi mượt mà giữa Calendar và DigitalClock.
 */
const DateTimePicker = (props) => {
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
    maxDate,
    maxDateTime,
    maxTime,
    minDate,
    minDateTime,
    minTime,
    onChange,
    onError,
    readOnly = false,
    shouldDisableDate,
    shouldDisableTime,
    size = 'medium',
    value: controlledValue,
    variant = 'outlined',
    ...rest
  } = props;

  const {
    dropdown,
    handleCalendarChange,
    handleClear,
    handleClose,
    handleTextChange,
    handleTimeChange,
    handleToday,
    handleToggle,
    isMobileOrTablet,
    isOpen,
    pickerView,
    setPickerView,
    value,
  } = useDateTimePicker({
    value: controlledValue,
    defaultValue,
    onChange,
    disabled,
    readOnly,
    closeOnSelect,
    onError,
    disablePast,
    disableFuture,
    minDate,
    maxDate,
    shouldDisableDate,
    minTime,
    maxTime,
    shouldDisableTime,
    minDateTime,
    maxDateTime,
  });

  const resolvedFormat = format || (ampm ? 'DD/MM/YYYY hh:mm a' : 'DD/MM/YYYY HH:mm');

  const calendarProps = {
    value,
    onChange: handleCalendarChange,
    minDate,
    maxDate,
    disablePast,
    disableFuture,
    shouldDisableDate,
  };

  const clockProps = {
    value,
    onChange: handleTimeChange,
    ampm,
    minTime,
    maxTime,
    shouldDisableTime,
    disablePast,
    disableFuture,
    minDateTime,
    maxDateTime,
  };

  const renderPickerContent = () => (
    <div className="date-time-picker__content">
      {/* Thanh chuyển đổi Date/Time */}
      <div className="date-time-picker__tabs">
        <button
          className={classNames('date-time-picker__tab', {
            'date-time-picker__tab--active': pickerView === 'date',
          })}
          onClick={() => setPickerView('date')}
          type="button"
        >
          <Calendar size={16} /> Ngày
        </button>
        <button
          className={classNames('date-time-picker__tab', {
            'date-time-picker__tab--active': pickerView === 'time',
          })}
          disabled={!value}
          onClick={() => setPickerView('time')}
          type="button"
        >
          <Clock size={16} /> Giờ
        </button>
      </div>

      {/* Vùng hiển thị Calendar/Clock */}
      <div className="date-time-picker__view-container">
        <AnimatePresence mode="wait">
          {pickerView === 'date' && (
            <motion.div
              key="date-view"
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ type: 'tween', duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            >
              <DateCalendar {...calendarProps} />
            </motion.div>
          )}
          {pickerView === 'time' && (
            <motion.div
              key="time-view"
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 16 }}
              transition={{ type: 'tween', duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="date-time-picker__time-wrapper"
            >
              <DigitalClock {...clockProps} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Action Bar */}
      <div className="date-time-picker__actions">
        <button
          type="button"
          className="date-time-picker__action-btn date-time-picker__action-btn--clear"
          onClick={handleClear}
        >
          Xóa
        </button>
        <button
          type="button"
          className="date-time-picker__action-btn date-time-picker__action-btn--now"
          onClick={handleToday}
        >
          Hiện tại
        </button>
        <button
          type="button"
          className="date-time-picker__action-btn date-time-picker__action-btn--confirm"
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
        'date-time-picker',
        {
          'date-time-picker--full-width': fullWidth,
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
        <DateTimeField
          value={value}
          format={resolvedFormat}
          ampm={ampm}
          onChange={handleTextChange}
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
                  ? 'date-time-picker__bottom-sheet'
                  : 'date-time-picker__popover',
              })}
            >
              {/* Mobile Handlebar & Header */}
              {isMobileOrTablet && (
                <>
                  <div className="date-time-picker__handlebar" aria-hidden="true" />
                  <div className="date-time-picker__sheet-header">
                    <span className="date-time-picker__sheet-title">
                      {label || 'Chọn ngày & giờ'}
                    </span>
                    <button
                      type="button"
                      className="date-time-picker__sheet-close"
                      onClick={handleClose}
                      aria-label="Đóng"
                    >
                      <X size={18} />
                    </button>
                  </div>
                </>
              )}

              {/* Picker Content with Tabs */}
              <div className="date-time-picker__modal-body">
                {renderPickerContent()}
              </div>
            </div>
          </dropdown.FloatingFocusManager>
        </dropdown.FloatingPortal>
      )}
    </div>
  );
};

DateTimePicker.propTypes = {
  /** Sử dụng định dạng 12 giờ (AM/PM) */
  ampm: PropTypes.bool,
  /** CSS class bổ sung */
  className: PropTypes.string,
  /** Tự động đóng sau khi chọn */
  closeOnSelect: PropTypes.bool,
  /** Giá trị mặc định */
  defaultValue: PropTypes.instanceOf(Date),
  /** Trạng thái vô hiệu hóa */
  disabled: PropTypes.bool,
  /** Vô hiệu hóa ngày tương lai */
  disableFuture: PropTypes.bool,
  /** Vô hiệu hóa ngày quá khứ */
  disablePast: PropTypes.bool,
  /** Trạng thái lỗi */
  error: PropTypes.bool,
  /** Định dạng hiển thị */
  format: PropTypes.string,
  /** Chiều rộng đầy đủ */
  fullWidth: PropTypes.bool,
  /** Văn bản trợ giúp/lỗi */
  helperText: PropTypes.node,
  /** Nhãn trường */
  label: PropTypes.node,
  /** Ngày tối đa */
  maxDate: PropTypes.instanceOf(Date),
  /** Ngày giờ tối đa */
  maxDateTime: PropTypes.instanceOf(Date),
  /** Giờ tối đa */
  maxTime: PropTypes.instanceOf(Date),
  /** Ngày tối thiểu */
  minDate: PropTypes.instanceOf(Date),
  /** Ngày giờ tối thiểu */
  minDateTime: PropTypes.instanceOf(Date),
  /** Giờ tối thiểu */
  minTime: PropTypes.instanceOf(Date),
  /** Sự kiện khi thay đổi */
  onChange: PropTypes.func,
  /** Callback lỗi validation */
  onError: PropTypes.func,
  /** Trạng thái chỉ đọc */
  readOnly: PropTypes.bool,
  /** Hàm kiểm tra vô hiệu hóa ngày tùy chỉnh */
  shouldDisableDate: PropTypes.func,
  /** Hàm kiểm tra vô hiệu hóa giờ tùy chỉnh */
  shouldDisableTime: PropTypes.func,
  /** Kích thước component */
  size: PropTypes.oneOf(['small', 'medium', 'large']),
  /** Giá trị ngày giờ (Date object) */
  value: PropTypes.instanceOf(Date),
  /** Biến thể TextField */
  variant: PropTypes.oneOf(['outlined', 'filled', 'standard']),
};

export default React.memo(DateTimePicker);
