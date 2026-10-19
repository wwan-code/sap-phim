/**
 * @file DataGridBody.jsx
 * @module Admin/Shared/Components/DataDisplay/DataGrid/Components/DataGridBody
 * @description Thân bảng DataGrid (Body) hỗ trợ Dynamic Hybrid Virtualization, Inline Row Editing và Empty/Error states.
 */

import React from 'react';
import PropTypes from 'prop-types';
import DataGridRow from './DataGridRow';
import DataGridSkeleton from './DataGridSkeleton';
import DataGridEmpty from './DataGridEmpty';
import DataGridNoResults from './DataGridNoResults';
import DataGridError from './DataGridError';

export const DataGridBody = ({
  rows = [],
  rawTotalRowsCount = 0,
  columns = [],
  effectiveTotalWidth,
  loading = false,
  error = null,
  onRetry,
  selectionState,
  virtualizerState,
  keyboardState,
  editingState = {},
  getRowId,
  getRowValue,
  onRowClick,
  onRowDoubleClick,
  getRowClassName,
  slots = {},
  slotProps = {},
  api,
}) => {
  const { isSelected, toggleRowSelection } = selectionState;
  const { isVirtual, virtualRows, totalVirtualSize } = virtualizerState;
  const { focusedCell } = keyboardState;
  const {
    editRowId,
    editRowData,
    onEditChange,
    onSaveEdit,
    onCancelEdit,
    onStartEdit,
    onDeleteRow,
  } = editingState;

  // 1. Trạng thái Loading ban đầu
  if (loading && rows.length === 0) {
    const SkeletonComponent = slots.loading || DataGridSkeleton;
    return (
      <SkeletonComponent
        columns={columns}
        effectiveTotalWidth={effectiveTotalWidth}
        columnsCount={columns.length}
        rowsCount={8}
        {...slotProps.loading}
      />
    );
  }

  // 2. Trạng thái Lỗi (Error)
  if (error && rows.length === 0) {
    const ErrorComponent = slots.error || DataGridError;
    return <ErrorComponent error={error} onRetry={onRetry} {...slotProps.error} />;
  }

  // 3. Trạng thái Trống (Empty dataset vs No Results sau lọc)
  if (rows.length === 0) {
    if (rawTotalRowsCount > 0) {
      // Có dữ liệu nhưng filter/search không ra kết quả
      const NoResultsComponent = slots.noResults || DataGridNoResults;
      return <NoResultsComponent {...slotProps.noResults} />;
    }
    // Hoàn toàn không có dữ liệu
    const EmptyComponent = slots.empty || DataGridEmpty;
    return <EmptyComponent {...slotProps.empty} />;
  }

  const minWidthStyle = {
    width: '100%',
    minWidth: effectiveTotalWidth ? `${effectiveTotalWidth}px` : '100%',
  };

  // 4. Render danh sách dòng có ảo hóa (Virtualization)
  if (isVirtual && virtualRows) {
    return (
      <div
        className="data-grid__body"
        role="rowgroup"
        style={{ height: `${totalVirtualSize}px`, position: 'relative', width: '100%', ...minWidthStyle }}
      >
        {virtualRows.map((virtualRow) => {
          const row = rows[virtualRow.index];
          const rowId = getRowId ? getRowId(row) : (row.id ?? virtualRow.index);
          const isRowSelected = isSelected(rowId);
          const isRowFocused = focusedCell?.rowIndex === virtualRow.index;
          const isEditing = editRowId !== null && editRowId === rowId;

          const RowComponent = slots.row || DataGridRow;

          return (
            <RowComponent
              key={rowId}
              row={row}
              rowIndex={virtualRow.index}
              columns={columns}
              isSelected={isRowSelected}
              isFocused={isRowFocused}
              isEditing={isEditing}
              editRowData={isEditing ? editRowData : null}
              onEditChange={onEditChange}
              onSaveEdit={onSaveEdit}
              onCancelEdit={onCancelEdit}
              onStartEdit={onStartEdit}
              onDeleteRow={onDeleteRow}
              getRowId={getRowId}
              getRowValue={getRowValue}
              onRowClick={onRowClick}
              onRowDoubleClick={onRowDoubleClick}
              onSelectRow={toggleRowSelection}
              getRowClassName={getRowClassName}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualRow.start}px)`,
              }}
              api={api}
              {...slotProps.row}
            />
          );
        })}
      </div>
    );
  }

  // 5. Render danh sách dòng thông thường (Standard Static DOM)
  return (
    <div className="data-grid__body" role="rowgroup" style={minWidthStyle}>
      {rows.map((row, index) => {
        const rowId = getRowId ? getRowId(row) : (row.id ?? index);
        const isRowSelected = isSelected(rowId);
        const isRowFocused = focusedCell?.rowIndex === index;
        const isEditing = editRowId !== null && editRowId === rowId;

        const RowComponent = slots.row || DataGridRow;

        return (
          <RowComponent
            key={rowId}
            row={row}
            rowIndex={index}
            columns={columns}
            isSelected={isRowSelected}
            isFocused={isRowFocused}
            isEditing={isEditing}
            editRowData={isEditing ? editRowData : null}
            onEditChange={onEditChange}
            onSaveEdit={onSaveEdit}
            onCancelEdit={onCancelEdit}
            onStartEdit={onStartEdit}
            onDeleteRow={onDeleteRow}
            getRowId={getRowId}
            getRowValue={getRowValue}
            onRowClick={onRowClick}
            onRowDoubleClick={onRowDoubleClick}
            onSelectRow={toggleRowSelection}
            getRowClassName={getRowClassName}
            api={api}
            {...slotProps.row}
          />
        );
      })}
    </div>
  );
};

DataGridBody.propTypes = {
  rows: PropTypes.array.isRequired,
  rawTotalRowsCount: PropTypes.number,
  columns: PropTypes.array.isRequired,
  effectiveTotalWidth: PropTypes.number,
  loading: PropTypes.bool,
  error: PropTypes.any,
  onRetry: PropTypes.func,
  selectionState: PropTypes.object.isRequired,
  virtualizerState: PropTypes.object.isRequired,
  keyboardState: PropTypes.object.isRequired,
  editingState: PropTypes.object,
  getRowId: PropTypes.func,
  getRowValue: PropTypes.func,
  onRowClick: PropTypes.func,
  onRowDoubleClick: PropTypes.func,
  getRowClassName: PropTypes.func,
  slots: PropTypes.object,
  slotProps: PropTypes.object,
  api: PropTypes.object,
};

export default React.memo(DataGridBody);
