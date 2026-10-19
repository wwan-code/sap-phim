/**
 * @file KhanGiaIcon.jsx
 * @module Components/Icons/Ranks
 * @description Biểu tượng SVG Cấp bậc Khán Giả (Lv.1 - 5) chuẩn Dual-tone Cinematic Gradient.
 */

import React, { memo } from 'react';

const KhanGiaIcon = memo(({ size = 20, className = '', style = {}, ...props }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`rank-icon rank-icon--khan-gia ${className}`}
      style={{ verticalAlign: 'middle', display: 'inline-block', flexShrink: 0, ...style }}
      aria-hidden="true"
      {...props}
    >
      <defs>
        <linearGradient id="sp-rk-kg-body" x1="2" y1="9" x2="22" y2="21" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#757575" />
          <stop offset="50%" stopColor="#424242" />
          <stop offset="100%" stopColor="#212121" />
        </linearGradient>
        <linearGradient id="sp-rk-kg-clapper" x1="2" y1="3" x2="22" y2="9" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#BDBDBD" />
          <stop offset="50%" stopColor="#9E9E9E" />
          <stop offset="100%" stopColor="#616161" />
        </linearGradient>
        <linearGradient id="sp-rk-kg-stripe" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#E0E0E0" stopOpacity="0.6" />
        </linearGradient>
      </defs>
      {/* Slate Body */}
      <rect x="3" y="9" width="18" height="12" rx="2" fill="url(#sp-rk-kg-body)" stroke="#9E9E9E" strokeWidth="1" />
      {/* Slate Text Lines */}
      <line x1="6" y1="13" x2="12" y2="13" stroke="#BDBDBD" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="6" y1="16" x2="15" y2="16" stroke="#757575" strokeWidth="1" strokeLinecap="round" />
      <line x1="6" y1="18.5" x2="10" y2="18.5" stroke="#616161" strokeWidth="1" strokeLinecap="round" />
      {/* Clapper Top Board (Open at an angle) */}
      <path
        d="M2.5 7.5L20.5 3.5C21.3 3.3 22 3.9 21.8 4.7L21.4 6.5C21.2 7.3 20.4 7.8 19.6 8L1.6 12C0.8 12.2 0.1 11.6 0.3 10.8L0.7 9C0.9 8.2 1.7 7.7 2.5 7.5Z"
        fill="url(#sp-rk-kg-clapper)"
        stroke="#E0E0E0"
        strokeWidth="0.75"
      />
      {/* Clapper Stripes */}
      <path d="M5.5 6.8L7.5 6.4L5 11.2L3 11.7L5.5 6.8Z" fill="url(#sp-rk-kg-stripe)" />
      <path d="M10.5 5.7L12.5 5.3L10 10.1L8 10.6L10.5 5.7Z" fill="url(#sp-rk-kg-stripe)" />
      <path d="M15.5 4.6L17.5 4.2L15 9.0L13 9.5L15.5 4.6Z" fill="url(#sp-rk-kg-stripe)" />
      {/* Hinge Pin */}
      <circle cx="3" cy="9.5" r="1.2" fill="#E0E0E0" stroke="#424242" strokeWidth="0.5" />
    </svg>
  );
});

KhanGiaIcon.displayName = 'KhanGiaIcon';
export default KhanGiaIcon;
