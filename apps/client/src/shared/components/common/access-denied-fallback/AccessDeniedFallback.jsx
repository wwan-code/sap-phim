/**
 * @file AccessDeniedFallback.jsx
 * @module Components/Common/AccessDeniedFallback/AccessDeniedFallback
 * @component AccessDeniedFallback
 * @description Component UX hiển thị khi người dùng bị từ chối truy cập (phân quyền vai trò, nâng cấp Premium & CTA điều hướng) chuẩn Material 3 Expressive.
 */

import React, { memo } from 'react';
import PropTypes from 'prop-types';
import { motion } from 'framer-motion';
import { ArrowLeft, Home, Lock, Sparkles } from 'lucide-react';

import Button from '@/shared/components/ui/button';
import { useAccessDeniedFallback } from './hooks/use-access-denied-fallback';
import { ANIMATION } from './access-denied-fallback.constants';
import BenefitsList from './components/BenefitsList';

import './access-denied-fallback.scss';

/**
 * @component AccessDeniedFallback
 * @description Component hiển thị giao diện thông báo khi người dùng bị từ chối truy cập nội dung.
 *
 * @param {object}   props
 * @param {string}  [props.title]        - Tiêu đề thông báo
 * @param {string}  [props.message]      - Nội dung chi tiết lỗi
 * @param {string}  [props.requiredRole] - Vai trò cần thiết (premium_user, vip_member, admin, moderator)
 * @param {boolean} [props.showUpgrade]  - Có hiển thị khu vực nâng cấp không
 * @param {string}  [props.upgradeUrl]   - Đường dẫn trang nâng cấp
 */
const AccessDeniedFallback = memo(
  ({
    message = 'Bạn cần quyền truy cập cao hơn để xem nội dung này.',
    requiredRole = null,
    showUpgrade = true,
    title = 'Nội dung giới hạn',
    upgradeUrl = '/ho-so/goi-dich-vu',
  }) => {
    const { hasBenefits, handlers, isPremiumGated, upgradeInfo } =
      useAccessDeniedFallback({
        requiredRole,
        showUpgrade,
        upgradeUrl,
      });

    return (
      <motion.div
        className="access-denied"
        role="alert"
        aria-live="polite"
        {...ANIMATION.container}
      >
        <div className="access-denied__card">
          {/* Icon Khóa */}
          <motion.div
            className="access-denied__icon-wrapper"
            aria-hidden="true"
            {...ANIMATION.icon}
          >
            <Lock size={36} aria-hidden="true" />
          </motion.div>

          {/* Nội dung thông báo */}
          <h2 className="access-denied__title">{title}</h2>
          <p className="access-denied__message">{message}</p>

          {/* Lợi ích Premium / VIP – chỉ hiển thị khi có danh sách benefits */}
          {isPremiumGated && hasBenefits && (
            <BenefitsList upgradeInfo={upgradeInfo} />
          )}

          {/* Nhóm nút hành động */}
          <div
            className="access-denied__actions"
            role="group"
            aria-label="Các hành động điều hướng"
          >
            {isPremiumGated && (
              <Button
                variant="filled"
                color="primary"
                onClick={handlers.onUpgrade}
                startIcon={<Sparkles size={16} aria-hidden="true" />}
              >
                Nâng cấp ngay
              </Button>
            )}

            <Button
              variant="outlined"
              onClick={handlers.onBack}
              startIcon={<ArrowLeft size={16} aria-hidden="true" />}
            >
              Quay lại
            </Button>

            <Button
              variant="outlined"
              onClick={handlers.onHome}
              startIcon={<Home size={16} aria-hidden="true" />}
            >
              Trang chủ
            </Button>
          </div>
        </div>
      </motion.div>
    );
  }
);

AccessDeniedFallback.displayName = 'AccessDeniedFallback';

AccessDeniedFallback.propTypes = {
  message: PropTypes.string,
  requiredRole: PropTypes.oneOf(['premium_user', 'vip_member', 'admin', 'moderator']),
  showUpgrade: PropTypes.bool,
  title: PropTypes.string,
  upgradeUrl: PropTypes.string,
};

export default AccessDeniedFallback;
