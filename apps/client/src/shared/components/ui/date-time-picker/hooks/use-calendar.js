/**
 * @file use-calendar.js
 * @module Components/UI/DateTimePicker/Hooks/UseCalendar
 * @description Custom hook quản lý trạng thái và logic tính toán của bộ chọn Lịch (DateCalendar).
 */

import { useState, useCallback, useMemo, useEffect } from 'react';

import {
  getCalendarGrid,
  isSameMonth,
  startOfDay,
  addMonths,
  getStartOfMonth,
  getEndOfMonth,
  getStartOfYear,
  getEndOfYear,
} from '../utils/date-time.util';

/**
 * @hook useCalendar
 * @description Hook quản lý logic lịch
 * @returns {object} Trạng thái và các hàm điều khiển
 */
export const useCalendar = ({
  value,
  defaultValue,
  onChange,
  minDate,
  maxDate,
  disablePast,
  disableFuture,
  shouldDisableDate,
}) => {
  const [view, setView] = useState('day');
  const [currentMonth, setCurrentMonth] = useState(() => {
    const init = value || defaultValue || new Date();
    return new Date(init.getFullYear(), init.getMonth(), 1);
  });
  const [slideDirection, setSlideDirection] = useState(1);

  // Đồng bộ currentMonth khi value từ bên ngoài thay đổi
  useEffect(() => {
    if (value && !isSameMonth(value, currentMonth)) {
      setCurrentMonth(new Date(value.getFullYear(), value.getMonth(), 1));
    }
  }, [value]);

  // ────────────────────────────────────────── Logic kiểm tra vô hiệu hóa ──────────────────────────────────────────

  const isDateDisabled = useCallback((date) => {
    if (!date) return true;
    const target = startOfDay(date);
    const today = startOfDay(new Date());
    if (disablePast && target.getTime() < today.getTime()) return true;
    if (disableFuture && target.getTime() > today.getTime()) return true;
    if (minDate && target.getTime() < startOfDay(minDate).getTime()) return true;
    if (maxDate && target.getTime() > startOfDay(maxDate).getTime()) return true;
    if (shouldDisableDate && shouldDisableDate(target)) return true;
    return false;
  }, [disablePast, disableFuture, minDate, maxDate, shouldDisableDate]);

  const isMonthDisabled = useCallback((year, monthIdx) => {
    const today = startOfDay(new Date());
    const monthEnd = getEndOfMonth(year, monthIdx);
    const monthStart = getStartOfMonth(year, monthIdx);
    if (disablePast && monthEnd.getTime() < today.getTime()) return true;
    if (disableFuture && monthStart.getTime() > today.getTime()) return true;
    if (minDate && monthEnd.getTime() < startOfDay(minDate).getTime()) return true;
    if (maxDate && monthStart.getTime() > startOfDay(maxDate).getTime()) return true;
    return false;
  }, [disablePast, disableFuture, minDate, maxDate]);

  const isYearDisabled = useCallback((year) => {
    const today = startOfDay(new Date());
    const yearEnd = getEndOfYear(year);
    const yearStart = getStartOfYear(year);
    if (disablePast && yearEnd.getTime() < today.getTime()) return true;
    if (disableFuture && yearStart.getTime() > today.getTime()) return true;
    if (minDate && yearEnd.getTime() < startOfDay(minDate).getTime()) return true;
    if (maxDate && yearStart.getTime() > startOfDay(maxDate).getTime()) return true;
    return false;
  }, [disablePast, disableFuture, minDate, maxDate]);

  // ────────────────────────────────────────── Handlers ──────────────────────────────────────────

  const handlePrevMonth = useCallback(() => {
    setSlideDirection(-1);
    setCurrentMonth(p => addMonths(p, -1));
  }, []);

  const handleNextMonth = useCallback(() => {
    setSlideDirection(1);
    setCurrentMonth(p => addMonths(p, 1));
  }, []);

  const handleYearNav = useCallback((dir) => {
    setSlideDirection(dir);
    setCurrentMonth(p => new Date(p.getFullYear() + dir * 12, p.getMonth(), 1));
  }, []);

  const handleDayClick = useCallback((date) => {
    if (!isDateDisabled(date)) {
      onChange?.(date);
    }
  }, [isDateDisabled, onChange]);

  const handleMonthClick = useCallback((idx) => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), idx, 1));
    setView('day');
  }, [currentMonth]);

  const handleYearClick = useCallback((year) => {
    setCurrentMonth(new Date(year, currentMonth.getMonth(), 1));
    setView('month');
  }, [currentMonth]);

  const toggleView = useCallback(() => {
    setView(v => {
      if (v === 'day') return 'month';
      if (v === 'month') return 'year';
      return 'day';
    });
  }, []);

  const handlePrev = useCallback(() => {
    if (view === 'day') handlePrevMonth();
    else if (view === 'year') handleYearNav(-1);
  }, [view, handlePrevMonth, handleYearNav]);

  const handleNext = useCallback(() => {
    if (view === 'day') handleNextMonth();
    else if (view === 'year') handleYearNav(1);
  }, [view, handleNextMonth, handleYearNav]);

  const calendarGrid = useMemo(() =>
    getCalendarGrid(currentMonth.getFullYear(), currentMonth.getMonth()),
    [currentMonth]
  );

  return {
    view,
    setView,
    currentMonth,
    setCurrentMonth,
    slideDirection,
    calendarGrid,
    isDateDisabled,
    isMonthDisabled,
    isYearDisabled,
    handlePrev,
    handleNext,
    handleDayClick,
    handleMonthClick,
    handleYearClick,
    toggleView,
  };
};
