/**
 * @file DataGridSkeleton.jsx
 * @module Admin/Shared/Components/DataDisplay/DataGrid/Components/DataGridSkeleton
 * @description Hiệu ứng khung xương tải dữ liệu (Shimmer Skeleton) chuẩn tỷ lệ dòng cho DataGrid.
 * Sử dụng chính xác effectiveColumnWidths và effectiveTotalWidth, hỗ trợ 3 biến thể: Checkbox (18×18px),
 * Action icons (24×24px) và Text bar (65–85% width) chuẩn alignment.
 */

import React, { memo } from 'react';
import PropTypes from 'prop-types';

export const DataGridSkeleton = ({
  columns = [],
  columnsCount = 6,
  rowsCount = 8,
  effectiveTotalWidth,
}) => {
  const rows = Array.from({ length: rowsCount });
  const cols =
    Array.isArray(columns) && columns.length > 0
      ? columns
      : Array.from({ length: columnsCount }).map((_, i) => ({
          field: `col_${i}`,
          width: 140,
          minWidth: 80,
          computedWidth: 140,
          align: 'left',
        }));

  return (
    <div
      className="data-grid__body data-grid__body--skeleton"
      role="rowgroup"
      aria-busy="true"
      aria-label="Đang tải dữ liệu..."
      style={effectiveTotalWidth ? { minWidth: `${effectiveTotalWidth}px` } : undefined}
    >
      {rows.map((_, rIdx) => (
        <div key={rIdx} className="data-grid__row data-grid__row--skeleton" style={{ pointerEvents: 'none' }}>
          {cols.map((col, cIdx) => {
            const isCheckCol = col.field === '__check__';
            const isActionsCol = col.field === '__actions__' || col.field === 'actions';
            const align = col.align || 'left';

            const widthStyle = {
              width: col.computedWidth || col.width,
              minWidth: col.minWidth,
              maxWidth: col.maxWidth,
              flexShrink: 0,
              ...(isCheckCol ? { padding: 0 } : {}),
            };

            // Biến thể Checkbox: 18x18px
            if (isCheckCol) {
              return (
                <div
                  key={col.field || cIdx}
                  className="data-grid__cell data-grid__cell--align-center"
                  style={widthStyle}
                >
                  <div className="data-grid__skeleton data-grid__skeleton--checkbox" />
                </div>
              );
            }

            // Biến thể Actions: 24x24px
            if (isActionsCol) {
              return (
                <div
                  key={col.field || cIdx}
                  className={`data-grid__cell data-grid__cell--align-${align}`}
                  style={widthStyle}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: align === 'center' ? 'center' : align === 'left' ? 'flex-start' : 'flex-end',
                      gap: 6,
                      width: '100%',
                    }}
                  >
                    <div className="data-grid__skeleton data-grid__skeleton--action" />
                    <div className="data-grid__skeleton data-grid__skeleton--action" />
                  </div>
                </div>
              );
            }

            // Biến thể Text / Data Cell: Chiều dài ngẫu nhiên có kiểm soát từ 65% đến 85%
            const widthPercent = 65 + ((rIdx * 7 + cIdx * 13) % 21);

            return (
              <div
                key={col.field || cIdx}
                className={`data-grid__cell data-grid__cell--align-${align}`}
                style={widthStyle}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start',
                    width: '100%',
                  }}
                >
                  <div
                    className="data-grid__skeleton data-grid__skeleton--text"
                    style={{
                      width: `${widthPercent}%`,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
};

DataGridSkeleton.propTypes = {
  columns: PropTypes.array,
  columnsCount: PropTypes.number,
  rowsCount: PropTypes.number,
  effectiveTotalWidth: PropTypes.number,
};

export default memo(DataGridSkeleton);
