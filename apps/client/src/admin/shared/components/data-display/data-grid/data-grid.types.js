/**
 * @file data-grid.types.js
 * @module Admin/Shared/Components/DataDisplay/DataGrid/Types
 * @description Định nghĩa các JSDoc types cho hệ thống DataGrid (The Aesthetic OS).
 */

/**
 * @typedef {'left' | 'center' | 'right'} ColumnAlignment
 */

/**
 * @typedef {'asc' | 'desc' | null} SortDirection
 */

/**
 * @typedef {'compact' | 'standard' | 'comfortable'} GridDensity
 */

/**
 * @typedef {'client' | 'server'} DataGridMode
 */

/**
 * @typedef {Object} GridSortItem
 * @property {string} field - Tên trường cần sort
 * @property {'asc' | 'desc'} sort - Hướng sort
 */

/**
 * @typedef {GridSortItem[]} GridSortModel
 */

/**
 * @typedef {Object} GridFilterItem
 * @property {string} [id] - ID duy nhất của điều kiện lọc
 * @property {string} field - Tên trường lọc
 * @property {string} operator - Toán tử (contains, equals, gt, lt, in...)
 * @property {any} value - Giá trị lọc
 */

/**
 * @typedef {Object} GridFilterModel
 * @property {GridFilterItem[]} [items] - Danh sách điều kiện lọc
 * @property {string[]} [quickFilterValues] - Từ khóa tìm kiếm nhanh
 * @property {'and' | 'or'} [logicOperator] - Toán tử logic kết hợp
 */

/**
 * @typedef {Object} GridPaginationModel
 * @property {number} page - Trang hiện tại (1-indexed)
 * @property {number} pageSize - Số dòng trên mỗi trang
 */

/**
 * @typedef {Object} GridColumnDef
 * @property {string} field - Tên thuộc tính trong row object
 * @property {string} [headerName] - Tiêu đề cột hiển thị
 * @property {string} [description] - Mô tả tooltip cho tiêu đề cột
 * @property {number} [width] - Chiều rộng cố định (px)
 * @property {number} [minWidth] - Chiều rộng tối thiểu (px)
 * @property {number} [maxWidth] - Chiều rộng tối đa (px)
 * @property {number} [flex] - Tỉ lệ co giãn flexbox
 * @property {ColumnAlignment} [align='left'] - Căn lề nội dung ô
 * @property {ColumnAlignment} [headerAlign='left'] - Căn lề tiêu đề cột
 * @property {boolean} [sortable=true] - Cho phép sắp xếp
 * @property {boolean} [filterable=true] - Cho phép lọc
 * @property {boolean} [resizable=true] - Cho phép kéo giãn chiều rộng
 * @property {boolean} [hideable=true] - Cho phép ẩn/hiện cột
 * @property {boolean} [hide=false] - Trạng thái ẩn mặc định
 * @property {boolean} [pinned=false] - Ghim cố định ('left' | 'right' | false)
 * @property {string} [type='string'] - Kiểu dữ liệu ('string' | 'number' | 'date' | 'boolean' | 'actions' | 'custom')
 * @property {(params: { value: any, row: any, field: string }) => any} [valueGetter] - Hàm lấy giá trị tùy biến
 * @property {(params: { value: any, row: any, field: string }) => string} [valueFormatter] - Hàm định dạng giá trị chuỗi
 * @property {(params: { value: any, row: any, field: string, column: GridColumnDef, api: any }) => React.ReactNode} [renderCell] - Hàm render cell tùy biến
 * @property {(params: { column: GridColumnDef }) => React.ReactNode} [renderHeader] - Hàm render header tùy biến
 * @property {string | ((params: { value: any, row: any }) => string)} [cellClassName] - Class CSS cho cell
 * @property {string | ((params: { column: GridColumnDef }) => string)} [headerClassName] - Class CSS cho header
 */

export {};
