/**
 * @file SectionCard.jsx
 * @module Admin/Shared/Components/Layout/SectionCard
 * @description Card container layout chuẩn cho các modules trong Admin Portal, hỗ trợ title, subtitle, action toolbar và theme Obsidian Cinema.
 */

import React, { forwardRef, memo } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import './section-card.scss';

export const SectionCard = memo(
  forwardRef(function SectionCard(
    {
      title,
      subtitle,
      extra,
      children,
      className = '',
      headerClassName = '',
      bodyClassName = '',
      isLoading = false,
      noPadding = false,
      ...props
    },
    ref
  ) {
    const hasHeader = Boolean(title || subtitle || extra);

    return (
      <section
        ref={ref}
        className={classNames(
          'admin-section-card',
          {
            'admin-section-card--no-padding': noPadding,
            'admin-section-card--loading': isLoading,
          },
          className
        )}
        {...props}
      >
        {hasHeader && (
          <header className={classNames('admin-section-card__header', headerClassName)}>
            <div className="admin-section-card__titles">
              {title && <h3 className="admin-section-card__title">{title}</h3>}
              {subtitle && <p className="admin-section-card__subtitle">{subtitle}</p>}
            </div>
            {extra && <div className="admin-section-card__extra">{extra}</div>}
          </header>
        )}

        <div className={classNames('admin-section-card__body', bodyClassName)}>
          {isLoading ? (
            <div className="admin-section-card__skeleton" aria-busy="true">
              <div className="admin-section-card__skeleton-line" />
              <div className="admin-section-card__skeleton-line admin-section-card__skeleton-line--short" />
            </div>
          ) : (
            children
          )}
        </div>
      </section>
    );
  })
);

SectionCard.propTypes = {
  title: PropTypes.node,
  subtitle: PropTypes.node,
  extra: PropTypes.node,
  children: PropTypes.node,
  className: PropTypes.string,
  headerClassName: PropTypes.string,
  bodyClassName: PropTypes.string,
  isLoading: PropTypes.bool,
  noPadding: PropTypes.bool,
};

export default SectionCard;
