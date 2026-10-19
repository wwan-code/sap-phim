/**
 * @file AdminSidebarNavItem.jsx
 * @module Admin/Layout/Sidebar/Components/AdminSidebarNavItem
 * @component AdminSidebarNavItem
 * @description Subcomponent biểu diễn mục điều hướng trong Admin Sidebar theo chuẩn The Aesthetic OS & Mockup (Menu Cha trong suốt, Menu Con active dạng Solid Pill độc lập, thanh line 2px, Badge Capsule Pastel, Flyout khi thu gọn).
 */

import React, { useState, useEffect, memo, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import { NavLink, useLocation } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

import Tooltip from '@/shared/components/ui/tooltip/Tooltip';
import { useFloatingDropdown } from '@/hooks/ui/use-floating-dropdown';

/**
 * @component AdminSidebarNavItem
 * @description Subcomponent item điều hướng hỗ trợ Accordion, Badge Pastel Capsule và Flyout
 */
export const AdminSidebarNavItem = memo(({
  item,
  isActive = false,
  isCollapsed = false,
  onClick,
  onPrefetch,
}) => {
  const location = useLocation();
  const hasChildren = Array.isArray(item.children) && item.children.length > 0;

  // Thuật toán Longest Prefix Match để xác định ĐÚNG DUY NHẤT một menu con đang active
  const activeChildId = useMemo(() => {
    if (!hasChildren) return null;
    let currentActiveId = null;
    let maxMatchLength = -1;

    item.children.forEach((child) => {
      const targetPath = child.to || child.path;
      if (!targetPath) return;

      // Chỉ match prefix nếu có dấu '/' ở sau, hoặc match chính xác
      const isPrefixMatch = location.pathname.startsWith(targetPath + '/');
      const isExactMatch = location.pathname === targetPath;

      if (isPrefixMatch || isExactMatch) {
        if (targetPath.length > maxMatchLength) {
          maxMatchLength = targetPath.length;
          currentActiveId = child.id || targetPath;
        }
      }
    });
    return currentActiveId;
  }, [hasChildren, item.children, location.pathname]);

  // Kiểm tra xem có bất kỳ route con nào đang active hay không
  const isChildActive = !!activeChildId;

  const [isExpanded, setIsExpanded] = useState(isChildActive);

  // Tự động mở accordion khi người dùng chuyển hướng tới route con
  useEffect(() => {
    if (isChildActive) {
      setIsExpanded(true);
    }
  }, [isChildActive]);

  // Hook quản lý Flyout Menu thông qua Portal khi Sidebar đang collapsed
  const dropdown = useFloatingDropdown({
    placement: 'right-start',
    trigger: isCollapsed ? 'hover' : 'manual',
    offset: 10,
    usePortal: true,
    adaptToDevice: false,
    enableScrollLock: false,
  });

  const Icon = item.icon;

  const handlePrefetch = useCallback(() => {
    if (onPrefetch && item.to) {
      onPrefetch(item.to);
    }
  }, [onPrefetch, item.to]);

  const handleToggleExpand = useCallback(
    (e) => {
      if (hasChildren && !isCollapsed) {
        e.preventDefault();
        setIsExpanded((prev) => !prev);
      }
    },
    [hasChildren, isCollapsed]
  );

  // Helper render Badge con nhộng Pastel chuẩn Mockup
  const renderItemBadge = (badgeContent, badgeVariant = 'neutral') => {
    if (badgeContent === undefined || badgeContent === null) return null;

    const variantClass =
      badgeVariant === 'warning' || badgeVariant === 'peach'
        ? 'admin-sidebar__badge--peach'
        : badgeVariant === 'success' || badgeVariant === 'mint'
          ? 'admin-sidebar__badge--mint'
          : badgeVariant === 'brand' || badgeVariant === 'primary'
            ? 'admin-sidebar__badge--brand'
            : badgeVariant === 'accent' || badgeVariant === 'vip'
              ? 'admin-sidebar__badge--accent'
              : 'admin-sidebar__badge--neutral';

    return (
      <span className={`admin-sidebar__badge ${variantClass}`}>
        {badgeContent}
      </span>
    );
  };

  // ── 1. Accordion Item (Có Menu Con) ─────────────────────────
  if (hasChildren) {
    return (
      <li
        className={
          'admin-sidebar__item-wrapper ' +
          (isExpanded ? 'admin-sidebar__item-wrapper--expanded' : '')
        }
        role='none'
        ref={dropdown.refs.setReference}
        {...dropdown.getReferenceProps()}
      >
        {/* Accordion Header Row (Trong suốt, không có khung nền bao quanh) */}
        <div
          className={
            'admin-sidebar__item admin-sidebar__item--accordion ' +
            (isChildActive ? 'admin-sidebar__item--accordion-active-child' : '')
          }
          onClick={handleToggleExpand}
          onMouseEnter={handlePrefetch}
          onFocus={handlePrefetch}
          onTouchStart={handlePrefetch}
          role='button'
          tabIndex={0}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handleToggleExpand(e)}
          title={isCollapsed ? item.label : undefined}
          aria-expanded={isExpanded}
          aria-haspopup='true'
        >
          <div className='admin-sidebar__item-icon'>
            {Icon && <Icon size={18} aria-hidden='true' />}
          </div>

          {!isCollapsed && (
            <>
              <span className='admin-sidebar__item-label'>{item.label}</span>
              {renderItemBadge(item.badge, item.badgeVariant)}
              <span
                className={
                  'admin-sidebar__chevron ' +
                  (isExpanded ? 'admin-sidebar__chevron--expanded' : '')
                }
                aria-hidden='true'
              >
                <ChevronRight size={14} />
              </span>
            </>
          )}
        </div>

        {/* Accordion Sub-list Wrapper (CSS Grid Height Transition) */}
        {!isCollapsed && (
          <div
            className={
              'admin-sidebar__sub-accordion ' +
              (isExpanded ? 'admin-sidebar__sub-accordion--expanded' : '')
            }
          >
            <div className='admin-sidebar__sub-accordion-inner'>
              <ul className='admin-sidebar__sub-list' role='menu'>
                {item.children.map((child) => {
                  const targetPath = child.to || child.path;
                  return (
                    <li
                      key={child.id || targetPath}
                      className='admin-sidebar__sub-item'
                      role='none'
                    >
                      {/* Curved branch tree connector */}
                      <div className='admin-sidebar__sub-branch' aria-hidden='true' />

                      <NavLink
                        to={targetPath}
                        className={() => {
                          const isSubActive = activeChildId === (child.id || targetPath);
                          return (
                            'admin-sidebar__sub-link ' +
                            (isSubActive ? 'admin-sidebar__sub-link--active' : '')
                          );
                        }}
                        onClick={onClick}
                        onMouseEnter={() => onPrefetch && onPrefetch(targetPath)}
                        onFocus={() => onPrefetch && onPrefetch(targetPath)}
                        onTouchStart={() => onPrefetch && onPrefetch(targetPath)}
                      >
                        <span className='admin-sidebar__sub-label'>{child.label}</span>
                        {renderItemBadge(child.badge, child.badgeVariant)}
                      </NavLink>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        )}

        {/* Floating Flyout Popover on Collapsed Mode (Rail / Collapsed Desktop) via Portal */}
        {isCollapsed && dropdown.isMounted && (
          <dropdown.FloatingPortal id={dropdown.portalId}>
            <div
              className='admin-sidebar__flyout'
              ref={dropdown.refs.setFloating}
              style={dropdown.floatingStyles}
              {...dropdown.getFloatingProps()}
            >
              <div className='admin-sidebar__flyout-header'>
                <span className='admin-sidebar__flyout-title'>{item.label}</span>
                {renderItemBadge(item.badge, item.badgeVariant)}
              </div>
              <ul className='admin-sidebar__flyout-list' role='menu'>
                {item.children.map((child) => {
                  const targetPath = child.to || child.path;
                  return (
                    <li key={child.id || targetPath} role='none'>
                      <NavLink
                        to={targetPath}
                        className={() => {
                          const isSubActive = activeChildId === (child.id || targetPath);
                          return (
                            'admin-sidebar__flyout-link ' +
                            (isSubActive ? 'admin-sidebar__flyout-link--active' : '')
                          );
                        }}
                        onClick={(e) => {
                          dropdown.setIsOpen(false);
                          if (onClick) onClick(e);
                        }}
                      >
                        <span>{child.label}</span>
                        {renderItemBadge(child.badge, child.badgeVariant)}
                      </NavLink>
                    </li>
                  );
                })}
              </ul>
            </div>
          </dropdown.FloatingPortal>
        )}
      </li>
    );
  }

  // ── 2. Single Nav Item (Mục đơn độc lập như Dashboard) ─────────
  const singleNavLink = (
    <NavLink
      to={item.to}
      end={item.to === '/admin/dashboard' || item.to === '/admin'}
      className={({ isActive: isSingleActive }) =>
        'admin-sidebar__item ' + (isSingleActive ? 'admin-sidebar__item--active' : '')
      }
      onClick={onClick}
      onMouseEnter={handlePrefetch}
      onFocus={handlePrefetch}
      onTouchStart={handlePrefetch}
      aria-label={item.label}
    >
      <div className='admin-sidebar__item-icon'>
        {Icon && <Icon size={18} aria-hidden='true' />}
      </div>
      {!isCollapsed && (
        <span className='admin-sidebar__item-label'>{item.label}</span>
      )}
      {!isCollapsed && renderItemBadge(item.badge, item.badgeVariant)}
    </NavLink>
  );

  return (
    <li className='admin-sidebar__item-wrapper' role='none'>
      {isCollapsed ? (
        <Tooltip title={item.label} placement='right' enterDelay={100}>
          {singleNavLink}
        </Tooltip>
      ) : (
        singleNavLink
      )}
    </li>
  );
});

AdminSidebarNavItem.displayName = 'AdminSidebarNavItem';

AdminSidebarNavItem.propTypes = {
  item: PropTypes.shape({
    id: PropTypes.string.isRequired,
    label: PropTypes.string.isRequired,
    to: PropTypes.string,
    path: PropTypes.string,
    icon: PropTypes.elementType,
    badge: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    badgeVariant: PropTypes.string,
    children: PropTypes.array,
  }).isRequired,
  isActive: PropTypes.bool,
  isCollapsed: PropTypes.bool,
  onClick: PropTypes.func,
  onPrefetch: PropTypes.func,
};

export default AdminSidebarNavItem;
