/**
 * @file RootLayout.jsx
 * @module Components/Layout/RootLayout
 * @component RootLayout
 * @description Layout gốc cấp cao nhất trong React Router, chịu trách nhiệm kích hoạt các Global Lifecycle Sync Hooks (như Realtime Notification Sync) xuyên suốt cả Client và Admin portals.
 */

import React, { memo } from 'react';
import { Outlet } from 'react-router-dom';

import { useNotificationSync } from '@/hooks/socket/use-notification-sync';

/**
 * @component RootLayout
 * @description Layout bao bọc toàn bộ các nhánh Route của ứng dụng
 */
export const RootLayout = () => {
  // Kích hoạt đồng bộ Notification Socket.IO toàn cục cho cả Member và Admin
  useNotificationSync();

  return <Outlet />;
};

export default memo(RootLayout);
