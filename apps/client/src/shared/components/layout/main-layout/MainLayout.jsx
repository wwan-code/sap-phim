/**
 * @file MainLayout.jsx
 * @module Components/Layout/MainLayout
 * @component MainLayout
 * @description Khung bố cục chính của ứng dụng khách (Client App Shell) kết nối Header, Nội dung chính và Footer chuẩn Material 3 Expressive.
 */

import React, { memo } from 'react';
import { Outlet } from 'react-router-dom';

import Header from './header/Header';
import Footer from './footer/Footer';
import BottomNav from './bottom-nav/BottomNav';

import './_main-layout.scss';

/**
 * @component MainLayout
 * @description Layout chính bao bọc toàn bộ các trang công khai và người dùng
 */
export const MainLayout = () => {
  return (
    <div className="main-layout">
      <Header />
      <main className="main-layout__content" id="app-main-content">
        <Outlet />
      </main>
      <Footer />
      <BottomNav />
    </div>
  );
};

export default memo(MainLayout);
