/**
 * @file VerifyEmailPage.jsx
 * @module Pages/Auth/VerifyEmailPage
 * @component VerifyEmailPage
 * @description Trang Xác thực Email tự động kích hoạt tài khoản qua URL token và xử lý gửi lại mã khi hết hạn.
 */

import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AlertCircle, ArrowLeft, CheckCircle2, Loader2, Mail, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

import Button from '@/shared/components/ui/button/Button';
import TextField from '@/shared/components/ui/text-field/TextField';
import Seo from '@/shared/components/common/seo/Seo';
import { useResendVerificationMutation, useVerifyEmailMutation } from '@/hooks/mutations/use-auth.mutations';
import { ROUTES } from '@/shared/constants/routes.constants';

import { validateEmail } from './utils/auth-form.validator';
import './_auth-pages.scss';

/**
 * @component VerifyEmailPage
 * @description Trang xác minh địa chỉ email người dùng.
 */
export const VerifyEmailPage = () => {
  const navigate = useNavigate();
  const { token: routeToken } = useParams();
  const [searchParams] = useSearchParams();
  const token = routeToken || searchParams.get('token');

  const [status, setStatus] = useState('verifying'); // 'verifying' | 'success' | 'error'
  const [errorMessage, setErrorMessage] = useState('');
  const [resendEmail, setResendEmail] = useState('');
  const [resendError, setResendError] = useState('');

  const verifyMutation = useVerifyEmailMutation();
  const resendMutation = useResendVerificationMutation();
  const verifiedRef = useRef(false);

  // Tự động gọi API xác thực khi mount có token (ngăn chặn duplicate call trong React 18 StrictMode)
  useEffect(() => {
    if (!token) {
      setStatus('error');
      setErrorMessage('Không tìm thấy mã token xác thực trên đường dẫn.');
      return;
    }

    if (verifiedRef.current) return;
    verifiedRef.current = true;

    verifyMutation.mutate(token, {
      onSuccess: () => {
        setStatus('success');
        toast.success('Kích hoạt tài khoản thành công!');
      },
      onError: (err) => {
        setStatus('error');
        const message =
          err?.response?.data?.message ||
          err?.message ||
          'Liên kết xác thực không hợp lệ hoặc đã hết hạn sử dụng.';
        setErrorMessage(message);
      },
    });
    // eslint-disable-next-line
  }, [token]);

  const handleResendSubmit = useCallback(
    (e) => {
      e.preventDefault();
      setResendError('');

      const emailErr = validateEmail(resendEmail);
      if (emailErr) {
        setResendError(emailErr);
        return;
      }

      resendMutation.mutate(
        { email: resendEmail.trim() },
        {
          onSuccess: () => {
            toast.success('Email xác thực mới đã được gửi thành công!');
            setResendEmail('');
          },
          onError: (err) => {
            const errorCode = err?.response?.data?.code || err?.response?.data?.error?.code;
            if (errorCode === 'EMAIL_ALREADY_VERIFIED') {
              setStatus('success');
              toast.success('Tài khoản của bạn đã được xác thực trước đó! Bạn có thể đăng nhập ngay.');
              return;
            }
            const message =
              err?.response?.data?.message ||
              err?.message ||
              'Không thể gửi lại email vào lúc này. Vui lòng thử lại sau.';
            toast.error(message);
          },
        }
      );
    },
    [resendEmail, resendMutation]
  );

  return (
    <div className="auth-page auth-page--verify-email">
      <Seo
        title="Xác thực email"
        description="Xác minh địa chỉ email và kích hoạt tài khoản Sạp Phim."
        canonicalPath={ROUTES.VERIFY_EMAIL}
        noIndex
      />
      <motion.div
        className="verify-email-page"
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      >
        {status === 'verifying' && (
          <div className="verify-email-page__state verify-email-page__state--loading">
            <div className="verify-email-page__status-icon verify-email-page__status-icon--loading">
              <Loader2 size={32} className="file-upload-zone__spinner-icon" aria-hidden="true" />
            </div>
            <h2 className="auth-form__title">Đang xác thực email...</h2>
            <p className="auth-form__subtitle">
              Vui lòng chờ trong giây lát trong khi chúng tôi kiểm tra mã xác nhận của bạn.
            </p>
          </div>
        )}

        {status === 'success' && (
          <div className="verify-email-page__state verify-email-page__state--success">
            <div className="verify-email-page__status-icon verify-email-page__status-icon--success">
              <CheckCircle2 size={32} aria-hidden="true" />
            </div>
            <h2 className="auth-form__title">Xác thực thành công!</h2>
            <p className="auth-form__subtitle">
              Tài khoản của bạn đã được kích hoạt hoàn tất. Bây giờ bạn đã có thể đăng nhập và tận hưởng mọi đặc quyền tại Sạp Phim.
            </p>

            <div className="verify-email-page__actions">
              <Button
                variant="filled"
                color="primary"
                size="medium"
                fullWidth
                onClick={() => navigate(ROUTES.LOGIN, { replace: true })}
              >
                Đăng nhập ngay
              </Button>
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className="verify-email-page__state verify-email-page__state--error">
            <div className="verify-email-page__status-icon verify-email-page__status-icon--error">
              <AlertCircle size={32} aria-hidden="true" />
            </div>
            <h2 className="auth-form__title">Xác thực không thành công</h2>
            <p className="auth-form__subtitle">
              {errorMessage || 'Đường dẫn xác thực của bạn có thể đã hết hạn hoặc không chính xác.'}
            </p>

            <div className="auth-form__divider" style={{ width: '100%', margin: '24px 0 16px 0' }} />

            <form className="auth-form" onSubmit={handleResendSubmit} noValidate style={{ marginTop: '8px' }}>
              <TextField
                label="Gửi lại mã xác nhận đến email"
                name="resendEmail"
                type="email"
                value={resendEmail}
                onChange={(e) => {
                  setResendEmail(e.target.value);
                  setResendError('');
                }}
                error={Boolean(resendError)}
                helperText={resendError || 'Nhập địa chỉ email tài khoản của bạn'}
                placeholder="name@example.com"
                required
                fullWidth
                size="medium"
                variant="outlined"
                disabled={resendMutation.isPending}
                InputProps={{
                  startAdornment: (
                    <Mail size={18} className="auth-form__input-icon" aria-hidden="true" />
                  ),
                }}
              />

              <div className="verify-email-page__actions">
                <Button
                  type="submit"
                  variant="outlined"
                  color="primary"
                  size="medium"
                  fullWidth
                  loading={resendMutation.isPending}
                  disabled={resendMutation.isPending || !resendEmail.trim()}
                  startIcon={<RefreshCw size={16} />}
                >
                  Gửi lại email xác thực
                </Button>

                <Button
                  component={Link}
                  to={ROUTES.LOGIN}
                  variant="text"
                  color="inherit"
                  size="medium"
                  fullWidth
                  startIcon={<ArrowLeft size={16} />}
                >
                  Quay lại Đăng nhập
                </Button>
              </div>
            </form>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default memo(VerifyEmailPage);
