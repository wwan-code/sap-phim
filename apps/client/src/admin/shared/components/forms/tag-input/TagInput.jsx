/**
 * @file TagInput.jsx
 * @module Admin/Shared/Components/Forms/TagInput
 * @component TagInput
 * @description Component nhập liệu dạng thẻ (Tag/Chip Input) cho các mảng chuỗi (ví dụ: Aliases của diễn viên).
 */

import React, { useState, useRef, useCallback, memo } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { X, Plus } from 'lucide-react';
import './tag-input.scss';

export const TagInput = memo(({
  value = [],
  onChange,
  label,
  placeholder = 'Nhập và nhấn Enter...',
  helperText,
  error,
  disabled = false,
  maxTags,
  className = '',
  id,
}) => {
  const [inputValue, setInputValue] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef(null);

  const tags = Array.isArray(value) ? value : [];

  const handleAddTag = useCallback(
    (rawText) => {
      if (!rawText) return;
      const itemsToAdd = rawText
        .split(/[,;\n]+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      const uniqueNewTags = itemsToAdd.filter(
        (item) => !tags.some((t) => t.toLowerCase() === item.toLowerCase())
      );

      if (uniqueNewTags.length === 0) {
        setInputValue('');
        return;
      }

      let nextTags = [...tags, ...uniqueNewTags];
      if (maxTags && nextTags.length > maxTags) {
        nextTags = nextTags.slice(0, maxTags);
      }

      onChange?.(nextTags);
      setInputValue('');
    },
    [tags, maxTags, onChange]
  );

  const handleRemoveTag = useCallback(
    (indexToRemove, e) => {
      e?.stopPropagation();
      if (disabled) return;
      const nextTags = tags.filter((_, i) => i !== indexToRemove);
      onChange?.(nextTags);
    },
    [tags, disabled, onChange]
  );

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      handleAddTag(inputValue);
    } else if (e.key === 'Backspace' && !inputValue && tags.length > 0) {
      handleRemoveTag(tags.length - 1);
    }
  };

  const handleBlur = () => {
    setIsFocused(false);
    if (inputValue.trim()) {
      handleAddTag(inputValue);
    }
  };

  const handleContainerClick = () => {
    if (!disabled && inputRef.current) {
      inputRef.current.focus();
    }
  };

  return (
    <div
      className={classNames(
        'tag-input',
        {
          'tag-input--focused': isFocused,
          'tag-input--disabled': disabled,
          'tag-input--error': Boolean(error),
        },
        className
      )}
    >
      {label && <label htmlFor={id} className="tag-input__label">{label}</label>}

      <div className="tag-input__container" onClick={handleContainerClick}>
        <div className="tag-input__tags">
          {tags.map((tag, idx) => (
            <span key={idx} className="tag-input__chip">
              <span className="tag-input__chip-text">{tag}</span>
              {!disabled && (
                <button
                  type="button"
                  className="tag-input__chip-remove"
                  onClick={(e) => handleRemoveTag(idx, e)}
                  aria-label={`Xóa thẻ ${tag}`}
                >
                  <X size={12} aria-hidden="true" />
                </button>
              )}
            </span>
          ))}

          <input
            ref={inputRef}
            id={id}
            type="text"
            className="tag-input__field"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={handleBlur}
            placeholder={tags.length === 0 ? placeholder : ''}
            disabled={disabled || (maxTags && tags.length >= maxTags)}
          />
        </div>
      </div>

      {(error || helperText) && (
        <p className={classNames('tag-input__helper', { 'tag-input__helper--error': Boolean(error) })}>
          {typeof error === 'string' ? error : helperText}
        </p>
      )}
    </div>
  );
});

TagInput.displayName = 'TagInput';

TagInput.propTypes = {
  value: PropTypes.arrayOf(PropTypes.string),
  onChange: PropTypes.func,
  label: PropTypes.node,
  placeholder: PropTypes.string,
  helperText: PropTypes.node,
  error: PropTypes.oneOfType([PropTypes.bool, PropTypes.string]),
  disabled: PropTypes.bool,
  maxTags: PropTypes.number,
  className: PropTypes.string,
  id: PropTypes.string,
};

export default TagInput;
