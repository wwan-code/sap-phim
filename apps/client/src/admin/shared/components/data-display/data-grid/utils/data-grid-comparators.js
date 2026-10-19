/**
 * @file data-grid-comparators.js
 * @module Admin/Shared/Components/DataDisplay/DataGrid/Utils/Comparators
 * @description Các hàm so sánh phục vụ sắp xếp dữ liệu (Client-side Sorting) cho DataGrid.
 */

/**
 * So sánh chuỗi tiếng Việt chuẩn có dấu (Intl.Collator)
 */
const stringCollator = new Intl.Collator('vi', { numeric: true, sensitivity: 'base' });

export const compareStrings = (a, b) => {
  if (a === b) return 0;
  if (a === null || a === undefined) return 1;
  if (b === null || b === undefined) return -1;
  return stringCollator.compare(String(a), String(b));
};

export const compareNumbers = (a, b) => {
  if (a === b) return 0;
  if (a === null || a === undefined) return 1;
  if (b === null || b === undefined) return -1;
  return Number(a) - Number(b);
};

export const compareDates = (a, b) => {
  if (a === b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  const timeA = new Date(a).getTime();
  const timeB = new Date(b).getTime();
  if (Number.isNaN(timeA)) return 1;
  if (Number.isNaN(timeB)) return -1;
  return timeA - timeB;
};

export const compareBooleans = (a, b) => {
  if (a === b) return 0;
  if (a === null || a === undefined) return 1;
  if (b === null || b === undefined) return -1;
  return (a ? 1 : 0) - (b ? 1 : 0);
};

/**
 * Tự động chọn comparator phù hợp dựa trên kiểu dữ liệu hoặc giá trị
 * @param {any} valA - Giá trị A
 * @param {any} valB - Giá trị B
 * @param {string} [columnType] - Kiểu cột nếu có
 * @returns {number}
 */
export const defaultComparator = (valA, valB, columnType) => {
  if (columnType === 'number') return compareNumbers(valA, valB);
  if (columnType === 'date') return compareDates(valA, valB);
  if (columnType === 'boolean') return compareBooleans(valA, valB);

  if (typeof valA === 'number' && typeof valB === 'number') {
    return compareNumbers(valA, valB);
  }
  if (typeof valA === 'boolean' && typeof valB === 'boolean') {
    return compareBooleans(valA, valB);
  }
  return compareStrings(valA, valB);
};

/**
 * Áp dụng multi-column sorting lên danh sách rows
 * @param {Array} rows - Danh sách rows
 * @param {Array} sortModel - Mảng [{ field, sort }]
 * @param {Object} columnMap - Bản đồ cấu hình cột
 * @param {Function} getRowValue - Hàm trích xuất giá trị dòng
 * @returns {Array} Mảng đã được sắp xếp
 */
export const sortRows = (rows, sortModel, columnMap, getRowValue) => {
  if (!Array.isArray(rows) || rows.length === 0 || !Array.isArray(sortModel) || sortModel.length === 0) {
    return rows;
  }

  const validSorts = sortModel.filter((s) => s.field && (s.sort === 'asc' || s.sort === 'desc'));
  if (validSorts.length === 0) return rows;

  return [...rows].sort((rowA, rowB) => {
    for (let i = 0; i < validSorts.length; i += 1) {
      const { field, sort } = validSorts[i];
      const column = columnMap[field];
      const valA = getRowValue ? getRowValue(rowA, field, column) : rowA[field];
      const valB = getRowValue ? getRowValue(rowB, field, column) : rowB[field];

      let diff = 0;
      if (column?.sortComparator && typeof column.sortComparator === 'function') {
        diff = column.sortComparator(valA, valB, rowA, rowB);
      } else {
        diff = defaultComparator(valA, valB, column?.type);
      }

      if (diff !== 0) {
        return sort === 'desc' ? -diff : diff;
      }
    }
    return 0;
  });
};
