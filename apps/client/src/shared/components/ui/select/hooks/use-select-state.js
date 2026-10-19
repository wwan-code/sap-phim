/**
 * @file use-select-state.js
 * @module Components/UI/Select/Hooks/UseSelectState
 * @description Custom hook quản lý trạng thái chọn, selection handlers, custom renderValue và derived values cho Select.
 */

import { useState, useCallback, useEffect, useMemo } from 'react';

/**
 * @hook useSelectState
 * @description Quản lý trạng thái và tương tác chọn của Select (Single & Multi-select)
 * @param {Object} params
 * @param {*} [params.value] - Giá trị controlled
 * @param {*} [params.defaultValue] - Giá trị mặc định
 * @param {boolean} [params.multiple=false] - Cho phép chọn nhiều
 * @param {Function} [params.onChange] - Callback thay đổi giá trị
 * @param {string} [params.name] - Tên field (form payload)
 * @param {Map} params.optionMap - Map value → option item
 * @param {Array} params.parsedOptions - Toàn bộ parsed options
 * @param {Function} [params.renderValue] - Hàm tùy biến hiển thị giá trị đã chọn
 * @param {Function} params.setIsOpen - Setter điều khiển đóng/mở dropdown
 * @param {Function} params.setSearchTerm - Setter điều khiển từ khóa tìm kiếm
 */
export const useSelectState = ({
  value,
  defaultValue,
  multiple = false,
  onChange,
  name,
  optionMap,
  parsedOptions,
  renderValue,
  setIsOpen,
  setSearchTerm,
}) => {
  const isControlled = value !== undefined;

  const resolveRawValue = (val) => {
    if (val && typeof val === 'object' && !Array.isArray(val) && 'target' in val) {
      return val.target.value !== undefined ? val.target.value : '';
    }
    return val;
  };

  const [internalValue, setInternalValue] = useState(() => {
    if (value !== undefined) return resolveRawValue(value);
    if (defaultValue !== undefined) return resolveRawValue(defaultValue);
    return multiple ? [] : '';
  });

  // Đồng bộ giá trị controlled khi prop value thay đổi
  useEffect(() => {
    if (value !== undefined) {
      setInternalValue(resolveRawValue(value));
    }
  }, [value]);

  const currentValue = isControlled ? resolveRawValue(value) : internalValue;

  // ─────────────────────────────────────────────────────────────────────────
  // DERIVED VALUES
  // ─────────────────────────────────────────────────────────────────────────

  /** Danh sách giá trị đã chọn (cho multi-select) */
  const selectedValues = useMemo(() => {
    if (!multiple) return [];
    return Array.isArray(currentValue) ? currentValue : [];
  }, [currentValue, multiple]);

  /**
   * Lấy chuỗi hiển thị trên trigger input
   */
  const getDisplayValue = useCallback(() => {
    if (typeof renderValue === 'function') {
      return renderValue(multiple ? selectedValues : currentValue);
    }

    if (multiple) {
      return selectedValues.length > 0 ? ' ' : '';
    }

    if (currentValue === undefined || currentValue === null) {
      return '';
    }

    let opt = optionMap.get(currentValue);
    if (!opt && currentValue !== '') {
      opt =
        optionMap.get(String(currentValue)) ??
        optionMap.get(Number(currentValue)) ??
        parsedOptions.find(
          (i) => i.type === 'option' && String(i.value) === String(currentValue)
        );
    }

    if (!opt) {
      if (currentValue === '') return '';
      return String(currentValue);
    }

    if (opt.textLabel !== undefined) {
      return String(opt.textLabel);
    }

    return typeof opt.label === 'string' ? opt.label : String(currentValue);
  }, [multiple, currentValue, selectedValues, optionMap, parsedOptions, renderValue]);

  // ─────────────────────────────────────────────────────────────────────────
  // HANDLERS
  // ─────────────────────────────────────────────────────────────────────────

  /** Kích hoạt sự kiện onChange chuẩn Form Event */
  const emitChange = useCallback(
    (nextVal) => {
      if (!isControlled) {
        setInternalValue(nextVal);
      }
      onChange?.(
        {
          target: {
            name,
            value: nextVal,
          },
        },
        nextVal
      );
    },
    [isControlled, name, onChange]
  );

  /** Chọn / Bỏ chọn một option */
  const handleSelect = useCallback(
    (val) => {
      let nextVal;
      if (multiple) {
        nextVal = selectedValues.includes(val)
          ? selectedValues.filter((v) => v !== val)
          : [...selectedValues, val];
      } else {
        nextVal = val;
        setIsOpen(false);
        setSearchTerm('');
      }
      emitChange(nextVal);
    },
    [multiple, selectedValues, emitChange, setIsOpen, setSearchTerm]
  );

  /** Chọn tất cả options (chỉ cho multi-select) */
  const handleSelectAll = useCallback(() => {
    const all = parsedOptions
      .filter((item) => item.type === 'option' && !item.disabled)
      .map((item) => item.value);
    emitChange(all);
  }, [parsedOptions, emitChange]);

  /** Xóa toàn bộ giá trị đã chọn */
  const handleClearAll = useCallback(
    (e) => {
      e?.stopPropagation();
      emitChange(multiple ? [] : '');
    },
    [multiple, emitChange]
  );

  /** Xóa một chip tag cụ thể */
  const handleChipDelete = useCallback(
    (val, e) => {
      e?.stopPropagation();
      const nextVal = selectedValues.filter((v) => v !== val);
      emitChange(nextVal);
    },
    [selectedValues, emitChange]
  );

  return {
    currentValue,
    selectedValues,
    getDisplayValue,
    handleSelect,
    handleSelectAll,
    handleClearAll,
    handleChipDelete,
  };
};
