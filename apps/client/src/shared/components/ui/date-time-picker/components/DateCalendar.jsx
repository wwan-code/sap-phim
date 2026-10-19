/**
 * @file DateCalendar.jsx
 * @module Components/UI/DateTimePicker/Components/DateCalendar
 * @component DateCalendar
 * @description Component lịch hiển thị các ngày, tháng, năm cho người dùng lựa chọn.
 */

import React, { useEffect, useRef, useCallback, useState } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';

import IconButton from '@/shared/components/ui/icon-button';

import { isSameDay, isSameMonth, isToday } from '../utils/date-time.util';
import { useCalendar } from '../hooks/use-calendar';
import '../date-calendar.scss';

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * @component DateCalendar
 * @description Hỗ trợ 3 chế độ xem: Ngày (day), Tháng (month), Năm (year). Chuyển động Neural Expressive mượt mà.
 */
const DateCalendar = (props) => {
  const {
    defaultValue,
    disableFuture,
    disablePast,
    maxDate,
    minDate,
    onChange,
    shouldDisableDate,
    value,
  } = props;

  const calendar = useCalendar({
    value,
    defaultValue,
    onChange,
    minDate,
    maxDate,
    disablePast,
    disableFuture,
    shouldDisableDate,
  });

  const yearViewRef = useRef(null);
  const gridRef = useRef(null);

  const [focusedDate, setFocusedDate] = useState(() => value || defaultValue || new Date());

  useEffect(() => {
    if (value) {
      setFocusedDate(value);
    }
  }, [value]);

  // Tự động cuộn đến năm được chọn hoặc năm hiện tại khi chuyển sang chế độ xem năm
  useEffect(() => {
    if (calendar.view === 'year' && yearViewRef.current) {
      const el = yearViewRef.current.querySelector(
        '.date-calendar__year--selected, .date-calendar__year--current'
      );
      el?.scrollIntoView({ block: 'center', behavior: 'auto' });
    }
  }, [calendar.view]);

  const handleKeyDown = useCallback(
    (date, e) => {
      const nextDate = new Date(date);
      let handled = false;

      switch (e.key) {
        case 'ArrowLeft':
          nextDate.setDate(date.getDate() - 1);
          handled = true;
          break;
        case 'ArrowRight':
          nextDate.setDate(date.getDate() + 1);
          handled = true;
          break;
        case 'ArrowUp':
          nextDate.setDate(date.getDate() - 7);
          handled = true;
          break;
        case 'ArrowDown':
          nextDate.setDate(date.getDate() + 7);
          handled = true;
          break;
        case 'Home': {
          const dayOfWeek = date.getDay(); // 0 is Sunday
          const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
          nextDate.setDate(date.getDate() + diff);
          handled = true;
          break;
        }
        case 'End': {
          const dayOfWeekEnd = date.getDay();
          const diffEnd = dayOfWeekEnd === 0 ? 0 : 7 - dayOfWeekEnd;
          nextDate.setDate(date.getDate() + diffEnd);
          handled = true;
          break;
        }
        case 'PageUp':
          nextDate.setMonth(date.getMonth() - 1);
          handled = true;
          break;
        case 'PageDown':
          nextDate.setMonth(date.getMonth() + 1);
          handled = true;
          break;
        case 'Enter':
        case ' ':
          if (!calendar.isDateDisabled(date)) {
            calendar.handleDayClick(date);
          }
          handled = true;
          break;
        default:
          break;
      }

      if (handled) {
        e.preventDefault();

        // If date is disabled, don't move focus
        if (calendar.isDateDisabled(nextDate)) {
          return;
        }

        // Sync currentMonth view if month changes
        if (!isSameMonth(nextDate, calendar.currentMonth)) {
          calendar.setCurrentMonth(new Date(nextDate.getFullYear(), nextDate.getMonth(), 1));
        }

        setFocusedDate(nextDate);

        // Set focus on the new active element
        setTimeout(() => {
          const dateString = nextDate.toISOString().split('T')[0];
          const btn = gridRef.current?.querySelector(`[data-date="${dateString}"]`);
          btn?.focus();
        }, 50);
      }
    },
    [calendar]
  );

  const getHeaderLabel = () => {
    if (calendar.view === 'day')
      return `${MONTHS[calendar.currentMonth.getMonth()]} ${calendar.currentMonth.getFullYear()}`;
    if (calendar.view === 'month') return `${calendar.currentMonth.getFullYear()}`;
    return 'Chọn năm';
  };

  // ────────────────────────────────────────── Views ──────────────────────────────────────────

  const renderDayView = () => (
    <motion.div
      key={calendar.currentMonth.toISOString()}
      initial={{ x: calendar.slideDirection * 16, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: calendar.slideDirection * -16, opacity: 0 }}
      transition={{ type: 'tween', duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="date-calendar__day-view"
    >
      <div className="date-calendar__weekdays">
        {WEEKDAYS.map((w) => (
          <div key={w} className="date-calendar__weekday">
            {w}
          </div>
        ))}
      </div>
      <div ref={gridRef} className="date-calendar__grid" role="grid">
        {calendar.calendarGrid.flat().map((date, idx) => {
          const disabled = calendar.isDateDisabled(date);
          const selected = value && isSameDay(date, value);
          const isTodayDate = isToday(date);
          const outsideMonth = !isSameMonth(date, calendar.currentMonth);
          const isFocusedDay = isSameDay(date, focusedDate);

          return (
            <button
              key={idx}
              disabled={disabled}
              data-date={date.toISOString().split('T')[0]}
              className={classNames('date-calendar__day', {
                'date-calendar__day--selected': selected,
                'date-calendar__day--today': isTodayDate && !selected,
                'date-calendar__day--outside': outsideMonth,
                'date-calendar__day--disabled': disabled,
              })}
              onClick={() => calendar.handleDayClick(date)}
              onKeyDown={(e) => handleKeyDown(date, e)}
              tabIndex={isFocusedDay ? 0 : -1}
              aria-selected={selected}
              aria-label={date.toLocaleDateString()}
              type="button"
            >
              <span className="date-calendar__day-text">{date.getDate()}</span>
              <span className="date-calendar__day-layer" aria-hidden="true" />
            </button>
          );
        })}
      </div>
    </motion.div>
  );

  const renderMonthView = () => (
    <motion.div
      initial={{ scale: 0.96, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.96, opacity: 0 }}
      transition={{ type: 'tween', duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="date-calendar__month-view"
    >
      <div className="date-calendar__months">
        {MONTHS.map((name, idx) => {
          const isCurrent = calendar.currentMonth.getMonth() === idx;
          const isSelected =
            value &&
            value.getMonth() === idx &&
            value.getFullYear() === calendar.currentMonth.getFullYear();
          const disabled = calendar.isMonthDisabled(calendar.currentMonth.getFullYear(), idx);
          return (
            <button
              key={name}
              className={classNames('date-calendar__month', {
                'date-calendar__month--selected': isSelected,
                'date-calendar__month--current': isCurrent && !isSelected,
                'date-calendar__month--disabled': disabled,
              })}
              disabled={disabled}
              onClick={() => calendar.handleMonthClick(idx)}
              type="button"
            >
              <span className="date-calendar__month-text">{name}</span>
              <span className="date-calendar__month-layer" aria-hidden="true" />
            </button>
          );
        })}
      </div>
    </motion.div>
  );

  const renderYearView = () => {
    const currentY = calendar.currentMonth.getFullYear();
    const years = Array.from({ length: 200 }, (_, i) => currentY - 100 + i);
    return (
      <motion.div
        initial={{ scale: 1.04, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 1.04, opacity: 0 }}
        transition={{ type: 'tween', duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className="date-calendar__year-view"
        ref={yearViewRef}
      >
        <div className="date-calendar__years">
          {years.map((y) => {
            const isCurrent = currentY === y;
            const isSelected = value && value.getFullYear() === y;
            const disabled = calendar.isYearDisabled(y);
            return (
              <button
                key={y}
                className={classNames('date-calendar__year', {
                  'date-calendar__year--selected': isSelected,
                  'date-calendar__year--current': isCurrent && !isSelected,
                  'date-calendar__year--disabled': disabled,
                })}
                disabled={disabled}
                onClick={() => calendar.handleYearClick(y)}
                type="button"
              >
                {y}
                <span className="date-calendar__year-layer" aria-hidden="true" />
              </button>
            );
          })}
        </div>
      </motion.div>
    );
  };

  const headerSpacer = (
    <div style={{ visibility: 'hidden', width: 36, height: 36 }} aria-hidden="true" />
  );

  return (
    <div className="date-calendar" role="application" aria-label="Bộ chọn ngày">
      <div className="date-calendar__header">
        {calendar.view !== 'month' ? (
          <IconButton
            size="small"
            onClick={calendar.handlePrev}
            className="date-calendar__nav-btn"
            aria-label="Tháng trước"
          >
            <ChevronLeft size={18} />
          </IconButton>
        ) : (
          headerSpacer
        )}

        <button
          className="date-calendar__title"
          onClick={calendar.toggleView}
          aria-label="Thay đổi chế độ xem"
          type="button"
        >
          {getHeaderLabel()}
          <ChevronDown
            size={16}
            className={classNames('date-calendar__title-icon', {
              'date-calendar__title-icon--rotated': calendar.view !== 'day',
            })}
          />
        </button>

        {calendar.view !== 'month' ? (
          <IconButton
            size="small"
            onClick={calendar.handleNext}
            className="date-calendar__nav-btn"
            aria-label="Tháng sau"
          >
            <ChevronRight size={18} />
          </IconButton>
        ) : (
          headerSpacer
        )}
      </div>

      <div className="date-calendar__body">
        <AnimatePresence mode="popLayout" custom={calendar.slideDirection}>
          {calendar.view === 'day' && renderDayView()}
          {calendar.view === 'month' && renderMonthView()}
          {calendar.view === 'year' && renderYearView()}
        </AnimatePresence>
      </div>
    </div>
  );
};

DateCalendar.propTypes = {
  /** Giá trị mặc định */
  defaultValue: PropTypes.instanceOf(Date),
  /** Vô hiệu hóa các ngày trong tương lai */
  disableFuture: PropTypes.bool,
  /** Vô hiệu hóa các ngày trong quá khứ */
  disablePast: PropTypes.bool,
  /** Ngày tối đa */
  maxDate: PropTypes.instanceOf(Date),
  /** Ngày tối thiểu */
  minDate: PropTypes.instanceOf(Date),
  /** Sự kiện thay đổi ngày */
  onChange: PropTypes.func,
  /** Hàm kiểm tra vô hiệu hóa ngày tùy chỉnh */
  shouldDisableDate: PropTypes.func,
  /** Giá trị ngày hiện tại */
  value: PropTypes.instanceOf(Date),
};

export default React.memo(DateCalendar);
