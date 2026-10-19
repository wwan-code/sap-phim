/**
 * @file use-date-time-picker.js
 * @module Components/UI/DateTimePicker/Hooks/UseDateTimePicker
 * @description Custom hook điều phối trạng thái của DateTimePicker (Value, Popover, Modal, Tab view, Validation).
 */

import { useState, useCallback, useEffect } from 'react';

import { useFloatingDropdown } from '@/hooks/ui/use-floating-dropdown';
import { useDeviceType } from '@/hooks/ui/use-device-type';

import { mergeDateAndTime, startOfDay, compareTimeOnly } from '../utils/date-time.util';

/**
 * @hook useDateTimePicker
 * @description Hook quản lý trạng thái và logic điều khiển của DateTimePicker
 * @returns {object} Trạng thái và các hàm điều khiển
 */
export const useDateTimePicker = ({
  value: controlledValue,
  defaultValue,
  onChange,
  disabled,
  readOnly,
  closeOnSelect = false,
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
}) => {
  const isControlled = controlledValue !== undefined;
  const [internalValue, setInternalValue] = useState(defaultValue || null);
  const value = isControlled ? controlledValue : internalValue;

  const [isOpen, setIsOpen] = useState(false);
  const [pickerView, setPickerView] = useState('date'); // 'date' | 'time'

  const { isMobile, isTablet } = useDeviceType();
  const isMobileOrTablet = Boolean(isMobile || isTablet);

  const dropdown = useFloatingDropdown({
    placement: 'bottom-start',
    trigger: 'manual',
    isOpen,
    onOpenChange: setIsOpen,
    adaptToDevice: true,
    offset: 6,
    zIndex: 1300,
    modal: isMobileOrTablet,
    enableScrollLock: isMobileOrTablet,
    deviceBehaviors: {
      mobile: { bottomSheet: true, fullWidth: true },
      tablet: { bottomSheet: true, fullWidth: true },
      desktop: { bottomSheet: false, fullWidth: false },
    },
  });

  // ────────────────────────────────────────── Handlers ──────────────────────────────────────────

  const handleToggle = useCallback(() => {
    if (disabled || readOnly) return;
    setIsOpen((prev) => {
      if (!prev) setPickerView('date');
      return !prev;
    });
  }, [disabled, readOnly]);

  const handleOpen = useCallback(() => {
    if (disabled || readOnly) return;
    setPickerView('date');
    setIsOpen(true);
  }, [disabled, readOnly]);

  const handleClose = useCallback(() => {
    setIsOpen(false);
  }, []);

  const handleCalendarChange = useCallback(
    (newDate) => {
      const baseDate = newDate || new Date();
      const merged = mergeDateAndTime(baseDate, value || new Date());

      if (!isControlled) {
        setInternalValue(merged);
      }
      onChange?.(merged);

      // Tự động chuyển tab sang 'time' sau khi chọn ngày
      setPickerView('time');
    },
    [isControlled, onChange, value]
  );

  const handleTimeChange = useCallback(
    (newTime) => {
      const baseDate = value || new Date();
      const merged = mergeDateAndTime(baseDate, newTime);

      if (!isControlled) {
        setInternalValue(merged);
      }
      onChange?.(merged);

      if (closeOnSelect) {
        handleClose();
      }
    },
    [isControlled, onChange, value, closeOnSelect, handleClose]
  );

  const handleTextChange = useCallback(
    (parsedDate) => {
      if (!isControlled) {
        setInternalValue(parsedDate);
      }
      onChange?.(parsedDate);
    },
    [isControlled, onChange]
  );

  const handleToday = useCallback(() => {
    const now = new Date();
    if (!isControlled) {
      setInternalValue(now);
    }
    onChange?.(now);
  }, [isControlled, onChange]);

  const handleClear = useCallback(() => {
    if (!isControlled) {
      setInternalValue(null);
    }
    onChange?.(null);
  }, [isControlled, onChange]);

  // ────────────────────────────────────────── Validation ──────────────────────────────────────────

  useEffect(() => {
    if (!onError) return;

    if (!value) {
      onError(null);
      return;
    }

    if (isNaN(value.getTime())) {
      onError('invalidDateTime');
      return;
    }

    const now = new Date();
    const targetDate = startOfDay(value);

    if (disablePast && value.getTime() < now.getTime()) {
      onError('disablePast');
      return;
    }
    if (disableFuture && value.getTime() > now.getTime()) {
      onError('disableFuture');
      return;
    }
    if (minDate && targetDate.getTime() < startOfDay(minDate).getTime()) {
      onError('minDate');
      return;
    }
    if (maxDate && targetDate.getTime() > startOfDay(maxDate).getTime()) {
      onError('maxDate');
      return;
    }
    if (minTime && compareTimeOnly(value, minTime) < 0) {
      onError('minTime');
      return;
    }
    if (maxTime && compareTimeOnly(value, maxTime) > 0) {
      onError('maxTime');
      return;
    }
    if (minDateTime && value.getTime() < minDateTime.getTime()) {
      onError('minDateTime');
      return;
    }
    if (maxDateTime && value.getTime() > maxDateTime.getTime()) {
      onError('maxDateTime');
      return;
    }
    if (shouldDisableDate && shouldDisableDate(targetDate)) {
      onError('shouldDisableDate');
      return;
    }
    if (shouldDisableTime && shouldDisableTime(value)) {
      onError('shouldDisableTime');
      return;
    }

    onError(null);
  }, [
    value,
    disablePast,
    disableFuture,
    minDate,
    maxDate,
    minTime,
    maxTime,
    minDateTime,
    maxDateTime,
    shouldDisableDate,
    shouldDisableTime,
    onError,
  ]);

  return {
    value,
    isOpen,
    setIsOpen,
    pickerView,
    setPickerView,
    isMobileOrTablet,
    dropdown,
    handleToggle,
    handleOpen,
    handleClose,
    handleCalendarChange,
    handleTimeChange,
    handleTextChange,
    handleToday,
    handleClear,
  };
};
