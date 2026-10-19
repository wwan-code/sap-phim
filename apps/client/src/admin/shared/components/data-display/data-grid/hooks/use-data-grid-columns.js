/**
 * @file use-data-grid-columns.js
 * @module Admin/Shared/Components/DataDisplay/DataGrid/Hooks/useDataGridColumns
 * @description Hook quản lý schema cột: Ẩn/hiện cột (Column Visibility), Thay đổi kích thước (Column Resizing)
 * và thuật toán Phân bổ Chiều rộng Tự Động (Auto-Fill Column Width Algorithm) lấp đầy 100% Viewport chuẩn MUI X.
 */

import { useState, useMemo, useCallback } from 'react';
import {
  COLUMN_WIDTH_CONSTRAINTS,
  COLUMN_ALIGNMENTS,
} from '../data-grid.constants';

/**
 * @hook useDataGridColumns
 * @param {object} params
 * @param {Array} params.columns - Danh sách cấu hình cột từ props
 * @param {object} params.initialColumnVisibility - Trạng thái ẩn hiện ban đầu { [field]: boolean }
 * @param {object} params.initialColumnWidths - Kích thước ban đầu { [field]: number }
 * @param {boolean} params.checkboxSelection - Có bật cột checkbox đầu bảng không
 * @param {number} params.containerWidth - Chiều rộng đo được của khung chứa bảng (Viewport)
 * @returns {object} Trạng thái và handler quản lý cột
 */
export const useDataGridColumns = ({
  columns: rawColumns = [],
  initialColumnVisibility = {},
  initialColumnWidths = {},
  initialPinnedColumns = { left: [], right: [] },
  checkboxSelection = false,
  containerWidth = 0,
  onSaveColumnVisibility,
  onSaveColumnWidths,
  onSavePinnedColumns,
}) => {
  // State ẩn/hiện cột (Column Visibility)
  const [columnVisibility, setColumnVisibility] = useState(initialColumnVisibility);

  const handleToggleColumn = useCallback(
    (field) => {
      setColumnVisibility((prev) => {
        const current = prev[field] !== undefined ? prev[field] : true;
        const next = {
          ...prev,
          [field]: !current,
        };
        onSaveColumnVisibility?.(next);
        return next;
      });
    },
    [onSaveColumnVisibility]
  );

  const setColumnVisibilityModel = useCallback(
    (model) => {
      setColumnVisibility((prev) => {
        const next = {
          ...prev,
          ...model,
        };
        onSaveColumnVisibility?.(next);
        return next;
      });
    },
    [onSaveColumnVisibility]
  );

  const setAllColumnsVisibility = useCallback(
    (visible) => {
      const updated = {};
      rawColumns.forEach((col) => {
        if (col.hideable !== false && col.field !== '__check__' && col.field !== '__actions__' && col.field !== 'actions') {
          updated[col.field] = visible;
        } else {
          updated[col.field] = true;
        }
      });
      setColumnVisibility(updated);
      onSaveColumnVisibility?.(updated);
    },
    [rawColumns, onSaveColumnVisibility]
  );

  // State độ rộng cột (Column Resizing)
  const [columnWidths, setColumnWidths] = useState(initialColumnWidths);

  const handleColumnResize = useCallback(
    (field, newWidth) => {
      setColumnWidths((prev) => {
        const min = COLUMN_WIDTH_CONSTRAINTS.MIN;
        const max = COLUMN_WIDTH_CONSTRAINTS.MAX;
        const clamped = Math.max(min, Math.min(max, newWidth));
        const next = { ...prev, [field]: clamped };
        onSaveColumnWidths?.(next);
        return next;
      });
    },
    [onSaveColumnWidths]
  );

  const handleResetColumnWidth = useCallback(
    (field) => {
      setColumnWidths((prev) => {
        const next = { ...prev };
        delete next[field];
        onSaveColumnWidths?.(next);
        return next;
      });
    },
    [onSaveColumnWidths]
  );

  // State ghim cột (Column Pinning: Left / Right)
  const [pinnedColumns, setPinnedColumns] = useState(() => initialPinnedColumns || { left: [], right: [] });

  const handlePinColumn = useCallback(
    (field, position) => {
      setPinnedColumns((prev) => {
        const left = (prev?.left || []).filter((f) => f !== field);
        const right = (prev?.right || []).filter((f) => f !== field);

        if (position === 'left') {
          left.push(field);
        } else if (position === 'right') {
          right.push(field);
        }

        const next = { left, right };
        onSavePinnedColumns?.(next);
        return next;
      });
    },
    [onSavePinnedColumns]
  );

  const resetColumns = useCallback(() => {
    setColumnVisibility(initialColumnVisibility || {});
    setColumnWidths(initialColumnWidths || {});
    setPinnedColumns(initialPinnedColumns || { left: [], right: [] });
  }, [initialColumnVisibility, initialColumnWidths, initialPinnedColumns]);

  // 1. Chuẩn hóa và thêm cột checkbox nếu bật selection
  const processedColumns = useMemo(() => {
    const cols = [];

    if (checkboxSelection) {
      cols.push({
        field: '__check__',
        headerName: '',
        width: COLUMN_WIDTH_CONSTRAINTS.CHECKBOX,
        minWidth: COLUMN_WIDTH_CONSTRAINTS.CHECKBOX,
        maxWidth: COLUMN_WIDTH_CONSTRAINTS.CHECKBOX,
        pinned: 'left',
        sortable: false,
        filterable: false,
        resizable: false,
        hideable: false,
        align: COLUMN_ALIGNMENTS.CENTER,
        headerAlign: COLUMN_ALIGNMENTS.CENTER,
      });
    }

    rawColumns.forEach((col) => {
      const field = col.field;
      const isResized = typeof columnWidths[field] === 'number';
      const userWidth = isResized ? columnWidths[field] : col.width;
      const isActionsField = field === '__actions__' || field === 'actions';

      let pinned = false;
      if (pinnedColumns?.left?.includes(field)) {
        pinned = 'left';
      } else if (pinnedColumns?.right?.includes(field)) {
        pinned = 'right';
      } else if (col.pinned) {
        pinned = col.pinned;
      }

      cols.push({
        ...col,
        pinned,
        align: col.align || (col.type === 'number' ? COLUMN_ALIGNMENTS.RIGHT : COLUMN_ALIGNMENTS.LEFT),
        headerAlign: col.headerAlign || col.align || (col.type === 'number' ? COLUMN_ALIGNMENTS.RIGHT : COLUMN_ALIGNMENTS.LEFT),
        minWidth: col.minWidth || COLUMN_WIDTH_CONSTRAINTS.MIN,
        maxWidth: col.maxWidth || COLUMN_WIDTH_CONSTRAINTS.MAX,
        width: userWidth,
        flex: isResized ? undefined : col.flex,
        sortable: col.sortable !== false && !isActionsField,
        filterable: col.filterable !== false && !isActionsField,
        resizable: col.resizable !== false && field !== '__check__' && !isActionsField,
        hideable: col.hideable !== false && field !== '__check__' && !isActionsField,
      });
    });

    return cols;
  }, [checkboxSelection, rawColumns, columnWidths, pinnedColumns]);

  // 2. Thuật toán Phân bổ Chiều rộng Tự Động Chuẩn MUI-X kết hợp Nhóm Ghim & Sticky Offset
  const visibleColumns = useMemo(() => {
    const rawVisible = processedColumns.filter((col) => {
      if (col.field === '__check__') return true;
      if (col.hideable === false) return true;
      return columnVisibility[col.field] !== false;
    });

    if (rawVisible.length === 0) return [];

    // Nhóm thứ tự hiển thị: Left Pinned -> Unpinned -> Right Pinned
    const leftPinnedCols = [];
    const unpinnedCols = [];
    const rightPinnedCols = [];

    rawVisible.forEach((col) => {
      if (col.pinned === 'left') {
        leftPinnedCols.push(col);
      } else if (col.pinned === 'right') {
        rightPinnedCols.push(col);
      } else {
        unpinnedCols.push(col);
      }
    });

    const orderedVisible = [...leftPinnedCols, ...unpinnedCols, ...rightPinnedCols];

    let totalFlexFactor = 0;

    // Phân loại cột (Fixed, Resized, Flex, Elastic)
    const columnMeta = orderedVisible.map((col) => {
      const field = col.field;
      const isCheckbox = field === '__check__';
      const isActions = field === '__actions__' || field === 'actions';
      const isResized = typeof columnWidths[field] === 'number';
      const isFixedExplicit = typeof col.width === 'number' && !col.flex;

      const minWidth = col.minWidth || (isCheckbox ? 48 : isActions ? 90 : COLUMN_WIDTH_CONSTRAINTS.MIN);
      const maxWidth = col.maxWidth || (isCheckbox ? 48 : COLUMN_WIDTH_CONSTRAINTS.MAX);

      if (isCheckbox) {
        return { col, isFlex: false, isElastic: false, baseWidth: 48, minWidth: 48, maxWidth: 48 };
      }

      if (isActions) {
        const actW = col.width || 90;
        return { col, isFlex: false, isElastic: false, baseWidth: actW, minWidth: actW, maxWidth: actW };
      }

      if (isResized) {
        const userW = Math.max(minWidth, Math.min(maxWidth, columnWidths[field]));
        const isContentCol = col.type !== 'number' && col.type !== 'boolean' && col.type !== 'date';
        return { col, isFlex: false, isElastic: isContentCol, baseWidth: userW, minWidth, maxWidth };
      }

      if (isFixedExplicit) {
        const fixW = Math.max(minWidth, Math.min(maxWidth, col.width));
        return { col, isFlex: false, isElastic: false, baseWidth: fixW, minWidth, maxWidth };
      }

      // Cột co giãn (Flex) chưa bị resize thủ công: Tính flexFactor chuẩn
      const flexFactor = typeof col.flex === 'number' && col.flex > 0 ? col.flex : 1;
      totalFlexFactor += flexFactor;
      return { col, isFlex: true, isElastic: true, flexFactor, baseWidth: minWidth, minWidth, maxWidth };
    });

    const unresizedFlexItems = columnMeta.filter((item) => item.isFlex);
    const fixedItems = columnMeta.filter((item) => !item.isFlex);

    const fixedWidthSum = fixedItems.reduce((acc, item) => acc + item.baseWidth, 0);
    const allocations = {};

    if (unresizedFlexItems.length > 0) {
      const availableForFlex = Math.max(0, containerWidth - fixedWidthSum);

      if (availableForFlex > 0 && containerWidth > 0 && totalFlexFactor > 0) {
        // Bước 1: Phân bổ theo tỷ lệ FLEX FACTOR chuẩn MUI-X
        let allocatedFlexSum = 0;

        unresizedFlexItems.forEach((item) => {
          const idealW = (item.flexFactor / totalFlexFactor) * availableForFlex;
          const clampedW = Math.max(item.minWidth, Math.min(item.maxWidth, Math.floor(idealW)));
          allocations[item.col.field] = clampedW;
          allocatedFlexSum += clampedW;
        });

        // Bước 2: Phân phối phần pixel dư (remainder pixels) qua Round-robin để khít 100% mép phải Viewport
        let remainder = Math.floor(containerWidth - (fixedWidthSum + allocatedFlexSum));
        if (remainder > 0) {
          for (let i = 0; i < unresizedFlexItems.length && remainder > 0; i++) {
            const item = unresizedFlexItems[i];
            if (allocations[item.col.field] < item.maxWidth) {
              allocations[item.col.field] += 1;
              remainder -= 1;
            }
          }
        }
      } else {
        // Trường hợp container thu hẹp hoặc fixedWidthSum lớn: giữ an toàn minWidth
        unresizedFlexItems.forEach((item) => {
          allocations[item.col.field] = item.minWidth;
        });
      }
    } else {
      // Trường hợp TẤT CẢ các cột flex đều đã bị kéo tay hoặc là cột fixed
      const currentTotalFixed = fixedWidthSum;
      const extraSpace = Math.max(0, containerWidth - currentTotalFixed);

      // Nếu còn khoảng trống lớn hơn màn hình: Phân bổ extraSpace cho các cột nội dung để luôn khít 100% Viewport
      if (extraSpace > 0 && containerWidth > 0) {
        const elasticItems = columnMeta.filter((item) => item.isElastic);
        const targetItems =
          elasticItems.length > 0
            ? elasticItems
            : columnMeta.filter(
                (i) => i.col.field !== '__check__' && i.col.field !== '__actions__' && i.col.field !== 'actions'
              );

        if (targetItems.length > 0) {
          const extraPerCol = Math.floor(extraSpace / targetItems.length);
          let extraAllocated = 0;

          targetItems.forEach((item) => {
            const additional = Math.max(0, Math.min(item.maxWidth - item.baseWidth, extraPerCol));
            allocations[item.col.field] = item.baseWidth + additional;
            extraAllocated += additional;
          });

          let remainder = extraSpace - extraAllocated;
          if (remainder > 0) {
            for (let i = 0; i < targetItems.length && remainder > 0; i++) {
              const item = targetItems[i];
              const cur = allocations[item.col.field] || item.baseWidth;
              if (cur < item.maxWidth) {
                allocations[item.col.field] = cur + 1;
                remainder -= 1;
              }
            }
          }
        }
      }
    }

    // Bước 3: Gắn computedWidth vào từng cột
    const columnsWithWidth = orderedVisible.map((col) => {
      const field = col.field;
      let computedWidth;

      if (allocations[field] !== undefined) {
        computedWidth = allocations[field];
      } else if (typeof columnWidths[field] === 'number') {
        computedWidth = columnWidths[field];
      } else if (typeof col.width === 'number') {
        computedWidth = col.width;
      } else {
        computedWidth = col.minWidth || COLUMN_WIDTH_CONSTRAINTS.DEFAULT;
      }

      return {
        ...col,
        computedWidth,
        width: computedWidth,
      };
    });

    // Bước 4: Tính toán sticky offsets và cờ phân tách cho các cột ghim (MUI X Enterprise Pinning)
    const leftCols = columnsWithWidth.filter((c) => c.pinned === 'left');
    const rightCols = columnsWithWidth.filter((c) => c.pinned === 'right');

    let currentLeftOffset = 0;
    const leftOffsetMap = {};
    leftCols.forEach((c) => {
      leftOffsetMap[c.field] = currentLeftOffset;
      currentLeftOffset += (c.computedWidth || c.width || 0);
    });

    let currentRightOffset = 0;
    const rightOffsetMap = {};
    for (let i = rightCols.length - 1; i >= 0; i--) {
      const c = rightCols[i];
      rightOffsetMap[c.field] = currentRightOffset;
      currentRightOffset += (c.computedWidth || c.width || 0);
    }

    const lastLeftField = leftCols.length > 0 ? leftCols[leftCols.length - 1].field : null;
    const firstRightField = rightCols.length > 0 ? rightCols[0].field : null;

    return columnsWithWidth.map((col) => {
      const isPinnedLeft = col.pinned === 'left';
      const isPinnedRight = col.pinned === 'right';

      return {
        ...col,
        isPinnedLeft,
        isPinnedRight,
        isLastPinnedLeft: col.field === lastLeftField,
        isFirstPinnedRight: col.field === firstRightField,
        stickyLeft: isPinnedLeft ? leftOffsetMap[col.field] : undefined,
        stickyRight: isPinnedRight ? rightOffsetMap[col.field] : undefined,
      };
    });
  }, [processedColumns, columnVisibility, columnWidths, containerWidth]);

  // Tổng chiều rộng thực tế của tất cả các cột (Single source of truth cho header/body/skeleton)
  const effectiveTotalWidth = useMemo(() => {
    const sum = visibleColumns.reduce((acc, col) => acc + (col.computedWidth || col.width || 0), 0);
    return Math.max(containerWidth, sum);
  }, [visibleColumns, containerWidth]);

  // Map tra cứu nhanh cấu hình cột theo field
  const columnMap = useMemo(() => {
    const map = {};
    visibleColumns.forEach((col) => {
      map[col.field] = col;
    });
    return map;
  }, [visibleColumns]);

  return {
    columns: processedColumns,
    allColumns: processedColumns,
    visibleColumns,
    effectiveTotalWidth,
    columnMap,
    columnVisibility,
    columnWidths,
    pinnedColumns,
    handlePinColumn,
    handleToggleColumn,
    toggleColumnVisibility: handleToggleColumn,
    setColumnVisibilityModel,
    setAllColumnsVisibility,
    handleColumnResize,
    handleResetColumnWidth,
    resetColumns,
  };
};

export default useDataGridColumns;



