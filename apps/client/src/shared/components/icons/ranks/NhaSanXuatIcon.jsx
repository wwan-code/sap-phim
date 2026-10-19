/**
 * @file NhaSanXuatIcon.jsx
 * @module Components/Icons/Ranks
 * @description Biểu tượng SVG Cấp bậc Nhà Sản Xuất (Lv.58 - 68) chuẩn Dual-tone Cinematic Gradient.
 */

import React, { memo } from 'react';

const NhaSanXuatIcon = memo(({ size = 20, className = '', style = {}, ...props }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`rank-icon rank-icon--nha-san-xuat ${className}`}
      style={{ verticalAlign: 'middle', display: 'inline-block', flexShrink: 0, ...style }}
      aria-hidden="true"
      {...props}
    >
      <defs>
        <linearGradient id="sp-rk-nsx-crown" x1="2" y1="5" x2="22" y2="21" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFE082" />
          <stop offset="30%" stopColor="#FFA726" />
          <stop offset="70%" stopColor="#FB8C00" />
          <stop offset="100%" stopColor="#E65100" />
        </linearGradient>
        <linearGradient id="sp-rk-nsx-ruby" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FF5252" />
          <stop offset="100%" stopColor="#B71C1C" />
        </linearGradient>
        <linearGradient id="sp-rk-nsx-emerald" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#69F0AE" />
          <stop offset="100%" stopColor="#00796B" />
        </linearGradient>
      </defs>

      {/* Five Peak Crown Body */}
      <path
        d="M2.5 9.5L5.5 18H18.5L21.5 9.5L16.5 13L12 4.5L7.5 13L2.5 9.5Z"
        fill="url(#sp-rk-nsx-crown)"
        stroke="#FFF8E1"
        strokeWidth="0.8"
        strokeLinejoin="round"
      />

      {/* Crown Base Velvet Band */}
      <rect x="5.5" y="18" width="13" height="3" rx="1" fill="#D84315" stroke="#FFE082" strokeWidth="0.6" />

      {/* Pearl Spheres on Crown Peaks */}
      <circle cx="12" cy="4.2" r="1.5" fill="#FFF9C4" stroke="#FFA726" strokeWidth="0.5" />
      <circle cx="2.5" cy="9.2" r="1.2" fill="#FFF9C4" stroke="#FFA726" strokeWidth="0.4" />
      <circle cx="21.5" cy="9.2" r="1.2" fill="#FFF9C4" stroke="#FFA726" strokeWidth="0.4" />
      <circle cx="7.5" cy="12.8" r="0.9" fill="#FFF9C4" />
      <circle cx="16.5" cy="12.8" r="0.9" fill="#FFF9C4" />

      {/* Jewels on Base Band */}
      <circle cx="8" cy="19.5" r="0.9" fill="url(#sp-rk-nsx-emerald)" />
      <circle cx="12" cy="19.5" r="1.1" fill="url(#sp-rk-nsx-ruby)" />
      <circle cx="16" cy="19.5" r="0.9" fill="url(#sp-rk-nsx-emerald)" />

      {/* Center Crown Diamond Inset */}
      <polygon points="12,9.5 13.8,12 12,14.5 10.2,12" fill="#FFFDE7" opacity="0.9" />
    </svg>
  );
});

NhaSanXuatIcon.displayName = 'NhaSanXuatIcon';
export default NhaSanXuatIcon;
