/**
 * @file HiepSiIcon.jsx
 * @module Components/Icons/Ranks
 * @description Biểu tượng SVG Cấp bậc Hiệp Sĩ (Lv.39 - 47) chuẩn Dual-tone Cinematic Gradient.
 */

import React, { memo } from 'react';

const HiepSiIcon = memo(({ size = 20, className = '', style = {}, ...props }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`rank-icon rank-icon--hiep-si ${className}`}
      style={{ verticalAlign: 'middle', display: 'inline-block', flexShrink: 0, ...style }}
      aria-hidden="true"
      {...props}
    >
      <defs>
        <linearGradient id="sp-rk-hs-shield" x1="4" y1="2" x2="20" y2="22" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFAB91" />
          <stop offset="40%" stopColor="#FF7043" />
          <stop offset="100%" stopColor="#D84315" />
        </linearGradient>
        <linearGradient id="sp-rk-hs-gold" x1="12" y1="2" x2="12" y2="22" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFF8E1" />
          <stop offset="50%" stopColor="#FFE082" />
          <stop offset="100%" stopColor="#FFB300" />
        </linearGradient>
      </defs>

      {/* Outer Shield Shell */}
      <path
        d="M12 2L4 5V11.5C4 16.5 7.4 20.8 12 22C16.6 20.8 20 16.5 20 11.5V5L12 2Z"
        fill="url(#sp-rk-hs-shield)"
        stroke="url(#sp-rk-hs-gold)"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />

      {/* Inner Inset Rim */}
      <path
        d="M12 4L5.8 6.4V11.5C5.8 15.4 8.5 19 12 20.1C15.5 19 18.2 15.4 18.2 11.5V6.4L12 4Z"
        stroke="#FFCCBC"
        strokeWidth="0.6"
        strokeLinejoin="round"
        opacity="0.8"
      />

      {/* Medieval Cross on Shield Face */}
      <path
        d="M11 6.5H13V10H16.5V12H13V17.5H11V12H7.5V10H11V6.5Z"
        fill="url(#sp-rk-hs-gold)"
        stroke="#BF360C"
        strokeWidth="0.5"
      />

      {/* Center Star Diamond Flare */}
      <circle cx="12" cy="11" r="1.5" fill="#FFFFFF" />
      <polygon points="12,8.5 12.8,10.2 14.5,11 12.8,11.8 12,13.5 11.2,11.8 9.5,11 11.2,10.2" fill="#FFFFFF" />
    </svg>
  );
});

HiepSiIcon.displayName = 'HiepSiIcon';
export default HiepSiIcon;
