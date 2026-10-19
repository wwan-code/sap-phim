/**
 * @file router.jsx
 * @module Routes/Router
 * @description Central Data Router sử dụng createBrowserRouter của React Router v7 tích hợp pre-render route loaders, guards và lazy route helpers chuẩn hóa.
 */

import React from 'react';
import { createBrowserRouter, redirect } from 'react-router-dom';

import RootLayout from '@/shared/components/layout/root-layout/RootLayout';
import MainLayout from '@/shared/components/layout/main-layout/MainLayout';
import AuthLayout from '@/shared/components/layout/auth-layout/AuthLayout';
import AdminLayout from '@/admin/layout/AdminLayout';
import RouteErrorBoundary from '@/shared/components/common/error-boundary/RouteErrorBoundary';
import PageLoader from '@/shared/components/ui/page-loader/PageLoader';
import { ROUTES } from '@/shared/constants/routes.constants';
import { ROLES } from '@/shared/constants/roles.constants';

import { adminRoutes } from '@/admin/router/admin-routes';
import { guestLoader, requireAuthLoader, requireRoleLoader } from './guards/route-loaders';
import { lazyRoute } from './utils/lazy-route';

const ADMIN_REQUIRED_ROLES = [ROLES.BOSS, ROLES.ADMIN, ROLES.MODERATOR];

// ──────────────────────────────────────────────────────────────
// Router Configuration
// ──────────────────────────────────────────────────────────────

export const router = createBrowserRouter(
  [
    {
      element: <RootLayout />,
      errorElement: <RouteErrorBoundary />,
      children: [
        // ── 1. Client Application Routes (MainLayout) ───────────────
        {
          element: <MainLayout />,
      errorElement: <RouteErrorBoundary />,
      HydrateFallback: () => <PageLoader variant='full' />,
      children: [
        {
          path: ROUTES.HOME,
          ...lazyRoute(() => import('@pages/home-page/HomePage')),
        },
        {
          path: ROUTES.CATALOG,
          ...lazyRoute(() => import('@pages/catalog-page/CatalogPage')),
        },
        {
          path: ROUTES.SEARCH,
          ...lazyRoute(() => import('@pages/catalog-page/CatalogPage')),
        },
        {
          path: ROUTES.MOVIE_DETAIL(),
          ...lazyRoute(() => import('@pages/movie-detail-page/MovieDetailPage')),
        },
        {
          path: ROUTES.WATCH(),
          ...lazyRoute(() => import('@pages/watch-page/WatchPage')),
        },
        {
          path: ROUTES.WALLET,
          loader: requireAuthLoader,
          ...lazyRoute(() => import('@pages/wallet-page/WalletPage')),
        },
        {
          path: ROUTES.VIP,
          loader: requireAuthLoader,
          ...lazyRoute(() => import('@pages/vip-page/VipPage')),
        },
        {
          path: ROUTES.ACCOUNT,
          loader: requireAuthLoader,
          ...lazyRoute(() => import('@pages/account/AccountPage')),
        },
        // Profile & Settings aliases redirecting to Account
        {
          path: ROUTES.PROFILE,
          loader: () => redirect(ROUTES.ACCOUNT),
        },
        {
          path: ROUTES.USER_SETTINGS,
          loader: () => redirect(ROUTES.ACCOUNT),
        },
        // Error & Forbidden status pages
        {
          path: ROUTES.FORBIDDEN,
          ...lazyRoute(() => import('@pages/errors/unauthorized-page/UnauthorizedPage')),
        },
        {
          path: ROUTES.UNAUTHORIZED,
          ...lazyRoute(() => import('@pages/errors/unauthorized-page/UnauthorizedPage')),
        },
        {
          path: '*',
          ...lazyRoute(() => import('@pages/errors/not-found-page/NotFoundPage')),
        },
      ],
    },

    // ── 2. Authentication Routes (AuthLayout) ───────────────────
    {
      element: <AuthLayout />,
      errorElement: <RouteErrorBoundary />,
      HydrateFallback: () => <PageLoader variant='full' />,
      loader: guestLoader,
      children: [
        {
          path: ROUTES.LOGIN,
          ...lazyRoute(() => import('@pages/auth/LoginPage')),
        },
        {
          path: ROUTES.REGISTER,
          ...lazyRoute(() => import('@pages/auth/RegisterPage')),
        },
        {
          path: ROUTES.FORGOT_PW,
          ...lazyRoute(() => import('@pages/auth/ForgotPasswordPage')),
        },
        {
          path: ROUTES.RESET_PW,
          ...lazyRoute(() => import('@pages/auth/ResetPasswordPage')),
        },
        {
          path: ROUTES.RESET_PW_TOKEN(),
          ...lazyRoute(() => import('@pages/auth/ResetPasswordPage')),
        },
        {
          path: ROUTES.VERIFY_EMAIL,
          ...lazyRoute(() => import('@pages/auth/VerifyEmailPage')),
        },
        {
          path: ROUTES.VERIFY_EMAIL_TOKEN(),
          ...lazyRoute(() => import('@pages/auth/VerifyEmailPage')),
        },
      ],
    },

        // ── 3. Admin Portal Routes (AdminLayout) ────────────────────
        {
          path: ROUTES.ADMIN.ROOT,
          element: <AdminLayout />,
          errorElement: <RouteErrorBoundary />,
          HydrateFallback: () => <PageLoader variant='full' />,
          loader: requireRoleLoader(ADMIN_REQUIRED_ROLES),
          children: adminRoutes,
        },
      ],
    },
  ],
  {
    future: {
      v7_relativeSplatPath: true,
      v7_fetcherPersist: true,
      v7_normalizeFormMethod: true,
      v7_partialHydration: true,
      v7_skipActionErrorRevalidation: true,
    },
  }
);

export default router;
