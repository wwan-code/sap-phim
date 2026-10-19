/**
 * @file data-grid-filters.js
 * @module Admin/Shared/Components/DataDisplay/DataGrid/Utils/Filters
 * @description Bộ toán tử lọc dữ liệu và thuật toán tìm kiếm nhanh cho DataGrid.
 */

import { FILTER_OPERATORS } from '../data-grid.constants';

/**
 * Chuẩn hóa chuỗi tìm kiếm (xóa dấu tiếng Việt, đưa về chữ thường)
 */
export const normalizeSearchText = (str) => {
  if (str === null || str === undefined) return '';
  if (typeof str === 'object') {
    if (Array.isArray(str)) {
      return str.map((item) => normalizeSearchText(item)).join(' ');
    }
    return normalizeSearchText(str.name || str.title || str.label || str.slug || '');
  }
  return String(str)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
};

/**
 * Kiểm tra xem một giá trị có thỏa mãn điều kiện lọc không
 */
export const evaluateFilterOperator = (val, operator, targetVal) => {
  // Xử lý giá trị mảng (như mảng thể loại genres, tags, v.v.)
  if (Array.isArray(val)) {
    if (operator === FILTER_OPERATORS.IS_EMPTY) return val.length === 0;
    if (operator === FILTER_OPERATORS.IS_NOT_EMPTY) return val.length > 0;
    return val.some((item) => evaluateFilterOperator(item, operator, targetVal));
  }

  // Xử lý đối tượng lồng nhau (như category: { id, name })
  let resolvedVal = val;
  if (val && typeof val === 'object') {
    resolvedVal = val.name || val.title || val.label || val.slug || '';
  }

  const normVal = normalizeSearchText(resolvedVal);
  const normTarget = normalizeSearchText(targetVal);

  switch (operator) {
    case FILTER_OPERATORS.CONTAINS:
      return normVal.includes(normTarget);

    case FILTER_OPERATORS.EQUALS:
      if (typeof resolvedVal === 'number') {
        const numTarget = Number(targetVal);
        return !Number.isNaN(numTarget) && Number(resolvedVal) === numTarget;
      }
      if (typeof resolvedVal === 'boolean') {
        const boolTarget =
          targetVal === true ||
          targetVal === 'true' ||
          targetVal === '1' ||
          normTarget === 'cong khai';
        return resolvedVal === boolTarget;
      }
      return normVal === normTarget;

    case FILTER_OPERATORS.STARTS_WITH:
      return normVal.startsWith(normTarget);

    case FILTER_OPERATORS.ENDS_WITH:
      return normVal.endsWith(normTarget);

    case FILTER_OPERATORS.GREATER_THAN:
    case FILTER_OPERATORS.GREATER_THAN_OR_EQUAL:
    case FILTER_OPERATORS.LESS_THAN:
    case FILTER_OPERATORS.LESS_THAN_OR_EQUAL: {
      const numVal = Number(resolvedVal);
      const numTarget = Number(targetVal);
      if (Number.isNaN(numVal) || Number.isNaN(numTarget)) return false;
      if (operator === FILTER_OPERATORS.GREATER_THAN) return numVal > numTarget;
      if (operator === FILTER_OPERATORS.GREATER_THAN_OR_EQUAL) return numVal >= numTarget;
      if (operator === FILTER_OPERATORS.LESS_THAN) return numVal < numTarget;
      if (operator === FILTER_OPERATORS.LESS_THAN_OR_EQUAL) return numVal <= numTarget;
      return false;
    }

    case FILTER_OPERATORS.IN:
      if (Array.isArray(targetVal)) {
        return targetVal.includes(resolvedVal);
      }
      return normTarget.split(',').map((s) => s.trim()).includes(normVal);

    case FILTER_OPERATORS.IS_EMPTY:
      return (
        resolvedVal === null ||
        resolvedVal === undefined ||
        resolvedVal === '' ||
        (Array.isArray(resolvedVal) && resolvedVal.length === 0)
      );

    case FILTER_OPERATORS.IS_NOT_EMPTY:
      return (
        resolvedVal !== null &&
        resolvedVal !== undefined &&
        resolvedVal !== '' &&
        (!Array.isArray(resolvedVal) || resolvedVal.length > 0)
      );

    default:
      return normVal.includes(normTarget);
  }
};

/**
 * Thực thi Quick Search và Column Filter trên Client-side
 * @param {Array} rows - Danh sách rows
 * @param {Object} filterModel - Cấu hình lọc { quickFilterValues, items, logicOperator }
 * @param {Array} columns - Danh sách cột
 * @param {Function} getRowValue - Hàm trích xuất giá trị ô
 * @returns {Array} Danh sách rows đã được lọc
 */
export const filterRows = (rows, filterModel, columns, getRowValue) => {
  if (!Array.isArray(rows) || rows.length === 0 || !filterModel) {
    return rows;
  }

  const { quickFilterValues = [], items = [], logicOperator = 'and' } = filterModel;
  const activeItems = (items || []).filter(
    (item) =>
      item.field &&
      (item.operator === FILTER_OPERATORS.IS_EMPTY ||
        item.operator === FILTER_OPERATORS.IS_NOT_EMPTY ||
        (item.value !== undefined && item.value !== null && String(item.value).trim() !== ''))
  );

  const hasQuickFilter =
    Array.isArray(quickFilterValues) &&
    quickFilterValues.length > 0 &&
    quickFilterValues.some((v) => Boolean(v?.trim?.()));
  const hasColumnFilters = activeItems.length > 0;

  if (!hasQuickFilter && !hasColumnFilters) {
    return rows;
  }

  const searchableColumns = columns.filter((col) => col.filterable !== false && col.field);

  return rows.filter((row) => {
    // 1. Kiểm tra Quick Filter (tìm kiếm nhanh trên mọi cột)
    if (hasQuickFilter) {
      const matchAllQuickKeywords = quickFilterValues.every((kw) => {
        const normKw = normalizeSearchText(kw);
        if (!normKw) return true;

        return searchableColumns.some((col) => {
          const val = getRowValue ? getRowValue(row, col.field, col) : row[col.field];
          const normVal = normalizeSearchText(val);
          return normVal.includes(normKw);
        });
      });

      if (!matchAllQuickKeywords) return false;
    }

    // 2. Kiểm tra Column Filters
    if (hasColumnFilters) {
      const columnMap = new Map(columns.map((c) => [c.field, c]));

      if (logicOperator === 'or') {
        return activeItems.some((item) => {
          const col = columnMap.get(item.field);
          const val = getRowValue ? getRowValue(row, item.field, col) : row[item.field];
          return evaluateFilterOperator(val, item.operator, item.value);
        });
      }

      // Mặc định là AND
      return activeItems.every((item) => {
        const col = columnMap.get(item.field);
        const val = getRowValue ? getRowValue(row, item.field, col) : row[item.field];
        return evaluateFilterOperator(val, item.operator, item.value);
      });
    }

    return true;
  });
};
