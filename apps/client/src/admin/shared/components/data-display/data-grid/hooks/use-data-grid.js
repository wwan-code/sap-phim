/**
 * @file use-data-grid.js
 * @module Admin/Shared/Components/DataDisplay/DataGrid/Hooks/UseDataGrid
 * @description Hook điều phối trung tâm (Headless State Coordinator) tích hợp toàn bộ sub-hooks cho DataGrid.
 * Đo lường chính xác kích thước container qua ResizeObserver để tính toán độ rộng cột tự động làm đầy Viewport.
 */

import { useMemo, useCallback, useRef, useState, useEffect } from 'react';
import { GRID_DENSITIES } from '../data-grid.constants';
import { sortRows } from '../utils/data-grid-comparators';
import { filterRows } from '../utils/data-grid-filters';
import { useDataGridColumns } from './use-data-grid-columns';
import { useDataGridPagination } from './use-data-grid-pagination';
import { useDataGridSort } from './use-data-grid-sort';
import { useDataGridFilter } from './use-data-grid-filter';
import { useDataGridSelection } from './use-data-grid-selection';
import { useDataGridVirtualizer } from './use-data-grid-virtualizer';
import { useDataGridKeyboard } from './use-data-grid-keyboard';
import { useDataGridPersistence } from './use-data-grid-persistence';

export const useDataGrid = (props) => {
  const {
    rows: rawRows = [],
    columns: rawColumns = [],
    getRowId = (row) => row?.id ?? row?._id,
    
    // Persistence props
    storageKey,
    persistSettings = true,
    title,

    // Pagination props
    pagination = true,
    paginationMode = 'client',
    paginationModel,
    onPaginationModelChange,
    pageSizeOptions,
    rowCount,

    // Sorting props
    sortingMode = 'client',
    sortModel,
    onSortModelChange,
    disableMultiSort = false,
    multiSortKey = 'Ctrl',

    // Filter props
    filterMode = 'client',
    filterModel,
    onFilterModelChange,

    // Selection props
    checkboxSelection = false,
    rowSelectionModel,
    onRowSelectionModelChange,
    isRowSelectable,

    // Density
    density: initialDensity = GRID_DENSITIES.STANDARD,
    onDensityChange,

    // Column visibility
    columnVisibilityModel,
    onColumnVisibilityModelChange,

    // Virtualization
    virtualize = 'auto', // 'auto' | true | false
  } = props;

  // 0. Sub-hook: Persistence Engine (LocalStorage)
  const persistence = useDataGridPersistence({
    storageKey,
    title: typeof title === 'string' ? title : undefined,
    persistSettings,
  });

  // 1. Ref cuộn và đo lường kích thước Viewport của bảng (kèm threshold chống layout thrashing)
  const bodyScrollRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const lastWidthRef = useRef(0);

  useEffect(() => {
    const el = bodyScrollRef.current;
    if (!el) return;

    const updateWidth = (force = false) => {
      if (el) {
        const clientW = Math.floor(el.clientWidth);
        if (clientW > 0) {
          if (force || lastWidthRef.current === 0 || Math.abs(clientW - lastWidthRef.current) > 2) {
            lastWidthRef.current = clientW;
            setContainerWidth(clientW);
          }
        }
      }
    };

    updateWidth(true);

    let observer = null;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const width = Math.floor(entry.contentRect ? entry.contentRect.width : el.clientWidth);
          if (width > 0 && (lastWidthRef.current === 0 || Math.abs(width - lastWidthRef.current) > 2)) {
            lastWidthRef.current = width;
            setContainerWidth(width);
          }
        }
      });
      observer.observe(el);
    }
    
    window.addEventListener('resize', () => updateWidth(false));

    return () => {
      if (observer) {
        observer.disconnect();
      }
      window.removeEventListener('resize', () => updateWidth(false));
    };
  }, []);

  // 2. Density state (Hỗ trợ 2 chiều: Controlled & Uncontrolled, không lưu LocalStorage)
  const isControlledDensity = props.density !== undefined && typeof onDensityChange === 'function';
  const defaultDensity = props.density || initialDensity || GRID_DENSITIES.STANDARD;
  const [internalDensity, setInternalDensity] = useState(defaultDensity);

  // Chỉ đồng bộ khi Controlled Mode thực sự thay đổi giá trị từ props component cha
  const prevControlledDensityRef = useRef(isControlledDensity ? props.density : undefined);
  useEffect(() => {
    if (isControlledDensity && props.density !== prevControlledDensityRef.current) {
      prevControlledDensityRef.current = props.density;
      setInternalDensity(props.density);
    }
  }, [isControlledDensity, props.density]);

  const density = isControlledDensity ? props.density : internalDensity;

  const setDensity = useCallback(
    (newDensity) => {
      const validDensity = Object.values(GRID_DENSITIES).includes(newDensity) ? newDensity : GRID_DENSITIES.STANDARD;
      setInternalDensity(validDensity);
      if (onDensityChange) {
        onDensityChange(validDensity);
      }
    },
    [onDensityChange]
  );

  // 3. Helper lấy giá trị của một ô
  const getRowValue = useCallback((row, field, column) => {
    if (!row) return undefined;
    if (column?.valueGetter && typeof column.valueGetter === 'function') {
      return column.valueGetter({ value: row[field], row, field });
    }
    const val = row[field];
    if (val && typeof val === 'object') {
      if (val.name) return val.name;
      if (val.title) return val.title;
      if (Array.isArray(val)) {
        return val.map((v) => (typeof v === 'object' ? v.name || v.title || '' : String(v))).join(', ');
      }
    }
    return val;
  }, []);

  // 4. Sub-hook: Columns với Auto-Fill Viewport Width & Persistence & Pinning
  const columnsState = useDataGridColumns({
    columns: rawColumns,
    initialColumnVisibility: persistence.savedColumnVisibility || columnVisibilityModel || {},
    initialColumnWidths: persistence.savedColumnWidths || {},
    initialPinnedColumns: persistence.savedPinnedColumns || props.pinnedColumns || { left: [], right: [] },
    checkboxSelection,
    columnVisibilityModel,
    onColumnVisibilityModelChange,
    containerWidth,
    onSaveColumnVisibility: (model) => persistence.savePreference('columnVisibility', model),
    onSaveColumnWidths: (widths) => persistence.savePreference('columnWidths', widths),
    onSavePinnedColumns: (pinned) => persistence.savePreference('pinnedColumns', pinned),
  });

  // 5. Sub-hook: Sorting
  const sortState = useDataGridSort({
    sortingMode,
    sortModel,
    onSortModelChange,
    disableMultiSort,
    multiSortKey,
  });

  // 6. Sub-hook: Filtering
  const filterState = useDataGridFilter({
    filterMode,
    filterModel,
    onFilterModelChange,
  });

  // 7. Xử lý dữ liệu Client-side: Filter -> Sort
  const processedClientRows = useMemo(() => {
    let result = Array.isArray(rawRows) ? rawRows : [];

    // Client filtering / Hybrid Column Filter
    if (
      filterMode === 'client' ||
      (Array.isArray(filterState.filterModel?.items) && filterState.filterModel.items.length > 0)
    ) {
      result = filterRows(result, filterState.filterModel, columnsState.columns, getRowValue);
    }

    // Client sorting
    if (sortingMode === 'client') {
      result = sortRows(result, sortState.sortModel, columnsState.columnMap, getRowValue);
    }

    return result;
  }, [
    rawRows,
    filterMode,
    filterState.filterModel,
    columnsState.columns,
    columnsState.columnMap,
    sortingMode,
    sortState.sortModel,
    getRowValue,
  ]);

  // 8. Sub-hook: Pagination & Persistence
  const paginationState = useDataGridPagination({
    pagination,
    paginationMode,
    paginationModel,
    onPaginationModelChange,
    pageSizeOptions,
    rowCount,
    totalClientRows: processedClientRows.length,
    initialPageSize: persistence.savedPageSize,
    onSavePageSize: (size) => persistence.savePreference('pageSize', size),
  });

  // 9. Cắt lát dữ liệu theo trang hiện tại (Current Page Rows)
  const currentPageRows = useMemo(() => {
    if (paginationMode === 'server' || !pagination) {
      return processedClientRows;
    }
    const { start, end } = paginationState.clientPageSlice;
    return processedClientRows.slice(start, end);
  }, [paginationMode, pagination, processedClientRows, paginationState.clientPageSlice]);

  // 10. Sub-hook: Selection
  const selectionState = useDataGridSelection({
    checkboxSelection,
    rowSelectionModel,
    onRowSelectionModelChange,
    isRowSelectable,
    getRowId,
    rows: currentPageRows,
  });

  // 11. Virtualization: Xác định bật ảo hóa nếu số lượng dòng trang hiện tại lớn (>50) hoặc bật tường minh
  const shouldVirtualize = useMemo(() => {
    if (virtualize === true) return true;
    if (virtualize === false) return false;
    return currentPageRows.length > 50;
  }, [virtualize, currentPageRows.length]);

  const virtualizerState = useDataGridVirtualizer({
    enabled: shouldVirtualize,
    rowsCount: currentPageRows.length,
    density,
    scrollElementRef: bodyScrollRef,
  });

  // 12. Sub-hook: Keyboard Navigation
  const keyboardState = useDataGridKeyboard({
    rowCount: currentPageRows.length,
    colCount: columnsState.visibleColumns.length,
    onSelectRow: selectionState.toggleRowSelection,
    pageRows: currentPageRows,
  });

  // 13. Đặt lại mặc định (Reset Preferences)
  const resetPreferences = useCallback(() => {
    persistence.clearSavedPreferences();
    setInternalDensity(initialDensity || GRID_DENSITIES.STANDARD);
    columnsState.resetColumns();
    paginationState.handlePageSizeChange(10);
  }, [persistence, initialDensity, columnsState, paginationState]);

  // 14. Điều phối Floating Panels tập trung (Columns, Filter, Density, Export)
  const [activePanel, setActivePanel] = useState(null);
  const [panelContext, setPanelContext] = useState(null);

  const openColumnsPanel = useCallback(() => {
    setActivePanel('columns');
  }, []);

  const openFilterPanel = useCallback(
    (targetField) => {
      if (targetField) {
        filterState.upsertFilterItem({
          field: targetField,
          operator: 'contains',
          value: '',
        });
        setPanelContext({ targetField });
      }
      setActivePanel('filter');
    },
    [filterState]
  );

  const closePanel = useCallback(() => {
    setActivePanel(null);
    setPanelContext(null);
  }, []);

  return {
    // Data
    rawRows,
    processedRows: processedClientRows,
    currentPageRows,
    getRowId,
    getRowValue,
    density,
    setDensity,
    bodyScrollRef,
    containerWidth,
    resetPreferences,
    persistence,

    // Sub-hook states
    columnsState,
    sortState,
    filterState,
    paginationState,
    selectionState,
    virtualizerState,
    keyboardState,

    // Panel coordination state
    activePanel,
    setActivePanel,
    panelContext,
    openColumnsPanel,
    openFilterPanel,
    closePanel,
  };
};

export default useDataGrid;

