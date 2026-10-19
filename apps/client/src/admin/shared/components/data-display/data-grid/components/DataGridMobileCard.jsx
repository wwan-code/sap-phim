/**
 * @file DataGridMobileCard.jsx
 * @module Admin/Shared/Components/DataDisplay/DataGrid/Components/DataGridMobileCard
 * @description Card View đại diện cho từng dòng dữ liệu khi hiển thị trên thiết bị di động (< 768px)
 * tích hợp IconButton và Tooltip từ shared UI.
 */

import React, { useState, memo } from 'react';
import PropTypes from 'prop-types';
import { ChevronDown, ChevronUp } from 'lucide-react';

import IconButton from '@/shared/components/ui/icon-button';
import Tooltip from '@/shared/components/ui/tooltip';

export const DataGridMobileCard = ({
  row,
  rowIndex,
  columns = [],
  isSelected = false,
  onSelectRow,
  getRowValue,
  checkboxSelection = false,
  renderMobileCard,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (renderMobileCard && typeof renderMobileCard === 'function') {
    return renderMobileCard({ row, rowIndex, isSelected, onSelectRow, isExpanded, setIsExpanded });
  }

  const primaryCol = columns.find((c) => c.field !== '__check__' && c.field !== '__actions__') || columns[0];
  const otherCols = columns.filter((c) => c.field !== '__check__' && c.field !== primaryCol?.field);

  const displayedCols = isExpanded ? otherCols : otherCols.slice(0, 3);

  const primaryValue = getRowValue ? getRowValue(row, primaryCol?.field, primaryCol) : row[primaryCol?.field];

  return (
    <div
      className={`data-grid__mobile-feed-card ${isSelected ? 'data-grid__mobile-feed-card--selected' : ''}`}
      role="article"
    >
      <div className="data-grid__mobile-feed-card-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {checkboxSelection && (
            <input
              type="checkbox"
              className="data-grid__cell-checkbox"
              checked={isSelected}
              onChange={(e) => onSelectRow(row, e)}
              aria-label={`Chọn dòng ${row.id || ''}`}
            />
          )}
          <span style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--sp-color-text-primary)' }}>
            {primaryCol?.renderCell
              ? primaryCol.renderCell({ value: primaryValue, row, field: primaryCol.field, column: primaryCol })
              : String(primaryValue ?? '—')}
          </span>
        </div>

        {otherCols.length > 3 && (
          <Tooltip title={isExpanded ? 'Thu gọn chi tiết' : 'Xem thêm chi tiết'}>
            <IconButton
              size="small"
              variant="standard"
              onClick={() => setIsExpanded((prev) => !prev)}
              aria-label={isExpanded ? 'Thu gọn chi tiết' : 'Xem thêm chi tiết'}
            >
              {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </IconButton>
          </Tooltip>
        )}
      </div>

      <div className="data-grid__mobile-feed-card-body">
        {displayedCols.map((col) => {
          const val = getRowValue ? getRowValue(row, col.field, col) : row[col.field];
          let formattedContent = val;

          if (col.renderCell && typeof col.renderCell === 'function') {
            formattedContent = col.renderCell({ value: val, row, field: col.field, column: col });
          } else if (col.valueFormatter && typeof col.valueFormatter === 'function') {
            formattedContent = col.valueFormatter({ value: val, row, field: col.field });
          } else if (val === null || val === undefined || val === '') {
            formattedContent = '—';
          }

          return (
            <div key={col.field} className="data-grid__mobile-feed-card-row">
              <span className="data-grid__mobile-feed-card-row-label">
                {col.headerName || col.field}:
              </span>
              <span className="data-grid__mobile-feed-card-row-value">{formattedContent}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

DataGridMobileCard.propTypes = {
  row: PropTypes.object.isRequired,
  rowIndex: PropTypes.number.isRequired,
  columns: PropTypes.array.isRequired,
  isSelected: PropTypes.bool,
  onSelectRow: PropTypes.func,
  getRowId: PropTypes.func,
  getRowValue: PropTypes.func,
  checkboxSelection: PropTypes.bool,
  renderMobileCard: PropTypes.func,
};

export default memo(DataGridMobileCard);

