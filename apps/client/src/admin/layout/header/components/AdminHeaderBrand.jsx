/**
 * @file AdminHeaderBrand.jsx
 * @module Admin/Layout/Header/Components/AdminHeaderBrand
 * @component AdminHeaderBrand
 * @description Subcomponent hiển thị Brand Logo Sạp Phim cho Admin Header trên Mobile/Tablet Portrait Drawer Header.
 */

import React, { memo } from 'react';
import { Link } from 'react-router-dom';
import PropTypes from 'prop-types';
import BrandLogo from '@/shared/components/common/brand-logo/BrandLogo';
import { ROUTES } from '@/shared/constants/routes.constants';

/**
 * @component AdminHeaderBrand
 * @description Hiển thị logo Sạp Phim kết nối về Admin Dashboard (Dumb UI)
 */
const AdminHeaderBrand = ({ showText = true }) => {
  return (
    <Link
      to={ROUTES.ADMIN.DASHBOARD}
      className='admin-header__brand-logo'
      aria-label='Về Dashboard Sạp Phim'
      title='Sạp Phim Admin Portal'
    >
      <BrandLogo variant='icon-only' width={32} height={32} />
      {showText && <span className='admin-header__brand-text'>Sạp Phim</span>}
    </Link>
  );
};

AdminHeaderBrand.displayName = 'AdminHeaderBrand';

AdminHeaderBrand.propTypes = {
  showText: PropTypes.bool,
};

export default memo(AdminHeaderBrand);
