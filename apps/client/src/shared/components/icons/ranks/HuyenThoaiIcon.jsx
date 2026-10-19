/**
 * @file HuyenThoaiIcon.jsx
 * @module Components/Icons/Ranks
 * @description Biểu tượng SVG Cấp bậc Huyền Thoại (Lv.96 - 100) chuẩn Dual-tone Cinematic Gradient.
 */

import React, { memo } from 'react';

const HuyenThoaiIcon = memo(({ size = 20, className = '', style = {}, ...props }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`rank-icon rank-icon--huyen-thoai ${className}`}
      style={{ verticalAlign: 'middle', display: 'inline-block', flexShrink: 0, ...style }}
      aria-hidden="true"
      {...props}
    >
      <defs>
        <linearGradient id="sp-rk-ht-gold" x1="4" y1="2" x2="20" y2="20" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFFDE7" />
          <stop offset="25%" stopColor="#FFEE58" />
          <stop offset="60%" stopColor="#FFD700" />
          <stop offset="85%" stopColor="#FF8F00" />
          <stop offset="100%" stopColor="#E65100" />
        </linearGradient>
        <linearGradient id="sp-rk-ht-pedestal" x1="6" y1="18" x2="18" y2="22" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#424242" />
          <stop offset="50%" stopColor="#212121" />
          <stop offset="100%" stopColor="#121212" />
        </linearGradient>
        <radialGradient id="sp-rk-ht-halo" cx="12" cy="7" r="7" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFF9C4" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#FFD700" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Divine Aura Halo */}
      <circle cx="12" cy="7" r="6" fill="url(#sp-rk-ht-halo)" />

      {/* Left Trophy Ear Handle */}
      <path
        d="M7 4.5C4 4.5 3 7 3 9.5C3 12 5 13.5 7 13.5"
        stroke="url(#sp-rk-ht-gold)"
        strokeWidth="1.8"
        strokeLinecap="round"
      />

      {/* Right Trophy Ear Handle */}
      <path
        d="M17 4.5C20 4.5 21 7 21 9.5C21 12 19 13.5 17 13.5"
        stroke="url(#sp-rk-ht-gold)"
        strokeWidth="1.8"
        strokeLinecap="round"
      />

      {/* Main Trophy Chalice / Cup Body */}
      <path
        d="M6 3H18V8.5C18 12 15.3 14.8 12 14.8C8.7 14.8 6 12 6 8.5V3Z"
        fill="url(#sp-rk-ht-gold)"
        stroke="#FFF9C4"
        strokeWidth="0.8"
        strokeLinejoin="round"
      />

      {/* Trophy Rim Lip */}
      <rect x="5.5" y="2.2" width="13" height="1.8" rx="0.9" fill="#FFFDE7" stroke="#FFB300" strokeWidth="0.5" />

      {/* Star / Laurel Emblem on Cup Body */}
      <polygon points="12,5.5 12.8,7.2 14.5,7.5 13.2,8.8 13.6,10.5 12,9.6 10.4,10.5 10.8,8.8 9.5,7.5 11.2,7.2" fill="#FFFFFF" />

      {/* Cup Stem */}
      <path d="M10.5 14.5V17.5C10.5 18 10 18.5 9.5 18.5H14.5C14 18.5 13.5 18 13.5 17.5V14.5" fill="url(#sp-rk-ht-gold)" stroke="#FFB300" strokeWidth="0.5" />

      {/* Pedestal Base */}
      <rect x="6.5" y="18.5" width="11" height="3.5" rx="1" fill="url(#sp-rk-ht-pedestal)" stroke="#FFD700" strokeWidth="0.8" />
      <line x1="8.5" y1="20.2" x2="15.5" y2="20.2" stroke="#FFD700" strokeWidth="0.8" strokeLinecap="round" />

      {/* Legendary Sparkle Star */}
      <circle cx="12" cy="2.2" r="1.2" fill="#FFFFFF" />
    </svg>
  );
});

HuyenThoaiIcon.displayName = 'HuyenThoaiIcon';
export default HuyenThoaiIcon;
