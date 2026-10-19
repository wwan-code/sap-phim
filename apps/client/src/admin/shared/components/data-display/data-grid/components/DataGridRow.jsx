/**
 * @file DataGridRow.jsx
 * @module Admin/Shared/Components/DataDisplay/DataGrid/Components/DataGridRow
 * @description Dòng dữ liệu trong bảng (DataGrid Row) hỗ trợ trạng thái Inline Editing và Rounded Pill Hover.
 */

import React, { memo } from 'react';
import PropTypes from 'prop-types';
import DataGridCell from './DataGridCell';

export const DataGridRow = ({
  row,
  rowIndex,
  columns = [],
  isSelected = false,
  isFocused = false,
  isEditing = false,
  editRowData = {},
  onEditChange,
  onSaveEdit,
  onCancelEdit,
  onStartEdit,
  onDeleteRow,
  getRowId,
  getRowValue,
  onRowClick,
  onRowDoubleClick,
  onSelectRow,
  getRowClassName,
  style,
  api,
}) => {
  const rowId = getRowId ? getRowId(row) : (row.id ?? rowIndex);

  const customClassName = getRowClassName ? getRowClassName({ row, rowIndex }) : '';

  const handleClick = (e) => {
    onRowClick?.({ row, rowId, rowIndex }, e);
  };

  const handleDoubleClick = (e) => {
    onRowDoubleClick?.({ row, rowId, rowIndex }, e);
  };

  return (
    <div
      className={`data-grid__row ${isSelected ? 'data-grid__row--selected' : ''} ${isEditing ? 'data-grid__row--editing' : ''} ${isFocused ? 'data-grid__row--focused' : ''} ${customClassName}`}
      style={style}
      role="row"
      aria-selected={isSelected}
      aria-rowindex={rowIndex + 1}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
    >
      {columns.map((col) => {
        const isCheckCol = col.field === '__check__';
        const val = getRowValue ? getRowValue(row, col.field, col) : row[col.field];
        const currentEditVal = editRowData?.[col.field];

        return (
          <DataGridCell
            key={col.field}
            column={col}
            row={row}
            value={val}
            isSelected={isSelected}
            onSelectRow={onSelectRow}
            isCheckboxColumn={isCheckCol}
            isEditing={isEditing}
            editValue={currentEditVal}
            onEditChange={onEditChange}
            onSaveEdit={onSaveEdit}
            onCancelEdit={onCancelEdit}
            onStartEdit={() => onStartEdit?.(rowId, row)}
            onDeleteRow={() => onDeleteRow?.(rowId, row)}
            api={api}
          />
        );
      })}
    </div>
  );
};

DataGridRow.propTypes = {
  row: PropTypes.object.isRequired,
  rowIndex: PropTypes.number.isRequired,
  columns: PropTypes.array.isRequired,
  isSelected: PropTypes.bool,
  isFocused: PropTypes.bool,
  isEditing: PropTypes.bool,
  editRowData: PropTypes.object,
  onEditChange: PropTypes.func,
  onSaveEdit: PropTypes.func,
  onCancelEdit: PropTypes.func,
  onStartEdit: PropTypes.func,
  onDeleteRow: PropTypes.func,
  getRowId: PropTypes.func,
  getRowValue: PropTypes.func,
  onRowClick: PropTypes.func,
  onRowDoubleClick: PropTypes.func,
  onSelectRow: PropTypes.func,
  getRowClassName: PropTypes.func,
  style: PropTypes.object,
  api: PropTypes.object,
};

export default memo(DataGridRow);
