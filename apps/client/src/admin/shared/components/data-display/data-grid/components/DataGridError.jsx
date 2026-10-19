/**
 * @file DataGridError.jsx
 * @module Admin/Shared/Components/DataDisplay/DataGrid/Components/DataGridError
 * @description Trạng thái lỗi tải dữ liệu từ máy chủ kèm nút thử lại tích hợp Button chuẩn Material 3 Expressive.
 */

import React, { memo } from 'react';
import PropTypes from 'prop-types';
import { AlertTriangle, RotateCw } from 'lucide-react';

import Button from '@/shared/components/ui/button';

export const DataGridError = ({
  error,
  title = 'Không thể tải dữ liệu',
  description,
  onRetry,
}) => {
  const errorMessage =
    description ||
    (typeof error === 'string'
      ? error
      : error?.message || 'Đã có lỗi xảy ra trong quá trình truy vấn dữ liệu từ máy chủ.');

  return (
    <div className="data-grid__state-container" role="alert">
      <AlertTriangle
        size={44}
        className="data-grid__state-container-icon"
        style={{ color: 'var(--sp-color-status-error)' }}
        strokeWidth={1.5}
      />
      <h3 className="data-grid__state-container-title">{title}</h3>
      <p className="data-grid__state-container-description">{errorMessage}</p>
      {onRetry && (
        <Button
          variant="tonal"
          color="primary"
          size="small"
          startIcon={<RotateCw size={14} />}
          onClick={onRetry}
          style={{ marginTop: 8 }}
        >
          Thử lại
        </Button>
      )}
    </div>
  );
};

DataGridError.propTypes = {
  error: PropTypes.any,
  title: PropTypes.node,
  description: PropTypes.node,
  onRetry: PropTypes.func,
};

export default memo(DataGridError);

