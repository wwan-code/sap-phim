/**
 * @file AdminHeaderSearch.jsx
 * @module Admin/Layout/Header/Components/AdminHeaderSearch
 * @component AdminHeaderSearch
 * @description Subcomponent modal tìm kiếm Command Palette (Ctrl+K / Cmd+K) trên danh sách Admin Routes đã authorized và System Quick Actions chuẩn Material 3 Expressive.
 */

import React, { memo, useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import PropTypes from 'prop-types';
import { Search, ArrowRight, CornerDownLeft, Sparkles, X, Sun, Moon, LogOut, Globe, Plus, Settings } from 'lucide-react';

import IconButton from '@/shared/components/ui/icon-button/IconButton';
import Badge from '@/shared/components/ui/badge/Badge';
import { usePortal } from '@/hooks/ui/use-portal';
import { useFocusTrap } from '@/hooks/ui/use-focus-trap';
import { useLockBodyScroll } from '@/hooks/ui/use-lock-body-scroll';
import { ROUTES } from '@/shared/constants/routes.constants';

/**
 * @component AdminHeaderSearch
 * @description Search overlay kiểu Command Palette (Dumb UI)
 */
const AdminHeaderSearch = ({
  open,
  onClose,
  routes = [],
  onToggleTheme,
  onLogout,
}) => {
  const navigate = useNavigate();
  const [searchValue, setSearchValue] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const portalNode = usePortal('admin-search-root');
  const focusTrapRef = useFocusTrap(open, { autoFocus: false });

  // Khóa cuộn trang khi modal Command Palette mở
  useLockBodyScroll(open);

  // Danh sách các System Quick Actions
  const systemActions = useMemo(() => [
    {
      id: 'action-theme',
      label: 'Chuyển giao diện Sáng / Tối',
      category: 'Hệ thống',
      icon: Sun,
      action: () => {
        onToggleTheme?.();
        onClose?.();
      },
    },
    {
      id: 'action-create-movie',
      label: 'Tạo phim mới',
      category: 'Nội dung',
      path: ROUTES.ADMIN.MOVIE_CREATE,
      icon: Plus,
    },
    {
      id: 'action-client-home',
      label: 'Về trang chủ Sạp Phim Client',
      category: 'Điều hướng',
      path: ROUTES.HOME,
      icon: Globe,
    },
    {
      id: 'action-settings',
      label: 'Cài đặt hệ thống Sạp Phim',
      category: 'Hệ thống',
      path: ROUTES.ADMIN.SETTINGS,
      icon: Settings,
    },
    {
      id: 'action-logout',
      label: 'Đăng xuất tài khoản',
      category: 'Tài khoản',
      icon: LogOut,
      action: () => {
        onLogout?.();
        onClose?.();
      },
    },
  ], [onToggleTheme, onLogout, onClose]);

  // Làm phẳng toàn bộ route và sub-child routes
  const flatItems = useMemo(() => {
    const items = [];

    // 1. System Actions
    systemActions.forEach((act) => {
      items.push({
        id: act.id,
        label: act.label,
        category: act.category,
        path: act.path || '',
        icon: act.icon,
        action: act.action,
        isAction: Boolean(act.action),
      });
    });

    // 2. Navigation Routes
    routes.forEach((r) => {
      items.push({
        id: 'route-' + r.path,
        label: r.label,
        category: r.section || 'Trang quản trị',
        path: r.path,
        icon: r.icon,
        isAction: false,
      });

      if (Array.isArray(r.children)) {
        r.children.forEach((child) => {
          items.push({
            id: 'child-' + (child.to || child.path),
            label: r.label + ' → ' + child.label,
            category: r.section || 'Trang quản trị',
            path: child.to || child.path,
            icon: r.icon,
            isAction: false,
          });
        });
      }
    });

    return items;
  }, [routes, systemActions]);

  // Lọc kết quả theo từ khóa
  const results = useMemo(() => {
    if (!searchValue.trim()) return flatItems.slice(0, 10);

    const query = searchValue.toLowerCase().trim();
    return flatItems.filter((item) => {
      const matchLabel = item.label?.toLowerCase().includes(query);
      const matchPath = item.path?.toLowerCase().includes(query);
      const matchCategory = item.category?.toLowerCase().includes(query);
      return matchLabel || matchPath || matchCategory;
    });
  }, [searchValue, flatItems]);

  // Reset active index khi kết quả thay đổi
  useEffect(() => {
    setActiveIndex(0);
  }, [results]);

  // Focus input khi mở modal
  useEffect(() => {
    if (open) {
      setSearchValue('');
      setActiveIndex(0);
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    }
  }, [open]);

  // Tự động scroll item đang active vào tầm nhìn
  useEffect(() => {
    if (!listRef.current) return;
    const activeItem = listRef.current.children[activeIndex];
    activeItem?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  const handleSelect = useCallback(
    (item) => {
      if (item.action) {
        item.action();
      } else if (item.path) {
        navigate(item.path);
        onClose?.();
      }
    },
    [navigate, onClose]
  );

  const handleKeyDown = useCallback(
    (e) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setActiveIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setActiveIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1));
          break;
        case 'Enter':
          e.preventDefault();
          if (results[activeIndex]) {
            handleSelect(results[activeIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose?.();
          break;
        default:
          break;
      }
    },
    [results, activeIndex, handleSelect, onClose]
  );

  const handleBackdropClick = useCallback(
    (e) => {
      if (e.target === e.currentTarget) {
        onClose?.();
      }
    },
    [onClose]
  );

  if (!open || !portalNode) return null;

  return createPortal(
    <div
      className='admin-header-search__overlay'
      onClick={handleBackdropClick}
      role='presentation'
      aria-hidden='true'
    >
      <div
        ref={focusTrapRef}
        className='admin-header-search'
        role='dialog'
        aria-label='Tìm kiếm Command Palette Admin'
        aria-modal='true'
        onKeyDown={handleKeyDown}
      >
        {/* Search Input */}
        <div className='admin-header-search__input-wrapper'>
          <Search size={18} className='admin-header-search__input-icon' aria-hidden='true' />
          <input
            ref={inputRef}
            type='text'
            className='admin-header-search__input'
            placeholder='Tìm kiếm trang, chức năng, tác vụ...'
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            role='combobox'
            aria-expanded={results.length > 0}
            aria-controls='admin-search-results'
            aria-autocomplete='list'
            autoComplete='off'
            spellCheck='false'
          />
          {searchValue ? (
            <IconButton
              size='small'
              variant='standard'
              onClick={() => {
                setSearchValue('');
                inputRef.current?.focus();
              }}
              aria-label='Xóa từ khóa tìm kiếm'
            >
              <X size={14} />
            </IconButton>
          ) : (
            <kbd className='admin-header-search__shortcut'>ESC</kbd>
          )}
        </div>

        {/* Results List */}
        <ul
          ref={listRef}
          id='admin-search-results'
          className='admin-header-search__results'
          role='listbox'
          aria-label='Kết quả tìm kiếm'
        >
          {results.length > 0 ? (
            results.map((item, index) => {
              const Icon = item.icon || Sparkles;
              return (
                <li
                  key={item.id}
                  role='option'
                  aria-selected={index === activeIndex}
                  className={
                    'admin-header-search__result-item ' +
                    (index === activeIndex ? 'admin-header-search__result-item--active' : '')
                  }
                  onClick={() => handleSelect(item)}
                  onMouseEnter={() => setActiveIndex(index)}
                >
                  <div className='admin-header-search__result-icon'>
                    <Icon size={16} aria-hidden='true' />
                  </div>
                  <div className='admin-header-search__result-content'>
                    <div className='admin-header-search__result-head'>
                      <span className='admin-header-search__result-label'>{item.label}</span>
                      <Badge
                        size='small'
                        variant={item.isAction ? 'accent' : 'neutral'}
                        content={item.category}
                        className='admin-header-search__result-badge'
                      />
                    </div>
                    {item.path && <span className='admin-header-search__result-path'>{item.path}</span>}
                  </div>
                  <ArrowRight size={14} className='admin-header-search__result-arrow' aria-hidden='true' />
                </li>
              );
            })
          ) : (
            <li className='admin-header-search__empty' role='status'>
              <Search size={24} className='admin-header-search__empty-icon' aria-hidden='true' />
              <p>Không tìm thấy kết quả phù hợp cho &quot;{searchValue}&quot;</p>
            </li>
          )}
        </ul>

        {/* Footer Shortcut Hints */}
        <div className='admin-header-search__footer' aria-hidden='true'>
          <span className='admin-header-search__hint'>
            <kbd>↑↓</kbd> điều hướng
          </span>
          <span className='admin-header-search__hint'>
            <kbd>
              <CornerDownLeft size={10} style={{ display: 'inline' }} />
            </kbd>{' '}
            chọn
          </span>
          <span className='admin-header-search__hint'>
            <kbd>esc</kbd> đóng
          </span>
        </div>
      </div>
    </div>,
    portalNode
  );
};

AdminHeaderSearch.displayName = 'AdminHeaderSearch';

AdminHeaderSearch.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  routes: PropTypes.array,
  onToggleTheme: PropTypes.func,
  onLogout: PropTypes.func,
};

export default memo(AdminHeaderSearch);
