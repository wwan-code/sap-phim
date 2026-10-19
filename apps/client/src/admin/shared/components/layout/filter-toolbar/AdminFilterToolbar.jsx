/**
 * @file AdminFilterToolbar.jsx
 * @module Admin/Shared/Components/Layout/FilterToolbar
 * @description Component thanh công cụ lọc và chuyển tab trạng thái chuẩn Red Pill Cinema (Material 3 Expressive), dùng chung thống nhất cho tất cả các trang quản trị Admin.
 */

import React, { memo } from 'react';
import './admin-filter-toolbar.scss';

/**
 * @typedef {Object} StatusTabItem
 * @property {string} id - Định danh duy nhất của tab
 * @property {string} label - Tiêu đề hiển thị của tab
 * @property {number} [count] - Số lượng mục thuộc tab này (tùy chọn)
 * @property {React.ReactNode} [icon] - Icon tiền tố (tùy chọn)
 * @property {boolean} [disabled] - Vô hiệu hóa tab
 */

/**
 * @component AdminFilterToolbar
 * @description Thanh công cụ kết hợp Status Tabs và Extra Filter Toolbar cho Admin
 * @param {Object} props
 * @param {StatusTabItem[]} [props.tabs=[]] - Danh sách các tab trạng thái
 * @param {string} props.activeTab - ID tab đang được chọn
 * @param {(tabId: string) => void} props.onTabChange - Hàm xử lý khi chuyển tab
 * @param {Record<string, number>} [props.counts] - Map số lượng theo tab ID
 * @param {React.ReactNode} [props.children] - Slot hiển thị các bộ lọc phụ bên phải (Select, DatePicker...)
 * @param {boolean} [props.bordered=true] - Hiển thị viền phân tách bên dưới
 * @param {string} [props.className=''] - Tùy biến class container
 */
export const AdminFilterToolbar = memo(({
  tabs = [],
  activeTab,
  onTabChange,
  counts = {},
  children,
  bordered = true,
  className = '',
}) => {
  return (
    <div
      className={`admin-filter-toolbar ${bordered ? 'admin-filter-toolbar--bordered' : ''} ${className}`.trim()}
    >
      {/* 1. Status Tabs List */}
      {tabs.length > 0 && (
        <div className="admin-filter-toolbar__tabs-container" role="tablist">
          <div className="admin-filter-toolbar__tabs-list">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              // Ưu tiên count khai báo trong tab, nếu không lấy từ map counts
              const tabCount = tab.count !== undefined ? tab.count : counts?.[tab.id];

              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  disabled={tab.disabled}
                  className={`admin-filter-toolbar__tab-btn ${
                    isActive ? 'admin-filter-toolbar__tab-btn--active' : ''
                  }`}
                  onClick={() => onTabChange?.(tab.id)}
                >
                  {tab.icon && (
                    <span className="admin-filter-toolbar__tab-icon">{tab.icon}</span>
                  )}
                  <span className="admin-filter-toolbar__tab-label">{tab.label}</span>
                  {tabCount !== undefined && tabCount !== null && (
                    <span className="admin-filter-toolbar__badge">{tabCount}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 2. Extra Filters Toolbar Slot */}
      {children && (
        <div className="admin-filter-toolbar__filters">
          {children}
        </div>
      )}
    </div>
  );
});

AdminFilterToolbar.displayName = 'AdminFilterToolbar';

export default AdminFilterToolbar;
