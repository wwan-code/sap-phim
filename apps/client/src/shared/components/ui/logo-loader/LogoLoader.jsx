/**
 * @file LogoLoader.jsx
 * @module Components/UI/LogoLoader
 * @component LogoLoader
 * @description Component hiệu ứng Animated Logo Loading đặc trưng của Sạp Phim (Infinite Stroke Draw & Ambient Glow) theo chuẩn Material 3 Expressive.
 */

import React, { memo, forwardRef, useId } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';

import './logo-loader.scss';

/**
 * @component LogoLoader
 * @description Hiển thị logo hoạt họa dạng stroke drawing độc quyền của ứng dụng
 */
export const LogoLoader = forwardRef(
  (
    {
      size = 'md',
      color = 'brand',
      showWordmark = false,
      text = '',
      loop = true,
      className = '',
      ...rest
    },
    ref
  ) => {
    const rawId = useId();
    const maskId = `sp-logo-mask-${rawId.replace(/:/g, '')}`;

    const isFullscreen = size === 'fullscreen';

    const rootClasses = classNames(
      'logo-loader',
      `logo-loader--size-${size}`,
      `logo-loader--color-${color}`,
      {
        'logo-loader--loop': loop,
        'logo-loader--fullscreen': isFullscreen,
        'logo-loader--has-wordmark': showWordmark,
      },
      className
    );

    return (
      <div
        ref={ref}
        className={rootClasses}
        role="status"
        aria-label={text || 'Đang tải Sạp Phim...'}
        aria-live="polite"
        {...rest}
      >
        <div className="logo-loader__inner">
          {/* 1. Ambient Glow Backdrop */}
          <div className="logo-loader__ambient-glow" aria-hidden="true" />

          {/* 2. Animated Vector Logo */}
          <div className="logo-loader__icon-wrapper">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 200 200"
              className="logo-loader__svg"
              aria-hidden="true"
            >
              <defs>
                <mask id={maskId}>
                  <rect width="200" height="200" fill="#FFFFFF" />
                  <path
                    d="M 100 45 C 110 60, 135 85, 135 115 C 135 135, 120 145, 100 145 C 80 145, 65 135, 65 115 C 65 85, 90 60, 100 45 Z"
                    fill="#000000"
                    stroke="#000000"
                    strokeWidth="4"
                    strokeLinejoin="round"
                  />
                </mask>
              </defs>

              <g
                fill="none"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="logo-loader__strokes"
              >
                {/* Tent (Mái Lều) */}
                <g mask={`url(#${maskId})`} className="logo-loader__group-tent">
                  <path
                    pathLength="100"
                    className="logo-loader__path logo-loader__path--tent-1"
                    d="M 100 45 L 35 85 Q 45 95 55 87 Q 65 95 75 85 Q 85 95 100 78"
                  />
                  <path
                    pathLength="100"
                    className="logo-loader__path logo-loader__path--tent-2"
                    d="M 55 87 Q 75 65 100 45"
                  />
                  <path
                    pathLength="100"
                    className="logo-loader__path logo-loader__path--tent-3"
                    d="M 75 85 Q 85 65 100 45"
                  />

                  <path
                    pathLength="100"
                    className="logo-loader__path logo-loader__path--tent-4"
                    d="M 100 45 L 165 85 Q 155 95 145 87 Q 135 95 125 85 Q 115 95 100 78"
                  />
                  <path
                    pathLength="100"
                    className="logo-loader__path logo-loader__path--tent-5"
                    d="M 145 87 Q 125 65 100 45"
                  />
                  <path
                    pathLength="100"
                    className="logo-loader__path logo-loader__path--tent-6"
                    d="M 125 85 Q 115 65 100 45"
                  />
                </g>

                {/* Base (Khung đế) */}
                <path
                  pathLength="100"
                  className="logo-loader__path logo-loader__path--base"
                  d="M 65 110 C 45 145, 75 155, 100 155 C 125 155, 155 145, 135 110"
                />

                {/* Drop (Giọt điện ảnh) */}
                <path
                  pathLength="100"
                  className="logo-loader__path logo-loader__path--drop"
                  d="M 100 45 C 110 60, 135 85, 135 115 C 135 135, 120 145, 100 145 C 80 145, 65 135, 65 115 C 65 85, 90 60, 100 45 Z"
                />

                {/* Play Icon */}
                <path
                  pathLength="100"
                  className="logo-loader__path logo-loader__path--play"
                  d="M 92 94 L 114 105 L 92 116 Z"
                />
              </g>
            </svg>
          </div>

          {/* 3. Wordmark (Tùy chọn) */}
          {showWordmark && (
            <div className="logo-loader__wordmark" aria-hidden="true">
              <span className="logo-loader__brand-title">
                SẠP <span className="logo-loader__brand-accent">PHIM</span>
              </span>
              <span className="logo-loader__brand-tagline">CINEMA EXPERIENCE</span>
            </div>
          )}

          {/* 4. Subtitle Text */}
          {text && <p className="logo-loader__text">{text}</p>}
        </div>

        <span className="logo-loader__sr-only">{text || 'Đang tải Sạp Phim...'}</span>
      </div>
    );
  }
);

LogoLoader.displayName = 'LogoLoader';

LogoLoader.propTypes = {
  /** Kích thước của loader */
  size: PropTypes.oneOf(['sm', 'md', 'lg', 'xl', 'fullscreen']),
  /** Bộ màu phong cách */
  color: PropTypes.oneOf(['brand', 'monochrome', 'accent']),
  /** Hiển thị chữ Sạp Phim bên dưới logo */
  showWordmark: PropTypes.bool,
  /** Dòng chữ thông báo bên dưới */
  text: PropTypes.string,
  /** Hoạt ảnh lặp tuần hoàn */
  loop: PropTypes.bool,
  /** Class bổ sung */
  className: PropTypes.string,
};

export default memo(LogoLoader);
