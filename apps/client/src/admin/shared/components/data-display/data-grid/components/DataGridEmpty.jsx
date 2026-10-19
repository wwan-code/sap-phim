/**
 * @file DataGridEmpty.jsx
 * @module Admin/Shared/Components/DataDisplay/DataGrid/Components/DataGridEmpty
 * @description Trạng thái bảng hoàn toàn trống (Empty State - No Data) chuẩn Material 3 Expressive.
 */

import React, { memo } from 'react';
import PropTypes from 'prop-types';
import { Database } from 'lucide-react';

export const DataGridEmpty = ({
  title = 'Chưa có dữ liệu',
  description = 'Hiện tại bảng chưa có bản ghi nào để hiển thị.',
  action,
}) => {
  return (
    <div className="data-grid__state-container" role="status">
      <Database size={44} className="data-grid__state-container-icon" strokeWidth={1.5} />
      <h3 className="data-grid__state-container-title">{title}</h3>
      <p className="data-grid__state-container-description">{description}</p>
      {action && <div style={{ marginTop: 12 }}>{action}</div>}
    </div>
  );
};

DataGridEmpty.propTypes = {
  title: PropTypes.node,
  description: PropTypes.node,
  action: PropTypes.node,
};

export default memo(DataGridEmpty);

