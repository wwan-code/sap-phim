/**
 * @file LoginPage.jsx
 * @module Pages/Auth/LoginPage
 * @component LoginPage
 * @description Trang Đăng nhập chuẩn Material 3 Expressive hỗ trợ ghi nhớ phiên, mạng xã hội và chuyển bước MFA 2FA nội tuyến.
 */

import React, { memo, useCallback, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, Lock, User } from 'lucide-react';
import toast from 'react-hot-toast';

import Button from '@/shared/components/ui/button/Button';
import TextField from '@/shared/components/ui/text-field/TextField';
import Seo from '@/shared/components/common/seo/Seo';
import { useLoginMutation, useMfaLoginVerifyMutation } from '@/hooks/mutations/use-auth.mutations';
import { ROUTES } from '@/shared/constants/routes.constants';

import AuthSocialButtons from './components/AuthSocialButtons';
import MfaVerifyStep from './components/MfaVerifyStep';
import MfaSetupStep from './components/MfaSetupStep';
import './_auth-pages.scss';

/**
 * @component LoginPage
 * @description Trang đăng nhập chính với các bước: Nhập thông tin, Xác thực 2FA & Thiết lập 2FA bắt buộc.
 */
export const LoginPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get('redirectTo') || ROUTES.HOME;

  const [step, setStep] = useState('credentials'); // 'credentials' | 'mfa' | 'mfa-setup'
  const [mfaToken, setMfaToken] = useState('');
  const [tempToken, setTempToken] = useState('');
  const [formData, setFormData] = useState({
    identifier: '',
    password: '',
    rememberMe: false,
  });
  const [fieldErrors, setFieldErrors] = useState({});
  const [serverError, setServerError] = useState('');

  const loginMutation = useLoginMutation();
  const mfaVerifyMutation = useMfaLoginVerifyMutation();

  const handleInputChange = useCallback((e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
    setFieldErrors((prev) => ({ ...prev, [name]: '' }));
    setServerError('');
  }, []);

  const handleCredentialsSubmit = useCallback(
    (e) => {
      e.preventDefault();
      setServerError('');

      // Fallback đọc trực tiếp từ form DOM elements nếu trình duyệt autofill nhưng state chưa kịp flush
      const formElements = e.currentTarget?.elements;
      const domIdentifier = formElements?.identifier?.value ?? '';
      const domPassword = formElements?.password?.value ?? '';
      const domRememberMe = Boolean(formElements?.rememberMe?.checked);

      const effectiveIdentifier = (formData.identifier || domIdentifier).trim();
      const effectivePassword = formData.password || domPassword;
      const effectiveRememberMe = formData.rememberMe || domRememberMe;

      // Đồng bộ ngược lại state nếu phát hiện giá trị từ DOM autofill
      if (
        effectiveIdentifier !== formData.identifier ||
        effectivePassword !== formData.password ||
        effectiveRememberMe !== formData.rememberMe
      ) {
        setFormData((prev) => ({
          ...prev,
          identifier: effectiveIdentifier,
          password: effectivePassword,
          rememberMe: effectiveRememberMe,
        }));
      }

      const errors = {};
      if (!effectiveIdentifier) {
        errors.identifier = 'Vui lòng nhập Email hoặc Tên đăng nhập';
      }
      if (!effectivePassword) {
        errors.password = 'Vui lòng nhập Mật khẩu';
      }

      if (Object.keys(errors).length > 0) {
        setFieldErrors(errors);
        return;
      }

      loginMutation.mutate(
        {
          identifier: effectiveIdentifier,
          password: effectivePassword,
          rememberMe: effectiveRememberMe,
        },
        {
          onSuccess: (data) => {
            // 1. Trường hợp tài khoản Admin/Boss yêu cầu thiết lập 2FA lần đầu
            if (data?.status === 'mfa_setup_required') {
              setTempToken(data.accessToken || '');
              setStep('mfa-setup');
              toast('Tài khoản quản trị viên yêu cầu thiết lập bảo mật 2FA.', { icon: '🛡️' });
              return;
            }

            // 2. Trường hợp tài khoản đã bật 2FA, yêu cầu nhập mã OTP
            if (data?.requireMfa || data?.mfaRequired || data?.status === 'mfa_required') {
              setMfaToken(data.mfaToken || '');
              setStep('mfa');
              toast('Vui lòng nhập mã OTP 6 số để tiếp tục.', { icon: '🔐' });
              return;
            }

            toast.success('Đăng nhập thành công! Chào mừng bạn trở lại.');
            navigate(redirectTo, { replace: true });
          },
          onError: (err) => {
            const message =
              err?.response?.data?.message ||
              err?.message ||
              'Đăng nhập thất bại. Vui lòng kiểm tra lại thông tin.';
            setServerError(message);
          },
        }
      );
    },
    [formData, loginMutation, navigate, redirectTo]
  );

  const handleMfaVerify = useCallback(
    (code) => {
      setServerError('');
      mfaVerifyMutation.mutate(
        {
          mfaToken,
          code,
        },
        {
          onSuccess: () => {
            toast.success('Xác thực 2FA thành công!');
            navigate(redirectTo, { replace: true });
          },
          onError: (err) => {
            const message =
              err?.response?.data?.message ||
              err?.message ||
              'Mã xác thực 2FA không chính xác hoặc đã hết hạn.';
            setServerError(message);
          },
        }
      );
    },
    [mfaToken, mfaVerifyMutation, navigate, redirectTo]
  );

  const handleMfaSetupSuccess = useCallback(() => {
    // Sau khi kích hoạt thành công, tự động thực hiện đăng nhập lại bằng thông tin có sẵn
    loginMutation.mutate(
      {
        identifier: formData.identifier.trim(),
        password: formData.password,
        rememberMe: formData.rememberMe,
      },
      {
        onSuccess: (data) => {
          if (data?.status === 'mfa_required' || data?.mfaToken) {
            setMfaToken(data.mfaToken || '');
            setStep('mfa');
            toast('Vui lòng nhập mã OTP từ ứng dụng để hoàn tất phiên đăng nhập.', { icon: '🔐' });
          } else {
            toast.success('Đăng nhập thành công!');
            navigate(redirectTo, { replace: true });
          }
        },
        onError: () => {
          setStep('credentials');
        },
      }
    );
  }, [formData, loginMutation, navigate, redirectTo]);

  const handleBackToCredentials = useCallback(() => {
    setStep('credentials');
    setServerError('');
  }, []);

  const isLoggingIn = loginMutation.isPending;
  const isVerifyingMfa = mfaVerifyMutation.isPending;

  return (
    <div className="auth-page auth-page--login">
      <Seo
        title="Đăng nhập"
        description="Đăng nhập tài khoản Sạp Phim để xem tiếp các tập phim yêu thích và quản lý danh sách của bạn."
        canonicalPath={ROUTES.LOGIN}
      />
      <AnimatePresence mode="wait">
        {step === 'credentials' ? (
          <motion.div
            key="login-credentials"
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 16 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="auth-form__header">
              <h2 className="auth-form__title">Đăng nhập tài khoản</h2>
              <p className="auth-form__subtitle">
                Đăng nhập để xem tiếp các tập phim yêu thích và quản lý danh sách của bạn.
              </p>
            </div>

            {serverError && (
              <div className="auth-form__banner-error" role="alert">
                <AlertCircle size={16} aria-hidden="true" />
                <span>{serverError}</span>
              </div>
            )}

            <form className="auth-form" onSubmit={handleCredentialsSubmit} noValidate>
              <div className="auth-form__fields">
                <TextField
                  label="Email hoặc Tên đăng nhập"
                  name="identifier"
                  type="text"
                  value={formData.identifier}
                  onChange={handleInputChange}
                  error={Boolean(fieldErrors.identifier)}
                  helperText={fieldErrors.identifier}
                  placeholder="name@example.com hoặc username"
                  required
                  fullWidth
                  size="medium"
                  variant="outlined"
                  disabled={isLoggingIn}
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
                  label="Mật khẩu"
                  name="password"
                  type="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  error={Boolean(fieldErrors.password)}
                  helperText={fieldErrors.password}
                  placeholder="Nhập mật khẩu của bạn"
                  required
                  fullWidth
                  size="medium"
                  variant="outlined"
                  showPasswordToggle
                  disabled={isLoggingIn}
                  autoComplete="current-password"
                  InputProps={{
                    startAdornment: (
                      <Lock size={18} className="auth-form__input-icon" aria-hidden="true" />
                    ),
                  }}
                />
              </div>

              <div className="auth-form__options">
                <label className="auth-form__checkbox-label">
                  <input
                    type="checkbox"
                    name="rememberMe"
                    checked={formData.rememberMe}
                    onChange={handleInputChange}
                    disabled={isLoggingIn}
                  />
                  <span>Ghi nhớ đăng nhập</span>
                </label>

                <Link to={ROUTES.FORGOT_PW} className="auth-form__forgot-link">
                  Quên mật khẩu?
                </Link>
              </div>

              <div className="auth-form__actions">
                <Button
                  type="submit"
                  variant="filled"
                  color="primary"
                  size="medium"
                  fullWidth
                  loading={isLoggingIn}
                  disabled={isLoggingIn}
                  className="auth-form__submit-btn"
                >
                  Đăng nhập
                </Button>
              </div>
            </form>

            <AuthSocialButtons disabled={isLoggingIn} />

            <div className="auth-form__footer">
              <span>Chưa có tài khoản?</span>
              <Link to={ROUTES.REGISTER} className="auth-form__footer-link">
                Đăng ký ngay
              </Link>
            </div>
          </motion.div>
        ) : step === 'mfa-setup' ? (
          <motion.div
            key="login-mfa-setup"
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          >
            <MfaSetupStep
              tempToken={tempToken}
              onBack={handleBackToCredentials}
              onSetupSuccess={handleMfaSetupSuccess}
            />
          </motion.div>
        ) : (
          <motion.div
            key="login-mfa"
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          >
            <MfaVerifyStep
              error={serverError}
              isPending={isVerifyingMfa}
              onVerify={handleMfaVerify}
              onBack={handleBackToCredentials}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default memo(LoginPage);
