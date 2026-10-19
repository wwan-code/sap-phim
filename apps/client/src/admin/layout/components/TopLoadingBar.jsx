/**
 * @file TopLoadingBar.jsx
 * @module Admin/Layout/Components/TopLoadingBar
 * @description Thanh đỏ sát mép trên tiến dần khi chuyển trang, chạy đầy rồi mờ đi khi hoàn tất.
 */

import React, { memo } from 'react';
import PropTypes from 'prop-types';

import { useTopLoadingBar } from '../hooks/use-top-loading-bar';
import './top-loading-bar.scss';

/**
 * @component TopLoadingBar
 * @description Render thanh tải liên tục; chỉ thông báo hoàn tất khi trang và dữ liệu đã tải xong.
 */
export const TopLoadingBar = memo(({ isNavigating = false }) => {
  const { phase, progress } = useTopLoadingBar(isNavigating);

  if (phase === 'idle' || phase === 'pending') return null;

  return (
    <div
      className={`admin-top-loading-bar admin-top-loading-bar--${phase}`}
      data-progress={Math.round(progress)}
      role='progressbar'
      aria-label='Tiến trình chuyển trang'
      aria-valuetext={phase === 'loading' ? 'Đang tải trang' : 'Đã tải xong'}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={phase === 'loading' ? undefined : 100}
    >
      <div className='admin-top-loading-bar__fill' aria-hidden='true' />
    </div>
  );
});

TopLoadingBar.displayName = 'TopLoadingBar';

TopLoadingBar.propTypes = {
  /** Trạng thái chuyển trang và tải dữ liệu do layout cung cấp. */
  isNavigating: PropTypes.bool,
};

export default TopLoadingBar;
