/**
 * @file DataGridColumnsPanel.jsx
 * @module Admin/Shared/Components/DataDisplay/DataGrid/Components/Panels/DataGridColumnsPanel
 * @description Floating Panel cho phép tìm kiếm và bật/tắt hiển thị các cột trong DataGrid
 * tái hiện 100% Mockup: Search Pill, Cyan Squircle Checkboxes, Show/Hide All và Reset button.
 */

import React, { useState, useMemo, memo } from 'react';
import PropTypes from 'prop-types';
import { Search, Check, Minus } from 'lucide-react';

import ButtonBase from '@/shared/components/ui/button-base';
import { normalizeSearchText } from '../../utils/data-grid-filters';

export const DataGridColumnsPanel = ({
  columns = [],
  columnVisibility = {},
  onToggleColumn,
  onSetAllColumnsVisibility,
  onResetColumns,
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  const hideableColumns = useMemo(() => {
    return (columns || []).filter(
      (c) => c.hideable !== false && c.field !== '__check__' && c.field !== '__actions__' && c.field !== 'actions' && c.field
    );
  }, [columns]);

  const filteredColumns = useMemo(() => {
    const norm = normalizeSearchText(searchTerm);
    if (!norm) return hideableColumns;
    return hideableColumns.filter((c) => {
      const name = c.headerName || c.field;
      return normalizeSearchText(name).includes(norm);
    });
  }, [hideableColumns, searchTerm]);

  // Đếm số lượng cột đang hiển thị
  const visibleCount = useMemo(() => {
    return hideableColumns.filter((c) => columnVisibility[c.field] !== false).length;
  }, [hideableColumns, columnVisibility]);

  const isAllVisible = hideableColumns.length > 0 && visibleCount === hideableColumns.length;
  const isIndeterminate = visibleCount > 0 && visibleCount < hideableColumns.length;

  const handleToggleAll = () => {
    if (isAllVisible) {
      onSetAllColumnsVisibility(false);
    } else {
      onSetAllColumnsVisibility(true);
    }
  };

  const handleReset = () => {
    if (onResetColumns) {
      onResetColumns();
    } else {
      onSetAllColumnsVisibility(true);
    }
  };

  return (
    <div
      className="data-grid-columns-popup"
      role="dialog"
      aria-label="Tùy chỉnh hiển thị cột"
    >
      {/* 1. Top Search Bar Pill */}
      <div className="data-grid-columns-popup__search-wrapper">
        <Search size={16} className="data-grid-columns-popup__search-icon" />
        <input
          type="text"
          className="data-grid-columns-popup__search-input"
          placeholder="Tìm kiếm..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          aria-label="Tìm kiếm cột"
        />
      </div>

      {/* 2. List of Columns with Squircle Checkboxes */}
      <div className="data-grid-columns-popup__list">
        {filteredColumns.map((col) => {
          const isVisible = columnVisibility[col.field] !== false;
          return (
            <ButtonBase
              key={col.field}
              className={`data-grid-columns-popup__item ${isVisible ? 'data-grid-columns-popup__item--checked' : ''}`}
              onClick={() => onToggleColumn?.(col.field)}
              aria-label={`Bật/tắt cột ${col.headerName || col.field}`}
              aria-checked={isVisible}
              role="checkbox"
            >
              <div className={`data-grid-columns-popup__checkbox ${isVisible ? 'data-grid-columns-popup__checkbox--checked' : ''}`}>
                {isVisible && <Check size={12} strokeWidth={3.5} />}
              </div>
              <span className="data-grid-columns-popup__label">
                {col.headerName || col.field}
              </span>
            </ButtonBase>
          );
        })}
      </div>

      {/* 3. Bottom Actions Footer: Show/Hide All & Reset */}
      <div className="data-grid-columns-popup__footer">
        <ButtonBase
          className="data-grid-columns-popup__toggle-all"
          onClick={handleToggleAll}
          aria-label="Hiện hoặc ẩn tất cả các cột"
        >
          <div
            className={`data-grid-columns-popup__checkbox ${
              isAllVisible || isIndeterminate ? 'data-grid-columns-popup__checkbox--checked' : ''
            }`}
          >
            {isAllVisible && <Check size={12} strokeWidth={3.5} />}
            {isIndeterminate && <Minus size={12} strokeWidth={3.5} />}
          </div>
          <span className="data-grid-columns-popup__footer-label">
            Hiện/Ẩn tất cả
          </span>
        </ButtonBase>

        <ButtonBase
          className="data-grid-columns-popup__reset-btn"
          onClick={handleReset}
          aria-label="Đặt lại hiển thị cột"
        >
          Đặt lại
        </ButtonBase>
      </div>
    </div>
  );
};

DataGridColumnsPanel.propTypes = {
  columns: PropTypes.array.isRequired,
  columnVisibility: PropTypes.object.isRequired,
  onToggleColumn: PropTypes.func.isRequired,
  onSetAllColumnsVisibility: PropTypes.func.isRequired,
  onResetColumns: PropTypes.func,
};

export default memo(DataGridColumnsPanel);



