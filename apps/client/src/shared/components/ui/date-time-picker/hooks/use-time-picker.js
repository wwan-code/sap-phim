/**
 * @file use-time-picker.js
 * @module Components/UI/DateTimePicker/Hooks/UseTimePicker
 * @description Custom hook điều khiển logic chọn giờ (Giờ 12h/24h, Phút, AM/PM) cho DigitalClock.
 */

import { useState, useCallback, useEffect } from 'react';

import { compareTimeOnly } from '../utils/date-time.util';

/**
 * @hook useTimePicker
 * @description Hook quản lý trạng thái và tính toán cho DigitalClock
 * @returns {object} Trạng thái và các hàm điều khiển
 */
export const useTimePicker = ({
  value,
  onChange,
  ampm = false,
  minTime,
  maxTime,
  shouldDisableTime,
  disablePast,
  disableFuture,
  minDateTime,
  maxDateTime,
}) => {
  const [internalTime, setInternalTime] = useState(() => value || new Date());

  useEffect(() => {
    if (value) {
      setInternalTime(value);
    }
  }, [value]);

  const selectedHour24 = internalTime.getHours();
  const selectedMinute = internalTime.getMinutes();

  let selectedHour12 = selectedHour24 % 12;
  selectedHour12 = selectedHour12 ? selectedHour12 : 12;
  const selectedAmPm = selectedHour24 >= 12 ? 'PM' : 'AM';

  const currentHourDisplay = ampm ? selectedHour12 : selectedHour24;

  // ────────────────────────────────────────── Logic kiểm tra vô hiệu hóa ──────────────────────────────────────────

  const isTimeDisabled = useCallback(
    (type, val) => {
      const clone = new Date(internalTime);
      if (type === 'hour') {
        if (ampm) {
          let h24 = val;
          if (selectedAmPm === 'PM' && val < 12) h24 += 12;
          if (selectedAmPm === 'AM' && val === 12) h24 = 0;
          clone.setHours(h24);
        } else {
          clone.setHours(val);
        }
      } else if (type === 'minute') {
        clone.setMinutes(val);
      }

      const now = new Date();
      if (disablePast && clone.getTime() < now.getTime()) return true;
      if (disableFuture && clone.getTime() > now.getTime()) return true;
      if (minTime && compareTimeOnly(clone, minTime) < 0) return true;
      if (maxTime && compareTimeOnly(clone, maxTime) > 0) return true;
      if (minDateTime && clone.getTime() < minDateTime.getTime()) return true;
      if (maxDateTime && clone.getTime() > maxDateTime.getTime()) return true;
      if (shouldDisableTime && shouldDisableTime(clone)) return true;

      return false;
    },
    [
      internalTime,
      ampm,
      selectedAmPm,
      disablePast,
      disableFuture,
      minTime,
      maxTime,
      minDateTime,
      maxDateTime,
      shouldDisableTime,
    ]
  );

  // ────────────────────────────────────────── Handlers ──────────────────────────────────────────

  const handleHourSelect = useCallback(
    (hr) => {
      const nextDate = new Date(internalTime);
      let targetH24 = hr;
      if (ampm) {
        if (selectedAmPm === 'PM' && hr < 12) targetH24 += 12;
        if (selectedAmPm === 'AM' && hr === 12) targetH24 = 0;
      }
      nextDate.setHours(targetH24);

      if (!isTimeDisabled('hour', hr)) {
        setInternalTime(nextDate);
        onChange?.(nextDate);
      }
    },
    [internalTime, ampm, selectedAmPm, isTimeDisabled, onChange]
  );

  const handleMinuteSelect = useCallback(
    (min) => {
      const nextDate = new Date(internalTime);
      nextDate.setMinutes(min);

      if (!isTimeDisabled('minute', min)) {
        setInternalTime(nextDate);
        onChange?.(nextDate);
      }
    },
    [internalTime, isTimeDisabled, onChange]
  );

  const handleAmPmSelect = useCallback(
    (targetAmPm) => {
      if (targetAmPm === selectedAmPm) return;
      const nextDate = new Date(internalTime);
      let h24 = nextDate.getHours();
      if (targetAmPm === 'PM' && h24 < 12) h24 += 12;
      if (targetAmPm === 'AM' && h24 >= 12) h24 -= 12;
      nextDate.setHours(h24);

      setInternalTime(nextDate);
      onChange?.(nextDate);
    },
    [internalTime, selectedAmPm, onChange]
  );

  return {
    selectedHour24,
    selectedHour12,
    selectedMinute,
    selectedAmPm,
    currentHourDisplay,
    isTimeDisabled,
    handleHourSelect,
    handleMinuteSelect,
    handleAmPmSelect,
  };
};
