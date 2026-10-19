/**
 * @file ResetPasswordPage.jsx
 * @module Pages/Auth/ResetPasswordPage
 * @component ResetPasswordPage
 * @description Trang Đặt lại mật khẩu chuẩn Material 3 Expressive với kiểm tra token URL, thanh đo độ mạnh mật khẩu và bảo mật hai lớp.
 */

import React, { memo, useCallback, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AlertCircle, ArrowLeft, CheckCircle2, Lock, ShieldAlert } from 'lucide-react';
import toast from 'react-hot-toast';

import Button from '@/shared/components/ui/button/Button';
import TextField from '@/shared/components/ui/text-field/TextField';
import Seo from '@/shared/components/common/seo/Seo';
import { useResetPasswordMutation } from '@/hooks/mutations/use-auth.mutations';
import { ROUTES } from '@/shared/constants/routes.constants';

import PasswordStrengthBar from './components/PasswordStrengthBar';
import { validatePassword } from './utils/auth-form.validator';
import './_auth-pages.scss';

/**
 * @component ResetPasswordPage
 * @description Trang thiết lập mật khẩu mới thông qua mã token gửi từ email.
 */
export const ResetPasswordPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [formData, setFormData] = useState({
    password: '',
    confirm_password: '',
  });
  const [fieldErrors, setFieldErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  const resetMutation = useResetPasswordMutation();

  const handleInputChange = useCallback((e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setFieldErrors((prev) => ({ ...prev, [name]: '' }));
    setServerError('');
  }, []);

  const handleSubmit = useCallback(
    (e) => {
      e.preventDefault();
      setServerError('');

      if (!token) {
        setServerError('Mã token khôi phục không tồn tại hoặc đã hết hạn.');
        return;
      }

      const errors = {};
      const passwordErr = validatePassword(formData.password);
      if (passwordErr) errors.password = passwordErr;

      if (!formData.confirm_password) {
        errors.confirm_password = 'Vui lòng xác nhận mật khẩu mới';
      } else if (formData.password !== formData.confirm_password) {
        errors.confirm_password = 'Mật khẩu xác nhận không trùng khớp';
      }

      if (Object.keys(errors).length > 0) {
        setFieldErrors(errors);
        return;
      }

      resetMutation.mutate(
        {
          token: token.trim(),
          password: formData.password,
          confirm_password: formData.confirm_password,
        },
        {
          onSuccess: () => {
            setIsSuccess(true);
            toast.success('Mật khẩu của bạn đã được đặt lại thành công!');
          },
          onError: (err) => {
            const message =
              err?.response?.data?.message ||
              err?.message ||
              'Không thể đặt lại mật khẩu. Mã xác thực có thể đã hết hạn.';
            setServerError(message);
          },
        }
      );
    },
    [formData, resetMutation, token]
  );

  const isPending = resetMutation.isPending;

  // Trường hợp không có token trên URL
  if (!token) {
    return (
      <div className="auth-page auth-page--reset-password">
        <Seo
          title="Đặt lại mật khẩu"
          description="Thiết lập mật khẩu mới cho tài khoản Sạp Phim của bạn."
          canonicalPath={ROUTES.RESET_PW}
          noIndex
        />
        <div className="email-sent-card">
          <div className="email-sent-card__icon-wrapper">
            <ShieldAlert size={32} className="email-sent-card__icon" aria-hidden="true" />
          </div>

          <h2 className="auth-form__title">Liên kết không hợp lệ</h2>

          <p className="auth-form__subtitle">
            Đường dẫn đặt lại mật khẩu bị thiếu mã token xác thực hoặc đã hết hạn. Vui lòng gửi lại yêu cầu khôi phục mới.
          </p>

          <div className="email-sent-card__actions">
            <Button
              component={Link}
              to={ROUTES.FORGOT_PW}
              variant="filled"
              color="primary"
              size="medium"
              fullWidth
              className="email-sent-card__back-link"
            >
              Gửi lại yêu cầu khôi phục
            </Button>

            <Button
              component={Link}
              to={ROUTES.LOGIN}
              variant="text"
              color="inherit"
              size="medium"
              fullWidth
              startIcon={<ArrowLeft size={16} />}
              className="email-sent-card__back-link"
            >
              Quay lại Đăng nhập
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Trường hợp đã đặt lại thành công
  if (isSuccess) {
    return (
      <div className="auth-page auth-page--reset-password">
        <Seo
          title="Đặt lại mật khẩu thành công"
          description="Mật khẩu tài khoản Sạp Phim đã được cập nhật thành công."
          canonicalPath={ROUTES.RESET_PW}
          noIndex
        />
        <div className="email-sent-card">
          <div className="email-sent-card__icon-wrapper">
            <CheckCircle2 size={32} style={{ color: 'var(--sp-color-status-success)' }} aria-hidden="true" />
          </div>

          <h2 className="auth-form__title">Đặt lại mật khẩu thành công!</h2>

          <p className="auth-form__subtitle">
            Mật khẩu mới của bạn đã được cập nhật an toàn. Bây giờ bạn có thể đăng nhập bằng mật khẩu vừa tạo.
          </p>

          <div className="email-sent-card__actions">
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
      </div>
    );
  }

  return (
    <div className="auth-page auth-page--reset-password">
      <Seo
        title="Đặt lại mật khẩu"
        description="Thiết lập mật khẩu mới cho tài khoản Sạp Phim của bạn."
        canonicalPath={ROUTES.RESET_PW}
        noIndex
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="auth-form__header">
          <h2 className="auth-form__title">Đặt lại mật khẩu</h2>
          <p className="auth-form__subtitle">
            Nhập mật khẩu mới an toàn cho tài khoản của bạn để tiếp tục trải nghiệm.
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
            <div className="auth-form__password-field-group">
              <TextField
                label="Mật khẩu mới"
                name="password"
                type="password"
                value={formData.password}
                onChange={handleInputChange}
                error={Boolean(fieldErrors.password)}
                helperText={fieldErrors.password}
                placeholder="Nhập mật khẩu mới"
                required
                fullWidth
                size="medium"
                variant="outlined"
                showPasswordToggle
                disabled={isPending}
                autoComplete="new-password"
                InputProps={{
                  startAdornment: (
                    <Lock size={18} className="auth-form__input-icon" aria-hidden="true" />
                  ),
                }}
              />

              <PasswordStrengthBar password={formData.password} />
            </div>

            <TextField
              label="Xác nhận mật khẩu mới"
              name="confirm_password"
              type="password"
              value={formData.confirm_password}
              onChange={handleInputChange}
              error={Boolean(fieldErrors.confirm_password)}
              helperText={fieldErrors.confirm_password}
              placeholder="Nhập lại mật khẩu mới"
              required
              fullWidth
              size="medium"
              variant="outlined"
              showPasswordToggle
              disabled={isPending}
              autoComplete="new-password"
              InputProps={{
                startAdornment: (
                  <Lock size={18} className="auth-form__input-icon" aria-hidden="true" />
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
              Cập nhật mật khẩu
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
              className="auth-form__back-link"
            >
              Quay lại Đăng nhập
            </Button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

export default memo(ResetPasswordPage);
