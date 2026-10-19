/**
 * @file Badge.jsx
 * @module Components/UI/Badge
 * @description Component huy hiệu (Badge) chuẩn Material 3 Expressive, hỗ trợ cả 2 chế độ Anchored Wrapper và Standalone Tag/Label, hiệu ứng Pulse radar, đa dạng vị trí placement và Design Tokens (--sp-*).
 */

import React, { forwardRef, memo, useMemo } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';

import Tooltip from '@/shared/components/ui/tooltip';

import './badge.scss';

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @component Badge
 * @description Huy hiệu thông báo hoặc nhãn trạng thái chuẩn Material 3 Expressive
 */
const Badge = forwardRef((props, ref) => {
  const {
    badgeClassName,
    badgeContent,
    children,
    className,
    content,
    count,
    dot = false,
    icon,
    invisible = false,
    maxCount = 99,
    overlap = 'rectangular',
    placement = 'top-right',
    pulse = false,
    radius = 'full',
    showZero = false,
    size = 'medium',
    tooltip,
    tooltipProps,
    variant = 'default',
    ...rest
  } = props;

  // ─────────────────────────────────────────────────────────────────────────
  // PROP NORMALIZATION & MODE DETECTION
  // ─────────────────────────────────────────────────────────────────────────

  // Chuẩn hóa variant name
  const normalizedVariant = useMemo(() => {
    if (variant === 'danger') return 'error';
    if (variant === 'secondary') return 'accent';
    return variant || 'default';
  }, [variant]);

  const effectiveContent = badgeContent !== undefined ? badgeContent : content;

  // Tự động nhận diện chế độ Anchored Wrapper (khi có children được bọc và có cấu hình badge indicator)
  const isAnchored = Boolean(
    children &&
      (effectiveContent !== undefined ||
        count !== undefined ||
        dot ||
        pulse ||
        props.placement ||
        props.overlap)
  );

  const hasChildren = children !== undefined && children !== null && children !== '';

  // Xác định trạng thái ẩn của badge
  const isBadgeInvisible =
    invisible ||
    (count !== undefined && count === 0 && !showZero) ||
    (!dot && count === undefined && effectiveContent === undefined && !hasChildren && !icon);

  // Xác định kiểu hiển thị của badge
  const badgeType = count !== undefined ? 'count' : dot ? 'dot' : 'label';

  // ─────────────────────────────────────────────────────────────────────────
  // CLASS COMPOSITION
  // ─────────────────────────────────────────────────────────────────────────

  const badgeClasses = classNames(
    'badge',
    `badge--type-${badgeType}`,
    `badge--variant-${normalizedVariant}`,
    `badge--size-${size}`,
    `badge--radius-${radius}`,
    {
      [`badge--pos-${placement}`]: isAnchored,
      [`badge--overlap-${overlap}`]: isAnchored,
      'badge--pulse': pulse,
      'badge--invisible': isBadgeInvisible,
      'badge--standalone': !isAnchored,
    },
    badgeClassName
  );

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER HELPERS
  // ─────────────────────────────────────────────────────────────────────────

  const renderBadgeInner = () => {
    if (dot) return null;

    if (count !== undefined) {
      return count > maxCount ? `${maxCount}+` : count;
    }

    if (effectiveContent !== undefined) {
      return (
        <>
          {icon && <span className="badge__icon-wrapper" aria-hidden="true">{icon}</span>}
          {effectiveContent}
        </>
      );
    }

    if (!isAnchored && hasChildren) {
      return (
        <>
          {icon && <span className="badge__icon-wrapper" aria-hidden="true">{icon}</span>}
          {children}
        </>
      );
    }

    return null;
  };

  // ─────────────────────────────────────────────────────────────────────────
  // TOOLTIP WRAPPER UTILITY
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Bọc node trong Tooltip nếu prop `tooltip` được truyền vào.
   * @param {React.ReactNode} node - Nội dung cần bọc
   * @returns {React.ReactNode}
   */
  const withTooltip = (node) => {
    if (!tooltip) return node;
    return (
      <Tooltip title={tooltip} placement="top" {...tooltipProps}>
        {node}
      </Tooltip>
    );
  };

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  // 1. Chế độ Anchored Wrapper (Bọc quanh Icon, Avatar, Button, v.v.)
  if (isAnchored) {
    return withTooltip(
      <span ref={ref} className={classNames('badge-wrapper', className)} {...rest}>
        {children}
        {!isBadgeInvisible && (
          <span className={badgeClasses} role="status" aria-live="polite">
            {renderBadgeInner()}
          </span>
        )}
      </span>
    );
  }

  // 2. Chế độ Standalone Tag / Pill / Label độc lập
  if (isBadgeInvisible) return null;

  return withTooltip(
    <span ref={ref} className={classNames(badgeClasses, className)} role="status" {...rest}>
      {renderBadgeInner()}
    </span>
  );
});

Badge.displayName = 'Badge';

Badge.propTypes = {
  /** CSS class riêng cho phần tử badge indicator khi ở chế độ wrapper */
  badgeClassName: PropTypes.string,
  /** Nội dung hiển thị bên trong badge indicator (chế độ wrapper) */
  badgeContent: PropTypes.node,
  /** Phần tử con được bọc (chế độ wrapper) hoặc văn bản nhãn (chế độ standalone) */
  children: PropTypes.node,
  /** CSS class bổ sung cho phần tử root */
  className: PropTypes.string,
  /** Nội dung hiển thị bên trong badge (alias của badgeContent) */
  content: PropTypes.node,
  /** Số đếm hiển thị (ví dụ: số thông báo) */
  count: PropTypes.number,
  /** Hiển thị dưới dạng chấm tròn nhỏ (status dot) */
  dot: PropTypes.bool,
  /** Icon đi kèm bên trong nhãn */
  icon: PropTypes.node,
  /** Ẩn badge */
  invisible: PropTypes.bool,
  /** Số đếm tối đa trước khi hiển thị dấu "+" (ví dụ: 99+) */
  maxCount: PropTypes.number,
  /** Kiểu lồng ghép vị trí (rectangular cho nút vuông, circular cho Avatar tròn) */
  overlap: PropTypes.oneOf(['rectangular', 'circular']),
  /** Vị trí ghim badge ở 4 góc (chế độ wrapper) */
  placement: PropTypes.oneOf(['top-right', 'top-left', 'bottom-right', 'bottom-left']),
  /** Kích hoạt hiệu ứng xung radar lan tỏa */
  pulse: PropTypes.bool,
  /** 3 Kiểu bo góc: full (pill/tròn), rounded (bo góc nhẹ), square (vuông) */
  radius: PropTypes.oneOf(['full', 'rounded', 'square']),
  /** Hiển thị số 0 khi count = 0 */
  showZero: PropTypes.bool,
  /** 3 Kích thước: small (18px), medium (22px), large (26px) */
  size: PropTypes.oneOf(['small', 'medium', 'large']),
  /** Nội dung chú giải hiển thị khi hover/focus lên Badge (tích hợp Tooltip) */
  tooltip: PropTypes.node,
  /** Props bổ sung truyền xuống component Tooltip (placement, size, variant, enterDelay...) */
  tooltipProps: PropTypes.object,
  /** Biến thể màu sắc Material 3 */
  variant: PropTypes.oneOf([
    'default',
    'primary',
    'accent',
    'secondary',
    'success',
    'warning',
    'error',
    'danger',
    'info',
    'premium',
    'neutral',
    'outline',
    'muted',
  ]),
};

export default memo(Badge);
