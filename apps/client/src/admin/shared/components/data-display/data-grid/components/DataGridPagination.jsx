/**
 * @file DataGridPagination.jsx
 * @module Admin/Shared/Components/DataDisplay/DataGrid/Components/DataGridPagination
 * @description Thanh Footer chuẩn Mockup Gogo MUI-X: Số dòng đã chọn góc trái,
 * Phân trang số tròn góc phải tích hợp IconButton và Tooltip từ shared UI.
 */

/**
 * @file DataGridPagination.jsx
 * @module Admin/Shared/Components/DataDisplay/DataGrid/Components/DataGridPagination
 * @description Thanh Footer DataGrid chuẩn Mockup Material 3 Expressive:
 * - Góc trái: Đếm số dòng đã chọn
 * - Góc phải: Bộ chọn số dòng (Dòng 10 ⌵) với Floating Dropdown, Vạch ngăn cách,
 *   Đoạn chữ phạm vi bản ghi (1-10 trên 30) và các nút chuyển trang tròn tích hợp Tooltip.
 */

import React, { memo } from 'react';
import PropTypes from 'prop-types';
import { ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';

import { useFloatingDropdown } from '@/hooks/ui/use-floating-dropdown';
import IconButton from '@/shared/components/ui/icon-button';
import Tooltip from '@/shared/components/ui/tooltip';

export const DataGridPagination = ({ paginationState, selectionCount = 0 }) => {
  const {
    pagination,
    page,
    pageSize,
    pageCount,
    rowCount,
    pageSizeOptions = [10, 20, 50, 100],
    handlePageChange,
    handlePageSizeChange,
  } = paginationState;

  // Sử dụng hook floating dropdown chuẩn toàn dự án
  const dropdown = useFloatingDropdown({
    placement: 'top-start',
    trigger: 'click',
    offset: 6,
    adaptToDevice: false,
    zIndex: 1300,
  });

  if (!pagination) return null;

  // Tính danh sách số trang hiển thị
  const pageNumbers = [];
  const maxDisplayedPages = 5;
  let startPage = Math.max(1, page - 2);
  let endPage = Math.min(pageCount, startPage + maxDisplayedPages - 1);

  if (endPage - startPage + 1 < maxDisplayedPages) {
    startPage = Math.max(1, endPage - maxDisplayedPages + 1);
  }

  for (let i = startPage; i <= endPage; i++) {
    pageNumbers.push(i);
  }

  // Format phạm vi dòng hiển thị: '1-10 trên 30'
  const rangeText = (() => {
    if (rowCount === 0) return '0 dòng';
    const start = (page - 1) * pageSize + 1;
    const end = Math.min(page * pageSize, rowCount);
    return `${start}-${end} trên ${rowCount}`;
  })();

  const handleSelectPageSize = (size) => {
    handlePageSizeChange(size);
    dropdown.setIsOpen(false);
  };

  return (
    <div className="data-grid__footer" role="navigation" aria-label="Phân trang DataGrid">
      {/* 1. Left Side: Selected Rows Count */}
      <div className="data-grid__footer-selected-text">
        {selectionCount > 0 ? `${selectionCount} dòng đã chọn` : ''}
      </div>

      {/* 2. Right Side: Page size + Range text + Pagination controls */}
      <div className="data-grid__footer-right-group">
        {/* Page Size Selector & Range Indicator */}
        <div className="data-grid__footer-info-group">
          {/* Page Size Trigger (Dòng 10 ⌵) */}
          <button
            ref={dropdown.refs.setReference}
            type="button"
            className={`data-grid__footer-page-size-btn ${dropdown.isOpen ? 'data-grid__footer-page-size-btn--open' : ''}`}
            {...dropdown.getReferenceProps()}
            aria-label="Chọn số dòng mỗi trang"
          >
            <span className="data-grid__footer-page-size-label">Dòng</span>
            <span className="data-grid__footer-page-size-value">{pageSize}</span>
            <ChevronDown size={13} className="data-grid__footer-page-size-icon" />
          </button>

          {/* Vertical Divider */}
          <div className="data-grid__footer-divider" />

          {/* Record Range Text */}
          <span className="data-grid__footer-range-text">{rangeText}</span>
        </div>

        {/* Circular Page Numbers & Chevrons */}
        <div className="data-grid__footer-pagination-group">
          <Tooltip title="Trang trước">
            <IconButton
              size="small"
              variant="standard"
              disabled={page <= 1}
              onClick={() => handlePageChange(page - 1)}
              aria-label="Trang trước"
            >
              <ChevronLeft size={16} />
            </IconButton>
          </Tooltip>

          {pageNumbers.map((num) => {
            const isActive = num === page;
            return (
              <button
                key={num}
                type="button"
                className={`data-grid__footer-page-circle-btn ${isActive ? 'data-grid__footer-page-circle-btn--active' : ''}`}
                onClick={() => handlePageChange(num)}
                aria-label={`Trang ${num}`}
                aria-current={isActive ? 'page' : undefined}
              >
                {num}
              </button>
            );
          })}

          <Tooltip title="Trang sau">
            <IconButton
              size="small"
              variant="standard"
              disabled={page >= pageCount}
              onClick={() => handlePageChange(page + 1)}
              aria-label="Trang sau"
            >
              <ChevronRight size={16} />
            </IconButton>
          </Tooltip>
        </div>
      </div>

      {/* Floating Page Size Menu Popup */}
      {dropdown.isMounted && (
        <dropdown.FloatingPortal>
          <div
            ref={dropdown.refs.setFloating}
            className="data-grid-page-size-menu"
            style={dropdown.floatingStyles}
            {...dropdown.getFloatingProps()}
            role="menu"
            aria-label="Tùy chọn số dòng"
          >
            {pageSizeOptions.map((size) => {
              const isSelected = size === pageSize;
              return (
                <button
                  key={size}
                  type="button"
                  className={`data-grid-page-size-menu__item ${isSelected ? 'data-grid-page-size-menu__item--active' : ''}`}
                  onClick={() => handleSelectPageSize(size)}
                  role="menuitem"
                  aria-pressed={isSelected}
                >
                  {size}
                </button>
              );
            })}
          </div>
        </dropdown.FloatingPortal>
      )}
    </div>
  );
};

DataGridPagination.propTypes = {
  paginationState: PropTypes.object.isRequired,
  selectionCount: PropTypes.number,
};

export default memo(DataGridPagination);

