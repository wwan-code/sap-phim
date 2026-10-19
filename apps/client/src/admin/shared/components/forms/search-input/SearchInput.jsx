/**
 * @file SearchInput.jsx
 * @module Admin/Shared/Components/Forms/SearchInput
 * @description Input tìm kiếm chuẩn cho các bảng dữ liệu Admin Portal.
 */

import React from 'react';
import PropTypes from 'prop-types';
import { Search, X } from 'lucide-react';
import './search-input.scss';

export function SearchInput({
  value = '',
  onChange,
  onClear,
  placeholder = 'Tìm kiếm...',
  className = '',
  ...rest
}) {
  const handleClear = (e) => {
    e.stopPropagation();
    if (onClear) {
      onClear();
    } else if (onChange) {
      onChange({ target: { value: '' } });
    }
  };

  return (
    <div className={`admin-search-input ${className}`}>
      <Search size={16} className="admin-search-input__icon" />
      <input
        type="text"
        className="admin-search-input__field"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        {...rest}
      />
      {value && (
        <button
          type="button"
          className="admin-search-input__clear-btn"
          onClick={handleClear}
          aria-label="Xóa tìm kiếm"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}

SearchInput.propTypes = {
  value: PropTypes.string,
  onChange: PropTypes.func,
  onClear: PropTypes.func,
  placeholder: PropTypes.string,
  className: PropTypes.string,
};

export default SearchInput;
