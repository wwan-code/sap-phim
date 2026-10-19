/**
 * @file TuTruongIcon.jsx
 * @module Components/Icons/Ranks
 * @description Biểu tượng SVG Cấp bậc Tư Trưởng (Lv.23 - 30) chuẩn Dual-tone Cinematic Gradient.
 */

import React, { memo } from 'react';

const TuTruongIcon = memo(({ size = 20, className = '', style = {}, ...props }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`rank-icon rank-icon--tu-truong ${className}`}
      style={{ verticalAlign: 'middle', display: 'inline-block', flexShrink: 0, ...style }}
      aria-hidden="true"
      {...props}
    >
      <defs>
        <linearGradient id="sp-rk-tt-body" x1="3" y1="7" x2="16" y2="17" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#CE93D8" />
          <stop offset="50%" stopColor="#AB47BC" />
          <stop offset="100%" stopColor="#4A148C" />
        </linearGradient>
        <linearGradient id="sp-rk-tt-beam" x1="16" y1="12" x2="23" y2="12" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#E1BEE7" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#BA68C8" stopOpacity="0.1" />
        </linearGradient>
      </defs>
      {/* Light Projection Rays */}
      <path d="M16 10.5L23 7.5V16.5L16 13.5V10.5Z" fill="url(#sp-rk-tt-beam)" />

      {/* Top Dual Film Reels on arms */}
      <path d="M5.5 8.5L3.5 4.5" stroke="#BA68C8" strokeWidth="1.2" strokeLinecap="round" />
      <circle cx="3.5" cy="4.5" r="2.5" fill="#7B1FA2" stroke="#E1BEE7" strokeWidth="0.75" />
      <circle cx="3.5" cy="4.5" r="0.8" fill="#F3E5F5" />

      <path d="M11.5 8.5L13.5 3.5" stroke="#BA68C8" strokeWidth="1.2" strokeLinecap="round" />
      <circle cx="13.5" cy="3.5" r="3" fill="#7B1FA2" stroke="#E1BEE7" strokeWidth="0.75" />
      <circle cx="13.5" cy="3.5" r="1" fill="#F3E5F5" />

      {/* Projector Body Box */}
      <rect x="2" y="8" width="14" height="9" rx="2" fill="url(#sp-rk-tt-body)" stroke="#E1BEE7" strokeWidth="0.8" />
      {/* Lens Barrel */}
      <rect x="15" y="10" width="3" height="4.5" rx="1" fill="#BA68C8" stroke="#F3E5F5" strokeWidth="0.6" />
      <circle cx="7" cy="12.5" r="1.8" fill="#4A148C" stroke="#CE93D8" strokeWidth="0.5" />
      <circle cx="11.5" cy="12.5" r="1.2" fill="#CE93D8" />

      {/* Tripod Legs */}
      <path d="M5 17L3 22" stroke="#BA68C8" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M9 17V22" stroke="#CE93D8" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M13 17L15 22" stroke="#BA68C8" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
});

TuTruongIcon.displayName = 'TuTruongIcon';
export default TuTruongIcon;
