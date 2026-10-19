/**
 * @file DataGridSelectionBar.jsx
 * @module Admin/Shared/Components/DataDisplay/DataGrid/Components/DataGridSelectionBar
 * @description Thanh tác vụ hàng loạt nổi cố định dưới đáy màn hình (Bottom Dock) khi có dòng được chọn
 * tích hợp Badge, Button, IconButton, Tooltip và CircularProgress từ shared UI.
 */

import React, { memo } from 'react';
import PropTypes from 'prop-types';
import { X, Trash2, Download, CheckCircle2 } from 'lucide-react';

import Badge from '@/shared/components/ui/badge';
import Button from '@/shared/components/ui/button';
import IconButton from '@/shared/components/ui/icon-button';
import Tooltip from '@/shared/components/ui/tooltip';
import CircularProgress from '@/shared/components/ui/circular-progress';

import { BULK_ACTION_STATES } from '../data-grid.constants';

export const DataGridSelectionBar = ({
  selectedCount = 0,
  onClearSelection,
  onBulkDelete,
  onBulkExport,
  bulkActionState = BULK_ACTION_STATES.IDLE,
  customBulkActions,
}) => {
  if (selectedCount === 0) return null;

  return (
    <div
      className="data-grid__selection-bar"
      role="region"
      aria-label="Thanh tác vụ cho các dòng đã chọn"
    >
      <div className="data-grid__selection-bar-info">
        <Badge
          badgeContent={selectedCount}
          color="primary"
          className="data-grid__selection-bar-badge-comp"
        />
        <span style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--sp-color-text-primary)' }}>
          dòng đã chọn
        </span>
        <Tooltip title="Bỏ chọn tất cả">
          <IconButton
            size="small"
            variant="standard"
            onClick={onClearSelection}
            aria-label="Bỏ chọn tất cả"
            style={{ marginLeft: 4 }}
          >
            <X size={14} />
          </IconButton>
        </Tooltip>
      </div>

      <div className="data-grid__selection-bar-actions">
        {bulkActionState === BULK_ACTION_STATES.PROCESSING ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: '0.875rem' }}>
            <CircularProgress size={16} color="primary" /> Đang xử lý...
          </span>
        ) : bulkActionState === BULK_ACTION_STATES.SUCCESS ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--sp-color-status-success)', fontSize: '0.875rem', fontWeight: 600 }}>
            <CheckCircle2 size={16} /> Hoàn tất thành công
          </span>
        ) : (
          <>
            {customBulkActions}

            {onBulkExport && (
              <Button
                variant="tonal"
                size="small"
                startIcon={<Download size={14} />}
                onClick={onBulkExport}
              >
                Xuất đã chọn
              </Button>
            )}

            {onBulkDelete && (
              <Button
                variant="tonal"
                color="error"
                size="small"
                startIcon={<Trash2 size={14} />}
                onClick={onBulkDelete}
              >
                Xóa
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
};

DataGridSelectionBar.propTypes = {
  selectedCount: PropTypes.number.isRequired,
  onClearSelection: PropTypes.func.isRequired,
  onBulkDelete: PropTypes.func,
  onBulkExport: PropTypes.func,
  bulkActionState: PropTypes.string,
  customBulkActions: PropTypes.node,
};

export default memo(DataGridSelectionBar);

