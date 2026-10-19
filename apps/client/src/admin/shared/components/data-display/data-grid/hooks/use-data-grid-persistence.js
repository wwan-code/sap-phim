/**
 * @file use-data-grid-persistence.js
 * @module Admin/Shared/Components/DataDisplay/DataGrid/Hooks/UseDataGridPersistence
 * @description Hook quản lý lưu trữ và phục hồi trạng thái người dùng (Density, Columns Visibility,
 * Column Widths, PageSize) vào LocalStorage giữa các phiên làm việc và tải lại trang.
 */

import { useState, useCallback } from 'react';

/**
 * Helper tạo key LocalStorage an toàn theo tiền tố hệ thống
 * @param {string} key - storageKey được chỉ định tường minh
 * @param {string} title - Tiêu đề bảng DataGrid
 * @returns {string} Key định danh trong LocalStorage
 */
const getStorageKey = (key, title) => {
  if (key && typeof key === 'string') {
    return `sp_datagrid_${key}`;
  }
  if (title && typeof title === 'string') {
    const slug = title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
    return `sp_datagrid_${slug}`;
  }
  if (typeof window !== 'undefined' && window.location?.pathname) {
    const pathSlug = window.location.pathname.replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    return `sp_datagrid_${pathSlug}`;
  }
  return 'sp_datagrid_default';
};

/**
 * @hook useDataGridPersistence
 * @param {object} params
 * @param {string} params.storageKey - Key định danh trong LocalStorage
 * @param {string} params.title - Tiêu đề bảng
 * @param {boolean} params.persistSettings - Bật/tắt tính năng lưu tự động (mặc định: true)
 * @returns {object} Trạng thái đã lưu và các hàm thao tác
 */
export const useDataGridPersistence = ({
  storageKey,
  title,
  persistSettings = true,
}) => {
  const effectiveKey = getStorageKey(storageKey, title);

  // Đọc cấu hình từ LocalStorage
  const loadSavedState = useCallback(() => {
    if (!persistSettings || typeof window === 'undefined' || !window.localStorage) {
      return {};
    }
    try {
      // Dọn dẹp key sp_datagrid_density cũ nếu còn tồn tại
      window.localStorage.removeItem('sp_datagrid_density');

      const raw = window.localStorage.getItem(effectiveKey);
      if (!raw) return {};
      const parsed = JSON.parse(raw) || {};

      // Cleanup: Nếu trong key bảng riêng có lưu density cũ, xóa bỏ density khỏi key này
      if (parsed.density !== undefined) {
        delete parsed.density;
        window.localStorage.setItem(effectiveKey, JSON.stringify(parsed));
      }
      return parsed;
    } catch {
      return {};
    }
  }, [effectiveKey, persistSettings]);

  const [savedState, setSavedState] = useState(() => loadSavedState());

  // Cập nhật từng thuộc tính vào LocalStorage (chỉ lưu columnWidths, columnVisibility, pageSize)
  const savePreference = useCallback(
    (key, value) => {
      // Tuyệt đối không lưu density vào LocalStorage
      if (key === 'density') return;
      if (!persistSettings || typeof window === 'undefined' || !window.localStorage) return;
      try {
        const current = loadSavedState();
        const updated = { ...current };
        if (value === undefined) {
          delete updated[key];
        } else {
          updated[key] = value;
        }
        delete updated.density;
        updated._updatedAt = Date.now();
        window.localStorage.setItem(effectiveKey, JSON.stringify(updated));
        setSavedState(updated);
      } catch (err) {
        console.warn(`[DataGrid][Persistence] Không thể lưu ${key}:`, err);
      }
    },
    [effectiveKey, loadSavedState, persistSettings]
  );

  // Xóa toàn bộ cấu hình đã lưu (Đặt lại mặc định)
  const clearSavedPreferences = useCallback(() => {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      window.localStorage.removeItem(effectiveKey);
      setSavedState({});
    } catch (err) {
      console.warn('[DataGrid][Persistence] Không thể xóa cài đặt:', err);
    }
  }, [effectiveKey]);

  return {
    savedColumnVisibility: savedState.columnVisibility,
    savedColumnWidths: savedState.columnWidths,
    savedPinnedColumns: savedState.pinnedColumns,
    savedPageSize: savedState.pageSize,
    savePreference,
    clearSavedPreferences,
    savedState,
    effectiveKey,
  };
};

export default useDataGridPersistence;
