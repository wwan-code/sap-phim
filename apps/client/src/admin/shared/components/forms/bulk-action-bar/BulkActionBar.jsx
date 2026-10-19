import React from 'react';
import './bulk-action-bar.scss';

export function BulkActionBar({ selectedCount, onAction }) {
  if (!selectedCount) return null;

  return (
    <div className="bulk-action-bar">
      <span>Đã chọn {selectedCount} phần tử</span>
      <button onClick={onAction}>Hành động hàng loạt</button>
    </div>
  );
}

export default BulkActionBar;
