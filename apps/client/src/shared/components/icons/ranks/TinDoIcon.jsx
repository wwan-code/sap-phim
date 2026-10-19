/**
 * @file TinDoIcon.jsx
 * @module Components/Icons/Ranks
 * @description Biểu tượng SVG Cấp bậc Tín Đồ (Lv.11 - 15) chuẩn Dual-tone Cinematic Gradient.
 */

import React, { memo } from 'react';

const TinDoIcon = memo(({ size = 20, className = '', style = {}, ...props }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`rank-icon rank-icon--tin-do ${className}`}
      style={{ verticalAlign: 'middle', display: 'inline-block', flexShrink: 0, ...style }}
      aria-hidden="true"
      {...props}
    >
      <defs>
        <linearGradient id="sp-rk-td-outer" x1="2" y1="2" x2="20" y2="20" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#90CAF9" />
          <stop offset="40%" stopColor="#42A5F5" />
          <stop offset="100%" stopColor="#1565C0" />
        </linearGradient>
        <linearGradient id="sp-rk-td-strip" x1="12" y1="14" x2="22" y2="22" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#64B5F6" />
          <stop offset="100%" stopColor="#0D47A1" />
        </linearGradient>
      </defs>
      {/* Film Strip coming out */}
      <path
        d="M14 18C16 19 18.5 19.5 21 19C21.8 18.8 22.5 19.5 22.2 20.3C21.8 21.3 20 22 17.5 22C14.5 22 12 20 11 18"
        stroke="url(#sp-rk-td-strip)"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      {/* Main Film Reel Body */}
      <circle cx="11" cy="11" r="9" fill="url(#sp-rk-td-outer)" stroke="#BBDEFB" strokeWidth="0.8" />
      {/* Inner Metallic Ring */}
      <circle cx="11" cy="11" r="7.2" stroke="#E3F2FD" strokeWidth="0.75" strokeDasharray="1.5 1.5" />
      {/* Reel Cutout Circles */}
      <circle cx="11" cy="6" r="2" fill="#0A1128" opacity="0.85" />
      <circle cx="15.3" cy="8.5" r="2" fill="#0A1128" opacity="0.85" />
      <circle cx="15.3" cy="13.5" r="2" fill="#0A1128" opacity="0.85" />
      <circle cx="11" cy="16" r="2" fill="#0A1128" opacity="0.85" />
      <circle cx="6.7" cy="13.5" r="2" fill="#0A1128" opacity="0.85" />
      <circle cx="6.7" cy="8.5" r="2" fill="#0A1128" opacity="0.85" />
      {/* Center Core Spindle */}
      <circle cx="11" cy="11" r="2.2" fill="#E3F2FD" />
      <circle cx="11" cy="11" r="1.1" fill="#0D47A1" />
    </svg>
  );
});

TinDoIcon.displayName = 'TinDoIcon';
export default TinDoIcon;
