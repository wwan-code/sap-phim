/**
 * @file Avatar.jsx
 * @module Components/UI/Avatar
 * @description Component hiển thị ảnh đại diện (Avatar) chuẩn Material 3 Expressive, hỗ trợ string hash tonal color initials, dynamic status, custom badge, premium ring và fallback User icon từ lucide-react.
 */

import React, { useState, forwardRef, memo, useMemo, useEffect, useCallback, useRef } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { User } from 'lucide-react';

import { getAssetUrl, resolveImage } from '@/shared/utils/asset.util';

import './avatar.scss';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS & HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const TONAL_PALETTES = ['primary', 'accent', 'indigo', 'emerald', 'amber', 'rose', 'teal', 'neutral'];

const ICON_SIZE_MAP = {
  xs: 12,
  sm: 16,
  md: 20,
  lg: 28,
  xl: 40,
  '2xl': 48,
  full: 24,
};

/**
 * Thuật toán băm chuỗi ký tự (String Hash) để sinh màu Tonal M3 nhất quán
 * @param {string} str - Chuỗi đầu vào (tên người dùng)
 * @returns {string} Tên palette màu
 */
const getTonalColorFromHash = (str) => {
  if (!str || typeof str !== 'string') return 'neutral';
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % (TONAL_PALETTES.length - 1); // Loại trừ 'neutral' khỏi hash ngẫu nhiên
  return TONAL_PALETTES[index];
};

/**
 * Rút trích ký tự viết tắt (Initials) từ tên người dùng (tối đa 2 ký tự)
 * @param {string} name - Tên người dùng
 * @returns {string} Initials viết hoa
 */
const getInitials = (name) => {
  if (!name || typeof name !== 'string') return '';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
};

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @component Avatar
 * @description Component hiển thị ảnh đại diện chuẩn Material 3 Expressive
 */
const Avatar = forwardRef((props, ref) => {
  const {
    alt = '',
    badge,
    badgePosition = 'bottom-right',
    className,
    color = 'auto',
    fallback,
    fallbackIcon,
    frame = null,
    imgProps = {},
    loading = 'lazy',
    name = '',
    onClick,
    online,
    premium = false,
    size = 'md',
    src,
    srcSet,
    status: statusProp,
    statusPosition = 'bottom-right',
    variant = 'circle',
    ...rest
  } = props;

  // ─────────────────────────────────────────────────────────────────────────
  // IMAGE RESOLUTION & STATE
  // ─────────────────────────────────────────────────────────────────────────

  const resolvedSrc = useMemo(() => {
    if (!src) return null;
    if (typeof src === 'object') {
      return resolveImage(src) || null;
    }
    return getAssetUrl(src) || null;
  }, [src]);

  const imgRef = useRef(null);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);

  // Gán ref và kiểm tra tức thì nếu ảnh đã hoàn tất tải trong browser cache
  const setImgElementRef = useCallback((el) => {
    imgRef.current = el;
    if (el && el.complete) {
      if (el.naturalWidth > 0) {
        setImgLoaded(true);
        setImgError(false);
      } else if (el.naturalWidth === 0) {
        setImgLoaded(false);
        setImgError(true);
      }
    }
  }, []);

  // Đồng bộ trạng thái tải ảnh khi đường dẫn src thay đổi
  useEffect(() => {
    if (!resolvedSrc) {
      setImgLoaded(false);
      setImgError(false);
      return;
    }

    if (imgRef.current && imgRef.current.complete) {
      if (imgRef.current.naturalWidth > 0) {
        setImgLoaded(true);
        setImgError(false);
      } else {
        setImgLoaded(false);
        setImgError(true);
      }
    } else {
      setImgLoaded(false);
      setImgError(false);
    }
  }, [resolvedSrc]);

  const handleImageLoad = useCallback(() => {
    setImgLoaded(true);
    setImgError(false);
  }, []);

  const handleImageError = useCallback(() => {
    setImgLoaded(false);
    setImgError(true);
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // COMPUTED PROPERTIES
  // ─────────────────────────────────────────────────────────────────────────

  const initials = useMemo(() => getInitials(name), [name]);

  const effectiveTonalColor = useMemo(() => {
    if (color !== 'auto') return color;
    if (name) return getTonalColorFromHash(name);
    return 'neutral';
  }, [color, name]);

  const effectiveStatus = useMemo(() => {
    if (statusProp) return statusProp;
    if (online !== undefined) return online ? 'online' : 'offline';
    return null;
  }, [statusProp, online]);

  const iconSize = ICON_SIZE_MAP[size] || 20;
  const isImageVisible = resolvedSrc && !imgError;

  // ─────────────────────────────────────────────────────────────────────────
  // CLASS COMPOSITION
  // ─────────────────────────────────────────────────────────────────────────

  const rootClasses = classNames(
    'avatar',
    `avatar--size-${size}`,
    `avatar--variant-${variant}`,
    `avatar--color-${effectiveTonalColor}`,
    {
      'avatar--premium': premium,
      'avatar--has-frame': Boolean(frame),
      'avatar--clickable': Boolean(onClick),
      'avatar--has-image': isImageVisible && imgLoaded,
    },
    className
  );

  return (
    <div
      ref={ref}
      className={rootClasses}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      {...rest}
    >
      <div className="avatar__content">
        {/* 1. Image View */}
        {isImageVisible ? (
          <>
            {!imgLoaded && <div className="avatar__placeholder" aria-hidden="true" />}
            <img
              ref={setImgElementRef}
              src={resolvedSrc}
              srcSet={srcSet}
              alt={alt || name || 'Ảnh đại diện'}
              className={classNames('avatar__img', {
                'avatar__img--loaded': imgLoaded,
              })}
              loading={loading}
              onLoad={handleImageLoad}
              onError={handleImageError}
              {...imgProps}
            />
          </>
        ) : (
          /* 2. Fallback / Initials View */
          <div className="avatar__fallback">
            {fallback ? (
              fallback
            ) : initials ? (
              <span className="avatar__initials">{initials}</span>
            ) : fallbackIcon ? (
              fallbackIcon
            ) : (
              <User size={iconSize} className="avatar__default-icon" aria-hidden="true" />
            )}
          </div>
        )}
      </div>

      {/* 3. Status Indicator */}
      {effectiveStatus && !badge && (
        <span
          className={classNames(
            'avatar__status',
            `avatar__status--${effectiveStatus}`,
            `avatar__status--pos-${statusPosition}`
          )}
          aria-label={`Trạng thái: ${effectiveStatus}`}
          role="status"
        />
      )}

      {/* 4. Custom Badge Component */}
      {badge && (
        <div className={classNames('avatar__badge', `avatar__badge--pos-${badgePosition}`)}>
          {badge}
        </div>
      )}

      {/* 5. Decorative Frame Overlay */}
      {frame && (
        <img
          src={getAssetUrl(frame.startsWith('/') || frame.startsWith('http') ? frame : `/images/premium/frames/${frame}`)}
          alt="Khung đại diện"
          className="avatar__frame"
          loading="lazy"
          aria-hidden="true"
        />
      )}
    </div>
  );
});

Avatar.displayName = 'Avatar';

Avatar.propTypes = {
  /** Alt text mô tả ảnh cho trợ năng */
  alt: PropTypes.string,
  /** Huy hiệu tùy biến hiển thị ở góc */
  badge: PropTypes.node,
  /** Vị trí huy hiệu */
  badgePosition: PropTypes.oneOf(['bottom-right', 'bottom-left', 'top-right', 'top-left']),
  /** CSS class bổ sung */
  className: PropTypes.string,
  /** Bộ màu sắc thái Tonal khi hiển thị Initials (auto: tự động băm theo tên) */
  color: PropTypes.oneOf([
    'auto',
    'primary',
    'accent',
    'indigo',
    'emerald',
    'amber',
    'rose',
    'teal',
    'neutral',
  ]),
  /** Nội dung tùy biến thay thế hoàn toàn khi không có ảnh */
  fallback: PropTypes.node,
  /** Icon thay thế khi không có cả ảnh lẫn tên người dùng */
  fallbackIcon: PropTypes.node,
  /** Đường dẫn hoặc tên file khung trang trí */
  frame: PropTypes.string,
  /** Props bổ sung truyền trực tiếp cho thẻ <img> */
  imgProps: PropTypes.object,
  /** Chế độ tải ảnh của trình duyệt */
  loading: PropTypes.oneOf(['lazy', 'eager']),
  /** Tên thực thể / người dùng (dùng để trích xuất Initials và sinh màu Tonal) */
  name: PropTypes.string,
  /** Callback khi click */
  onClick: PropTypes.func,
  /** Trạng thái online (boolean, tương thích ngược) */
  online: PropTypes.bool,
  /** Viền phát sáng Gradient dành cho tài khoản Premium */
  premium: PropTypes.bool,
  /** Kích thước của Avatar */
  size: PropTypes.oneOf(['xs', 'sm', 'md', 'lg', 'xl', '2xl', 'full']),
  /** Đường dẫn ảnh đại diện (URL, relative path hoặc object) */
  src: PropTypes.oneOfType([PropTypes.string, PropTypes.object]),
  /** srcSet cho ảnh responsive */
  srcSet: PropTypes.string,
  /** Trạng thái hoạt động */
  status: PropTypes.oneOf(['online', 'offline', 'busy', 'away']),
  /** Vị trí hiển thị chấm trạng thái */
  statusPosition: PropTypes.oneOf(['bottom-right', 'bottom-left', 'top-right', 'top-left']),
  /** Hình dạng của Avatar */
  variant: PropTypes.oneOf(['circle', 'rounded', 'square']),
};

export default memo(Avatar);
