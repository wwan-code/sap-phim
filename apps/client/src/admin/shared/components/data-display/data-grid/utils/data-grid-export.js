/**
 * @file data-grid-export.js
 * @module Admin/Shared/Components/DataDisplay/DataGrid/Utils/Export
 * @description Tiện ích xuất dữ liệu bảng ra định dạng CSV và JSON với mã hóa UTF-8 BOM chuẩn cho Tiếng Việt.
 */

/**
 * Tải file xuống máy khách
 */
const triggerFileDownload = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

/**
 * Xuất dữ liệu bảng ra file CSV
 * @param {Array} rows - Danh sách dòng
 * @param {Array} visibleColumns - Danh sách cột đang hiển thị
 * @param {Function} getRowValue - Hàm lấy giá trị ô
 * @param {string} [filename='export-data.csv'] - Tên file tải về
 */
export const exportToCSV = (rows, visibleColumns, getRowValue, filename = 'export-data.csv') => {
  if (!Array.isArray(rows) || rows.length === 0) return;

  const exportableCols = visibleColumns.filter((c) => c.field !== '__check__' && c.field !== '__actions__' && c.field);
  const headers = exportableCols.map((c) => `"${(c.headerName || c.field).replace(/"/g, '""')}"`);

  const csvRows = rows.map((row) => {
    return exportableCols
      .map((col) => {
        let val = getRowValue ? getRowValue(row, col.field, col) : row[col.field];
        if (col.valueFormatter && typeof col.valueFormatter === 'function') {
          val = col.valueFormatter({ value: val, row, field: col.field });
        }
        if (val === null || val === undefined) val = '';
        return `"${String(val).replace(/"/g, '""')}"`;
      })
      .join(',');
  });

  // Thêm UTF-8 BOM (\uFEFF) để Excel hiển thị đúng tiếng Việt có dấu
  const csvContent = '\uFEFF' + [headers.join(','), ...csvRows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  triggerFileDownload(blob, filename.endsWith('.csv') ? filename : `${filename}.csv`);
};

/**
 * Xuất dữ liệu bảng ra file JSON
 * @param {Array} rows - Danh sách dòng
 * @param {Array} visibleColumns - Danh sách cột đang hiển thị
 * @param {Function} getRowValue - Hàm lấy giá trị ô
 * @param {string} [filename='export-data.json'] - Tên file tải về
 */
export const exportToJSON = (rows, visibleColumns, getRowValue, filename = 'export-data.json') => {
  if (!Array.isArray(rows) || rows.length === 0) return;

  const exportableCols = visibleColumns.filter((c) => c.field !== '__check__' && c.field !== '__actions__' && c.field);

  const data = rows.map((row) => {
    const rowObj = {};
    exportableCols.forEach((col) => {
      let val = getRowValue ? getRowValue(row, col.field, col) : row[col.field];
      if (col.valueFormatter && typeof col.valueFormatter === 'function') {
        val = col.valueFormatter({ value: val, row, field: col.field });
      }
      rowObj[col.field] = val;
    });
    return rowObj;
  });

  const jsonContent = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
  triggerFileDownload(blob, filename.endsWith('.json') ? filename : `${filename}.json`);
};
