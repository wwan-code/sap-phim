/**
 * @file RegisterPage.jsx
 * @module Pages/Auth/RegisterPage
 * @component RegisterPage
 * @description Trang Đăng ký tài khoản chuẩn Material 3 Expressive với thanh đo mật khẩu Real-time, xác thực đa tầng và chuyển bước kích hoạt email.
 */

import React, { memo, useCallback, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, Lock, Mail, User, UserCheck } from 'lucide-react';
import toast from 'react-hot-toast';

import Button from '@/shared/components/ui/button/Button';
import TextField from '@/shared/components/ui/text-field/TextField';
import Seo from '@/shared/components/common/seo/Seo';
import { useRegisterMutation, useResendVerificationMutation } from '@/hooks/mutations/use-auth.mutations';
import { ROUTES } from '@/shared/constants/routes.constants';

import AuthSocialButtons from './components/AuthSocialButtons';
import EmailSentCard from './components/EmailSentCard';
import PasswordStrengthBar from './components/PasswordStrengthBar';
import {
  validateEmail,
  validatePassword,
  validateUsername,
} from './utils/auth-form.validator';
import './_auth-pages.scss';

/**
 * @component RegisterPage
 * @description Trang đăng ký tài khoản người dùng mới.
 */
export const RegisterPage = () => {
  const navigate = useNavigate();
  const [isSuccessStep, setIsSuccessStep] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    full_name: '',
    acceptTerms: false,
  });
  const [fieldErrors, setFieldErrors] = useState({});
  const [serverError, setServerError] = useState('');

  const registerMutation = useRegisterMutation();
  const resendMutation = useResendVerificationMutation();

  const handleInputChange = useCallback((e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
    setFieldErrors((prev) => ({ ...prev, [name]: '' }));
    setServerError('');
  }, []);

  const handleRegisterSubmit = useCallback(
    (e) => {
      e.preventDefault();
      setServerError('');

      // Fallback đọc trực tiếp từ form DOM elements nếu trình duyệt autofill nhưng state chưa kịp flush
      const formElements = e.currentTarget?.elements;
      const domUsername = formElements?.username?.value ?? '';
      const domEmail = formElements?.email?.value ?? '';
      const domPassword = formElements?.password?.value ?? '';
      const domFullName = formElements?.full_name?.value ?? '';
      const domAcceptTerms = Boolean(formElements?.acceptTerms?.checked);

      const effectiveUsername = (formData.username || domUsername).trim();
      const effectiveEmail = (formData.email || domEmail).trim();
      const effectivePassword = formData.password || domPassword;
      const effectiveFullName = (formData.full_name || domFullName).trim();
      const effectiveAcceptTerms = formData.acceptTerms || domAcceptTerms;

      // Đồng bộ ngược lại state nếu phát hiện giá trị từ DOM autofill
      if (
        effectiveUsername !== formData.username ||
        effectiveEmail !== formData.email ||
        effectivePassword !== formData.password ||
        effectiveFullName !== formData.full_name ||
        effectiveAcceptTerms !== formData.acceptTerms
      ) {
        setFormData((prev) => ({
          ...prev,
          username: effectiveUsername,
          email: effectiveEmail,
          password: effectivePassword,
          full_name: effectiveFullName,
          acceptTerms: effectiveAcceptTerms,
        }));
      }

      const errors = {};
      const usernameErr = validateUsername(effectiveUsername);
      if (usernameErr) errors.username = usernameErr;

      const emailErr = validateEmail(effectiveEmail);
      if (emailErr) errors.email = emailErr;

      const passwordErr = validatePassword(effectivePassword);
      if (passwordErr) errors.password = passwordErr;

      if (!effectiveAcceptTerms) {
        errors.acceptTerms = 'Bạn cần đồng ý với Điều khoản dịch vụ & Chính sách bảo mật.';
      }

      if (Object.keys(errors).length > 0) {
        setFieldErrors(errors);
        return;
      }

      registerMutation.mutate(
        {
          username: effectiveUsername,
          email: effectiveEmail,
          password: effectivePassword,
          full_name: effectiveFullName || undefined,
          acceptTerms: true,
        },
        {
          onSuccess: () => {
            setIsSuccessStep(true);
            toast.success('Đăng ký tài khoản thành công!');
          },
          onError: (err) => {
            const message =
              err?.response?.data?.message ||
              err?.message ||
              'Đăng ký không thành công. Vui lòng thử lại.';
            setServerError(message);
          },
        }
      );
    },
    [formData, registerMutation]
  );

  const handleResendActivationEmail = useCallback(() => {
    resendMutation.mutate(
      { email: formData.email.trim() },
      {
        onSuccess: () => {
          toast.success('Email kích hoạt mới đã được gửi thành công!');
        },
        onError: (err) => {
          const errorCode = err?.response?.data?.code || err?.response?.data?.error?.code;
          if (errorCode === 'EMAIL_ALREADY_VERIFIED') {
            toast.success('Tài khoản của bạn đã được xác thực trước đó! Đang chuyển hướng...');
            navigate(ROUTES.LOGIN);
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
  }, [formData.email, navigate, resendMutation]);

  const isRegistering = registerMutation.isPending;

  return (
    <div className="auth-page auth-page--register">
      <Seo
        title="Đăng ký tài khoản"
        description="Tạo tài khoản Sạp Phim miễn phí để khám phá thế giới anime đỉnh cao và xem phim bom tấn cập nhật mới nhất."
        canonicalPath={ROUTES.REGISTER}
      />
      <AnimatePresence mode="wait">
        {!isSuccessStep ? (
          <motion.div
            key="register-form"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="auth-form__header">
              <h2 className="auth-form__title">Tạo tài khoản mới</h2>
              <p className="auth-form__subtitle">
                Tham gia cộng đồng Sạp Phim để thỏa sức khám phá thế giới anime đỉnh cao.
              </p>
            </div>

            {serverError && (
              <div className="auth-form__banner-error" role="alert">
                <AlertCircle size={16} aria-hidden="true" />
                <span>{serverError}</span>
              </div>
            )}

            <form className="auth-form" onSubmit={handleRegisterSubmit} noValidate>
              <div className="auth-form__fields">
                <TextField
                  label="Tên đăng nhập"
                  name="username"
                  type="text"
                  value={formData.username}
                  onChange={handleInputChange}
                  error={Boolean(fieldErrors.username)}
                  helperText={fieldErrors.username || '3-30 ký tự, gồm chữ, số, _ hoặc -'}
                  placeholder="Ví dụ: otaku_vip99"
                  required
                  fullWidth
                  size="medium"
                  variant="outlined"
                  disabled={isRegistering}
                  autoComplete="username"
                  inputProps={{
                    autoCapitalize: 'none',
                    autoCorrect: 'off',
                    spellCheck: 'false',
                  }}
                  InputProps={{
                    startAdornment: (
                      <User size={18} className="auth-form__input-icon" aria-hidden="true" />
                    ),
                  }}
                />

                <TextField
                  label="Địa chỉ Email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  error={Boolean(fieldErrors.email)}
                  helperText={fieldErrors.email}
                  placeholder="name@example.com"
                  required
                  fullWidth
                  size="medium"
                  variant="outlined"
                  disabled={isRegistering}
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

                <TextField
                  label="Họ và tên (Tùy chọn)"
                  name="full_name"
                  type="text"
                  value={formData.full_name}
                  onChange={handleInputChange}
                  error={Boolean(fieldErrors.full_name)}
                  helperText={fieldErrors.full_name}
                  placeholder="Ví dụ: Nguyễn Văn A"
                  fullWidth
                  size="medium"
                  variant="outlined"
                  disabled={isRegistering}
                  autoComplete="name"
                  InputProps={{
                    startAdornment: (
                      <UserCheck size={18} className="auth-form__input-icon" aria-hidden="true" />
                    ),
                  }}
                />

                <div className="auth-form__password-field-group">
                  <TextField
                    label="Mật khẩu"
                    name="password"
                    type="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    error={Boolean(fieldErrors.password)}
                    helperText={fieldErrors.password}
                    placeholder="Nhập mật khẩu an toàn"
                    required
                    fullWidth
                    size="medium"
                    variant="outlined"
                    showPasswordToggle
                    disabled={isRegistering}
                    autoComplete="new-password"
                    InputProps={{
                      startAdornment: (
                        <Lock size={18} className="auth-form__input-icon" aria-hidden="true" />
                      ),
                    }}
                  />

                  <PasswordStrengthBar password={formData.password} />
                </div>

                <div className="auth-form__terms-container">
                  <label className="auth-form__terms-label">
                    <input
                      type="checkbox"
                      name="acceptTerms"
                      checked={formData.acceptTerms}
                      onChange={handleInputChange}
                      disabled={isRegistering}
                    />
                    <span>
                      Tôi đã đọc và đồng ý với{' '}
                      <a href="#terms" target="_blank" rel="noopener noreferrer">
                        Điều khoản dịch vụ
                      </a>{' '}
                      &amp;{' '}
                      <a href="#privacy" target="_blank" rel="noopener noreferrer">
                        Chính sách bảo mật
                      </a>
                    </span>
                  </label>
                  {fieldErrors.acceptTerms && (
                    <p className="text-field__helper-text text-field__helper-text--error" role="alert">
                      {fieldErrors.acceptTerms}
                    </p>
                  )}
                </div>
              </div>

              <div className="auth-form__actions">
                <Button
                  type="submit"
                  variant="filled"
                  color="primary"
                  size="medium"
                  fullWidth
                  loading={isRegistering}
                  disabled={isRegistering}
                  className="auth-form__submit-btn"
                >
                  Đăng ký tài khoản
                </Button>
              </div>
            </form>

            <AuthSocialButtons disabled={isRegistering} />

            <div className="auth-form__footer">
              <span>Đã có tài khoản?</span>
              <Link to={ROUTES.LOGIN} className="auth-form__footer-link">
                Đăng nhập ngay
              </Link>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="register-success"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          >
            <EmailSentCard
              title="Đăng ký thành công!"
              email={formData.email}
              description={
                <>
                  Một email kích hoạt tài khoản đã được gửi đến{' '}
                  <strong className="email-sent-card__email-highlight">{formData.email}</strong>.
                  Vui lòng kiểm tra hòm thư và nhấn vào đường link xác nhận để bắt đầu sử dụng tài khoản.
                </>
              }
              onResend={handleResendActivationEmail}
              isResending={resendMutation.isPending}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default memo(RegisterPage);
