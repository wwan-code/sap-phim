/**
 * @file HeaderDrawer.jsx
 * @module Components/Layout/Header/Components/HeaderDrawer
 * @component HeaderDrawer
 * @description Subcomponent menu điều hướng dạng Off-Canvas Drawer trượt từ bên phải dành cho Mobile và Tablet theo chuẩn Material 3.
 */

import React, { useState, memo, useEffect, useCallback } from 'react';
import { FloatingPortal, FloatingFocusManager, useFloating } from '@floating-ui/react';
import { Link, useNavigate } from 'react-router-dom';
import PropTypes from 'prop-types';
import {
  ChevronDown,
  ChevronUp,
  Download,
  LogOut,
  Search,
  User,
  X,
  Crown,
  Wallet,
  LayoutDashboard,
} from 'lucide-react';

import Avatar from '@/shared/components/ui/avatar/Avatar';
import Button from '@/shared/components/ui/button/Button';
import IconButton from '@/shared/components/ui/icon-button/IconButton';
import BrandLogo from '@/shared/components/common/brand-logo/BrandLogo';
import { ROUTES } from '@/shared/constants/routes.constants';
import {
  HEADER_GENRES,
  HEADER_COUNTRIES,
  HEADER_MORE_LINKS,
  HEADER_PRIMARY_LINKS,
} from '../constants/header-nav.constants';

/**
 * @component HeaderDrawer
 * @description Off-Canvas Drawer menu điều hướng di động
 */
const HeaderDrawer = memo(({
  open,
  onClose,
  user,
  isAuthenticated,
  isAdmin,
  onLogout,
}) => {
  const navigate = useNavigate();
  const [mobileSearchQuery, setMobileSearchQuery] = useState('');
  const [expandedSection, setExpandedSection] = useState(null);

  const [isMounted, setIsMounted] = useState(false);
  const [isAnimatingOut, setIsAnimatingOut] = useState(false);

  useEffect(() => {
    if (open) {
      setIsMounted(true);
      setIsAnimatingOut(false);
    } else if (isMounted) {
      setIsAnimatingOut(true);
    }
  }, [open, isMounted]);

  const handleAnimationEnd = useCallback(() => {
    if (isAnimatingOut) {
      setIsMounted(false);
      setIsAnimatingOut(false);
    }
  }, [isAnimatingOut]);

  const { context } = useFloating({
    open: isMounted,
    onOpenChange: (isOpen) => {
      if (!isOpen) onClose();
    },
  });

  if (!isMounted) return null;

  const toggleSection = (sectionName) => {
    setExpandedSection((prev) => (prev === sectionName ? null : sectionName));
  };

  const handleAuthClick = () => {
    onClose();
    navigate(ROUTES.LOGIN);
  };

  const handleLogoutClick = (e) => {
    onClose();
    onLogout?.(e);
  };

  const handleMobileSearchSubmit = (e) => {
    e.preventDefault();
    const trimmed = mobileSearchQuery.trim();
    if (!trimmed) return;

    try {
      const saved = localStorage.getItem('recentSearches');
      const recent = saved ? JSON.parse(saved) : [];
      const next = [trimmed, ...recent.filter((q) => q !== trimmed)].slice(0, 6);
      localStorage.setItem('recentSearches', JSON.stringify(next));
    } catch {
      // Bỏ qua lỗi quota
    }

    onClose();
    navigate(`${ROUTES.CATALOG}?search=${encodeURIComponent(trimmed)}`);
  };

  const displayName = user?.displayName || user?.username || 'Thành viên';

  return (
    <FloatingPortal>
      <FloatingFocusManager context={context} modal={true}>
        <div className="app-header__drawer-portal">
          <div
            className={`app-header__drawer-backdrop ${isAnimatingOut ? 'app-header__drawer-backdrop--closing' : ''}`}
            onClick={onClose}
            aria-hidden="true"
          />

          <div
            ref={context.refs.setFloating}
            className={`app-header__drawer ${isAnimatingOut ? 'app-header__drawer--closing' : ''}`}
            role="dialog"
            aria-modal="true"
            aria-label="Menu điều hướng di động"
            onAnimationEnd={handleAnimationEnd}
          >
            <div className="app-header__drawer-header">
              <Link to={ROUTES.HOME} onClick={onClose} className="app-header__drawer-logo-link">
                <BrandLogo height={32} />
              </Link>
              <IconButton
                variant="standard"
                size="medium"
                onClick={onClose}
                aria-label="Đóng menu"
                className="app-header__drawer-close"
              >
                <X size={20} />
              </IconButton>
            </div>

            <div className="app-header__drawer-body">
              <form className="app-header__drawer-search" onSubmit={handleMobileSearchSubmit}>
                <Search size={18} className="app-header__drawer-search-icon" />
                <input
                  type="text"
                  value={mobileSearchQuery}
                  onChange={(e) => setMobileSearchQuery(e.target.value)}
                  placeholder="Tìm kiếm anime..."
                  className="app-header__drawer-search-input"
                  aria-label="Tìm kiếm anime"
                />
              </form>

              <nav className="app-header__drawer-nav" aria-label="Menu điều hướng di động">
                <ul className="app-header__drawer-nav-list">
                  <li className="app-header__drawer-nav-item">
                    <button
                      type="button"
                      className="app-header__drawer-nav-btn"
                      onClick={() => toggleSection('genres')}
                      aria-expanded={expandedSection === 'genres'}
                    >
                      <span>Thể loại</span>
                      {expandedSection === 'genres' ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                    {expandedSection === 'genres' && (
                      <ul className="app-header__drawer-sublist">
                        {HEADER_GENRES.map((genre) => (
                          <li key={genre.path}>
                            <Link to={genre.path} onClick={onClose} className="app-header__drawer-sublink">
                              {genre.name}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>

                  {HEADER_PRIMARY_LINKS.map((link) => (
                    <li className="app-header__drawer-nav-item" key={link.path}>
                      <Link to={link.path} onClick={onClose} className="app-header__drawer-nav-link">
                        {link.name}
                      </Link>
                    </li>
                  ))}

                  <li className="app-header__drawer-nav-item">
                    <button
                      type="button"
                      className="app-header__drawer-nav-btn"
                      onClick={() => toggleSection('countries')}
                      aria-expanded={expandedSection === 'countries'}
                    >
                      <span>Quốc gia</span>
                      {expandedSection === 'countries' ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                    {expandedSection === 'countries' && (
                      <ul className="app-header__drawer-sublist">
                        {HEADER_COUNTRIES.map((country) => (
                          <li key={country.path}>
                            <Link to={country.path} onClick={onClose} className="app-header__drawer-sublink">
                              {country.name}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>

                  <li className="app-header__drawer-nav-item">
                    <button
                      type="button"
                      className="app-header__drawer-nav-btn"
                      onClick={() => toggleSection('more')}
                      aria-expanded={expandedSection === 'more'}
                    >
                      <span>Khám phá thêm</span>
                      {expandedSection === 'more' ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                    {expandedSection === 'more' && (
                      <ul className="app-header__drawer-sublist">
                        {HEADER_MORE_LINKS.map((link) => (
                          <li key={link.path}>
                            <Link to={link.path} onClick={onClose} className="app-header__drawer-sublink">
                              {link.name}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                </ul>
              </nav>

              <div className="app-header__drawer-divider" />

              <div className="app-header__drawer-app-download">
                <a href="/download" onClick={onClose} className="app-header__drawer-download-btn">
                  <Download size={18} />
                  <span>Tải ứng dụng Sạp Phim</span>
                </a>
              </div>
            </div>

            <div className="app-header__drawer-footer">
              {isAuthenticated ? (
                <div className="app-header__drawer-user">
                  <div className="app-header__drawer-user-info">
                    <Avatar
                      src={user?.avatar_url}
                      name={displayName}
                      alt={displayName}
                      size="md"
                    />
                    <div className="app-header__drawer-user-text">
                      <p className="app-header__drawer-user-name">{displayName}</p>
                      {isAdmin && <span className="app-header__drawer-user-badge">Quản trị viên</span>}
                    </div>
                  </div>

                  <div className="app-header__drawer-user-actions">
                    {isAdmin && (
                      <Link
                        to={ROUTES.ADMIN.ROOT}
                        onClick={onClose}
                        className="app-header__drawer-quick-link"
                      >
                        <LayoutDashboard size={16} />
                        <span>Trang Quản trị</span>
                      </Link>
                    )}
                    <Link
                      to={ROUTES.WALLET}
                      onClick={onClose}
                      className="app-header__drawer-quick-link"
                    >
                      <Wallet size={16} />
                      <span>Ví & Nạp xu</span>
                    </Link>
                    <Link
                      to={ROUTES.VIP}
                      onClick={onClose}
                      className="app-header__drawer-quick-link app-header__drawer-quick-link--vip"
                    >
                      <Crown size={16} />
                      <span>VIP Đặc quyền</span>
                    </Link>
                  </div>

                  <Button
                    variant="tonal"
                    color="danger"
                    size="medium"
                    fullWidth
                    onClick={handleLogoutClick}
                    startIcon={<LogOut size={16} />}
                    className="app-header__drawer-logout-btn"
                  >
                    Đăng xuất
                  </Button>
                </div>
              ) : (
                <Button
                  variant="filled"
                  color="primary"
                  size="large"
                  fullWidth
                  onClick={handleAuthClick}
                  startIcon={<User size={18} />}
                  className="app-header__drawer-login-btn"
                >
                  Đăng nhập / Đăng ký
                </Button>
              )}
            </div>
          </div>
        </div>
      </FloatingFocusManager>
    </FloatingPortal>
  );
});

HeaderDrawer.displayName = 'HeaderDrawer';

HeaderDrawer.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  user: PropTypes.object,
  isAuthenticated: PropTypes.bool.isRequired,
  isAdmin: PropTypes.bool.isRequired,
  onLogout: PropTypes.func.isRequired,
};

export default HeaderDrawer;