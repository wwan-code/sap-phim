/**
 * @file data-grid.constants.js
 * @module Admin/Shared/Components/DataDisplay/DataGrid/Constants
 * @description Định nghĩa các hằng số cấu hình mặc định cho hệ thống DataGrid (The Aesthetic OS).
 */

/**
 * Các mức độ giãn dòng (Row Density)
 */
export const GRID_DENSITIES = {
  COMPACT: 'compact',
  STANDARD: 'standard',
  COMFORTABLE: 'comfortable',
};

/**
 * Chiều cao dòng mặc định tính theo pixel theo từng density
 */
export const ROW_HEIGHTS = {
  [GRID_DENSITIES.COMPACT]: 40,
  [GRID_DENSITIES.STANDARD]: 52,
  [GRID_DENSITIES.COMFORTABLE]: 68,
};

/**
 * Chiều cao header mặc định tính theo pixel theo từng density
 */
export const HEADER_HEIGHTS = {
  [GRID_DENSITIES.COMPACT]: 40,
  [GRID_DENSITIES.STANDARD]: 48,
  [GRID_DENSITIES.COMFORTABLE]: 56,
};


/**
 * Hướng sắp xếp (Sort Directions)
 */
export const SORT_DIRECTIONS = {
  ASC: 'asc',
  DESC: 'desc',
  NONE: null,
};

/**
 * Kiểu căn lề nội dung ô
 */
export const COLUMN_ALIGNMENTS = {
  LEFT: 'left',
  CENTER: 'center',
  RIGHT: 'right',
};

/**
 * Các toán tử lọc dữ liệu (Filter Operators)
 */
export const FILTER_OPERATORS = {
  CONTAINS: 'contains',
  EQUALS: 'equals',
  STARTS_WITH: 'startsWith',
  ENDS_WITH: 'endsWith',
  GREATER_THAN: 'gt',
  LESS_THAN: 'lt',
  GREATER_THAN_OR_EQUAL: 'gte',
  LESS_THAN_OR_EQUAL: 'lte',
  IN: 'in',
  NOT_IN: 'notIn',
  IS_EMPTY: 'isEmpty',
  IS_NOT_EMPTY: 'isNotEmpty',
};

/**
 * Các tùy chọn phân trang mặc định
 */
export const DEFAULT_PAGE_SIZES = [10, 20, 50, 100];

/**
 * Chiều rộng tối thiểu và tối đa mặc định cho cột
 */
export const COLUMN_WIDTH_CONSTRAINTS = {
  MIN: 60,
  DEFAULT: 160,
  MAX: 800,
  CHECKBOX: 48,
  ACTIONS: 110,
};

/**
 * Trạng thái của thanh tác vụ hàng loạt (Bulk Action Bar)
 */
export const BULK_ACTION_STATES = {
  IDLE: 'idle',
  PROCESSING: 'processing',
  SUCCESS: 'success',
  ERROR: 'error',
};

/**
 * Vị trí ghim cột (Column Pinned Positions)
 */
export const COLUMN_PINNED_POSITIONS = {
  LEFT: 'left',
  RIGHT: 'right',
  NONE: false,
};
