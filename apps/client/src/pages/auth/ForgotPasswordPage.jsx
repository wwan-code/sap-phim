/**
 * @file ForgotPasswordPage.jsx
 * @module Pages/Auth/ForgotPasswordPage
 * @component ForgotPasswordPage
 * @description Trang Quên mật khẩu chuẩn Material 3 Expressive với cơ chế gửi email khôi phục và Card đếm ngược 60s.
 */

import React, { memo, useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, ArrowLeft, Mail } from 'lucide-react';
import toast from 'react-hot-toast';

import Button from '@/shared/components/ui/button/Button';
import TextField from '@/shared/components/ui/text-field/TextField';
import Seo from '@/shared/components/common/seo/Seo';
import { useForgotPasswordMutation } from '@/hooks/mutations/use-auth.mutations';
import { ROUTES } from '@/shared/constants/routes.constants';

import EmailSentCard from './components/EmailSentCard';
import { validateEmail } from './utils/auth-form.validator';
import './_auth-pages.scss';

/**
 * @component ForgotPasswordPage
 * @description Trang yêu cầu đặt lại mật khẩu qua email.
 */
export const ForgotPasswordPage = () => {
  const [email, setEmail] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [serverError, setServerError] = useState('');
  const [isSentSuccess, setIsSentSuccess] = useState(false);

  const forgotMutation = useForgotPasswordMutation();

  const handleEmailChange = useCallback((e) => {
    setEmail(e.target.value);
    setFieldError('');
    setServerError('');
  }, []);

  const handleSubmit = useCallback(
    (e) => {
      e.preventDefault();
      setServerError('');

      const emailErr = validateEmail(email);
      if (emailErr) {
        setFieldError(emailErr);
        return;
      }

      forgotMutation.mutate(
        { email: email.trim() },
        {
          onSuccess: () => {
            setIsSentSuccess(true);
            toast.success('Yêu cầu khôi phục mật khẩu đã được gửi!');
          },
          onError: (err) => {
            const message =
              err?.response?.data?.message ||
              err?.message ||
              'Không thể gửi email khôi phục. Vui lòng kiểm tra lại.';
            setServerError(message);
          },
        }
      );
    },
    [email, forgotMutation]
  );

  const handleResend = useCallback(() => {
    forgotMutation.mutate(
      { email: email.trim() },
      {
        onSuccess: () => {
          toast.success('Email khôi phục mới đã được gửi lại!');
        },
        onError: (err) => {
          const message =
            err?.response?.data?.message ||
            err?.message ||
            'Không thể gửi lại email. Vui lòng thử lại sau.';
          toast.error(message);
        },
      }
    );
  }, [email, forgotMutation]);

  const isPending = forgotMutation.isPending;

  return (
    <div className="auth-page auth-page--forgot-password">
      <Seo
        title="Quên mật khẩu"
        description="Khôi phục mật khẩu tài khoản Sạp Phim an toàn và nhanh chóng."
        canonicalPath={ROUTES.FORGOT_PW}
        noIndex
      />
      <AnimatePresence mode="wait">
        {!isSentSuccess ? (
          <motion.div
            key="forgot-form"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="auth-form__header">
              <h2 className="auth-form__title">Quên mật khẩu?</h2>
              <p className="auth-form__subtitle">
                Đừng lo lắng! Nhập địa chỉ email đăng ký của bạn và chúng tôi sẽ gửi hướng dẫn khôi phục mật khẩu.
              </p>
            </div>

            {serverError && (
              <div className="auth-form__banner-error" role="alert">
                <AlertCircle size={16} aria-hidden="true" />
                <span>{serverError}</span>
              </div>
            )}

            <form className="auth-form" onSubmit={handleSubmit} noValidate>
              <div className="auth-form__fields">
                <TextField
                  label="Địa chỉ Email của bạn"
                  name="email"
                  type="email"
                  value={email}
                  onChange={handleEmailChange}
                  error={Boolean(fieldError)}
                  helperText={fieldError || 'Chúng tôi sẽ gửi đường link đặt lại mật khẩu đến email này'}
                  placeholder="name@example.com"
                  required
                  fullWidth
                  size="medium"
                  variant="outlined"
                  disabled={isPending}
                  autoComplete="email"
                  inputProps={{
                    inputMode: 'email',
                    autoCapitalize: 'none',
                    autoCorrect: 'off',
                  }}
                  InputProps={{
                    startAdornment: (
                      <Mail size={18} className="auth-form__input-icon" aria-hidden="true" />
                    ),
                  }}
                />
              </div>

              <div className="auth-form__actions">
                <Button
                  type="submit"
                  variant="filled"
                  color="primary"
                  size="medium"
                  fullWidth
                  loading={isPending}
                  disabled={isPending}
                  className="auth-form__submit-btn"
                >
                  Gửi liên kết khôi phục
                </Button>

                <Button
                  component={Link}
                  to={ROUTES.LOGIN}
                  variant="text"
                  color="inherit"
                  size="medium"
                  fullWidth
                  disabled={isPending}
                  startIcon={<ArrowLeft size={16} />}
                >
                  Quay lại Đăng nhập
                </Button>
              </div>
            </form>
          </motion.div>
        ) : (
          <motion.div
            key="forgot-success"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          >
            <EmailSentCard
              title="Đã gửi email khôi phục!"
              email={email}
              description={
                <>
                  Liên kết khôi phục mật khẩu đã được gửi đến email{' '}
                  <strong className="email-sent-card__email-highlight">{email}</strong>. Vui lòng kiểm tra hòm thư và làm theo hướng dẫn.
                </>
              }
              onResend={handleResend}
              isResending={isPending}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default memo(ForgotPasswordPage);
