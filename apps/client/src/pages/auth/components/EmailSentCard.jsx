/**
 * @file EmailSentCard.jsx
 * @module Pages/Auth/Components/EmailSentCard
 * @component EmailSentCard
 * @description Card thông báo đã gửi email thành công kèm bộ đếm ngược 60s (Cooldown Timer) và nút mở nhanh hòm thư.
 */

import React, { memo, useCallback, useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import { ArrowLeft, ExternalLink, Mail, RefreshCw } from 'lucide-react';

import Button from '@/shared/components/ui/button/Button';
import { ROUTES } from '@/shared/constants/routes.constants';
import { maskEmail } from '../utils/auth-form.validator';

const INITIAL_COOLDOWN_SECONDS = 60;

/**
 * @component EmailSentCard
 * @description Hiển thị phản hồi sau khi gửi email khôi phục hoặc kích hoạt tài khoản.
 */
const EmailSentCard = ({
  description,
  email = '',
  isResending = false,
  onResend,
  title = 'Kiểm tra hòm thư của bạn',
}) => {
  const [countdown, setCountdown] = useState(INITIAL_COOLDOWN_SECONDS);

  useEffect(() => {
    if (countdown <= 0) return;

    const interval = setInterval(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [countdown]);

  const handleResendClick = useCallback(() => {
    if (countdown > 0 || isResending) return;
    onResend?.();
    setCountdown(INITIAL_COOLDOWN_SECONDS);
  }, [countdown, isResending, onResend]);

  const masked = maskEmail(email);

  return (
    <div className="email-sent-card">
      <div className="email-sent-card__icon-wrapper">
        <Mail size={32} className="email-sent-card__icon" aria-hidden="true" />
      </div>

      <h2 className="auth-form__title">{title}</h2>

      <p className="auth-form__subtitle">
        {description || (
          <>
            Chúng tôi đã gửi hướng dẫn tới địa chỉ{' '}
            <strong className="email-sent-card__email-highlight">{masked || email}</strong>.
            Vui lòng kiểm tra hộp thư đến (hoặc thư mục Spam) để hoàn tất.
          </>
        )}
      </p>

      <div className="email-sent-card__quick-links">
        <a
          href="https://mail.google.com"
          target="_blank"
          rel="noopener noreferrer"
          className="email-sent-card__provider-link"
        >
          <span>Mở Gmail</span>
          <ExternalLink size={13} aria-hidden="true" />
        </a>

        <a
          href="https://outlook.live.com"
          target="_blank"
          rel="noopener noreferrer"
          className="email-sent-card__provider-link"
        >
          <span>Mở Outlook</span>
          <ExternalLink size={13} aria-hidden="true" />
        </a>
      </div>

      <div className="email-sent-card__actions">
        {onResend && (
          <Button
            type="button"
            variant="outlined"
            size="medium"
            fullWidth
            disabled={countdown > 0 || isResending}
            loading={isResending}
            onClick={handleResendClick}
            startIcon={<RefreshCw size={16} />}
            className="email-sent-card__resend-btn"
          >
            {countdown > 0 ? `Gửi lại email (${countdown}s)` : 'Gửi lại email'}
          </Button>
        )}

        <Link to={ROUTES.LOGIN} className="email-sent-card__back-link">
          <Button
            type="button"
            variant="text"
            color="inherit"
            size="medium"
            fullWidth
            startIcon={<ArrowLeft size={16} />}
          >
            Quay lại trang Đăng nhập
          </Button>
        </Link>
      </div>
    </div>
  );
};

EmailSentCard.propTypes = {
  description: PropTypes.node,
  email: PropTypes.string,
  isResending: PropTypes.bool,
  onResend: PropTypes.func,
  title: PropTypes.string,
};

export default memo(EmailSentCard);
