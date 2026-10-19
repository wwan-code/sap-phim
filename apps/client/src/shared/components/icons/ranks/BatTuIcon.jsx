/**
 * @file BatTuIcon.jsx
 * @module Components/Icons/Ranks
 * @description Biểu tượng SVG Cấp bậc Bất Tử (Lv.81 - 95) chuẩn Dual-tone Cinematic Gradient.
 */

import React, { memo } from 'react';

const BatTuIcon = memo(({ size = 20, className = '', style = {}, ...props }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`rank-icon rank-icon--bat-tu ${className}`}
      style={{ verticalAlign: 'middle', display: 'inline-block', flexShrink: 0, ...style }}
      aria-hidden="true"
      {...props}
    >
      <defs>
        <linearGradient id="sp-rk-bt-gem" x1="12" y1="3" x2="12" y2="22" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#E040FB" />
          <stop offset="35%" stopColor="#7C4DFF" />
          <stop offset="70%" stopColor="#651FFF" />
          <stop offset="100%" stopColor="#311B92" />
        </linearGradient>
        <linearGradient id="sp-rk-bt-table" x1="6" y1="3" x2="18" y2="9" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#EDE7F6" />
          <stop offset="100%" stopColor="#B388FF" />
        </linearGradient>
        <linearGradient id="sp-rk-bt-facet1" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#D1C4E9" />
          <stop offset="100%" stopColor="#7C4DFF" />
        </linearGradient>
        <linearGradient id="sp-rk-bt-facet2" x1="1" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#B388FF" />
          <stop offset="100%" stopColor="#512DA8" />
        </linearGradient>
      </defs>

      {/* Main Diamond Outline Shell */}
      <polygon
        points="6,3 18,3 22.5,9.5 12,22 1.5,9.5"
        fill="url(#sp-rk-bt-gem)"
        stroke="#EDE7F6"
        strokeWidth="0.8"
        strokeLinejoin="round"
      />

      {/* Crown Table (Top horizontal facet) */}
      <polygon points="6,3 18,3 15,9.5 9,9.5" fill="url(#sp-rk-bt-table)" stroke="#FFFFFF" strokeWidth="0.5" />

      {/* Crown Star Facets (Left & Right top triangles) */}
      <polygon points="6,3 9,9.5 1.5,9.5" fill="url(#sp-rk-bt-facet1)" stroke="#EDE7F6" strokeWidth="0.5" />
      <polygon points="18,3 22.5,9.5 15,9.5" fill="url(#sp-rk-bt-facet2)" stroke="#EDE7F6" strokeWidth="0.5" />

      {/* Pavilion Facets (Bottom triangles to culet) */}
      <polygon points="1.5,9.5 9,9.5 12,22" fill="#4A148C" stroke="#7C4DFF" strokeWidth="0.5" opacity="0.9" />
      <polygon points="9,9.5 15,9.5 12,22" fill="url(#sp-rk-bt-table)" stroke="#EDE7F6" strokeWidth="0.5" />
      <polygon points="15,9.5 22.5,9.5 12,22" fill="#311B92" stroke="#7C4DFF" strokeWidth="0.5" opacity="0.9" />

      {/* Diamond Sparkle Flare on Top Left */}
      <circle cx="5.5" cy="4.5" r="1.2" fill="#FFFFFF" />
      <polygon points="5.5,2.5 6,4 7.5,4.5 6,5 5.5,6.5 5,5 3.5,4.5 5,4" fill="#FFFFFF" />
    </svg>
  );
});

BatTuIcon.displayName = 'BatTuIcon';
export default BatTuIcon;
