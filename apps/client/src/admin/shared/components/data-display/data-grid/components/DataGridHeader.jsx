/**
 * @file DataGridHeader.jsx
 * @module Admin/Shared/Components/DataDisplay/DataGrid/Components/DataGridHeader
 * @description Header của bảng DataGrid chuẩn Mockup Gogo MUI-X: Sticky Header, 6px checkbox và Column Menu.
 */

import React, { useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import DataGridHeaderCell from './DataGridHeaderCell';

export const DataGridHeader = ({
  columnsState,
  sortState,
  selectionState,
  currentPageRows = [],
  onOpenColumnsPanel,
  onOpenFilterPanel,
  onPinColumn,
}) => {
  const { visibleColumns, effectiveTotalWidth, handleColumnResize, handleToggleColumn } = columnsState;
  const { handleSortColumn, getColumnSortInfo } = sortState;
  const { toggleSelectAll, getHeaderCheckboxState, checkboxSelection } = selectionState;

  const checkboxRef = useRef(null);
  const { isChecked, isIndeterminate } = getHeaderCheckboxState(currentPageRows);

  useEffect(() => {
    if (checkboxRef.current) {
      checkboxRef.current.indeterminate = isIndeterminate;
    }
  }, [isIndeterminate]);

  const headerCheckboxElement = checkboxSelection ? (
    <input
      ref={checkboxRef}
      type="checkbox"
      className="data-grid__cell-checkbox"
      checked={isChecked}
      onChange={() => toggleSelectAll(currentPageRows)}
      aria-label="Chọn hoặc bỏ chọn tất cả các dòng trên trang này"
    />
  ) : null;

  return (
    <div
      className="data-grid__header"
      role="row"
      style={{
        width: '100%',
        minWidth: effectiveTotalWidth ? `${effectiveTotalWidth}px` : '100%',
      }}
    >
      {visibleColumns.map((col, index) => {
        const isCheckCol = col.field === '__check__';
        const isLastColumn = index === visibleColumns.length - 1;
        const sortInfo = getColumnSortInfo(col.field);

        return (
          <DataGridHeaderCell
            key={col.field}
            column={col}
            sortInfo={sortInfo}
            onSort={handleSortColumn}
            onResize={handleColumnResize}
            onResetColumnWidth={columnsState.handleResetColumnWidth}
            onHideColumn={handleToggleColumn}
            onOpenColumnsPanel={onOpenColumnsPanel}
            onOpenFilterPanel={onOpenFilterPanel}
            onPinColumn={onPinColumn || columnsState.handlePinColumn}
            isCheckboxColumn={isCheckCol}
            isLastColumn={isLastColumn}
            headerCheckbox={isCheckCol ? headerCheckboxElement : null}
          />
        );
      })}
    </div>
  );
};

DataGridHeader.propTypes = {
  columnsState: PropTypes.object.isRequired,
  sortState: PropTypes.object.isRequired,
  selectionState: PropTypes.object.isRequired,
  currentPageRows: PropTypes.array,
  onOpenColumnsPanel: PropTypes.func,
  onOpenFilterPanel: PropTypes.func,
  onPinColumn: PropTypes.func,
};

export default React.memo(DataGridHeader);
