/**
 * @file use-date-picker.js
 * @module Components/UI/DateTimePicker/Hooks/UseDatePicker
 * @description Custom hook điều phối trạng thái của DatePicker (Value, Popover, Modal, Validation).
 */

import { useState, useCallback, useEffect } from 'react';

import { useFloatingDropdown } from '@/hooks/ui/use-floating-dropdown';
import { useDeviceType } from '@/hooks/ui/use-device-type';

import { startOfDay } from '../utils/date-time.util';

/**
 * @hook useDatePicker
 * @description Hook quản lý trạng thái và logic điều khiển của DatePicker
 * @returns {object} Trạng thái và các hàm điều khiển
 */
export const useDatePicker = ({
  value: controlledValue,
  defaultValue,
  onChange,
  disabled,
  readOnly,
  closeOnSelect = true,
  onError,
  disablePast,
  disableFuture,
  minDate,
  maxDate,
  shouldDisableDate,
}) => {
  const isControlled = controlledValue !== undefined;
  const [internalValue, setInternalValue] = useState(defaultValue || null);
  const value = isControlled ? controlledValue : internalValue;

  const [isOpen, setIsOpen] = useState(false);

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
    setIsOpen((prev) => !prev);
  }, [disabled, readOnly]);

  const handleOpen = useCallback(() => {
    if (disabled || readOnly) return;
    setIsOpen(true);
  }, [disabled, readOnly]);

  const handleClose = useCallback(() => {
    setIsOpen(false);
  }, []);

  const handleValueChange = useCallback(
    (newDate) => {
      if (!isControlled) {
        setInternalValue(newDate);
      }
      onChange?.(newDate);

      if (closeOnSelect) {
        handleClose();
      }
    },
    [isControlled, onChange, closeOnSelect, handleClose]
  );

  const handleToday = useCallback(() => {
    const today = new Date();
    handleValueChange(today);
  }, [handleValueChange]);

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

    const target = startOfDay(value);
    const today = startOfDay(new Date());

    if (disablePast && target.getTime() < today.getTime()) {
      onError('disablePast');
      return;
    }
    if (disableFuture && target.getTime() > today.getTime()) {
      onError('disableFuture');
      return;
    }
    if (minDate && target.getTime() < startOfDay(minDate).getTime()) {
      onError('minDate');
      return;
    }
    if (maxDate && target.getTime() > startOfDay(maxDate).getTime()) {
      onError('maxDate');
      return;
    }
    if (shouldDisableDate && shouldDisableDate(target)) {
      onError('shouldDisableDate');
      return;
    }
    if (isNaN(value.getTime())) {
      onError('invalidDate');
      return;
    }

    onError(null);
  }, [value, disablePast, disableFuture, minDate, maxDate, shouldDisableDate, onError]);

  return {
    value,
    isOpen,
    setIsOpen,
    isMobileOrTablet,
    dropdown,
    handleToggle,
    handleOpen,
    handleClose,
    handleValueChange,
    handleToday,
    handleClear,
  };
};
