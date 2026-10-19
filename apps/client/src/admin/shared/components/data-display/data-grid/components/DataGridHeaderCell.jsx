/**
 * @file DataGridHeaderCell.jsx
 * @module Admin/Shared/Components/DataDisplay/DataGrid/Components/DataGridHeaderCell
 * @description Ô tiêu đề cột chuẩn Mockup Gogo MUI-X: Subtle vertical column divider (14px),
 * indicator sắp xếp tinh tế, nút 3 chấm mở Column Menu với IconButton, Tooltip và FloatingPortal.
 * Tự động ẩn Resize Handle trên cột cuối cùng, cột checkbox và cột actions; kéo giãn cột mượt mà.
 */

import React, { useRef, useState, useCallback, useEffect, memo } from 'react';
import PropTypes from 'prop-types';
import { ArrowUp, ArrowDown, MoreVertical } from 'lucide-react';
import { useFloating, offset, flip, shift, autoUpdate, FloatingPortal } from '@floating-ui/react';

import IconButton from '@/shared/components/ui/icon-button';
import Tooltip from '@/shared/components/ui/tooltip';

import DataGridColumnMenu from './panels/DataGridColumnMenu';
import { SORT_DIRECTIONS } from '../data-grid.constants';

// Các cột đặc biệt không được resize và không hiển thị menu ngữ cảnh
const NON_INTERACTIVE_HEADER_FIELDS = new Set(['__check__', '__actions__', 'actions']);

export const DataGridHeaderCell = ({
  column,
  sortInfo,
  onSort,
  onResize,
  onResetColumnWidth,
  onHideColumn,
  onOpenColumnsPanel,
  onOpenFilterPanel,
  onPinColumn,
  isCheckboxColumn = false,
  isLastColumn = false,
  headerCheckbox = null,
}) => {
  const cellRef = useRef(null);
  const [isResizing, setIsResizing] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Floating Context Menu
  const { refs, floatingStyles } = useFloating({
    open: isMenuOpen,
    onOpenChange: setIsMenuOpen,
    middleware: [offset(4), flip(), shift({ padding: 12 })],
    whileElementsMounted: autoUpdate,
    placement: 'bottom-start',
  });

  // Click-outside listener for floating column menu in portal
  useEffect(() => {
    if (!isMenuOpen) return;

    const handlePointerDownOutside = (event) => {
      const refEl = refs.reference?.current;
      const floatEl = refs.floating?.current;

      if (refEl && refEl.contains(event.target)) return;
      if (floatEl && floatEl.contains(event.target)) return;

      setIsMenuOpen(false);
    };

    document.addEventListener('pointerdown', handlePointerDownOutside, true);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDownOutside, true);
    };
  }, [isMenuOpen, refs]);

  // Xử lý kéo giãn kích thước cột (Window-level drag with RAF throttling & Cursor lock)
  const handleResizePointerDown = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();

      setIsResizing(true);
      if (typeof document !== 'undefined') {
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
      }

      const startX = e.clientX;
      const initialWidth = cellRef.current?.getBoundingClientRect().width || column.width || 120;

      let rafId = null;

      const handlePointerMove = (moveEvent) => {
        if (rafId) cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(() => {
          const delta = moveEvent.clientX - startX;
          const min = column.minWidth || 60;
          const max = column.maxWidth || 800;
          const newWidth = Math.max(min, Math.min(max, initialWidth + delta));
          onResize(column.field, newWidth);
        });
      };

      const handlePointerUp = () => {
        if (rafId) cancelAnimationFrame(rafId);
        setIsResizing(false);
        if (typeof document !== 'undefined') {
          document.body.style.cursor = '';
          document.body.style.userSelect = '';
        }
        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('pointerup', handlePointerUp);
        window.removeEventListener('pointercancel', handlePointerUp);
      };

      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
      window.addEventListener('pointercancel', handlePointerUp);
    },
    [column, onResize]
  );

  const isPinnedLeft = Boolean(column.isPinnedLeft);
  const isPinnedRight = Boolean(column.isPinnedRight);
  const stickyStyle = isPinnedLeft
    ? { position: 'sticky', left: column.stickyLeft ?? 0, zIndex: 11 }
    : isPinnedRight
    ? { position: 'sticky', right: column.stickyRight ?? 0, zIndex: 11 }
    : {};

  const pinnedClass = isPinnedLeft
    ? 'data-grid__header-cell--pinned-left'
    : isPinnedRight
    ? 'data-grid__header-cell--pinned-right'
    : '';

  const dividerClass = column.isLastPinnedLeft
    ? 'data-grid__header-cell--pinned-left-last'
    : column.isFirstPinnedRight
    ? 'data-grid__header-cell--pinned-right-first'
    : '';

  // Cột Checkbox
  if (isCheckboxColumn) {
    return (
      <div
        ref={cellRef}
        className={`data-grid__header-cell data-grid__header-cell--align-center ${pinnedClass} ${dividerClass}`}
        style={{
          width: column.width || 48,
          minWidth: column.width || 48,
          maxWidth: column.width || 48,
          flexShrink: 0,
          padding: 0,
          ...stickyStyle,
          zIndex: isPinnedLeft ? 12 : undefined,
        }}
        role="columnheader"
        aria-label="Chọn tất cả các dòng"
      >
        {headerCheckbox}
      </div>
    );
  }

  const { sort } = sortInfo || { sort: null };
  const isSortable = column.sortable !== false;

  // Độ rộng pixel chuẩn hóa từ thuật toán Auto-Fill Column Width
  const widthStyle = {
    width: column.width,
    minWidth: column.minWidth,
    maxWidth: column.maxWidth,
    flexShrink: 0,
    ...stickyStyle,
  };

  const alignClass = `data-grid__header-cell--align-${column.headerAlign || column.align || 'left'}`;
  const sortClass = sort ? 'data-grid__header-cell--sorted' : '';
  const sortableClass = isSortable ? 'data-grid__header-cell--sortable' : '';

  const ariaSortValue = sort === SORT_DIRECTIONS.ASC ? 'ascending' : sort === SORT_DIRECTIONS.DESC ? 'descending' : 'none';

  // Kiểm tra cột có phải dạng đặc biệt (actions, checkbox) không
  const isSpecialCol = NON_INTERACTIVE_HEADER_FIELDS.has(column.field);

  // Resize chỉ khi:
  // 1. Cột có column.resizable !== false
  // 2. Không phải cột đặc biệt (__check__, __actions__, actions)
  // 3. Không phải cột cuối cùng trong bảng (isLastColumn !== true)
  const isResizable = column.resizable !== false && !isSpecialCol && !isLastColumn;

  return (
    <div
      ref={cellRef}
      className={`data-grid__header-cell ${alignClass} ${sortClass} ${sortableClass} ${pinnedClass} ${dividerClass}`}
      style={widthStyle}
      role="columnheader"
      aria-sort={ariaSortValue}
      onClick={(e) => isSortable && !isSpecialCol && onSort(column.field, e)}
    >
      <span className="data-grid__header-cell-title">
        {column.renderHeader ? column.renderHeader({ column }) : (column.headerName || column.field)}
      </span>

      {/* Indicator sắp xếp */}
      {isSortable && sort && (
        <span className="data-grid__header-cell-sort-icon">
          {sort === SORT_DIRECTIONS.ASC ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
        </span>
      )}

      {/* 3-dots Context Menu Button — ẩn hoàn toàn trên cột actions / __check__ */}
      {!isSpecialCol && (
        <Tooltip title={`Tùy chọn cột ${column.headerName || column.field}`}>
          <button
            ref={refs.setReference}
            type="button"
            className={`data-grid__header-cell-menu-btn ${isMenuOpen ? 'data-grid__header-cell-menu-btn--open' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              setIsMenuOpen((prev) => !prev);
            }}
            aria-label={`Tùy chọn cho cột ${column.headerName || column.field}`}
          >
            <MoreVertical size={14} />
          </button>
        </Tooltip>
      )}

      {/* Resize Handle — ẩn trên cột cuối cùng, cột actions, __check__ */}
      {isResizable && (
        <div
          className={`data-grid__header-cell-resizer ${isResizing ? 'data-grid__header-cell-resizer--active' : ''}`}
          onPointerDown={handleResizePointerDown}
          onDoubleClick={(e) => {
            e.stopPropagation();
            onResetColumnWidth?.(column.field);
          }}
          onClick={(e) => e.stopPropagation()}
          title="Kéo để đổi độ rộng (Nhấp đúp để tự động cân chỉnh)"
        />
      )}

      {/* Floating Column Menu */}
      {isMenuOpen && (
        <FloatingPortal>
          <div
            ref={refs.setFloating}
            style={{ ...floatingStyles, zIndex: 1300 }}
            onClick={(e) => e.stopPropagation()}
          >
            <DataGridColumnMenu
              column={column}
              onSort={(field, opt) => onSort(field, opt)}
              onPinColumn={onPinColumn}
              onHideColumn={onHideColumn}
              onOpenColumnsPanel={onOpenColumnsPanel}
              onOpenFilterPanel={onOpenFilterPanel}
              onClose={() => setIsMenuOpen(false)}
            />
          </div>
        </FloatingPortal>
      )}
    </div>
  );
};

DataGridHeaderCell.propTypes = {
  column: PropTypes.object.isRequired,
  sortInfo: PropTypes.object,
  onSort: PropTypes.func.isRequired,
  onResize: PropTypes.func.isRequired,
  onResetColumnWidth: PropTypes.func,
  onHideColumn: PropTypes.func,
  onOpenColumnsPanel: PropTypes.func,
  onOpenFilterPanel: PropTypes.func,
  onPinColumn: PropTypes.func,
  isCheckboxColumn: PropTypes.bool,
  isLastColumn: PropTypes.bool,
  headerCheckbox: PropTypes.node,
};

export default memo(DataGridHeaderCell);

