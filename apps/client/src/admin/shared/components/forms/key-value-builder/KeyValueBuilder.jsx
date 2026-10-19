/**
 * @file KeyValueBuilder.jsx
 * @module Admin/Shared/Components/Forms/KeyValueBuilder
 * @component KeyValueBuilder
 * @description Component chỉnh sửa cấu trúc Key-Value linh hoạt cho trường metadata JSONB (Actor, Studio).
 */

import React, { useState, useEffect, useCallback, memo } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { Plus, Trash2 } from 'lucide-react';
import Button from '@/shared/components/ui/button';
import IconButton from '@/shared/components/ui/icon-button';
import TextField from '@/shared/components/ui/text-field';
import './key-value-builder.scss';

export const KeyValueBuilder = memo(({
  value = {},
  onChange,
  label = 'Thuộc tính mở rộng (Metadata)',
  helperText,
  disabled = false,
  className = '',
}) => {
  // Chuyển object { k1: v1, k2: v2 } thành mảng cặp [{ id, key, val }]
  const [pairs, setPairs] = useState(() => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
    return Object.entries(value).map(([k, v], idx) => ({
      id: `pair_${idx}_${Date.now()}`,
      key: k,
      val: typeof v === 'object' ? JSON.stringify(v) : String(v ?? ''),
    }));
  });

  // Đồng bộ ngược ra ngoài khi pairs thay đổi
  const emitChange = useCallback(
    (newPairs) => {
      const obj = {};
      newPairs.forEach((item) => {
        const k = item.key.trim();
        if (k) {
          obj[k] = item.val;
        }
      });
      onChange?.(obj);
    },
    [onChange]
  );

  const handleAddPair = () => {
    if (disabled) return;
    const newPairs = [...pairs, { id: `pair_${Date.now()}`, key: '', val: '' }];
    setPairs(newPairs);
    emitChange(newPairs);
  };

  const handleRemovePair = (id) => {
    if (disabled) return;
    const newPairs = pairs.filter((p) => p.id !== id);
    setPairs(newPairs);
    emitChange(newPairs);
  };

  const handleChangePair = (id, field, newValue) => {
    if (disabled) return;
    const newPairs = pairs.map((p) => (p.id === id ? { ...p, [field]: newValue } : p));
    setPairs(newPairs);
    emitChange(newPairs);
  };

  return (
    <div className={classNames('key-value-builder', className)}>
      <div className="key-value-builder__header">
        <label className="key-value-builder__label">{label}</label>
        {!disabled && (
          <Button
            type="button"
            variant="tonal"
            size="small"
            startIcon={<Plus size={14} />}
            onClick={handleAddPair}
          >
            Thêm thuộc tính
          </Button>
        )}
      </div>

      {pairs.length === 0 ? (
        <div className="key-value-builder__empty">
          <span>Chưa có thuộc tính mở rộng nào.</span>
        </div>
      ) : (
        <div className="key-value-builder__list">
          {pairs.map((pair) => (
            <div key={pair.id} className="key-value-builder__row">
              <div className="key-value-builder__col">
                <TextField
                  size="small"
                  variant="outlined"
                  placeholder="Tên khóa (Key)..."
                  value={pair.key}
                  disabled={disabled}
                  onChange={(e) => handleChangePair(pair.id, 'key', e.target.value)}
                />
              </div>

              <div className="key-value-builder__col" style={{ flex: 1.5 }}>
                <TextField
                  size="small"
                  variant="outlined"
                  placeholder="Giá trị (Value)..."
                  value={pair.val}
                  disabled={disabled}
                  onChange={(e) => handleChangePair(pair.id, 'val', e.target.value)}
                />
              </div>

              {!disabled && (
                <IconButton
                  type="button"
                  size="small"
                  variant="standard"
                  color="danger"
                  onClick={() => handleRemovePair(pair.id)}
                  aria-label="Xóa thuộc tính này"
                >
                  <Trash2 size={16} />
                </IconButton>
              )}
            </div>
          ))}
        </div>
      )}

      {helperText && <p className="key-value-builder__helper">{helperText}</p>}
    </div>
  );
});

KeyValueBuilder.displayName = 'KeyValueBuilder';

KeyValueBuilder.propTypes = {
  value: PropTypes.object,
  onChange: PropTypes.func,
  label: PropTypes.node,
  helperText: PropTypes.node,
  disabled: PropTypes.bool,
  className: PropTypes.string,
};

export default KeyValueBuilder;
