/**
 * @file DataGridFilterPanel.jsx
 * @module Admin/Shared/Components/DataDisplay/DataGrid/Components/Panels/DataGridFilterPanel
 * @description Popover xây dựng bộ lọc đa điều kiện chuẩn Material 3 Expressive tích hợp
 * Select, TextField, Button, IconButton, Tooltip từ shared UI.
 */

import React, { useState, useEffect, memo, useMemo } from 'react';
import PropTypes from 'prop-types';
import { X, Plus, Trash2 } from 'lucide-react';

import Select from '@/shared/components/ui/select';
import TextField from '@/shared/components/ui/text-field';
import Button from '@/shared/components/ui/button';
import IconButton from '@/shared/components/ui/icon-button';
import Tooltip from '@/shared/components/ui/tooltip';

import { FILTER_OPERATORS } from '../../data-grid.constants';

const OPERATOR_OPTIONS = [
  { value: FILTER_OPERATORS.CONTAINS, label: 'chứa' },
  { value: FILTER_OPERATORS.EQUALS, label: 'bằng' },
  { value: FILTER_OPERATORS.STARTS_WITH, label: 'bắt đầu bằng' },
  { value: FILTER_OPERATORS.ENDS_WITH, label: 'kết thúc bằng' },
  { value: FILTER_OPERATORS.GREATER_THAN, label: '>' },
  { value: FILTER_OPERATORS.GREATER_THAN_OR_EQUAL, label: '>=' },
  { value: FILTER_OPERATORS.LESS_THAN, label: '<' },
  { value: FILTER_OPERATORS.LESS_THAN_OR_EQUAL, label: '<=' },
  { value: FILTER_OPERATORS.IS_EMPTY, label: 'trống' },
  { value: FILTER_OPERATORS.IS_NOT_EMPTY, label: 'không trống' },
];

const resolveSelectValue = (eventOrVal, rawVal) => {
  if (rawVal !== undefined) return rawVal;
  if (eventOrVal && typeof eventOrVal === 'object' && 'target' in eventOrVal) {
    return eventOrVal.target.value;
  }
  return eventOrVal;
};

const isItemActive = (item) => {
  if (!item?.field) return false;
  if (item.operator === FILTER_OPERATORS.IS_EMPTY || item.operator === FILTER_OPERATORS.IS_NOT_EMPTY) {
    return true;
  }
  return item.value !== undefined && item.value !== null && String(item.value).trim() !== '';
};

export const DataGridFilterPanel = ({ filterState, columns = [], onClose }) => {
  const { filterModel = { items: [] }, setFilterModel, clearFilters } = filterState;

  // Danh sách các cột có thể lọc
  const filterableColumns = useMemo(
    () =>
      (columns || []).filter(
        (c) =>
          c.filterable !== false &&
          c.field &&
          c.field !== '__check__' &&
          c.field !== '__actions__' &&
          c.field !== 'actions'
      ),
    [columns]
  );

  const columnOptions = useMemo(
    () =>
      filterableColumns.map((col) => ({
        value: col.field,
        label: col.headerName || col.field,
      })),
    [filterableColumns]
  );

  const initialItems = useMemo(() => {
    if (filterModel.items?.length > 0) {
      return filterModel.items;
    }
    return [
      {
        field: filterableColumns[0]?.field || '',
        operator: FILTER_OPERATORS.CONTAINS,
        value: '',
      },
    ];
  }, [filterModel.items, filterableColumns]);

  const [localItems, setLocalItems] = useState(initialItems);

  useEffect(() => {
    if (filterModel.items?.length > 0) {
      setLocalItems(filterModel.items);
    }
  }, [filterModel.items]);

  const handleAddItem = () => {
    const newItem = {
      field: filterableColumns[0]?.field || '',
      operator: FILTER_OPERATORS.CONTAINS,
      value: '',
    };
    const next = [...localItems, newItem];
    setLocalItems(next);
  };

  const handleRemoveItem = (index) => {
    const next = localItems.filter((_, i) => i !== index);
    const updatedNext =
      next.length > 0
        ? next
        : [
            {
              field: filterableColumns[0]?.field || '',
              operator: FILTER_OPERATORS.CONTAINS,
              value: '',
            },
          ];
    setLocalItems(updatedNext);
    setFilterModel({ ...filterModel, items: next.filter(isItemActive) });
  };

  const handleChangeItem = (index, fieldKey, val) => {
    const next = [...localItems];
    next[index] = { ...next[index], [fieldKey]: val };
    setLocalItems(next);
    // Tự động cập nhật filterModel cho consumer/table
    setFilterModel({ ...filterModel, items: next.filter(isItemActive) });
  };

  const handleClearAll = () => {
    clearFilters?.();
    setLocalItems([
      {
        field: filterableColumns[0]?.field || '',
        operator: FILTER_OPERATORS.CONTAINS,
        value: '',
      },
    ]);
    if (onClose) onClose();
  };

  return (
    <div role="dialog" aria-label="Bộ lọc dữ liệu nâng cao" className="data-grid-filter-popover">
      {/* Danh sách các hàng điều kiện lọc */}
      {localItems.map((item, index) => {
        const isValueDisabled =
          item.operator === FILTER_OPERATORS.IS_EMPTY ||
          item.operator === FILTER_OPERATORS.IS_NOT_EMPTY;

        return (
          <div key={index} className="data-grid-filter-popover__row">
            {/* Nút xóa điều kiện */}
            <Tooltip title="Xóa điều kiện">
              <IconButton
                size="small"
                variant="standard"
                onClick={() => handleRemoveItem(index)}
                aria-label="Xóa điều kiện lọc này"
              >
                <X size={14} />
              </IconButton>
            </Tooltip>

            {/* 1. Chọn Cột (Outlined Select) */}
            <div className="data-grid-filter-popover__field" style={{ flex: 1.2 }}>
              <Select
                size="small"
                variant="outlined"
                label="Cột"
                options={columnOptions}
                value={item.field}
                onChange={(e, val) =>
                  handleChangeItem(index, 'field', resolveSelectValue(e, val))
                }
              />
            </div>

            {/* 2. Chọn Toán tử (Outlined Operator Select) */}
            <div className="data-grid-filter-popover__field" style={{ flex: 1 }}>
              <Select
                size="small"
                variant="outlined"
                label="Điều kiện"
                options={OPERATOR_OPTIONS}
                value={item.operator}
                onChange={(e, val) =>
                  handleChangeItem(index, 'operator', resolveSelectValue(e, val))
                }
              />
            </div>

            {/* 3. Nhập Giá trị (Outlined TextField) */}
            <div className="data-grid-filter-popover__field" style={{ flex: 1.5 }}>
              <TextField
                size="small"
                variant="outlined"
                label="Giá trị"
                placeholder="Giá trị..."
                disabled={isValueDisabled}
                value={isValueDisabled ? '' : item.value || ''}
                onChange={(e) =>
                  handleChangeItem(
                    index,
                    'value',
                    e?.target?.value !== undefined ? e.target.value : e
                  )
                }
              />
            </div>
          </div>
        );
      })}

      {/* Nút tác vụ dưới đáy */}
      <div className="data-grid-filter-popover__actions">
        <Button
          variant="tonal"
          size="small"
          startIcon={<Plus size={14} />}
          onClick={handleAddItem}
        >
          Thêm bộ lọc
        </Button>

        <Button
          variant="text"
          size="small"
          startIcon={<Trash2 size={14} />}
          onClick={handleClearAll}
          color="secondary"
        >
          Xóa tất cả
        </Button>
      </div>
    </div>
  );
};

DataGridFilterPanel.propTypes = {
  filterState: PropTypes.object.isRequired,
  columns: PropTypes.array,
  onClose: PropTypes.func,
};

export default memo(DataGridFilterPanel);
