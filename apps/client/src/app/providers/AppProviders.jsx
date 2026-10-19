/**
 * @file AppProviders.jsx
 * @module App/Providers
 * @description Tập hợp các context providers chính (Redux, PersistGate, Query, Theme, Socket, Router, Toaster, Helmet) và khởi chạy useTokenManager.
 */

import React from 'react';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { RouterProvider } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { Toaster } from 'react-hot-toast';

import { QueryClientProvider } from '@tanstack/react-query';

import { store, persistor } from '@/store';
import { router } from '@/app/routes/router';
import { queryClient } from '@/shared/lib/query-client';
import ErrorBoundary from '@/shared/components/common/error-boundary/ErrorBoundary';
import PageLoader from '@/shared/components/ui/page-loader/PageLoader';
import { useTokenManager } from '@/hooks/use-token-manager';

import ThemeProvider from './ThemeProvider';
import SocketProvider from './SocketProvider';

const AppContent = () => {
  // Khởi tạo Token Manager & Proactive Refresh sau khi Redux Rehydrate thành công
  useTokenManager();

  return (
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <SocketProvider>
            <RouterProvider router={router} fallbackElement={<PageLoader variant="full" />} />
            <Toaster
              position="top-right"
              toastOptions={{
                duration: 4000,
                style: {
                  background: '#12151E',
                  color: '#F4F4F6',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '12px',
                  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.6)',
                  fontFamily: 'var(--sp-font-body, system-ui)',
                  fontSize: '0.875rem',
                },
                success: {
                  iconTheme: {
                    primary: '#10B981',
                    secondary: '#12151E',
                  },
                },
                error: {
                  iconTheme: {
                    primary: '#EF4444',
                    secondary: '#12151E',
                  },
                },
              }}
            />
          </SocketProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </HelmetProvider>
  );
};

export const AppProviders = () => {
  return (
    <ErrorBoundary>
      <Provider store={store}>
        <PersistGate loading={<PageLoader variant="full" />} persistor={persistor}>
          <AppContent />
        </PersistGate>
      </Provider>
    </ErrorBoundary>
  );
};

export default AppProviders;
