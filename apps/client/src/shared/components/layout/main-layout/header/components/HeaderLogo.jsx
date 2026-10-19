/**
 * @file HeaderLogo.jsx
 * @module Components/Layout/Header/Components/HeaderLogo
 * @component HeaderLogo
 * @description Subcomponent logo thương hiệu Sạp Phim sử dụng component BrandLogo dùng chung.
 */

import React, { memo } from 'react';
import { Link } from 'react-router-dom';
import BrandLogo from '@/shared/components/common/brand-logo/BrandLogo';
import { ROUTES } from '@/shared/constants/routes.constants';

/**
 * @component HeaderLogo
 * @description Component hiển thị Logo cho Header, tự động thích ứng Dark/Light qua Design Tokens.
 */
const HeaderLogo = memo(() => {
  return (
    <Link
      to={ROUTES.HOME}
      className="app-header__logo-link"
      aria-label="Về trang chủ Sạp Phim"
    >
      <BrandLogo height={38} className="app-header__logo-img" />
    </Link>
  );
});

HeaderLogo.displayName = 'HeaderLogo';

export default HeaderLogo;