/**
 * @file use-admin-ui-store.js
 * @module Admin/Store/UseAdminUIStore
 * @description Zustand UI store quản lý trạng thái giao diện của Admin Portal: Sidebar thu nhỏ/mở rộng, Drawer di động, Breadcrumbs và Quick Search.
 */

import { create } from 'zustand';

const SIDEBAR_COLLAPSED_KEY = 'sap_phim_admin_sidebar_collapsed';

const getInitialSidebarState = () => {
  try {
    const saved = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
    return saved !== null ? JSON.parse(saved) : false;
  } catch {
    return false;
  }
};

export const useAdminUIStore = create((set) => ({
  // Sidebar states
  isSidebarCollapsed: getInitialSidebarState(),
  isMobileSidebarOpen: false,
  isQuickSearchOpen: false,

  // Breadcrumbs & Page Metadata
  breadcrumbs: [],
  pageTitle: 'Admin Dashboard',

  // Actions
  toggleSidebar: () => {
    set((state) => {
      const nextState = !state.isSidebarCollapsed;
      try {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, JSON.stringify(nextState));
      } catch {
        // ignore
      }
      return { isSidebarCollapsed: nextState };
    });
  },

  setSidebarCollapsed: (collapsed) => {
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, JSON.stringify(collapsed));
    } catch {
      // ignore
    }
    set({ isSidebarCollapsed: collapsed });
  },

  toggleMobileSidebar: () => {
    set((state) => ({ isMobileSidebarOpen: !state.isMobileSidebarOpen }));
  },

  setMobileSidebarOpen: (isOpen) => {
    set({ isMobileSidebarOpen: isOpen });
  },

  setQuickSearchOpen: (isOpen) => {
    set({ isQuickSearchOpen: isOpen });
  },

  setBreadcrumbs: (breadcrumbs) => {
    set({ breadcrumbs });
  },

  setPageTitle: (pageTitle) => {
    set({ pageTitle });
  },
}));

export default useAdminUIStore;
