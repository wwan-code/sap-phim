/**
 * @file PageHeader.jsx
 * @module Admin/Shared/Components/Layout/PageHeader
 * @component PageHeader
 * @description Component Header chuẩn cho trang quản trị Admin Portal: tiêu đề, mô tả, badge đếm, breadcrumb và dải action buttons.
 */

import React, { memo } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import './page-header.scss';

export const PageHeader = memo(({
  title,
  subtitle,
  badge,
  badgeVariant = 'primary',
  breadcrumbs,
  actions,
  children,
  className = '',
  ...props
}) => {
  return (
    <header className={classNames('admin-page-header', className)} {...props}>
      <div className="admin-page-header__main">
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav aria-label="Breadcrumb" className="admin-page-header__breadcrumbs">
            <ol className="admin-page-header__breadcrumb-list">
              {breadcrumbs.map((crumb, idx) => {
                const isLast = idx === breadcrumbs.length - 1;
                return (
                  <li key={idx} className="admin-page-header__breadcrumb-item">
                    {crumb.href && !isLast ? (
                      <a href={crumb.href} className="admin-page-header__breadcrumb-link">
                        {crumb.label}
                      </a>
                    ) : (
                      <span className="admin-page-header__breadcrumb-current" aria-current={isLast ? 'page' : undefined}>
                        {crumb.label}
                      </span>
                    )}
                    {!isLast && <span className="admin-page-header__breadcrumb-sep" aria-hidden="true">/</span>}
                  </li>
                );
              })}
            </ol>
          </nav>
        )}

        <div className="admin-page-header__title-wrapper">
          <div className="admin-page-header__title-group">
            <h1 className="admin-page-header__title">{title}</h1>
            {badge !== undefined && badge !== null && (
              <span className={classNames('admin-page-header__badge', `admin-page-header__badge--${badgeVariant}`)}>
                {badge}
              </span>
            )}
          </div>
          {subtitle && <p className="admin-page-header__subtitle">{subtitle}</p>}
        </div>
      </div>

      {(actions || children) && (
        <div className="admin-page-header__actions">
          {actions}
          {children}
        </div>
      )}
    </header>
  );
});

PageHeader.displayName = 'PageHeader';

PageHeader.propTypes = {
  title: PropTypes.node.isRequired,
  subtitle: PropTypes.node,
  badge: PropTypes.node,
  badgeVariant: PropTypes.oneOf(['primary', 'secondary', 'accent', 'info', 'success', 'warning', 'danger', 'neutral', 'purple']),
  breadcrumbs: PropTypes.arrayOf(
    PropTypes.shape({
      label: PropTypes.node.isRequired,
      href: PropTypes.string,
    })
  ),
  actions: PropTypes.node,
  children: PropTypes.node,
  className: PropTypes.string,
};

export default PageHeader;
