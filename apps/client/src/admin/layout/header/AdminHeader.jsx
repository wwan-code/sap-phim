/**
 * @file AdminHeader.jsx
 * @module Admin/Layout/Header/AdminHeader
 * @component AdminHeader
 * @description Master Top Header trong Admin Portal theo chuẩn The Aesthetic OS & Mockup (Seamless Canvas không nền/viền, Tiêu đề lớn đậm nét, Inline Search Bar Pill, Quick Actions, Mobile Drawer Toggle và Command Palette Ctrl+K).
 */

import React, { memo, useMemo } from 'react';
import { useLocation, Link } from 'react-router-dom';
import PropTypes from 'prop-types';
import { Menu, Search, ChevronRight } from 'lucide-react';

import IconButton from '@/shared/components/ui/icon-button/IconButton';
import { useTheme } from '@/shared/contexts/ThemeContext';
import { useAuth } from '@/hooks/use-auth';
import { ROUTES } from '@/shared/constants/routes.constants';
import { useAdminUIStore } from '@/admin/store/use-admin-ui-store';

import AdminHeaderBrand from './components/AdminHeaderBrand';
import AdminHeaderActions from './components/AdminHeaderActions';
import AdminHeaderSearch from './components/AdminHeaderSearch';
import { useAdminHeaderState } from './hooks/use-admin-header-state';
import { useAuthorizedAdminRoutes } from './hooks/use-authorized-admin-routes';
import { useAdminHeaderContext } from './context/admin-header.context';

import './admin-header.scss';

const ROUTE_METADATA_MAP = {
  [ROUTES.ADMIN.DASHBOARD]: { title: 'Dashboard', description: 'Tổng quan hiệu suất & số liệu vận hành', section: 'Tổng quan' },
  [ROUTES.ADMIN.BROADCAST_SCHEDULES]: { title: 'Lịch phát sóng', description: 'Quản lý lịch chiếu phim theo tuần', section: 'Nội dung' },
  [ROUTES.ADMIN.MOVIES]: { title: 'Quản lý Phim', description: 'Danh sách và trạng thái toàn bộ phim', section: 'Nội dung' },
  [ROUTES.ADMIN.MOVIE_CREATE]: { title: 'Thêm Phim Mới', description: 'Tạo hồ sơ và siêu dữ liệu cho phim mới', section: 'Nội dung' },
  [ROUTES.ADMIN.EPISODES]: { title: 'Quản lý Tập phim', description: 'Danh sách tập phim, luồng video & phụ đề', section: 'Nội dung' },
  [ROUTES.ADMIN.SERIES]: { title: 'Series Phim', description: 'Quản lý các bộ phim nhiều phần/mùa', section: 'Nội dung' },
  [ROUTES.ADMIN.GENRES]: { title: 'Quản lý Thể loại', description: 'Hệ thống thẻ phân loại nội dung', section: 'Phân loại' },
  [ROUTES.ADMIN.CATEGORIES]: { title: 'Danh mục Phim', description: 'Phân loại phim theo nhóm chuyên biệt', section: 'Phân loại' },
  [ROUTES.ADMIN.COUNTRIES]: { title: 'Quốc gia', description: 'Khu vực và quốc gia sản xuất phim', section: 'Phân loại' },
  [ROUTES.ADMIN.ACTORS]: { title: 'Diễn viên & Đạo diễn', description: 'Hồ sơ nhân sự và nghệ sĩ tham gia', section: 'Nhân sự' },
  [ROUTES.ADMIN.STUDIOS]: { title: 'Studio sản xuất', description: 'Hãng sản xuất và phát hành phim', section: 'Nhân sự' },
  [ROUTES.ADMIN.USERS]: { title: 'Quản lý Người dùng', description: 'Tài khoản, quyền hạn và trạng thái xác thực', section: 'Tài khoản' },
  [ROUTES.ADMIN.WALLETS]: { title: 'Ví Quản trị', description: 'Biến động số dư và giao dịch người dùng', section: 'Tài chính' },
  [ROUTES.ADMIN.PAYMENT_REQUESTS]: { title: 'Yêu cầu Thanh toán', description: 'Duyệt các giao dịch nạp/rút tiền', section: 'Tài chính' },
  [ROUTES.ADMIN.MEMBERSHIP_PLANS]: { title: 'Gói thành viên', description: 'Cấu hình các gói VIP và quyền lợi', section: 'Kinh doanh' },
  [ROUTES.ADMIN.SUBSCRIPTIONS]: { title: 'Thuê bao VIP', description: 'Danh sách đăng ký gói hội viên', section: 'Kinh doanh' },
  [ROUTES.ADMIN.NOTIFICATIONS]: { title: 'Thông báo Hệ thống', description: 'Quản trị thông báo gửi đến người dùng', section: 'Hệ thống' },
  [ROUTES.ADMIN.SESSIONS]: { title: 'Phiên đăng nhập', description: 'Nhật ký thiết bị và an toàn bảo mật', section: 'Hệ thống' },
  [ROUTES.ADMIN.SETTINGS]: { title: 'Cài đặt Hệ thống', description: 'Cấu hình tham số vận hành toàn sàn', section: 'Hệ thống' },
};

/**
 * @component AdminHeader
 * @description Master Top Header cho Admin Portal (Dumb UI)
 */
export const AdminHeader = memo(({
  onToggleMobileSidebar,
  isDrawerMode = false,
  isRailMode = false,
}) => {
  const location = useLocation();
  const { user, logout } = useAuth();
  const { resolvedTheme = 'dark', toggleTheme } = useTheme();
  const authorizedRoutes = useAuthorizedAdminRoutes();
  const { headerConfig } = useAdminHeaderContext();
  const storeToggleMobile = useAdminUIStore((state) => state.toggleMobileSidebar);

  const handleToggleMobile = onToggleMobileSidebar || storeToggleMobile;
  const { searchOpen, toggleSearch, closeSearch } = useAdminHeaderState();

  // Tự động tính toán Title, Description & Breadcrumb theo URL pathname
  const fallbackMetadata = useMemo(() => {
    const path = location.pathname;
    if (ROUTE_METADATA_MAP[path]) return ROUTE_METADATA_MAP[path];

    // Khớp dynamic prefix routes (ví dụ: /admin/movies/edit/:id)
    const matched = authorizedRoutes.find(
      (r) => r.path !== ROUTES.ADMIN.DASHBOARD && path.startsWith(r.path)
    );
    if (matched) {
      return {
        title: matched.label,
        description: 'Quản lý ' + matched.label.toLowerCase(),
        section: matched.section || 'Quản trị',
      };
    }

    return { title: 'Admin Portal', description: 'Hệ thống quản trị Sạp Phim', section: 'Quản trị' };
  }, [location.pathname, authorizedRoutes]);

  const activeTitle = headerConfig?.title || fallbackMetadata.title;
  const activeDescription = headerConfig?.description || fallbackMetadata.description;
  const activeSection = fallbackMetadata.section;

  return (
    <>
      <header className='admin-header' role='banner'>
        {/* 1. Mobile & Tablet Portrait Nav: Hamburger Menu Toggle + Brand Logo (< 1024px) */}
        {isDrawerMode && (
          <div className='admin-header__mobile-nav'>
            <IconButton
              size='medium'
              variant='tonal'
              onClick={handleToggleMobile}
              aria-label='Mở menu điều hướng'
              className='admin-header__hamburger-btn'
            >
              <Menu size={20} />
            </IconButton>

            <AdminHeaderBrand showText={true} />
          </div>
        )}

        {/* 2. Breadcrumbs Hierarchy (Tablet Landscape & Desktop >= 1024px) */}
        <div className='admin-header__page-info'>
          {activeSection && (
            <nav className='admin-header__breadcrumbs' aria-label='Đường dẫn'>
              <Link to={ROUTES.ADMIN.DASHBOARD} className='admin-header__breadcrumb-item'>
                Admin
              </Link>
              <ChevronRight size={12} className='admin-header__breadcrumb-separator' aria-hidden='true' />
              <span className='admin-header__breadcrumb-item admin-header__breadcrumb-item--section'>{activeSection}</span>
              {activeTitle && (
                <>
                  <ChevronRight size={12} className='admin-header__breadcrumb-separator' aria-hidden='true' />
                  <span className='admin-header__breadcrumb-item admin-header__breadcrumb-item--current' aria-current='page'>
                    {activeTitle}
                  </span>
                </>
              )}
            </nav>
          )}
        </div>

        {/* 3. Search Pill Bar (Desktop >= 1280px) */}
        <div
          className='admin-header__search-trigger'
          onClick={toggleSearch}
          role='button'
          tabIndex={0}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && toggleSearch()}
          title='Tìm kiếm nhanh chức năng (Ctrl + K / ⌘K)'
          aria-label='Tìm kiếm nhanh chức năng'
        >
          <Search size={16} className='admin-header__search-icon' aria-hidden='true' />
          <span className='admin-header__search-placeholder'>
            Search anything...
          </span>
          <kbd className='admin-header__search-kbd'>⌘K</kbd>
        </div>

        {/* 4. Right: Actions Group (Quick Create, Theme Switcher, Notifications, User Menu) */}
        <AdminHeaderActions
          user={user}
          resolvedTheme={resolvedTheme}
          toggleTheme={toggleTheme}
          onToggleSearch={toggleSearch}
          onLogout={logout}
        />
      </header>

      {/* 5. Command Palette Overlay (Ctrl+K) */}
      <AdminHeaderSearch
        open={searchOpen}
        onClose={closeSearch}
        routes={authorizedRoutes}
        onToggleTheme={toggleTheme}
        onLogout={logout}
      />
    </>
  );
});

AdminHeader.displayName = 'AdminHeader';

AdminHeader.propTypes = {
  onToggleMobileSidebar: PropTypes.func,
  isDrawerMode: PropTypes.bool,
  isRailMode: PropTypes.bool,
};

export default AdminHeader;
