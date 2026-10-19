/**
 * @file use-time-picker-control.js
 * @module Components/UI/DateTimePicker/Hooks/UseTimePickerControl
 * @description Custom hook điều phối trạng thái của TimePicker (Value, Popover, Modal, Validation).
 */

import { useState, useCallback, useEffect } from 'react';

import { useFloatingDropdown } from '@/hooks/ui/use-floating-dropdown';
import { useDeviceType } from '@/hooks/ui/use-device-type';

import { compareTimeOnly } from '../utils/date-time.util';

/**
 * @hook useTimePickerControl
 * @description Hook điều phối trạng thái của TimePicker
 * @returns {object} Trạng thái và các hàm điều khiển
 */
export const useTimePickerControl = ({
  value: controlledValue,
  defaultValue,
  onChange,
  disabled,
  readOnly,
  closeOnSelect = false,
  onError,
  disablePast,
  disableFuture,
  minTime,
  maxTime,
  shouldDisableTime,
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
    (newTime) => {
      if (!isControlled) {
        setInternalValue(newTime);
      }
      onChange?.(newTime);

      if (closeOnSelect) {
        handleClose();
      }
    },
    [isControlled, onChange, closeOnSelect, handleClose]
  );

  const handleNow = useCallback(() => {
    const now = new Date();
    handleValueChange(now);
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

    if (isNaN(value.getTime())) {
      onError('invalidTime');
      return;
    }

    const now = new Date();
    if (disablePast && value.getTime() < now.getTime()) {
      onError('disablePast');
      return;
    }
    if (disableFuture && value.getTime() > now.getTime()) {
      onError('disableFuture');
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
    if (shouldDisableTime && shouldDisableTime(value)) {
      onError('shouldDisableTime');
      return;
    }

    onError(null);
  }, [value, disablePast, disableFuture, minTime, maxTime, shouldDisableTime, onError]);

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
    handleNow,
    handleClear,
  };
};
