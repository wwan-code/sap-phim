/**
 * @file SelectChips.jsx
 * @module Components/UI/Select/Components/SelectChips
 * @description Subcomponent hiển thị danh sách thẻ chip (Input Chips) cho chế độ multi-select của Select chuẩn Material 3 Expressive.
 */

import React, { memo } from 'react';
import PropTypes from 'prop-types';
import { X } from 'lucide-react';

/**
 * @component SelectChips
 * @description Hiển thị các chip tags đã chọn trong trigger của Select
 */
const SelectChips = ({ selectedValues, optionMap, maxDisplayChips = 3, onChipDelete }) => {
  const visible = selectedValues.slice(0, maxDisplayChips);
  const extra = selectedValues.length - maxDisplayChips;

  return (
    <div className="select__chips-container">
      {visible.map((val) => {
        const opt = optionMap.get(val);
        const chipText = opt
          ? opt.textLabel !== undefined
            ? String(opt.textLabel)
            : typeof opt.label === 'string'
              ? opt.label
              : String(val)
          : String(val);

        return (
          <div key={val} className="select__chip">
            <span className="select__chip-text">{chipText}</span>
            <button
              type="button"
              className="select__chip-delete"
              onMouseDown={(e) => onChipDelete(val, e)}
              aria-label={`Xóa ${chipText}`}
              tabIndex={-1}
            >
              <X size={12} aria-hidden="true" />
            </button>
          </div>
        );
      })}

      {extra > 0 && (
        <div className="select__chips-more" aria-label={`Còn ${extra} mục khác`}>
          +{extra}
        </div>
      )}
    </div>
  );
};

SelectChips.displayName = 'SelectChips';

SelectChips.propTypes = {
  /** Số lượng chip tối đa hiển thị trước khi gộp vào badge +N */
  maxDisplayChips: PropTypes.number,
  /** Callback khi xóa một chip */
  onChipDelete: PropTypes.func.isRequired,
  /** Map đối chiếu value sang option metadata */
  optionMap: PropTypes.instanceOf(Map).isRequired,
  /** Danh sách các giá trị đã chọn */
  selectedValues: PropTypes.array.isRequired,
};

export default memo(SelectChips);
