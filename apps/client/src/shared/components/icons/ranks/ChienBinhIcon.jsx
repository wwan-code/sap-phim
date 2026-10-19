/**
 * @file ChienBinhIcon.jsx
 * @module Components/Icons/Ranks
 * @description Biểu tượng SVG Cấp bậc Chiến Binh (Lv.31 - 38) chuẩn Dual-tone Cinematic Gradient.
 */

import React, { memo } from 'react';

const ChienBinhIcon = memo(({ size = 20, className = '', style = {}, ...props }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`rank-icon rank-icon--chien-binh ${className}`}
      style={{ verticalAlign: 'middle', display: 'inline-block', flexShrink: 0, ...style }}
      aria-hidden="true"
      {...props}
    >
      <defs>
        <linearGradient id="sp-rk-cb-blade" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="30%" stopColor="#FFCDD2" />
          <stop offset="70%" stopColor="#EF5350" />
          <stop offset="100%" stopColor="#B71C1C" />
        </linearGradient>
        <linearGradient id="sp-rk-cb-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FFE082" />
          <stop offset="100%" stopColor="#FF8F00" />
        </linearGradient>
      </defs>

      {/* Sword 1: Top-Left to Bottom-Right */}
      {/* Blade */}
      <path
        d="M20.5 3.5C18.5 4.5 12 9.5 9.5 12.5L11.5 14.5C14.5 12 19.5 5.5 20.5 3.5Z"
        fill="url(#sp-rk-cb-blade)"
        stroke="#FFCDD2"
        strokeWidth="0.6"
      />
      {/* Central fuller ridge line */}
      <line x1="20" y1="4" x2="11" y2="13" stroke="#FFFFFF" strokeWidth="0.6" />
      {/* Crossguard */}
      <path d="M7 11L12.5 16.5L11 18L5.5 12.5L7 11Z" fill="url(#sp-rk-cb-gold)" rx="0.5" />
      {/* Grip Handle */}
      <line x1="7.5" y1="15.5" x2="4.5" y2="18.5" stroke="#D32F2F" strokeWidth="1.8" strokeLinecap="round" />
      {/* Pommel */}
      <circle cx="3.8" cy="19.2" r="1.5" fill="url(#sp-rk-cb-gold)" stroke="#B71C1C" strokeWidth="0.5" />

      {/* Sword 2: Top-Right to Bottom-Left */}
      {/* Blade */}
      <path
        d="M3.5 3.5C5.5 4.5 12 9.5 14.5 12.5L12.5 14.5C9.5 12 4.5 5.5 3.5 3.5Z"
        fill="url(#sp-rk-cb-blade)"
        stroke="#FFCDD2"
        strokeWidth="0.6"
      />
      {/* Central fuller ridge line */}
      <line x1="4" y1="4" x2="13" y2="13" stroke="#FFFFFF" strokeWidth="0.6" />
      {/* Crossguard */}
      <path d="M17 11L11.5 16.5L13 18L18.5 12.5L17 11Z" fill="url(#sp-rk-cb-gold)" rx="0.5" />
      {/* Grip Handle */}
      <line x1="16.5" y1="15.5" x2="19.5" y2="18.5" stroke="#D32F2F" strokeWidth="1.8" strokeLinecap="round" />
      {/* Pommel */}
      <circle cx="20.2" cy="19.2" r="1.5" fill="url(#sp-rk-cb-gold)" stroke="#B71C1C" strokeWidth="0.5" />

      {/* Center Clash Flare */}
      <circle cx="12" cy="13.5" r="1.2" fill="#FFFFFF" />
    </svg>
  );
});

ChienBinhIcon.displayName = 'ChienBinhIcon';
export default ChienBinhIcon;
