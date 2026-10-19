/**
 * @file SelectDropdown.jsx
 * @module Components/UI/Select/Components/SelectDropdown
 * @description Subcomponent dropdown menu cho Select: thanh tìm kiếm, danh sách options với group và footer actions chuẩn Material 3 Expressive.
 */

import React, { memo } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { Search, Check } from 'lucide-react';

/**
 * @component SelectDropdown
 * @description Dropdown menu hiển thị danh sách các tùy chọn và thanh tìm kiếm
 */
const SelectDropdown = ({
  activeIndex,
  currentValue,
  filteredOptions,
  getItemProps,
  isLoading = false,
  listboxRef,
  listContentRef,
  multiple = false,
  onClearAll,
  onSearchChange,
  onSelect,
  onSelectAll,
  searchable = false,
  searchTerm = '',
  selectedValues = [],
}) => {
  return (
    <>
      {/* 1. Thanh tìm kiếm */}
      {searchable && (
        <div className="select__dropdown-search">
          <Search size={16} className="select__dropdown-search-icon" aria-hidden="true" />
          <input
            type="text"
            placeholder="Tìm kiếm tùy chọn..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="select__dropdown-search-input"
            autoFocus
            onClick={(e) => e.stopPropagation()}
            aria-label="Tìm kiếm trong danh sách tùy chọn"
          />
        </div>
      )}

      {/* 2. Danh sách options */}
      <div className="select__dropdown-list" ref={listboxRef} role="listbox">
        {isLoading ? (
          <div className="select__dropdown-empty" role="status">
            Đang tải dữ liệu...
          </div>
        ) : filteredOptions.length === 0 ? (
          <div className="select__dropdown-empty" role="status">
            Không tìm thấy tùy chọn phù hợp
          </div>
        ) : (
          filteredOptions.map((item, i) => {
            if (item.type === 'group') {
              return (
                <div key={`group-${item.label}-${i}`} className="select__dropdown-group" role="presentation">
                  {item.label}
                </div>
              );
            }

            const isSelected = multiple
              ? selectedValues.some(
                  (v) =>
                    v === item.value ||
                    (v !== '' && item.value !== '' && String(v) === String(item.value))
                )
              : currentValue === item.value ||
                (currentValue !== '' &&
                  item.value !== '' &&
                  String(currentValue) === String(item.value));

            return (
              <div
                key={`option-${item.value}-${i}`}
                ref={(el) => {
                  if (listContentRef && listContentRef.current) {
                    listContentRef.current[i] = el;
                  }
                }}
                className={classNames('select__dropdown-item', {
                  'select__dropdown-item--selected': isSelected,
                  'select__dropdown-item--active': activeIndex === i,
                  'select__dropdown-item--disabled': item.disabled,
                })}
                role="option"
                aria-selected={isSelected}
                aria-disabled={item.disabled ? 'true' : undefined}
                {...getItemProps({
                  onClick: () => !item.disabled && onSelect(item.value),
                })}
              >
                {multiple && (
                  <div
                    className={classNames('select__dropdown-checkbox', {
                      'select__dropdown-checkbox--checked': isSelected,
                    })}
                    aria-hidden="true"
                  >
                    {isSelected && <Check size={12} strokeWidth={3} />}
                  </div>
                )}

                <span className="select__dropdown-item-text">{item.label}</span>

                {!multiple && isSelected && (
                  <Check size={16} className="select__dropdown-check" aria-hidden="true" />
                )}
              </div>
            );
          })
        )}
      </div>

      {/* 3. Footer actions (chỉ xuất hiện trong multi-select) */}
      {multiple && (
        <div className="select__dropdown-footer">
          <button
            type="button"
            className="select__dropdown-action"
            onClick={onSelectAll}
          >
            Chọn tất cả
          </button>
          <button
            type="button"
            className={classNames('select__dropdown-action', 'select__dropdown-action--clear')}
            onClick={onClearAll}
            disabled={selectedValues.length === 0}
          >
            Bỏ chọn
          </button>
        </div>
      )}
    </>
  );
};

SelectDropdown.displayName = 'SelectDropdown';

SelectDropdown.propTypes = {
  /** Index của item đang được active bằng bàn phím */
  activeIndex: PropTypes.number,
  /** Giá trị hiện tại (chế độ single-select) */
  currentValue: PropTypes.any,
  /** Danh sách options đã lọc */
  filteredOptions: PropTypes.array.isRequired,
  /** Getter props từ FloatingUI cho từng item */
  getItemProps: PropTypes.func.isRequired,
  /** Trạng thái đang tải dữ liệu options */
  isLoading: PropTypes.bool,
  /** Ref cho thẻ container chứa danh sách options */
  listboxRef: PropTypes.object,
  /** Ref array tham chiếu tới từng DOM node của option item */
  listContentRef: PropTypes.object,
  /** Chế độ chọn nhiều */
  multiple: PropTypes.bool,
  /** Callback xóa tất cả lựa chọn */
  onClearAll: PropTypes.func,
  /** Callback khi thay đổi từ khóa tìm kiếm */
  onSearchChange: PropTypes.func.isRequired,
  /** Callback khi chọn một option */
  onSelect: PropTypes.func.isRequired,
  /** Callback khi chọn tất cả options */
  onSelectAll: PropTypes.func,
  /** Cho phép tìm kiếm options */
  searchable: PropTypes.bool,
  /** Từ khóa tìm kiếm hiện tại */
  searchTerm: PropTypes.string,
  /** Danh sách giá trị đã chọn (chế độ multi-select) */
  selectedValues: PropTypes.array,
};

export default memo(SelectDropdown);
