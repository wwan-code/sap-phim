/**
 * @file use-data-grid-sort.js
 * @module Admin/Shared/Components/DataDisplay/DataGrid/Hooks/UseDataGridSort
 * @description Hook quản lý sắp xếp đơn cột / đa cột (Single & Multi-column Sorting) cho DataGrid.
 */

import { useState, useCallback } from 'react';
import { SORT_DIRECTIONS } from '../data-grid.constants';

export const useDataGridSort = ({
  sortingMode = 'client',
  sortModel: controlledSortModel,
  onSortModelChange,
  disableMultiSort = false,
  multiSortKey = 'Ctrl',
}) => {
  // Uncontrolled fallback state
  const [internalSortModel, setInternalSortModel] = useState([]);

  const sortModel = controlledSortModel || internalSortModel;

  const setSortModel = useCallback(
    (newModel) => {
      const next = typeof newModel === 'function' ? newModel(sortModel) : newModel;
      if (onSortModelChange) {
        onSortModelChange(next);
      } else {
        setInternalSortModel(next);
      }
    },
    [sortModel, onSortModelChange]
  );

  /**
   * Chuyển đổi trạng thái sắp xếp của một cột theo chu kỳ: ASC -> DESC -> NONE
   */
  const handleSortColumn = useCallback(
    (field, event) => {
      const isMulti = !disableMultiSort && event && (event.ctrlKey || event.metaKey || event.shiftKey);
      const existingIndex = sortModel.findIndex((item) => item.field === field);
      const currentSort = existingIndex >= 0 ? sortModel[existingIndex].sort : null;

      let nextSort = null;
      if (!currentSort) {
        nextSort = SORT_DIRECTIONS.ASC;
      } else if (currentSort === SORT_DIRECTIONS.ASC) {
        nextSort = SORT_DIRECTIONS.DESC;
      } else {
        nextSort = null;
      }

      if (isMulti) {
        // Multi-column sorting
        if (!nextSort) {
          // Xóa cột khỏi sortModel nếu về NONE
          const updated = sortModel.filter((item) => item.field !== field);
          setSortModel(updated);
        } else if (existingIndex >= 0) {
          const updated = [...sortModel];
          updated[existingIndex] = { field, sort: nextSort };
          setSortModel(updated);
        } else {
          setSortModel([...sortModel, { field, sort: nextSort }]);
        }
      } else {
        // Single-column sorting
        if (!nextSort) {
          setSortModel([]);
        } else {
          setSortModel([{ field, sort: nextSort }]);
        }
      }
    },
    [disableMultiSort, sortModel, setSortModel]
  );

  /**
   * Lấy hướng sort và thứ tự ưu tiên (nếu có multi-sort) cho một cột
   */
  const getColumnSortInfo = useCallback(
    (field) => {
      const index = sortModel.findIndex((item) => item.field === field);
      if (index === -1) {
        return { sort: null, sortIndex: null };
      }
      return {
        sort: sortModel[index].sort,
        sortIndex: sortModel.length > 1 ? index + 1 : null,
      };
    },
    [sortModel]
  );

  return {
    sortingMode,
    sortModel,
    setSortModel,
    handleSortColumn,
    getColumnSortInfo,
    multiSortKey,
  };
};
