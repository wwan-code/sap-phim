/**
 * @file use-select-options.js
 * @module Components/UI/Select/Hooks/UseSelectOptions
 * @description Custom hook phân tích, ánh xạ và lọc danh sách tùy chọn (options) cho Select (hỗ trợ cả Declarative JSX và Imperative Array API).
 */

import React, { useMemo } from 'react';

/**
 * Sentinel component cho declarative Option JSX.
 * Không render UI thực tế, chỉ dùng làm cấu trúc dữ liệu khai báo.
 */
export const Option = () => null;
Option.displayName = 'SelectOption';

/**
 * Sentinel component cho declarative OptGroup JSX.
 * Dùng để nhóm các Option liên quan lại với nhau.
 */
export const OptGroup = () => null;
OptGroup.displayName = 'SelectOptGroup';

/**
 * @hook useSelectOptions
 * @description Phân tích và quản lý danh sách tùy chọn cho Select
 * @param {Object} params
 * @param {React.ReactNode} [params.children] - Declarative options (Option / OptGroup)
 * @param {Array} [params.options] - Imperative options array
 * @param {string} [params.searchTerm] - Từ khóa tìm kiếm hiện tại
 * @param {boolean} [params.searchable] - Cho phép tìm kiếm
 * @returns {{ parsedOptions: Array, optionMap: Map, filteredOptions: Array }}
 */
export const useSelectOptions = ({
  children,
  options: optionsProp,
  searchTerm = '',
  searchable = false,
}) => {
  /** Phân tích toàn bộ options từ props.options và children */
  const parsedOptions = useMemo(() => {
    const items = [];
    let index = 0;

    // 1. Phân tích Imperative options array
    if (optionsProp && Array.isArray(optionsProp)) {
      optionsProp.forEach((opt) => {
        if (opt !== null && typeof opt === 'object' && !React.isValidElement(opt)) {
          items.push({
            type: 'option',
            value: opt.value !== undefined ? opt.value : opt,
            label: opt.label || opt.name || opt.title || (opt.value !== undefined ? opt.value : opt),
            textLabel: opt.textLabel || (typeof opt.label === 'string' ? opt.label : undefined),
            disabled: Boolean(opt.disabled),
            index: index++,
          });
        } else {
          items.push({
            type: 'option',
            value: opt,
            label: opt,
            textLabel: String(opt),
            disabled: false,
            index: index++,
          });
        }
      });
    }

    // 2. Phân tích Declarative children
    React.Children.forEach(children, (child) => {
      if (!React.isValidElement(child)) return;

      const isGroup =
        child.type === OptGroup || child.type.displayName === 'SelectOptGroup';
      const isOption =
        child.type === Option ||
        child.type.displayName === 'SelectOption' ||
        child.type === 'option';

      if (isGroup) {
        items.push({
          type: 'group',
          label: child.props.label,
          index: index++,
        });

        React.Children.forEach(child.props.children, (nested) => {
          if (!React.isValidElement(nested)) return;
          const isNestOpt =
            nested.type === Option ||
            nested.type.displayName === 'SelectOption' ||
            nested.type === 'option';

          if (isNestOpt) {
            items.push({
              type: 'option',
              value: nested.props.value,
              label: nested.props.children ?? nested.props.label,
              textLabel: nested.props.label || (typeof nested.props.children === 'string' ? nested.props.children : undefined),
              disabled: Boolean(nested.props.disabled),
              index: index++,
            });
          }
        });
      } else if (isOption) {
        items.push({
          type: 'option',
          value: child.props.value,
          label: child.props.children ?? child.props.label,
          textLabel: child.props.label || (typeof child.props.children === 'string' ? child.props.children : undefined),
          disabled: Boolean(child.props.disabled),
          index: index++,
        });
      }
    });

    return items;
  }, [children, optionsProp]);

  /** Map value → option item giúp tra cứu O(1) */
  const optionMap = useMemo(() => {
    const map = new Map();
    parsedOptions.forEach((item) => {
      if (item.type === 'option') {
        map.set(item.value, item);
      }
    });
    return map;
  }, [parsedOptions]);

  /** Danh sách options đã lọc theo từ khóa tìm kiếm */
  const filteredOptions = useMemo(() => {
    if (!searchable || !searchTerm) return parsedOptions;

    const query = searchTerm.toLowerCase().trim();
    return parsedOptions.filter((item) => {
      if (item.type === 'group') return true;
      const searchTarget =
        item.textLabel !== undefined ? String(item.textLabel) : String(item.label);
      return searchTarget.toLowerCase().includes(query);
    });
  }, [parsedOptions, searchTerm, searchable]);

  return { parsedOptions, optionMap, filteredOptions };
};
