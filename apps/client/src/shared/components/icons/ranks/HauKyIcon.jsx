/**
 * @file HauKyIcon.jsx
 * @module Components/Icons/Ranks
 * @description Biểu tượng SVG Cấp bậc Hậu Kỳ (Lv.16 - 22) chuẩn Dual-tone Cinematic Gradient.
 */

import React, { memo } from 'react';

const HauKyIcon = memo(({ size = 20, className = '', style = {}, ...props }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`rank-icon rank-icon--hau-ky ${className}`}
      style={{ verticalAlign: 'middle', display: 'inline-block', flexShrink: 0, ...style }}
      aria-hidden="true"
      {...props}
    >
      <defs>
        <linearGradient id="sp-rk-hk-body" x1="2" y1="8" x2="16" y2="20" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#81C784" />
          <stop offset="50%" stopColor="#43A047" />
          <stop offset="100%" stopColor="#1B5E20" />
        </linearGradient>
        <linearGradient id="sp-rk-hk-reels" x1="4" y1="2" x2="14" y2="9" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#A5D6A7" />
          <stop offset="100%" stopColor="#2E7D32" />
        </linearGradient>
        <linearGradient id="sp-rk-hk-lens" x1="16" y1="10" x2="22" y2="18" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#C8E6C9" />
          <stop offset="100%" stopColor="#388E3C" />
        </linearGradient>
      </defs>
      {/* Top Film Magazine Reels (Classic Two-circle magazine) */}
      <circle cx="6.5" cy="5.5" r="3.5" fill="url(#sp-rk-hk-reels)" stroke="#C8E6C9" strokeWidth="0.75" />
      <circle cx="6.5" cy="5.5" r="1.2" fill="#1B5E20" />
      <circle cx="12.5" cy="5.5" r="3.5" fill="url(#sp-rk-hk-reels)" stroke="#C8E6C9" strokeWidth="0.75" />
      <circle cx="12.5" cy="5.5" r="1.2" fill="#1B5E20" />

      {/* Main Camera Body */}
      <rect x="3" y="8" width="13" height="12" rx="2" fill="url(#sp-rk-hk-body)" stroke="#A5D6A7" strokeWidth="0.8" />
      {/* Side Status Indicators & Buttons */}
      <circle cx="5.5" cy="11.5" r="1" fill="#E8F5E9" />
      <circle cx="5.5" cy="14.5" r="1" fill="#C8E6C9" opacity="0.7" />
      <rect x="8.5" y="11" width="5.5" height="4" rx="0.8" fill="#1B5E20" stroke="#81C784" strokeWidth="0.5" />

      {/* Lens Hood / Projection Conical Bell */}
      <path
        d="M16 11.2L20.8 8.2C21.4 7.8 22.2 8.3 22.2 9V17C22.2 17.7 21.4 18.2 20.8 17.8L16 14.8V11.2Z"
        fill="url(#sp-rk-hk-lens)"
        stroke="#E8F5E9"
        strokeWidth="0.8"
      />
      {/* Lens Aperture Glare */}
      <line x1="19.5" y1="10.5" x2="20.5" y2="15.5" stroke="#FFFFFF" strokeWidth="0.8" strokeLinecap="round" opacity="0.6" />
    </svg>
  );
});

HauKyIcon.displayName = 'HauKyIcon';
export default HauKyIcon;
