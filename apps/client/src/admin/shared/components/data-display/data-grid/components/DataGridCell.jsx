/**
 * @file DataGridCell.jsx
 * @module Admin/Shared/Components/DataDisplay/DataGrid/Components/DataGridCell
 * @description Ô dữ liệu trong bảng (DataGrid Cell) hỗ trợ Inline Editing
 * tích hợp TextField, Select, IconButton và Tooltip từ shared UI theo chuẩn Material 3 Expressive.
 */

import React, { memo } from 'react';
import PropTypes from 'prop-types';
import { Check, X, Edit2, Trash2 } from 'lucide-react';

import IconButton from '@/shared/components/ui/icon-button';
import Tooltip from '@/shared/components/ui/tooltip';
import TextField from '@/shared/components/ui/text-field';
import Select from '@/shared/components/ui/select';

export const DataGridCell = ({
  column,
  row,
  value,
  isSelected = false,
  onSelectRow,
  isCheckboxColumn = false,
  isEditing = false,
  editValue,
  onEditChange,
  onSaveEdit,
  onCancelEdit,
  onStartEdit,
  onDeleteRow,
  api,
}) => {
  const isPinnedLeft = Boolean(column.isPinnedLeft);
  const isPinnedRight = Boolean(column.isPinnedRight);
  const stickyStyle = isPinnedLeft
    ? { position: 'sticky', left: column.stickyLeft ?? 0, zIndex: 3 }
    : isPinnedRight
    ? { position: 'sticky', right: column.stickyRight ?? 0, zIndex: 3 }
    : {};

  const pinnedClass = isPinnedLeft
    ? 'data-grid__cell--pinned-left'
    : isPinnedRight
    ? 'data-grid__cell--pinned-right'
    : '';

  const dividerClass = column.isLastPinnedLeft
    ? 'data-grid__cell--pinned-left-last'
    : column.isFirstPinnedRight
    ? 'data-grid__cell--pinned-right-first'
    : '';

  // Độ rộng pixel chuẩn hóa từ thuật toán Auto-Fill Column Width kết hợp Sticky Offset
  const widthStyle = {
    width: column.width,
    minWidth: column.minWidth,
    maxWidth: column.maxWidth,
    flexShrink: 0,
    ...stickyStyle,
  };

  const alignClass = `data-grid__cell--align-${column.align || 'left'}`;

  // 1. Cột Checkbox 6px
  if (isCheckboxColumn) {
    return (
      <div
        className={`data-grid__cell data-grid__cell--align-center ${pinnedClass} ${dividerClass}`}
        style={{
          width: column.width || 48,
          minWidth: column.width || 48,
          maxWidth: column.width || 48,
          flexShrink: 0,
          padding: 0,
          ...stickyStyle,
          zIndex: isPinnedLeft ? 4 : undefined,
        }}
        role="gridcell"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          type="checkbox"
          className="data-grid__cell-checkbox"
          checked={isSelected}
          onChange={(e) => onSelectRow(row, e)}
          aria-label={`Chọn dòng ${row.id || ''}`}
        />
      </div>
    );
  }

  // 2. Chế độ Chỉnh sửa Trực tiếp (Inline Edit Mode)
  if (isEditing && column.editable !== false) {
    const currentVal = editValue !== undefined ? editValue : (value ?? '');

    // Cột Hành động trong lúc sửa (✓ Lưu & ✕ Hủy)
    if (column.type === 'actions' || column.field === 'actions') {
      return (
        <div className={`data-grid__cell ${alignClass} ${pinnedClass} ${dividerClass}`} style={widthStyle} role="gridcell">
          <div className="data-grid__actions-cell" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Tooltip title="Lưu thay đổi">
              <IconButton
                size="small"
                variant="filled"
                color="success"
                onClick={(e) => {
                  e.stopPropagation();
                  onSaveEdit?.();
                }}
                aria-label="Lưu thay đổi"
              >
                <Check size={15} />
              </IconButton>
            </Tooltip>

            <Tooltip title="Hủy bỏ">
              <IconButton
                size="small"
                variant="standard"
                onClick={(e) => {
                  e.stopPropagation();
                  onCancelEdit?.();
                }}
                aria-label="Hủy bỏ"
              >
                <X size={15} />
              </IconButton>
            </Tooltip>
          </div>
        </div>
      );
    }

    // Dropdown Select Pill
    if (column.type === 'singleSelect' || Array.isArray(column.valueOptions)) {
      const options = (column.valueOptions || []).map((opt) =>
        typeof opt === 'object' ? opt : { value: opt, label: String(opt) }
      );

      return (
        <div
          className={`data-grid__cell ${alignClass} ${pinnedClass} ${dividerClass}`}
          style={widthStyle}
          role="gridcell"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="data-grid__cell-edit-container">
            <Select
              size="small"
              variant="outlined"
              options={options}
              value={currentVal}
              onChange={(val) => onEditChange?.(column.field, val)}
              autoWidth
            />
          </div>
        </div>
      );
    }

    // Text / Number / Date Input with TextField
    const inputType = column.type === 'number' ? 'number' : column.type === 'date' ? 'date' : 'text';

    return (
      <div
        className={`data-grid__cell ${alignClass} ${pinnedClass} ${dividerClass}`}
        style={widthStyle}
        role="gridcell"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="data-grid__cell-edit-container">
          <TextField
            size="small"
            variant="outlined"
            type={inputType}
            value={currentVal}
            placeholder={column.headerName || ''}
            onChange={(e) => onEditChange?.(column.field, e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.stopPropagation();
                onSaveEdit?.();
              } else if (e.key === 'Escape') {
                e.stopPropagation();
                onCancelEdit?.();
              }
            }}
            autoFocus={column.autoFocus}
          />
        </div>
      </div>
    );
  }

  // 3. Chế độ Xem Bình Thường (Normal View Mode)
  let cellContent = value;

  // Nếu là cột actions và không có custom renderCell, cung cấp icon Sửa (✎) và Xóa (🗑)
  if ((column.type === 'actions' || column.field === 'actions') && !column.renderCell) {
    cellContent = (
      <div className="data-grid__actions-cell" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <Tooltip title="Chỉnh sửa dòng">
          <IconButton
            size="small"
            variant="standard"
            onClick={(e) => {
              e.stopPropagation();
              onStartEdit?.(row.id ?? row._id, row);
            }}
            aria-label="Chỉnh sửa dòng"
          >
            <Edit2 size={15} />
          </IconButton>
        </Tooltip>

        <Tooltip title="Xóa dòng">
          <IconButton
            size="small"
            variant="standard"
            color="error"
            onClick={(e) => {
              e.stopPropagation();
              onDeleteRow?.(row.id ?? row._id, row);
            }}
            aria-label="Xóa dòng"
          >
            <Trash2 size={15} />
          </IconButton>
        </Tooltip>
      </div>
    );
  } else if (column.renderCell && typeof column.renderCell === 'function') {
    cellContent = column.renderCell({
      value,
      row,
      field: column.field,
      column,
      api,
      onStartEdit: () => onStartEdit?.(row.id ?? row._id, row),
    });
  } else if (column.valueFormatter && typeof column.valueFormatter === 'function') {
    cellContent = column.valueFormatter({
      value,
      row,
      field: column.field,
    });
  } else if (value === null || value === undefined || value === '') {
    cellContent = <span style={{ color: 'var(--sp-color-text-muted)', opacity: 0.6 }}>—</span>;
  } else if (typeof value === 'boolean') {
    cellContent = value ? 'Có' : 'Không';
  }

  const customClassName =
    typeof column.cellClassName === 'function'
      ? column.cellClassName({ value, row, field: column.field })
      : (column.cellClassName || '');

  return (
    <div
      className={`data-grid__cell ${alignClass} ${customClassName} ${pinnedClass} ${dividerClass}`}
      style={widthStyle}
      role="gridcell"
    >
      <div className="data-grid__cell-content">{cellContent}</div>
    </div>
  );
};

DataGridCell.propTypes = {
  column: PropTypes.object.isRequired,
  row: PropTypes.object.isRequired,
  value: PropTypes.any,
  isSelected: PropTypes.bool,
  onSelectRow: PropTypes.func,
  isCheckboxColumn: PropTypes.bool,
  isEditing: PropTypes.bool,
  editValue: PropTypes.any,
  onEditChange: PropTypes.func,
  onSaveEdit: PropTypes.func,
  onCancelEdit: PropTypes.func,
  onStartEdit: PropTypes.func,
  onDeleteRow: PropTypes.func,
  api: PropTypes.object,
};

export default memo(DataGridCell);

