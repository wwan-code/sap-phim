/**
 * @file AvatarGroup.jsx
 * @module Components/UI/Avatar/AvatarGroup
 * @description Subcomponent nhóm các Avatar (AvatarGroup) chuẩn Material 3 Expressive, hỗ trợ xếp chồng (overlapping), giới hạn max và badge đếm dư +N.
 */

import React, { forwardRef, memo, Children, isValidElement, cloneElement, useMemo } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';

import Avatar from './Avatar';
import './avatar.scss';

/**
 * @component AvatarGroup
 * @description Component nhóm các Avatar hiển thị xếp chồng lấn nhau
 */
const AvatarGroup = forwardRef((props, ref) => {
  const {
    children,
    className,
    max = 5,
    renderSurplus,
    size = 'md',
    spacing = 'normal',
    stackOrder = 'last-on-top',
    variant = 'circle',
    ...rest
  } = props;

  // Lọc lấy danh sách các phần tử React hợp lệ
  const validChildren = useMemo(() => {
    return Children.toArray(children).filter((child) => isValidElement(child));
  }, [children]);

  const total = validChildren.length;
  const isOverMax = max && total > max;
  const visibleCount = isOverMax ? Math.max(1, max - 1) : total;
  const surplusCount = total - visibleCount;

  const visibleAvatars = validChildren.slice(0, visibleCount);

  const rootClasses = classNames(
    'avatar-group',
    `avatar-group--size-${size}`,
    `avatar-group--spacing-${spacing}`,
    `avatar-group--stack-${stackOrder}`,
    className
  );

  return (
    <div ref={ref} className={rootClasses} role="group" aria-label="Nhóm ảnh đại diện" {...rest}>
      {visibleAvatars.map((child, index) => {
        const zIndex = stackOrder === 'last-on-top' ? index + 1 : total - index;

        return (
          <div
            key={`avatar-group-item-${index}`}
            className="avatar-group__item"
            style={{ zIndex }}
          >
            {cloneElement(child, {
              size: child.props.size || size,
              variant: child.props.variant || variant,
              className: classNames('avatar-group__avatar', child.props.className),
            })}
          </div>
        );
      })}

      {/* Surplus Counter Badge (+N) */}
      {isOverMax && (
        <div
          className="avatar-group__item avatar-group__item--surplus"
          style={{ zIndex: stackOrder === 'last-on-top' ? total + 1 : 0 }}
        >
          {renderSurplus ? (
            renderSurplus(surplusCount)
          ) : (
            <Avatar
              size={size}
              variant={variant}
              color="neutral"
              className="avatar-group__surplus-avatar"
              fallback={`+${surplusCount}`}
              aria-label={`Còn ${surplusCount} người khác`}
            />
          )}
        </div>
      )}
    </div>
  );
});

AvatarGroup.displayName = 'AvatarGroup';

AvatarGroup.propTypes = {
  /** Danh sách các Avatar con */
  children: PropTypes.node,
  /** CSS class bổ sung */
  className: PropTypes.string,
  /** Số lượng Avatar tối đa hiển thị (bao gồm cả badge đếm dư) */
  max: PropTypes.number,
  /** Hàm tùy biến render badge đếm dư */
  renderSurplus: PropTypes.func,
  /** Kích thước chung của các Avatar trong nhóm */
  size: PropTypes.oneOf(['xs', 'sm', 'md', 'lg', 'xl', '2xl']),
  /** Mức độ xếp chồng lấn giữa các avatar */
  spacing: PropTypes.oneOf(['tight', 'normal', 'loose']),
  /** Thứ tự xếp lớp z-index */
  stackOrder: PropTypes.oneOf(['last-on-top', 'first-on-top']),
  /** Hình dạng chung của các Avatar trong nhóm */
  variant: PropTypes.oneOf(['circle', 'rounded', 'square']),
};

export default memo(AvatarGroup);
