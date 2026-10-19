/**
 * @file admin-routes.config.js
 * @module Admin/Router/AdminRoutesConfig
 * @description Single Source of Truth (SSOT) Manifest định nghĩa toàn bộ metadata của Admin Routes & Navigation Menu (Permissions, Icons, Lazy Importers, Sections, Sub-routes, Accordion Submenus, Badges) đồng bộ 100% với Backend RBAC Seeder.
 */

import React from 'react';
import { Navigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Film,
  Tags,
  Users2,
  Building2,
  UserCheck,
  Wallet,
  Crown,
  CreditCard,
  Settings,
} from 'lucide-react';
import { ROUTES } from '@/shared/constants/routes.constants';
import { PERMISSIONS } from '@/shared/constants/roles.constants';
import { requirePermissionLoader } from '@/app/routes/guards/route-loaders';
import { lazyRoute } from '@/app/routes/utils/lazy-route';
import { queryClient } from '@/shared/lib/query-client';

/**
 * Định nghĩa các nhóm danh mục trên thanh điều hướng Admin
 */
export const ADMIN_NAV_SECTIONS = [
  { id: 'main', title: 'Quản trị' },
];

/**
 * SSOT Route Manifest cho Admin Portal - Gom thành các Submenu gắn kết
 */
export const ADMIN_ROUTE_CONFIGS = [
  // ── 1. Dashboard (Mục đơn độc lập) ──────────────────────────
  {
    id: 'dashboard',
    path: ROUTES.ADMIN.DASHBOARD,
    label: 'Dashboard',
    section: 'main',
    icon: LayoutDashboard,
    permission: PERMISSIONS.ADMIN_DASHBOARD,
    importer: () => import('@admin/modules/dashboard'),
    componentName: 'AdminDashboardPage',
    isNav: true,
  },

  // ── 2. Phim & Nội dung (Submenu Phim ảnh) ────────────────────
  {
    id: 'movies',
    path: ROUTES.ADMIN.MOVIES,
    label: 'Phim & Nội dung',
    section: 'main',
    icon: Film,
    permission: PERMISSIONS.MOVIES_VIEW,
    isNav: true,
    children: [
      {
        id: 'movie-list',
        label: 'Tất cả phim',
        to: ROUTES.ADMIN.MOVIES,
        permission: PERMISSIONS.MOVIES_VIEW,
        importer: () => import('@admin/modules/movies'),
        componentName: 'MoviePage',
      },
      {
        id: 'movie-create',
        label: 'Thêm phim mới',
        to: ROUTES.ADMIN.MOVIE_CREATE,
        permission: PERMISSIONS.MOVIES_CREATE,
        badge: 'NEW',
        badgeVariant: 'warning',
        importer: () => import('@admin/modules/movies'),
        componentName: 'MovieFormPage',
      },
      {
        id: 'episodes',
        label: 'Tập phim',
        to: ROUTES.ADMIN.EPISODES,
        permission: PERMISSIONS.EPISODES_VIEW,
        importer: () => import('@admin/modules/episodes'),
        componentName: 'EpisodeListPage',
      },
      {
        id: 'series',
        label: 'Series phim',
        to: ROUTES.ADMIN.SERIES,
        permission: PERMISSIONS.SERIES_VIEW,
        importer: () => import('@admin/modules/series'),
        componentName: 'SeriesListPage',
      },
      {
        id: 'calendar',
        label: 'Lịch phát sóng',
        to: ROUTES.ADMIN.BROADCAST_SCHEDULES,
        permission: PERMISSIONS.ADMIN_ACCESS,
        importer: () => import('@admin/modules/calendar'),
        componentName: 'BroadcastCalendarPage',
      },
    ],
    subRoutes: [
      {
        id: 'movie-edit-route',
        path: ROUTES.ADMIN.MOVIE_EDIT(),
        permission: PERMISSIONS.MOVIES_EDIT,
        importer: () => import('@admin/modules/movies'),
        componentName: 'MovieFormPage',
      },
      {
        id: 'movie-detail-route',
        path: ROUTES.ADMIN.MOVIE_DETAIL(),
        permission: PERMISSIONS.MOVIES_VIEW,
        importer: () => import('@admin/modules/movies'),
        componentName: 'MovieFormPage',
      },
    ],
  },

  // ── 3. Phân loại & Siêu dữ liệu (Submenu Phân loại) ───────────
  {
    id: 'taxonomy',
    path: ROUTES.ADMIN.GENRES,
    label: 'Phân loại',
    section: 'main',
    icon: Tags,
    permission: PERMISSIONS.GENRES_MANAGE,
    isNav: true,
    children: [
      {
        id: 'genres',
        label: 'Thể loại',
        to: ROUTES.ADMIN.GENRES,
        permission: PERMISSIONS.GENRES_MANAGE,
        importer: () => import('@admin/modules/genres'),
        componentName: 'GenreListPage',
      },
      {
        id: 'categories',
        label: 'Danh mục',
        to: ROUTES.ADMIN.CATEGORIES,
        permission: PERMISSIONS.CATEGORIES_MANAGE,
        importer: () => import('@admin/modules/categories'),
        componentName: 'CategoryListPage',
      },
      {
        id: 'countries',
        label: 'Quốc gia',
        to: ROUTES.ADMIN.COUNTRIES,
        permission: PERMISSIONS.COUNTRIES_MANAGE,
        importer: () => import('@admin/modules/countries'),
        componentName: 'CountryListPage',
      },
    ],
  },

  // ── 4. Diễn viên ───────────────────────────────────────────
  {
    id: 'actors',
    path: ROUTES.ADMIN.ACTORS,
    label: 'Diễn viên',
    section: 'main',
    icon: Users2,
    permission: PERMISSIONS.ACTORS_MANAGE,
    importer: () => import('@admin/modules/actors'),
    componentName: 'ActorListPage',
    isNav: true,
  },

  // ── 5. Studio sản xuất ───────────────────────────────────────────
  {
    id: 'studios',
    path: ROUTES.ADMIN.STUDIOS,
    label: 'Studio sản xuất',
    section: 'main',
    icon: Building2,
    permission: PERMISSIONS.STUDIOS_MANAGE,
    importer: () => import('@admin/modules/studios'),
    componentName: 'StudioListPage',
    isNav: true,
  },

  // ── 6. Quản lý người dùng ───────────────────────────────────────────
  {
    id: 'users',
    path: ROUTES.ADMIN.USERS,
    label: 'Quản lý người dùng',
    section: 'main',
    icon: UserCheck,
    permission: PERMISSIONS.USERS_VIEW,
    importer: () => import('@admin/modules/users'),
    componentName: 'UserListPage',
    isNav: true,
  },

  // ── 7. Gói thành viên ───────────────────────────────────────────
  {
    id: 'membership-plans',
    path: ROUTES.ADMIN.MEMBERSHIP_PLANS,
    label: 'Gói thành viên',
    section: 'main',
    icon: CreditCard,
    permission: PERMISSIONS.MEMBERSHIP_READ,
    importer: () => import('@admin/modules/membership-plans'),
    componentName: 'MembershipPlanListPage',
    isNav: true,
  },

  // ── 8. Thuê bao VIP ───────────────────────────────────────────
  {
    id: 'subscriptions',
    path: ROUTES.ADMIN.SUBSCRIPTIONS,
    label: 'Thuê bao VIP',
    section: 'main',
    icon: Crown,
    permission: PERMISSIONS.SUBSCRIPTIONS_VIEW,
    badge: 'VIP',
    badgeVariant: 'accent',
    importer: () => import('@admin/modules/subscriptions'),
    componentName: 'SubscriptionListPage',
    isNav: true,
  },

  // ── 6. Tài chính & Giao dịch (Submenu Tài chính) ─────────────
  {
    id: 'financial-group',
    path: ROUTES.ADMIN.WALLETS,
    label: 'Tài chính',
    section: 'main',
    icon: Wallet,
    permission: PERMISSIONS.WALLET_VIEW,
    isNav: true,
    children: [
      {
        id: 'wallets',
        label: 'Ví Quản trị',
        to: ROUTES.ADMIN.WALLETS,
        permission: PERMISSIONS.WALLET_VIEW,
        importer: () => import('@admin/modules/wallet'),
        componentName: 'AdminWalletPage',
      },
      {
        id: 'payment-requests',
        label: 'Yêu cầu thanh toán',
        to: ROUTES.ADMIN.PAYMENT_REQUESTS,
        permission: PERMISSIONS.PAYMENT_VIEW,
        badge: '5',
        badgeVariant: 'warning',
        importer: () => import('@admin/modules/payment-requests'),
        componentName: 'PaymentRequestListPage',
      },
    ],
  },

  // ── 7. Hệ thống & Cấu hình (Submenu Hệ thống) ────────────────
  {
    id: 'system-group',
    path: ROUTES.ADMIN.SETTINGS,
    label: 'Hệ thống',
    section: 'main',
    icon: Settings,
    permission: PERMISSIONS.ADMIN_SETTINGS,
    isNav: true,
    children: [
      {
        id: 'settings',
        label: 'Cài đặt hệ thống',
        to: ROUTES.ADMIN.SETTINGS,
        permission: PERMISSIONS.ADMIN_SETTINGS,
        importer: () => import('@admin/modules/settings'),
        componentName: 'AdminSettingsPage',
      },
      {
        id: 'notifications',
        label: 'Thông báo',
        to: ROUTES.ADMIN.NOTIFICATIONS,
        permission: PERMISSIONS.NOTIFICATIONS_MANAGE,
        importer: () => import('@admin/modules/notifications'),
        componentName: 'NotificationListPage',
      },
      {
        id: 'sessions',
        label: 'Phiên đăng nhập',
        to: ROUTES.ADMIN.SESSIONS,
        permission: PERMISSIONS.ADMIN_LOGS,
        importer: () => import('@admin/modules/sessions'),
        componentName: 'SessionListPage',
      },
    ],
  },
];

/**
 * Xây dựng danh sách routes React Router v7 cho Admin Portal từ manifest
 * @param {Array} configs - Danh sách route configs
 * @returns {Array} Mảng React Router Route Objects
 */
export const buildAdminRoutes = (configs = ADMIN_ROUTE_CONFIGS) => {
  const routes = [
    {
      index: true,
      element: React.createElement(Navigate, { to: ROUTES.ADMIN.DASHBOARD, replace: true }),
    },
  ];

  const registeredPaths = new Set();

  configs.forEach((item) => {
    // 1. Parent route registration (nếu có importer riêng và chưa đăng ký)
    if (item.importer && item.componentName && item.path && !registeredPaths.has(item.path)) {
      const routeObj = {
        path: item.path,
        ...lazyRoute(item.importer, item.componentName),
      };
      if (item.permission) {
        routeObj.loader = requirePermissionLoader(item.permission);
      }
      routes.push(routeObj);
      registeredPaths.add(item.path);
    }

    // 2. Children routes registration (đăng ký các trang con trong submenu)
    if (Array.isArray(item.children)) {
      item.children.forEach((child) => {
        const childPath = child.to || child.path;
        if (childPath && child.importer && child.componentName && !registeredPaths.has(childPath)) {
          const childRouteObj = {
            path: childPath,
            ...lazyRoute(child.importer, child.componentName),
          };
          if (child.permission) {
            childRouteObj.loader = requirePermissionLoader(child.permission);
          }
          routes.push(childRouteObj);
          registeredPaths.add(childPath);
        }
      });
    }

    // 3. Sub-routes definitions (e.g. create, edit, detail)
    if (Array.isArray(item.subRoutes)) {
      item.subRoutes.forEach((sub) => {
        if (sub.path && sub.importer && sub.componentName && !registeredPaths.has(sub.path)) {
          const subRouteObj = {
            path: sub.path,
            ...lazyRoute(sub.importer, sub.componentName),
          };
          if (sub.permission) {
            subRouteObj.loader = requirePermissionLoader(sub.permission);
          }
          routes.push(subRouteObj);
          registeredPaths.add(sub.path);
        }
      });
    }
  });

  return routes;
};

/**
 * Xây dựng cấu trúc navigation cho Admin Sidebar từ manifest
 * @param {Array} configs - Danh sách route configs
 * @param {Array} sections - Danh sách sections định nghĩa
 * @returns {Array} Navigation sections cấu trúc
 */
export const buildAdminNavigation = (
  configs = ADMIN_ROUTE_CONFIGS,
  sections = ADMIN_NAV_SECTIONS
) => {
  return sections
    .map((sec) => {
      const items = configs
        .filter((item) => (item.section === sec.id || sec.id === 'main') && item.isNav !== false)
        .map((item) => {
          const navItem = {
            id: item.id,
            label: item.label,
            to: item.path,
            icon: item.icon,
            permission: item.permission,
            badge: item.badge,
            badgeVariant: item.badgeVariant || 'neutral',
          };

          if (Array.isArray(item.children)) {
            navItem.children = item.children.map((child) => ({
              id: child.id,
              label: child.label,
              to: child.to || child.path,
              permission: child.permission,
              badge: child.badge,
              badgeVariant: child.badgeVariant || 'neutral',
            }));
          }

          return navItem;
        });

      return {
        id: sec.id,
        title: sec.title,
        items,
      };
    })
    .filter((sec) => sec.items.length > 0);
};

// ──────────────────────────────────────────────────────────────
// Prefetch Engine & Module Map Bridge
// ──────────────────────────────────────────────────────────────

/**
 * Tạo bản đồ ánh xạ path -> importer function cho toàn bộ routes
 */
export const adminModuleMap = ADMIN_ROUTE_CONFIGS.reduce((acc, item) => {
  if (item.path && item.importer) {
    acc[item.path] = item.importer;
  }
  if (Array.isArray(item.children)) {
    item.children.forEach((child) => {
      const p = child.to || child.path;
      if (p && child.importer) {
        acc[p] = child.importer;
      }
    });
  }
  if (Array.isArray(item.subRoutes)) {
    item.subRoutes.forEach((sub) => {
      if (sub.path && sub.importer) {
        acc[sub.path] = sub.importer;
      }
    });
  }
  return acc;
}, {});

const _prefetchedRoutes = new Set();

/**
 * Bản đồ prefetch dữ liệu TanStack Query tương ứng với từng route
 * Nạp sẵn dữ liệu vào cache khi người dùng hover/idle để điều hướng 0ms
 */
export const adminQueryPrefetchMap = {
  [ROUTES.ADMIN.DASHBOARD]: () => {
    queryClient.query({
      queryKey: ['admin', 'dashboard', 'overview-metrics'],
      queryFn: async () => ({
        totalMovies: 1248,
        moviesGrowth: '+12 phim tuần này',
        totalUsers: 84520,
        usersGrowth: '+340 user hôm nay',
        monthlyRevenue: 128500000,
        revenueGrowth: '+18.5% so với tháng trước',
        activeTranscodes: 3,
      }),
      staleTime: 60 * 1000,
    }).catch(() => { });
  },
  [ROUTES.ADMIN.MOVIES]: () => {
    import('@/shared/services/movie.service').then(({ default: movieService }) => {
      const queryParams = {
        page: 1,
        limit: 20,
        pageSize: 20,
        sortBy: 'updated_at',
        sortOrder: 'desc',
        sort: 'DESC',
        order_by: 'updated_at',
      };
      queryClient.query({
        queryKey: ['movies', 'admin', 'list', {}, queryParams],
        queryFn: () => movieService.getAll(queryParams),
        staleTime: 60 * 1000,
      }).catch(() => { });
    }).catch(() => { });
  },
  [ROUTES.ADMIN.GENRES]: () => {
    import('@/shared/services/genre.service').then(({ default: genreService }) => {
      const queryParams = {
        page: 1,
        limit: 20,
        pageSize: 20,
        sortBy: 'name',
        sortOrder: 'asc',
        sort: 'ASC',
        order_by: 'name',
      };
      queryClient.query({
        queryKey: ['genres', 'admin', 'list', {}, queryParams],
        queryFn: () => genreService.getAll(queryParams),
        staleTime: 60 * 1000,
      }).catch(() => { });
    }).catch(() => { });
  },
  [ROUTES.ADMIN.CATEGORIES]: () => {
    import('@/shared/services/category.service').then(({ default: categoryService }) => {
      const queryParams = {
        page: 1,
        limit: 20,
        pageSize: 20,
        sortBy: 'order_num',
        sortOrder: 'asc',
        sort: 'ASC',
        order_by: 'order_num',
      };
      queryClient.query({
        queryKey: ['categories', 'admin', 'list', {}, queryParams],
        queryFn: () => categoryService.getAll(queryParams),
        staleTime: 60 * 1000,
      }).catch(() => { });
    }).catch(() => { });
  },
  [ROUTES.ADMIN.SERIES]: () => {
    import('@/shared/services/series.service').then(({ default: seriesService }) => {
      const queryParams = {
        page: 1,
        limit: 20,
        pageSize: 20,
        sortBy: 'name',
        sortOrder: 'asc',
        sort: 'ASC',
        order_by: 'name',
      };
      queryClient.query({
        queryKey: ['series', 'admin', 'list', {}, queryParams],
        queryFn: () => seriesService.getAll(queryParams),
        staleTime: 60 * 1000,
      }).catch(() => { });
    }).catch(() => { });
  },
  [ROUTES.ADMIN.ACTORS]: () => {
    import('@/shared/services/actor.service').then(({ default: actorService }) => {
      const queryParams = {
        page: 1,
        limit: 20,
        pageSize: 20,
        sortBy: 'popularity_score',
        sortOrder: 'desc',
        sort: 'DESC',
        order_by: 'popularity_score',
      };
      queryClient.query({
        queryKey: ['actors', 'admin', 'list', {}, queryParams],
        queryFn: () => actorService.getAll(queryParams),
        staleTime: 60 * 1000,
      }).catch(() => { });
    }).catch(() => { });
  },
  [ROUTES.ADMIN.STUDIOS]: () => {
    import('@/shared/services/studio.service').then(({ default: studioService }) => {
      const queryParams = {
        page: 1,
        limit: 20,
        pageSize: 20,
        sortBy: 'name',
        sortOrder: 'asc',
        sort: 'ASC',
        order_by: 'name',
      };
      queryClient.query({
        queryKey: ['studios', 'admin', 'list', {}, queryParams],
        queryFn: () => studioService.getAll(queryParams),
        staleTime: 60 * 1000,
      }).catch(() => { });
    }).catch(() => { });
  },
  [ROUTES.ADMIN.COUNTRIES]: () => {
    import('@/shared/services/country.service').then(({ default: countryService }) => {
      const queryParams = {
        page: 1,
        limit: 20,
        pageSize: 20,
        sortBy: 'name',
        sortOrder: 'asc',
        sort: 'ASC',
        order_by: 'name',
      };
      queryClient.query({
        queryKey: ['countries', 'admin', 'list', {}, queryParams],
        queryFn: () => countryService.getAll(queryParams),
        staleTime: 60 * 1000,
      }).catch(() => { });
    }).catch(() => { });
  },
  [ROUTES.ADMIN.USERS]: () => {
    import('@/shared/services/user.service').then(({ default: userService }) => {
      const queryParams = {
        page: 1,
        limit: 20,
        pageSize: 20,
        sortBy: 'created_at',
        sortOrder: 'desc',
        sort: 'DESC',
        order_by: 'created_at',
      };
      queryClient.query({
        queryKey: ['admin', 'users', 'list', {}, queryParams],
        queryFn: () => userService.listUsers(queryParams),
        staleTime: 60 * 1000,
      }).catch(() => { });
    }).catch(() => { });
  },
};

/**
 * Tải trước (Dual Prefetch) cả JS Chunk và dữ liệu Query Cache của route
 * @param {string} path - Route path
 */
export const prefetchAdminRoute = (path) => {
  if (!path || _prefetchedRoutes.has(path)) return;
  const importer = adminModuleMap[path];
  if (importer) {
    _prefetchedRoutes.add(path);

    // 1. Prefetch JS Chunk
    importer().catch((err) => {
      _prefetchedRoutes.delete(path);
      if (import.meta.env && import.meta.env.DEV) {
        console.warn('[Prefetch] Failed to prefetch route ' + path + ':', err ? err.message : err);
      }
    });

    // 2. Prefetch TanStack Query Cache (0ms instant render)
    const prefetchQueryFn = adminQueryPrefetchMap[path];
    if (prefetchQueryFn) {
      try {
        prefetchQueryFn();
      } catch (err) {
        if (import.meta.env && import.meta.env.DEV) {
          console.warn('[Prefetch] Failed to prefetch query for ' + path + ':', err);
        }
      }
    }
  }
};
