/**
 * @file ThemeContext.jsx
 * @module Shared/Contexts/ThemeContext
 * @description React Context định nghĩa trạng thái giao diện Theme (Dark, Light, System) và các hàm điều khiển chuyển đổi hỗ trợ View Transitions API.
 */

import { createContext, useContext } from 'react';

/**
 * Context đối tượng quản lý Theme
 */
export const ThemeContext = createContext({
  theme: 'dark',
  resolvedTheme: 'dark',
  toggleTheme: () => {},
  setTheme: () => {},
  isDark: true,
});

/**
 * Hook truy xuất trạng thái Theme trong toàn bộ ứng dụng
 *
 * @returns {{
 *   theme: 'dark'|'light'|'system',
 *   resolvedTheme: 'dark'|'light',
 *   isDark: boolean,
 *   toggleTheme: (event?: React.MouseEvent | MouseEvent) => void,
 *   setTheme: (theme: 'dark'|'light'|'system', event?: React.MouseEvent | MouseEvent) => void
 * }}
 */
export const useTheme = () => useContext(ThemeContext);

export default ThemeContext;
