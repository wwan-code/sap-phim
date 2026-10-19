/**
 * @file SieuSaoIcon.jsx
 * @module Components/Icons/Ranks
 * @description Biểu tượng SVG Cấp bậc Siêu Sao (Lv.69 - 80) chuẩn Dual-tone Cinematic Gradient.
 */

import React, { memo } from 'react';

const SieuSaoIcon = memo(({ size = 20, className = '', style = {}, ...props }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`rank-icon rank-icon--sieu-sao ${className}`}
      style={{ verticalAlign: 'middle', display: 'inline-block', flexShrink: 0, ...style }}
      aria-hidden="true"
      {...props}
    >
      <defs>
        <linearGradient id="sp-rk-ss-star" x1="12" y1="1" x2="12" y2="23" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFFDE7" />
          <stop offset="25%" stopColor="#FFEE58" />
          <stop offset="70%" stopColor="#FDD835" />
          <stop offset="100%" stopColor="#F57F17" />
        </linearGradient>
        <radialGradient id="sp-rk-ss-glow" cx="12" cy="12" r="10" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFF9C4" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#FBC02D" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Ambient Glow Disk */}
      <circle cx="12" cy="12" r="10" fill="url(#sp-rk-ss-glow)" />

      {/* Outer 5-Point Star */}
      <polygon
        points="12,1.5 15.1,8.2 22.5,9.1 17,14.2 18.5,21.5 12,17.9 5.5,21.5 7,14.2 1.5,9.1 8.9,8.2"
        fill="url(#sp-rk-ss-star)"
        stroke="#FFF9C4"
        strokeWidth="0.8"
        strokeLinejoin="round"
      />

      {/* Inner Inset Star Outline */}
      <polygon
        points="12,4.5 14.2,9.2 19.5,9.8 15.5,13.5 16.6,18.8 12,16.2 7.4,18.8 8.5,13.5 4.5,9.8 9.8,9.2"
        stroke="#FFFFFF"
        strokeWidth="0.5"
        strokeLinejoin="round"
        opacity="0.75"
      />

      {/* Center Facet Lines */}
      <line x1="12" y1="1.5" x2="12" y2="12" stroke="#FFFDE7" strokeWidth="0.8" />
      <line x1="22.5" y1="9.1" x2="12" y2="12" stroke="#FFF59D" strokeWidth="0.7" opacity="0.8" />
      <line x1="18.5" y1="21.5" x2="12" y2="12" stroke="#F57F17" strokeWidth="0.7" opacity="0.6" />
      <line x1="5.5" y1="21.5" x2="12" y2="12" stroke="#F57F17" strokeWidth="0.7" opacity="0.6" />
      <line x1="1.5" y1="9.1" x2="12" y2="12" stroke="#FFF59D" strokeWidth="0.7" opacity="0.8" />

      {/* Center Diamond Light Reflection */}
      <circle cx="12" cy="12" r="1.8" fill="#FFFFFF" />
    </svg>
  );
});

SieuSaoIcon.displayName = 'SieuSaoIcon';
export default SieuSaoIcon;
