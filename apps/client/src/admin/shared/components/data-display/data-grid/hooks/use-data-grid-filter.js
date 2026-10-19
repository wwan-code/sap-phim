/**
 * @file use-data-grid-filter.js
 * @module Admin/Shared/Components/DataDisplay/DataGrid/Hooks/UseDataGridFilter
 * @description Hook quản lý tìm kiếm nhanh (Quick Filter) và bộ lọc theo trường (Column Filters) cho DataGrid.
 */

import { useState, useMemo, useCallback } from 'react';
import { FILTER_OPERATORS } from '../data-grid.constants';

export const useDataGridFilter = ({
  filterMode = 'client',
  filterModel: controlledFilterModel,
  onFilterModelChange,
}) => {
  // Uncontrolled state fallback
  const [internalFilterModel, setInternalFilterModel] = useState({
    items: [],
    quickFilterValues: [],
    logicOperator: 'and',
  });

  const filterModel = controlledFilterModel || internalFilterModel;

  const setFilterModel = useCallback(
    (newModel) => {
      const next = typeof newModel === 'function' ? newModel(filterModel) : newModel;
      if (onFilterModelChange) {
        onFilterModelChange(next);
      } else {
        setInternalFilterModel(next);
      }
    },
    [filterModel, onFilterModelChange]
  );

  /**
   * Cập nhật từ khóa tìm kiếm nhanh
   */
  const handleQuickFilterChange = useCallback(
    (searchText) => {
      const keywords = searchText ? [searchText] : [];
      setFilterModel({
        ...filterModel,
        quickFilterValues: keywords,
      });
    },
    [filterModel, setFilterModel]
  );

  /**
   * Thêm hoặc cập nhật một điều kiện lọc cột
   */
  const upsertFilterItem = useCallback(
    (item) => {
      const currentItems = filterModel.items || [];
      const filterId = item.id || `filter_${item.field}_${Date.now()}`;
      const existingIndex = currentItems.findIndex((i) => i.id === filterId || i.field === item.field);

      let updatedItems = [];
      if (existingIndex >= 0) {
        updatedItems = [...currentItems];
        updatedItems[existingIndex] = { ...item, id: filterId };
      } else {
        updatedItems = [...currentItems, { ...item, id: filterId }];
      }

      setFilterModel({
        ...filterModel,
        items: updatedItems,
      });
    },
    [filterModel, setFilterModel]
  );

  /**
   * Xóa một điều kiện lọc
   */
  const removeFilterItem = useCallback(
    (idOrField) => {
      const currentItems = filterModel.items || [];
      const updated = currentItems.filter((i) => i.id !== idOrField && i.field !== idOrField);
      setFilterModel({
        ...filterModel,
        items: updated,
      });
    },
    [filterModel, setFilterModel]
  );

  /**
   * Xóa toàn bộ bộ lọc
   */
  const clearAllFilters = useCallback(() => {
    setFilterModel({
      items: [],
      quickFilterValues: [],
      logicOperator: 'and',
    });
  }, [setFilterModel]);

  /**
   * Đếm số lượng bộ lọc đang có hiệu lực
   */
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filterModel.quickFilterValues?.length > 0 && filterModel.quickFilterValues.some((v) => Boolean(v?.trim?.()))) {
      count += 1;
    }
    const activeColumnItems = (filterModel.items || []).filter(
      (i) => i.field && (i.operator === FILTER_OPERATORS.IS_EMPTY || i.operator === FILTER_OPERATORS.IS_NOT_EMPTY || (i.value !== undefined && i.value !== ''))
    );
    count += activeColumnItems.length;
    return count;
  }, [filterModel]);

  const quickFilterText = (filterModel.quickFilterValues && filterModel.quickFilterValues[0]) || '';

  return {
    filterMode,
    filterModel,
    quickFilterText,
    activeFiltersCount,
    setFilterModel,
    handleQuickFilterChange,
    upsertFilterItem,
    removeFilterItem,
    clearAllFilters,

    // Alias backward-compatible cho consumer API (DataGridToolbar, DataGridFilterPanel)
    setQuickFilterText: handleQuickFilterChange,
    clearFilters: clearAllFilters,
    activeFilterCount: activeFiltersCount,
  };
};
