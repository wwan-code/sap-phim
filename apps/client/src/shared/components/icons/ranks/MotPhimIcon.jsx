/**
 * @file MotPhimIcon.jsx
 * @module Components/Icons/Ranks
 * @description Biểu tượng SVG Cấp bậc Mọt Phim (Lv.6 - 10) chuẩn Dual-tone Cinematic Gradient.
 */

import React, { memo } from 'react';

const MotPhimIcon = memo(({ size = 20, className = '', style = {}, ...props }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`rank-icon rank-icon--mot-phim ${className}`}
      style={{ verticalAlign: 'middle', display: 'inline-block', flexShrink: 0, ...style }}
      aria-hidden="true"
      {...props}
    >
      <defs>
        <linearGradient id="sp-rk-mp-box" x1="5" y1="10" x2="19" y2="22" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#A1887F" />
          <stop offset="50%" stopColor="#8D6E63" />
          <stop offset="100%" stopColor="#4E342E" />
        </linearGradient>
        <linearGradient id="sp-rk-mp-stripe" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#E53935" />
          <stop offset="100%" stopColor="#B71C1C" />
        </linearGradient>
        <linearGradient id="sp-rk-mp-pop" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFF9C4" />
          <stop offset="60%" stopColor="#FDD835" />
          <stop offset="100%" stopColor="#F57F17" />
        </linearGradient>
      </defs>
      {/* Popcorn Clusters on top */}
      <circle cx="7.5" cy="8.5" r="2.8" fill="url(#sp-rk-mp-pop)" />
      <circle cx="16.5" cy="8.5" r="2.8" fill="url(#sp-rk-mp-pop)" />
      <circle cx="10" cy="5.5" r="3" fill="url(#sp-rk-mp-pop)" />
      <circle cx="14" cy="5.5" r="3" fill="url(#sp-rk-mp-pop)" />
      <circle cx="12" cy="7.5" r="2.6" fill="#FFFDE7" />
      <circle cx="12" cy="4" r="2.2" fill="url(#sp-rk-mp-pop)" />

      {/* Popcorn Box (Trapezoid) */}
      <path
        d="M5 10L6.8 21.2C6.9 21.7 7.3 22 7.8 22H16.2C16.7 22 17.1 21.7 17.2 21.2L19 10H5Z"
        fill="url(#sp-rk-mp-box)"
        stroke="#D7CCC8"
        strokeWidth="0.8"
      />
      {/* Red & Cream Stripes */}
      <path d="M7 10.2L8.2 21.8H9.8L8.6 10.2H7Z" fill="url(#sp-rk-mp-stripe)" />
      <path d="M11.2 10.2L11.4 21.8H12.6L12.8 10.2H11.2Z" fill="url(#sp-rk-mp-stripe)" />
      <path d="M15.4 10.2L14.2 21.8H15.8L17 10.2H15.4Z" fill="url(#sp-rk-mp-stripe)" />
      {/* Top Rim of Box */}
      <path d="M4.5 9.5C4.5 9.5 7 10.5 12 10.5C17 10.5 19.5 9.5 19.5 9.5" stroke="#FFE082" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
});

MotPhimIcon.displayName = 'MotPhimIcon';
export default MotPhimIcon;
