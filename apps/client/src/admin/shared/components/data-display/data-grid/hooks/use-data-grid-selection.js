/**
 * @file use-data-grid-selection.js
 * @module Admin/Shared/Components/DataDisplay/DataGrid/Hooks/UseDataGridSelection
 * @description Hook quản lý chọn dòng đơn/nhiều dòng (Row Selection, Select All, Range Selection) cho DataGrid.
 */

import { useState, useMemo, useCallback, useRef } from 'react';
import { BULK_ACTION_STATES } from '../data-grid.constants';

export const useDataGridSelection = ({
  checkboxSelection = false,
  rowSelectionModel: controlledSelection,
  onRowSelectionModelChange,
  isRowSelectable,
  getRowId = (row) => row?.id,
  rows = [],
}) => {
  const isControlled = controlledSelection !== undefined && typeof onRowSelectionModelChange === 'function';
  // Uncontrolled state fallback (Array of IDs)
  const [internalSelection, setInternalSelection] = useState(() => (Array.isArray(controlledSelection) ? controlledSelection : []));
  const lastSelectedRowIdRef = useRef(null);

  const rowSelectionModel = isControlled ? controlledSelection : internalSelection;

  const setRowSelectionModel = useCallback(
    (newModel) => {
      const next = typeof newModel === 'function' ? newModel(rowSelectionModel) : newModel;
      if (isControlled) {
        onRowSelectionModelChange?.(next);
      } else {
        setInternalSelection(next);
        onRowSelectionModelChange?.(next);
      }
    },
    [isControlled, rowSelectionModel, onRowSelectionModelChange]
  );

  const selectedSet = useMemo(() => new Set(rowSelectionModel), [rowSelectionModel]);

  const isSelected = useCallback((id) => selectedSet.has(id), [selectedSet]);

  /**
   * Chuyển đổi trạng thái chọn của một dòng
   */
  const toggleRowSelection = useCallback(
    (row, event) => {
      const rowId = getRowId(row);
      if (isRowSelectable && !isRowSelectable(row)) return;

      const isShift = event?.shiftKey && lastSelectedRowIdRef.current;

      if (isShift && rows.length > 0) {
        // Range selection
        const lastIdx = rows.findIndex((r) => getRowId(r) === lastSelectedRowIdRef.current);
        const currIdx = rows.findIndex((r) => getRowId(r) === rowId);

        if (lastIdx !== -1 && currIdx !== -1) {
          const start = Math.min(lastIdx, currIdx);
          const end = Math.max(lastIdx, currIdx);
          const rangeIds = rows
            .slice(start, end + 1)
            .filter((r) => !isRowSelectable || isRowSelectable(r))
            .map((r) => getRowId(r));

          const merged = Array.from(new Set([...rowSelectionModel, ...rangeIds]));
          setRowSelectionModel(merged);
          lastSelectedRowIdRef.current = rowId;
          return;
        }
      }

      if (selectedSet.has(rowId)) {
        const next = rowSelectionModel.filter((id) => id !== rowId);
        setRowSelectionModel(next);
      } else {
        setRowSelectionModel([...rowSelectionModel, rowId]);
      }
      lastSelectedRowIdRef.current = rowId;
    },
    [getRowId, isRowSelectable, rows, selectedSet, rowSelectionModel, setRowSelectionModel]
  );

  /**
   * Chọn hoặc bỏ chọn toàn bộ danh sách dòng hiện tại (trên trang)
   */
  const toggleSelectAll = useCallback(
    (pageRows) => {
      const selectableRows = pageRows.filter((r) => !isRowSelectable || isRowSelectable(r));
      const selectableIds = selectableRows.map((r) => getRowId(r));

      const isAllPageSelected = selectableIds.length > 0 && selectableIds.every((id) => selectedSet.has(id));

      if (isAllPageSelected) {
        // Bỏ chọn tất cả các dòng trên trang này
        const remaining = rowSelectionModel.filter((id) => !selectableIds.includes(id));
        setRowSelectionModel(remaining);
      } else {
        // Chọn tất cả các dòng trên trang này
        const merged = Array.from(new Set([...rowSelectionModel, ...selectableIds]));
        setRowSelectionModel(merged);
      }
    },
    [isRowSelectable, getRowId, selectedSet, rowSelectionModel, setRowSelectionModel]
  );

  /**
   * Xóa toàn bộ selection
   */
  const clearSelection = useCallback(() => {
    setRowSelectionModel([]);
    lastSelectedRowIdRef.current = null;
  }, [setRowSelectionModel]);

  /**
   * Kiểm tra trạng thái checkbox Header (checked / indeterminate)
   */
  const getHeaderCheckboxState = useCallback(
    (pageRows) => {
      const selectableRows = pageRows.filter((r) => !isRowSelectable || isRowSelectable(r));
      if (selectableRows.length === 0) {
        return { isChecked: false, isIndeterminate: false };
      }

      const selectableIds = selectableRows.map((r) => getRowId(r));
      const selectedCount = selectableIds.filter((id) => selectedSet.has(id)).length;

      const isChecked = selectedCount === selectableIds.length && selectableIds.length > 0;
      const isIndeterminate = selectedCount > 0 && selectedCount < selectableIds.length;

      return { isChecked, isIndeterminate };
    },
    [isRowSelectable, getRowId, selectedSet]
  );

  // Bulk action state management
  const [bulkActionState, setBulkActionState] = useState(BULK_ACTION_STATES.IDLE);

  return {
    checkboxSelection,
    rowSelectionModel,
    selectedCount: rowSelectionModel.length,
    bulkActionState,
    setBulkActionState,
    setRowSelectionModel,
    isSelected,
    toggleRowSelection,
    toggleSelectAll,
    clearSelection,
    getHeaderCheckboxState,
  };
};
