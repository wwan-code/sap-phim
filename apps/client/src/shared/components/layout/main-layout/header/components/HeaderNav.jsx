/**
 * @file HeaderNav.jsx
 * @module Components/Layout/Header/Components/HeaderNav
 * @component HeaderNav
 * @description Subcomponent thanh điều hướng chính của Header cho màn hình Desktop với Material 3 Solid Tonal Dropdowns.
 */

import React, { memo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { ChevronDown } from 'lucide-react';

import { useFloatingDropdown } from '@/hooks/ui/use-floating-dropdown';
import {
  HEADER_GENRES,
  HEADER_COUNTRIES,
  HEADER_MORE_LINKS,
  HEADER_PRIMARY_LINKS,
  isHeaderLinkActive,
} from '../constants/header-nav.constants';

/**
 * @component NavDropdown
 * @description Reusable dropdown item cho danh sách điều hướng dạng nhóm
 */
const NavDropdown = ({ label, items, columns = 1, pathname, searchParams }) => {
  const dropdown = useFloatingDropdown({
    placement: 'bottom-start',
    trigger: 'click',
    offset: 8,
    adaptToDevice: false,
  });

  const {
    isOpen,
    isMounted,
    floatingStyles,
    refs,
    context,
    getReferenceProps,
    getFloatingProps,
    FloatingPortal,
    FloatingFocusManager,
    portalId,
  } = dropdown;

  const hasActiveChild = items.some((item) => isHeaderLinkActive(pathname, searchParams, item));

  return (
    <li className="app-header__nav-item">
      <button
        ref={refs.setReference}
        type="button"
        {...getReferenceProps({
          className: classNames('app-header__nav-link app-header__nav-link--dropdown', {
            'app-header__nav-link--active': isOpen || hasActiveChild,
          }),
          'aria-expanded': isOpen,
          'aria-haspopup': 'menu',
        })}
      >
        <span>{label}</span>
        <ChevronDown
          size={16}
          className={classNames('app-header__nav-icon', {
            'app-header__nav-icon--open': isOpen,
          })}
        />
      </button>

      {isMounted && (
        <FloatingPortal id={portalId}>
          <FloatingFocusManager context={context} modal={false}>
            <div
              ref={refs.setFloating}
              style={floatingStyles}
              {...getFloatingProps({
                className: 'app-header__dropdown',
                role: 'menu',
              })}
            >
              <ul
                className={classNames('app-header__dropdown-grid', {
                  'app-header__dropdown-grid--cols-2': columns === 2,
                })}
              >
                {items.map((item) => {
                  const active = isHeaderLinkActive(pathname, searchParams, item);
                  return (
                    <li key={item.path} role="none">
                      <Link
                        to={item.path}
                        className={classNames('app-header__dropdown-link', {
                          'app-header__dropdown-link--active': active,
                        })}
                        role="menuitem"
                        aria-current={active ? 'page' : undefined}
                        onClick={() => dropdown.setIsOpen(false)}
                      >
                        {item.name}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          </FloatingFocusManager>
        </FloatingPortal>
      )}
    </li>
  );
};

NavDropdown.propTypes = {
  label: PropTypes.string.isRequired,
  items: PropTypes.arrayOf(
    PropTypes.shape({
      name: PropTypes.string.isRequired,
      path: PropTypes.string.isRequired,
    })
  ).isRequired,
  columns: PropTypes.number,
  pathname: PropTypes.string.isRequired,
  searchParams: PropTypes.instanceOf(URLSearchParams).isRequired,
};

/**
 * @component HeaderNav
 * @description Thanh điều hướng chính dành cho Desktop, hỗ trợ hiển thị danh sách Dropdown
 */
const HeaderNav = memo(() => {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);

  return (
    <nav className="app-header__nav" aria-label="Menu chính">
      <ul className="app-header__nav-list">
        <NavDropdown
          label="Thể loại"
          items={HEADER_GENRES}
          columns={2}
          pathname={location.pathname}
          searchParams={searchParams}
        />

        {HEADER_PRIMARY_LINKS.map((link) => {
          const active = isHeaderLinkActive(location.pathname, searchParams, link);
          return (
            <li className="app-header__nav-item" key={link.path}>
              <Link
                to={link.path}
                className={classNames('app-header__nav-link', {
                  'app-header__nav-link--active': active,
                })}
                aria-current={active ? 'page' : undefined}
              >
                {link.name}
              </Link>
            </li>
          );
        })}

        <NavDropdown
          label="Quốc gia"
          items={HEADER_COUNTRIES}
          pathname={location.pathname}
          searchParams={searchParams}
        />
        <NavDropdown
          label="Thêm"
          items={HEADER_MORE_LINKS}
          pathname={location.pathname}
          searchParams={searchParams}
        />
      </ul>
    </nav>
  );
});

HeaderNav.displayName = 'HeaderNav';

export default HeaderNav;