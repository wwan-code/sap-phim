/**
 * @file use-data-grid-pagination.js
 * @module Admin/Shared/Components/DataDisplay/DataGrid/Hooks/UseDataGridPagination
 * @description Hook quản lý phân trang client-side & server-side cho DataGrid.
 */

import { useState, useMemo, useCallback } from 'react';
import { DEFAULT_PAGE_SIZES } from '../data-grid.constants';

export const useDataGridPagination = ({
  pagination = true,
  paginationMode = 'client',
  paginationModel: controlledPaginationModel,
  onPaginationModelChange,
  pageSizeOptions = DEFAULT_PAGE_SIZES,
  rowCount: controlledRowCount,
  totalClientRows = 0,
  initialPageSize,
  onSavePageSize,
}) => {
  // Uncontrolled state fallback
  const [internalPaginationModel, setInternalPaginationModel] = useState({
    page: 1,
    pageSize: initialPageSize || pageSizeOptions[1] || 20,
  });

  const paginationModel = controlledPaginationModel || internalPaginationModel;

  const setPaginationModel = useCallback(
    (newModel) => {
      const next = typeof newModel === 'function' ? newModel(paginationModel) : newModel;
      if (onPaginationModelChange) {
        onPaginationModelChange(next);
      } else {
        setInternalPaginationModel(next);
      }
    },
    [paginationModel, onPaginationModelChange]
  );

  const effectiveRowCount = paginationMode === 'server' ? (controlledRowCount ?? 0) : totalClientRows;

  const pageCount = useMemo(() => {
    if (!pagination || paginationModel.pageSize <= 0) return 1;
    return Math.max(1, Math.ceil(effectiveRowCount / paginationModel.pageSize));
  }, [pagination, effectiveRowCount, paginationModel.pageSize]);

  // Đảm bảo page hiện tại không vượt quá pageCount
  const currentPage = Math.min(Math.max(1, paginationModel.page), pageCount);

  const handlePageChange = useCallback(
    (newPage) => {
      const targetPage = Math.min(Math.max(1, newPage), pageCount);
      setPaginationModel({
        ...paginationModel,
        page: targetPage,
      });
    },
    [pageCount, paginationModel, setPaginationModel]
  );

  const handlePageSizeChange = useCallback(
    (newPageSize) => {
      const size = Number(newPageSize);
      setPaginationModel({
        page: 1, // Reset về trang 1 khi đổi page size
        pageSize: size,
      });
      onSavePageSize?.(size);
    },
    [setPaginationModel, onSavePageSize]
  );

  // Tính toán phạm vi dòng hiển thị cho Client Mode
  const clientPageSlice = useMemo(() => {
    if (!pagination || paginationMode === 'server') {
      return { start: 0, end: totalClientRows };
    }
    const start = (currentPage - 1) * paginationModel.pageSize;
    const end = Math.min(start + paginationModel.pageSize, totalClientRows);
    return { start, end };
  }, [pagination, paginationMode, currentPage, paginationModel.pageSize, totalClientRows]);

  const rowRangeText = useMemo(() => {
    if (effectiveRowCount === 0) return '0 dòng';
    const start = (currentPage - 1) * paginationModel.pageSize + 1;
    const end = Math.min(currentPage * paginationModel.pageSize, effectiveRowCount);
    return `${start}-${end} trên ${effectiveRowCount}`;
  }, [currentPage, paginationModel.pageSize, effectiveRowCount]);

  return {
    pagination,
    paginationMode,
    page: currentPage,
    pageSize: paginationModel.pageSize,
    pageCount,
    rowCount: effectiveRowCount,
    pageSizeOptions,
    clientPageSlice,
    rowRangeText,
    setPaginationModel,
    handlePageChange,
    handlePageSizeChange,
  };
};
