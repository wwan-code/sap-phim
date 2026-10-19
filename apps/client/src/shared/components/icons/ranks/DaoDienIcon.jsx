/**
 * @file DaoDienIcon.jsx
 * @module Components/Icons/Ranks
 * @description Biểu tượng SVG Cấp bậc Đạo Diễn (Lv.48 - 57) chuẩn Dual-tone Cinematic Gradient.
 */

import React, { memo } from 'react';

const DaoDienIcon = memo(({ size = 20, className = '', style = {}, ...props }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`rank-icon rank-icon--dao-dien ${className}`}
      style={{ verticalAlign: 'middle', display: 'inline-block', flexShrink: 0, ...style }}
      aria-hidden="true"
      {...props}
    >
      <defs>
        <linearGradient id="sp-rk-dd-canvas" x1="4" y1="4" x2="16" y2="12" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#80DEEA" />
          <stop offset="50%" stopColor="#26C6DA" />
          <stop offset="100%" stopColor="#00838F" />
        </linearGradient>
        <linearGradient id="sp-rk-dd-wood" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#E0F7FA" />
          <stop offset="100%" stopColor="#0097A7" />
        </linearGradient>
        <linearGradient id="sp-rk-dd-cone" x1="12" y1="12" x2="22" y2="18" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#E0F7FA" />
          <stop offset="60%" stopColor="#26C6DA" />
          <stop offset="100%" stopColor="#006064" />
        </linearGradient>
      </defs>

      {/* Director Chair: Canvas Backrest */}
      <rect x="4" y="4" width="10" height="4.5" rx="1" fill="url(#sp-rk-dd-canvas)" stroke="#B2EBF2" strokeWidth="0.6" />
      <line x1="6" y1="6.2" x2="12" y2="6.2" stroke="#E0F7FA" strokeWidth="0.8" strokeLinecap="round" />

      {/* Chair Canvas Seat */}
      <rect x="3.5" y="10.5" width="11" height="2.5" rx="0.6" fill="url(#sp-rk-dd-canvas)" stroke="#80DEEA" strokeWidth="0.5" />

      {/* Chair Legs (Crossed Scissor Frame) */}
      <line x1="4.5" y1="8.5" x2="4.5" y2="10.5" stroke="url(#sp-rk-dd-wood)" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="13.5" y1="8.5" x2="13.5" y2="10.5" stroke="url(#sp-rk-dd-wood)" strokeWidth="1.2" strokeLinecap="round" />

      {/* Scissor legs X */}
      <line x1="4.5" y1="13" x2="13.5" y2="21" stroke="url(#sp-rk-dd-wood)" strokeWidth="1.3" strokeLinecap="round" />
      <line x1="13.5" y1="13" x2="4.5" y2="21" stroke="url(#sp-rk-dd-wood)" strokeWidth="1.3" strokeLinecap="round" />
      {/* Pivot rivet */}
      <circle cx="9" cy="17" r="0.8" fill="#FFFFFF" />

      {/* Megaphone / Bullhorn in foreground */}
      <path
        d="M13.5 14L21.5 10.5C22.2 10.2 23 10.7 23 11.5V16.5C23 17.3 22.2 17.8 21.5 17.5L13.5 14Z"
        fill="url(#sp-rk-dd-cone)"
        stroke="#E0F7FA"
        strokeWidth="0.75"
      />
      {/* Megaphone Mouthpiece */}
      <rect x="12" y="13" width="2" height="2" rx="0.5" fill="#E0F7FA" stroke="#00838F" strokeWidth="0.5" />
      {/* Megaphone Handle */}
      <path d="M15.5 14.8L16.5 18C16.6 18.4 16.3 18.8 15.9 18.8H14.8" stroke="#80DEEA" strokeWidth="1" strokeLinecap="round" />
    </svg>
  );
});

DaoDienIcon.displayName = 'DaoDienIcon';
export default DaoDienIcon;
