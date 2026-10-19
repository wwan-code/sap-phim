/**
 * @file Footer.jsx
 * @module Components/Layout/Footer/Footer
 * @component Footer
 * @description Component chân trang (Footer) nâng cấp toàn diện theo chuẩn Material 3 Expressive, Clean Architecture và Aesthetic OS Design Tokens.
 */

import React, { memo, useId, useMemo } from 'react';
import { Link } from 'react-router-dom';

import BrandLogo from '@/shared/components/common/brand-logo/BrandLogo';
import {
  FOOTER_NAV_LINKS,
  FOOTER_SOCIAL_LINKS,
  getFooterDescription,
} from './footer.constants';
import { ROUTES } from '@/shared/constants/routes.constants';

import './footer.scss';

/**
 * Render icon SVG mạng xã hội chuẩn nét
 * @param {string} type - Loại icon
 * @returns {React.ReactNode}
 */
const renderSocialIcon = (type) => {
  switch (type) {
    case 'facebook':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
        </svg>
      );
    case 'twitter':
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      );
    case 'discord':
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.893.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
        </svg>
      );
    case 'youtube':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17" />
          <polygon points="10 15 15 12 10 9 10 15" fill="currentColor" />
        </svg>
      );
    default:
      return null;
  }
};

/**
 * @component Footer
 * @description Chân trang chuẩn Material 3 Expressive với nền trang trí Cinematic Anime, Anime Mascot SVG và danh mục liên kết tối ưu SEO.
 */
const Footer = () => {
  const currentYear = useMemo(() => new Date().getFullYear(), []);
  const footerDesc = useMemo(() => getFooterDescription(currentYear), [currentYear]);

  const rawId = useId();
  const safeId = useMemo(() => rawId.replace(/[^a-zA-Z0-9_-]/g, ''), [rawId]);
  const dropMaskId = `footer-drop-mask-${safeId}`;
  const lanternGlowId = `footer-lantern-glow-${safeId}`;
  const petalGlowId = `footer-petal-glow-${safeId}`;

  return (
    <footer className="footer">
      {/* Lớp nền trang trí nghệ thuật (Decorative Background Layer) */}
      <div className="footer__background" aria-hidden="true">
        <img
          src="/images/footer-dec.png"
          alt=""
          className="footer__decor"
          width="1600"
          height="209"
          loading="lazy"
          decoding="async"
        />
        <img
          src="/images/footer-bg.png"
          alt=""
          className="footer__bg-img"
          width="1600"
          height="767"
          loading="lazy"
          decoding="async"
        />
        <div className="footer__bg-overlay" />
      </div>

      <div className="footer__content-block">
        {/* Anime Mascot Vector nghệ thuật */}
        <div className="footer__icon" aria-hidden="true">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="30 40 140 120"
            className="footer__icon-anime"
          >
            <defs>
              <mask id={dropMaskId}>
                <rect width="200" height="200" fill="white" />
                <path
                  d="M 100 45 C 110 60, 135 85, 135 115 C 135 135, 120 145, 100 145 C 80 145, 65 135, 65 115 C 65 85, 90 60, 100 45 Z"
                  fill="black"
                  stroke="black"
                  strokeWidth="10"
                  strokeLinejoin="round"
                />
              </mask>
              <filter id={lanternGlowId} x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="5" result="blur" />
              </filter>
              <filter id={petalGlowId} x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="2" result="blur" />
              </filter>
            </defs>

            <g fill="none" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round">
              <g strokeWidth="0">
                <g transform="translate(38, 65) rotate(-20) scale(0.8)">
                  <path d="M 0 -12 C 8 -5, 10 5, 6 10 L 0 5 L -6 10 C -10 5, -8 -5, 0 -12 Z" fill="currentColor" />
                </g>
                <g transform="translate(40, 120) rotate(15) scale(0.7)">
                  <path d="M 0 -12 C 8 -5, 10 5, 6 10 L 0 5 L -6 10 C -10 5, -8 -5, 0 -12 Z" fill="currentColor" />
                </g>
                <g transform="translate(50, 105) rotate(-45) scale(0.5)">
                  <path d="M 0 -12 C 8 -5, 10 5, 6 10 L 0 5 L -6 10 C -10 5, -8 -5, 0 -12 Z" fill="currentColor" />
                </g>
              </g>
              <g strokeWidth="0">
                <path d="M 155 89 L 155 97" stroke="currentColor" strokeWidth="2" />
                <rect x="151" y="96" width="8" height="2" fill="currentColor" rx="1" />
                <ellipse cx="155" cy="109" rx="8" ry="12" fill="none" stroke="currentColor" strokeWidth="2" />
                <path d="M 148 104 Q 155 107 162 104" stroke="currentColor" strokeWidth="1" fill="none" />
                <path d="M 147 109 Q 155 112 163 109" stroke="currentColor" strokeWidth="1" fill="none" />
                <path d="M 148 114 Q 155 117 162 114" stroke="currentColor" strokeWidth="1" fill="none" />
                <ellipse cx="155" cy="109" rx="2" ry="4" fill="currentColor" />
                <rect x="151" y="121" width="8" height="2" fill="currentColor" rx="1" />
              </g>
              <g mask={`url(#${dropMaskId})`} stroke="currentColor">
                <path d="M 100 45 L 35 85 Q 45 95 55 87 Q 65 95 75 85 Q 85 95 100 78" />
                <path d="M 55 87 Q 75 65 100 45" />
                <path d="M 75 85 Q 85 65 100 45" />
                <path d="M 100 45 L 165 85 Q 155 95 145 87 Q 135 95 125 85 Q 115 95 100 78" />
                <path d="M 145 87 Q 125 65 100 45" />
                <path d="M 125 85 Q 115 65 100 45" />
              </g>
              <path d="M 65 110 C 45 145, 75 155, 100 155 C 125 155, 155 145, 135 110" stroke="currentColor" />
              <path d="M 100 45 C 110 60, 135 85, 135 115 C 135 135, 120 145, 100 145 C 80 145, 65 135, 65 115 C 65 85, 90 60, 100 45 Z" stroke="currentColor" />
              <path d="M 89 91 L 117 105 L 89 119 Z" fill="currentColor" stroke="currentColor" strokeWidth="4" strokeLinejoin="round" />
            </g>
          </svg>
        </div>

        <div className="footer__container">
          <div className="footer__content">
            <div className="footer__top-row">
              <Link
                to={ROUTES.HOME}
                className="footer__logo-badge"
                aria-label="Sạp Phim - Về trang chủ"
              >
                <BrandLogo height={42} className="footer__logo" />
              </Link>

              <div className="footer__socials" aria-label="Mạng xã hội Sạp Phim">
                {FOOTER_SOCIAL_LINKS.map(({ id, label, href, iconType }) => (
                  <a
                    key={id}
                    href={href}
                    className="footer__social-link"
                    aria-label={label}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {renderSocialIcon(iconType)}
                  </a>
                ))}
              </div>
            </div>

            <nav className="footer__links-row" aria-label="Liên kết điều hướng chân trang">
              {FOOTER_NAV_LINKS.map((link) => (
                <Link key={link.label} to={link.to} className="footer__link">
                  {link.label}
                </Link>
              ))}
            </nav>

            <p className="footer__brand-desc">
              {footerDesc}
            </p>

            <div className="footer__copyright">
              &copy; {currentYear} Sạp Phim. Bản quyền thuộc về cộng đồng yêu phim.
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default memo(Footer);
