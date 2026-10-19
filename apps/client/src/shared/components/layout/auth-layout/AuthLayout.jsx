/**
 * @file AuthLayout.jsx
 * @module Components/Layout/AuthLayout
 * @component AuthLayout
 * @description Component khung giao diện chung cho luồng Auth theo chuẩn Seamless Gradient Blend tách lớp Background & Content độc lập, tương thích Dual-Theme (Light & Dark) và Material 3 Expressive.
 */

import React, { memo } from 'react';
import { Outlet, Link } from 'react-router-dom';
import { ArrowLeft, Moon, Sun } from 'lucide-react';

import IconButton from '@/shared/components/ui/icon-button/IconButton';
import Button from '@/shared/components/ui/button/Button';
import Tooltip from '@/shared/components/ui/tooltip/Tooltip';
import BrandLogo from '@/shared/components/common/brand-logo/BrandLogo';
import { useTheme } from '@/shared/contexts/ThemeContext';
import { ROUTES } from '@/shared/constants/routes.constants';

import './_auth-layout.scss';

/**
 * @component AuthLayout
 * @description Layout tập trung cho toàn bộ luồng Auth chuẩn Material 3 Expressive.
 */
const AuthLayout = () => {
  const { isDark, toggleTheme } = useTheme();

  return (
    <div className="auth-layout">
      {/* ─── 1. Background Backdrop (Poster wall với Seamless Gradient Blend) ─── */}
      <div className="auth-layout__backdrop" aria-hidden="true">
        <img
          src="/images/login.png"
          alt=""
          className="auth-layout__backdrop-img"
          loading="eager"
        />
        <div className="auth-layout__backdrop-scrim" />
      </div>

      {/* ─── 2. Thanh mini-header trên Mobile & Tablet Portrait (< 1024px) ─── */}
      <header className="auth-layout__mobile-bar">
        <Link to={ROUTES.HOME} className="auth-layout__mobile-logo" aria-label="Về trang chủ Sạp Phim">
          <BrandLogo className="auth-layout__mobile-logo-img" height={36} />
        </Link>

        <IconButton
          variant="tonal"
          size="small"
          onClick={toggleTheme}
          aria-label={isDark ? 'Chuyển sang Giao diện Sáng' : 'Chuyển sang Giao diện Tối'}
          className="auth-layout__theme-btn"
        >
          {isDark ? <Sun size={18} /> : <Moon size={18} />}
        </IconButton>
      </header>

      {/* ─── 3. Main Split Container (Brand Showcase & Form Area) ─── */}
      <div className="auth-layout__container">
        {/* Brand Showcase Panel (Bên trái: Vùng an toàn 0-40%, không bao giờ bị che) */}
        <aside className="auth-layout__brand" aria-hidden="true">
          <Link to={ROUTES.HOME} className="auth-layout__logo" tabIndex={-1}>
            <BrandLogo className="auth-layout__logo-img" height={48} />
          </Link>

          <div className="auth-layout__brand-hero">
            <h1 className="auth-layout__brand-title">
              Thế Giới Anime Không Giới Hạn Tại <span>Sạp Phim</span>
            </h1>

            <p className="auth-layout__tagline">
              Trải nghiệm hàng ngàn bộ phim bom tấn với chất lượng Full HD/4K, âm thanh sống động và cập nhật tập mới nhanh nhất mỗi ngày.
            </p>
          </div>

          <div className="auth-layout__brand-footer">
            <span>&copy; {new Date().getFullYear()} Sạp Phim. All rights reserved.</span>
            <span>Bản quyền điện ảnh & Anime</span>
          </div>
        </aside>

        {/* Form Content Panel (Bên phải) */}
        <main className="auth-layout__content">
          {/* Desktop Topbar */}
          <div className="auth-layout__topbar">
            <Button
              component={Link}
              to={ROUTES.HOME}
              variant="text"
              color="inherit"
              size="small"
              startIcon={<ArrowLeft size={16} />}
              className="auth-layout__back-link"
            >
              Về trang chủ
            </Button>

            <Tooltip title={isDark ? 'Chuyển sang Giao diện Sáng' : 'Chuyển sang Giao diện Tối'} placement="bottom">
              <IconButton
                variant="tonal"
                size="medium"
                onClick={toggleTheme}
                aria-label={isDark ? 'Chuyển sang Giao diện Sáng' : 'Chuyển sang Giao diện Tối'}
                className="auth-layout__theme-btn"
              >
                {isDark ? <Sun size={18} /> : <Moon size={18} />}
              </IconButton>
            </Tooltip>
          </div>

          {/* Centered Form Card */}
          <div className="auth-layout__content-wrapper">
            <div className="auth-layout__content-inner">
              <Outlet />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default memo(AuthLayout);