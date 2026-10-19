/**
 * @file QueryProvider.jsx
 * @module App/Providers/Query
 * @description Provider cho TanStack Query v5 tích hợp ReactQueryDevtools
 */

import React from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import queryClient from '@/shared/lib/query-client';

export const QueryProvider = ({ children }) => {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

export default QueryProvider;
