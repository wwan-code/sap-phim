/**
 * @file use-date-masking.js
 * @module Hooks/UI/UseDateMasking
 * @description Hook quản lý định dạng hiển thị, xử lý chuỗi nhập liệu và sự kiện bàn phím cho DateField, TimeField và DateTimeField.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { formatDate, parseDate } from '@/shared/components/ui/date-time-picker/utils/date-time.util';

/**
 * @hook useDateMasking
 * @description Quản lý chuỗi hiển thị input, parsing khi blur/enter và ref cho các field ngày giờ
 */
export const useDateMasking = ({
  value,
  format = 'DD/MM/YYYY',
  onDateChange,
  disabled = false,
  readOnly = false,
  ampm = false,
}) => {
  const inputRef = useRef(null);

  const formatValue = useCallback(
    (val) => {
      if (!val) return '';
      const d = val instanceof Date ? val : new Date(val);
      if (isNaN(d.getTime())) return '';
      return formatDate(d, format);
    },
    [format]
  );

  const [inputStr, setInputStr] = useState(() => formatValue(value));

  useEffect(() => {
    setInputStr(formatValue(value));
  }, [value, formatValue]);

  const handleFocus = useCallback((e) => {
    // Có thể chọn toàn bộ text khi focus
  }, []);

  const handleBlur = useCallback(
    (e) => {
      if (disabled || readOnly) return;
      const text = e.target.value?.trim();
      if (!text) {
        onDateChange?.(null);
        return;
      }
      const parsed = parseDate(text, format);
      if (parsed && !isNaN(parsed.getTime())) {
        onDateChange?.(parsed);
      } else {
        // Trả về giá trị hợp lệ gần nhất nếu chuỗi nhập không hợp lệ
        setInputStr(formatValue(value));
      }
    },
    [disabled, readOnly, format, onDateChange, formatValue, value]
  );

  const handleClick = useCallback((e) => {
    // Hỗ trợ chọn vị trí con trỏ nếu cần
  }, []);

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Enter') {
        const text = e.target.value?.trim();
        const parsed = parseDate(text, format);
        if (parsed && !isNaN(parsed.getTime())) {
          onDateChange?.(parsed);
        }
      }
    },
    [format, onDateChange]
  );

  return {
    handleBlur,
    handleClick,
    handleFocus,
    handleKeyDown,
    inputRef,
    inputStr,
  };
};

export default useDateMasking;
