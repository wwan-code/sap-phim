/**
 * @file DataGridNoResults.jsx
 * @module Admin/Shared/Components/DataDisplay/DataGrid/Components/DataGridNoResults
 * @description Trạng thái tìm kiếm/bộ lọc không tìm thấy kết quả phù hợp tích hợp Button chuẩn Material 3 Expressive.
 */

import React, { memo } from 'react';
import PropTypes from 'prop-types';
import { SearchX } from 'lucide-react';

import Button from '@/shared/components/ui/button';

export const DataGridNoResults = ({
  title = 'Không tìm thấy kết quả',
  description = 'Không có bản ghi nào khớp với điều kiện lọc hoặc từ khóa tìm kiếm của bạn.',
  onClearFilters,
}) => {
  return (
    <div className="data-grid__state-container" role="status">
      <SearchX size={44} className="data-grid__state-container-icon" strokeWidth={1.5} />
      <h3 className="data-grid__state-container-title">{title}</h3>
      <p className="data-grid__state-container-description">{description}</p>
      {onClearFilters && (
        <Button
          variant="outlined"
          size="small"
          onClick={onClearFilters}
          style={{ marginTop: 8 }}
        >
          Xóa bộ lọc tìm kiếm
        </Button>
      )}
    </div>
  );
};

DataGridNoResults.propTypes = {
  title: PropTypes.node,
  description: PropTypes.node,
  onClearFilters: PropTypes.func,
};

export default memo(DataGridNoResults);

