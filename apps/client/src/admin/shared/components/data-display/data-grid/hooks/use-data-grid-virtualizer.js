/**
 * @file use-data-grid-virtualizer.js
 * @module Admin/Shared/Components/DataDisplay/DataGrid/Hooks/UseDataGridVirtualizer
 * @description Hook tích hợp @tanstack/react-virtual cho Dynamic Hybrid Virtualization trong DataGrid.
 */

import { useMemo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ROW_HEIGHTS, GRID_DENSITIES } from '../data-grid.constants';

export const useDataGridVirtualizer = ({
  enabled = false,
  rowsCount = 0,
  density = GRID_DENSITIES.STANDARD,
  scrollElementRef,
  overscan = 5,
}) => {
  const estimatedRowHeight = ROW_HEIGHTS[density] || ROW_HEIGHTS[GRID_DENSITIES.STANDARD] || 52;

  const virtualizer = useVirtualizer({
    count: enabled ? rowsCount : 0,
    getScrollElement: () => scrollElementRef.current,
    estimateSize: () => estimatedRowHeight,
    overscan,
    enabled: enabled && rowsCount > 0,
  });

  const virtualRows = useMemo(() => {
    if (!enabled) return null;
    return virtualizer.getVirtualItems();
  }, [enabled, virtualizer]);

  const totalVirtualSize = useMemo(() => {
    if (!enabled) return 0;
    return virtualizer.getTotalSize();
  }, [enabled, virtualizer]);

  return {
    isVirtual: enabled,
    virtualizer,
    virtualRows,
    totalVirtualSize,
  };
};
