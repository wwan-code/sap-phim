/**
 * @file DataGridColumnMenu.jsx
 * @module Admin/Shared/Components/DataDisplay/DataGrid/Components/Panels/DataGridColumnMenu
 * @description Context Menu cho từng cột dữ liệu tích hợp các hành động Sắp xếp, Ghim cột (Sticky),
 * Lọc dữ liệu, Ẩn cột và Quản lý cột theo chuẩn Material 3 Expressive.
 */

import React, { memo } from 'react';
import PropTypes from 'prop-types';
import {
  ArrowUp,
  ArrowDown,
  Pin,
  PinOff,
  Filter,
  EyeOff,
  SlidersHorizontal,
} from 'lucide-react';

import { SORT_DIRECTIONS } from '../../data-grid.constants';

export const DataGridColumnMenu = ({
  column,
  onSort,
  onPinColumn,
  onHideColumn,
  onOpenColumnsPanel,
  onOpenFilterPanel,
  onClose,
}) => {
  if (!column) return null;

  const isSortable = column.sortable !== false;
  const isHideable = column.hideable !== false;
  const isFilterable = column.filterable !== false;
  const isPinnedLeft = column.pinned === 'left';
  const isPinnedRight = column.pinned === 'right';

  return (
    <div className="data-grid-column-menu" role="menu" aria-label={`Tùy chọn cột ${column.headerName || column.field}`}>
      {/* 1. Sắp Xếp */}
      {isSortable && (
        <>
          <button
            type="button"
            className="data-grid-column-menu__item"
            role="menuitem"
            onClick={() => {
              onSort(column.field, { dir: SORT_DIRECTIONS.ASC });
              onClose();
            }}
          >
            <ArrowUp size={15} />
            <span>Sắp xếp tăng dần</span>
          </button>

          <button
            type="button"
            className="data-grid-column-menu__item"
            role="menuitem"
            onClick={() => {
              onSort(column.field, { dir: SORT_DIRECTIONS.DESC });
              onClose();
            }}
          >
            <ArrowDown size={15} />
            <span>Sắp xếp giảm dần</span>
          </button>

          <div className="data-grid-column-menu__divider" />
        </>
      )}

      {/* 2. Ghim Cột (Pin to Left / Pin to Right / Unpin) */}
      {isPinnedLeft ? (
        <>
          <button
            type="button"
            className="data-grid-column-menu__item"
            role="menuitem"
            onClick={() => {
              onPinColumn?.(column.field, false);
              onClose();
            }}
          >
            <PinOff size={15} />
            <span>Bỏ ghim</span>
          </button>

          <button
            type="button"
            className="data-grid-column-menu__item"
            role="menuitem"
            onClick={() => {
              onPinColumn?.(column.field, 'right');
              onClose();
            }}
          >
            <Pin size={15} />
            <span>Ghim sang phải</span>
          </button>
        </>
      ) : isPinnedRight ? (
        <>
          <button
            type="button"
            className="data-grid-column-menu__item"
            role="menuitem"
            onClick={() => {
              onPinColumn?.(column.field, 'left');
              onClose();
            }}
          >
            <Pin size={15} />
            <span>Ghim sang trái</span>
          </button>

          <button
            type="button"
            className="data-grid-column-menu__item"
            role="menuitem"
            onClick={() => {
              onPinColumn?.(column.field, false);
              onClose();
            }}
          >
            <PinOff size={15} />
            <span>Bỏ ghim</span>
          </button>
        </>
      ) : (
        <>
          <button
            type="button"
            className="data-grid-column-menu__item"
            role="menuitem"
            onClick={() => {
              onPinColumn?.(column.field, 'left');
              onClose();
            }}
          >
            <Pin size={15} />
            <span>Ghim sang trái</span>
          </button>

          <button
            type="button"
            className="data-grid-column-menu__item"
            role="menuitem"
            onClick={() => {
              onPinColumn?.(column.field, 'right');
              onClose();
            }}
          >
            <Pin size={15} />
            <span>Ghim sang phải</span>
          </button>
        </>
      )}

      <div className="data-grid-column-menu__divider" />

      {/* 3. Lọc Theo Cột Này */}
      {isFilterable && (
        <>
          <button
            type="button"
            className="data-grid-column-menu__item"
            role="menuitem"
            onClick={() => {
              onClose();
              onOpenFilterPanel?.(column.field);
            }}
          >
            <Filter size={15} />
            <span>Lọc dữ liệu</span>
          </button>

          <div className="data-grid-column-menu__divider" />
        </>
      )}

      {/* 4. Ẩn Cột Này */}
      {isHideable && (
        <button
          type="button"
          className="data-grid-column-menu__item"
          role="menuitem"
          onClick={() => {
            onHideColumn(column.field);
            onClose();
          }}
        >
          <EyeOff size={15} />
          <span>Ẩn cột</span>
        </button>
      )}

      {/* 5. Mở Bảng Quản Lý Cột */}
      <button
        type="button"
        className="data-grid-column-menu__item"
        role="menuitem"
        onClick={() => {
          onClose();
          onOpenColumnsPanel?.();
        }}
      >
        <SlidersHorizontal size={15} />
        <span>Quản lý cột</span>
      </button>
    </div>
  );
};

DataGridColumnMenu.propTypes = {
  column: PropTypes.object.isRequired,
  onSort: PropTypes.func.isRequired,
  onPinColumn: PropTypes.func,
  onHideColumn: PropTypes.func.isRequired,
  onOpenColumnsPanel: PropTypes.func,
  onOpenFilterPanel: PropTypes.func,
  onClose: PropTypes.func.isRequired,
};

export default memo(DataGridColumnMenu);


