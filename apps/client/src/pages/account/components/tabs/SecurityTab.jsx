/**
 * @file SecurityTab.jsx
 * @module Pages/Account/Components/Tabs/SecurityTab
 * @component SecurityTab
 * @description Tab quản lý bảo mật (Đổi mật khẩu, Xác thực 2FA/MFA, Danh sách phiên đăng nhập Active Sessions).
 */

import React, { memo, useCallback, useState } from 'react';
import PropTypes from 'prop-types';
import {
  AlertCircle,
  CheckCircle2,
  KeyRound,
  Laptop,
  Lock,
  LogOut,
  Shield,
  ShieldAlert,
  Smartphone,
  Trash2,
} from 'lucide-react';
import toast from 'react-hot-toast';

import Badge from '@/shared/components/ui/badge/Badge';
import Button from '@/shared/components/ui/button/Button';
import TextField from '@/shared/components/ui/text-field/TextField';
import PasswordStrengthBar from '@/pages/auth/components/PasswordStrengthBar';
import { validatePassword } from '@/pages/auth/utils/auth-form.validator';
import { formatDateTime } from '@/shared/utils/format.util';

import './_account-tabs.scss';

/**
 * @component SecurityTab
 */
export const SecurityTab = ({
  profile,
  sessions,
  onChangePassword,
  onRevokeSession,
  onLogoutAllSessions,
  isChangingPassword,
  isRevokingSession,
  isLoggingOutAll,
}) => {
  // Password Form State
  const [passwordForm, setPasswordForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
    logout_all: true,
  });
  const [passwordErrors, setPasswordErrors] = useState({});
  const [serverError, setServerError] = useState('');

  const handlePasswordInputChange = useCallback((e) => {
    const { name, value, type, checked } = e.target;
    setPasswordForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
    setPasswordErrors((prev) => ({ ...prev, [name]: '' }));
    setServerError('');
  }, []);

  const handlePasswordSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      setServerError('');

      const errors = {};
      if (!passwordForm.current_password) {
        errors.current_password = 'Vui lòng nhập mật khẩu hiện tại';
      }

      const newPassErr = validatePassword(passwordForm.new_password);
      if (newPassErr) {
        errors.new_password = newPassErr;
      }

      if (!passwordForm.confirm_password) {
        errors.confirm_password = 'Vui lòng xác nhận mật khẩu mới';
      } else if (passwordForm.new_password !== passwordForm.confirm_password) {
        errors.confirm_password = 'Mật khẩu xác nhận không trùng khớp';
      }

      if (Object.keys(errors).length > 0) {
        setPasswordErrors(errors);
        return;
      }

      try {
        await onChangePassword({
          current_password: passwordForm.current_password,
          new_password: passwordForm.new_password,
          confirm_password: passwordForm.confirm_password,
          logout_all: passwordForm.logout_all,
        });

        setPasswordForm({
          current_password: '',
          new_password: '',
          confirm_password: '',
          logout_all: true,
        });
      } catch (err) {
        const msg = err?.response?.data?.message || err?.message || 'Đổi mật khẩu thất bại.';
        setServerError(msg);
      }
    },
    [onChangePassword, passwordForm]
  );

  return (
    <div className="account-tab-panel" id="account-panel-security" role="tabpanel" aria-labelledby="account-tab-security">
      {/* Header */}
      <div className="account-tab-panel__header">
        <div>
          <h2 className="account-tab-panel__title">Bảo mật & Phiên đăng nhập</h2>
          <p className="account-tab-panel__subtitle">
            Bảo vệ tài khoản với mật khẩu mạnh, xác thực đa yếu tố và quản lý các thiết bị đang truy cập.
          </p>
        </div>
      </div>

      {/* Card: Đổi mật khẩu */}
      <div className="account-card">
        <div className="account-card__header">
          <div className="account-card__header-icon-title">
            <KeyRound size={20} className="account-card__header-icon" aria-hidden="true" />
            <div>
              <h3 className="account-card__title">Đổi mật khẩu</h3>
              <p className="account-card__desc">Chúng tôi khuyến nghị sử dụng mật khẩu mạnh kết hợp chữ hoa, chữ số và ký tự đặc biệt.</p>
            </div>
          </div>
        </div>

        {serverError && (
          <div className="account-card__banner-error" role="alert">
            <AlertCircle size={16} aria-hidden="true" />
            <span>{serverError}</span>
          </div>
        )}

        <form onSubmit={handlePasswordSubmit} noValidate className="account-form">
          <div className="account-card__body account-form__grid">
            <div className="account-form__col-12">
              <TextField
                label="Mật khẩu hiện tại"
                name="current_password"
                type="password"
                value={passwordForm.current_password}
                onChange={handlePasswordInputChange}
                error={Boolean(passwordErrors.current_password)}
                helperText={passwordErrors.current_password}
                placeholder="Nhập mật khẩu đang dùng"
                required
                fullWidth
                size="medium"
                variant="outlined"
                showPasswordToggle
                disabled={isChangingPassword}
                autoComplete="current-password"
                InputProps={{
                  startAdornment: <Lock size={18} className="account-form__input-icon" aria-hidden="true" />,
                }}
              />
            </div>

            <div className="account-form__col-12 account-form__col-md-6">
              <div className="account-form__password-strength-container">
                <TextField
                  label="Mật khẩu mới"
                  name="new_password"
                  type="password"
                  value={passwordForm.new_password}
                  onChange={handlePasswordInputChange}
                  error={Boolean(passwordErrors.new_password)}
                  helperText={passwordErrors.new_password}
                  placeholder="Nhập mật khẩu mới an toàn"
                  required
                  fullWidth
                  size="medium"
                  variant="outlined"
                  showPasswordToggle
                  disabled={isChangingPassword}
                  autoComplete="new-password"
                  InputProps={{
                    startAdornment: <Lock size={18} className="account-form__input-icon" aria-hidden="true" />,
                  }}
                />
                <PasswordStrengthBar password={passwordForm.new_password} />
              </div>
            </div>

            <div className="account-form__col-12 account-form__col-md-6">
              <TextField
                label="Xác nhận mật khẩu mới"
                name="confirm_password"
                type="password"
                value={passwordForm.confirm_password}
                onChange={handlePasswordInputChange}
                error={Boolean(passwordErrors.confirm_password)}
                helperText={passwordErrors.confirm_password}
                placeholder="Nhập lại mật khẩu mới"
                required
                fullWidth
                size="medium"
                variant="outlined"
                showPasswordToggle
                disabled={isChangingPassword}
                autoComplete="new-password"
                InputProps={{
                  startAdornment: <Lock size={18} className="account-form__input-icon" aria-hidden="true" />,
                }}
              />
            </div>

            <div className="account-form__col-12">
              <label className="account-form__checkbox-label">
                <input
                  type="checkbox"
                  name="logout_all"
                  checked={passwordForm.logout_all}
                  onChange={handlePasswordInputChange}
                  disabled={isChangingPassword}
                />
                <span>Đăng xuất khỏi tất cả các thiết bị khác sau khi đổi mật khẩu</span>
              </label>
            </div>
          </div>

          <div className="account-form__actions">
            <Button
              type="submit"
              variant="filled"
              color="primary"
              size="medium"
              loading={isChangingPassword}
              disabled={isChangingPassword || !passwordForm.current_password || !passwordForm.new_password}
            >
              Cập nhật mật khẩu
            </Button>
          </div>
        </form>
      </div>

      {/* Card: Xác thực hai bước (2FA) */}
      <div className="account-card">
        <div className="account-card__header">
          <div className="account-card__header-icon-title">
            <Shield size={20} className="account-card__header-icon" aria-hidden="true" />
            <div>
              <div className="account-card__title-badge-row">
                <h3 className="account-card__title">Xác thực 2 bước (2FA / MFA)</h3>
                {profile.two_factor_enabled || profile.is_mfa_enabled ? (
                  <Badge variant="success" size="small">
                    <CheckCircle2 size={12} style={{ marginRight: 4 }} /> Đang bật
                  </Badge>
                ) : (
                  <Badge variant="outline" size="small">
                    Chưa kích hoạt
                  </Badge>
                )}
              </div>
              <p className="account-card__desc">
                Tăng cường bảo mật tài khoản bằng cách yêu cầu mã OTP từ ứng dụng xác thực (Google Authenticator, Authy) khi đăng nhập.
              </p>
            </div>
          </div>
        </div>

        <div className="account-card__body">
          <div className="account-card__info-box">
            <p>
              Khi kích hoạt 2FA, ngay cả khi ai đó biết mật khẩu của bạn, họ vẫn không thể đăng nhập nếu không có mã xác thực từ điện thoại của bạn.
            </p>
          </div>
        </div>
      </div>

      {/* Card: Thiết bị & Phiên hoạt động */}
      <div className="account-card">
        <div className="account-card__header account-card__header--between">
          <div className="account-card__header-icon-title">
            <Laptop size={20} className="account-card__header-icon" aria-hidden="true" />
            <div>
              <h3 className="account-card__title">Thiết bị đang đăng nhập</h3>
              <p className="account-card__desc">Danh sách các trình duyệt và thiết bị có phiên đăng nhập hoạt động.</p>
            </div>
          </div>

          {sessions.length > 1 && (
            <Button
              type="button"
              variant="outlined"
              color="error"
              size="small"
              loading={isLoggingOutAll}
              disabled={isLoggingOutAll}
              onClick={onLogoutAllSessions}
              startIcon={<LogOut size={14} />}
            >
              Đăng xuất tất cả thiết bị khác
            </Button>
          )}
        </div>

        <div className="account-card__body">
          <div className="account-sessions-list">
            {sessions.length === 0 ? (
              <div className="account-sessions-list__empty">
                <Laptop size={32} className="account-sessions-list__empty-icon" aria-hidden="true" />
                <p>Chưa có thông tin phiên thiết bị bổ sung nào.</p>
              </div>
            ) : (
              sessions.map((session, index) => {
                const isMobile = /mobile|android|iphone|ipad/i.test(session.user_agent || '');
                const DeviceIcon = isMobile ? Smartphone : Laptop;
                const isCurrentSession = session.is_current || index === 0;

                return (
                  <div key={session.id || index} className="account-session-item">
                    <div className="account-session-item__icon-wrapper" aria-hidden="true">
                      <DeviceIcon size={20} />
                    </div>

                    <div className="account-session-item__details">
                      <div className="account-session-item__title-row">
                        <span className="account-session-item__device-name">
                          {session.device_name || session.browser || 'Trình duyệt Web'}
                        </span>
                        {isCurrentSession && (
                          <Badge variant="primary" size="small">
                            Thiết bị này
                          </Badge>
                        )}
                      </div>

                      <div className="account-session-item__meta-row">
                        <span>IP: {session.ip_address || '127.0.0.1'}</span>
                        <span>&bull;</span>
                        <span>{session.location || 'Việt Nam'}</span>
                        <span>&bull;</span>
                        <span>Hoạt động: {formatDateTime(session.last_active_at || session.created_at)}</span>
                      </div>
                    </div>

                    {!isCurrentSession && (
                      <Button
                        type="button"
                        variant="text"
                        color="error"
                        size="small"
                        loading={isRevokingSession}
                        disabled={isRevokingSession}
                        onClick={() => onRevokeSession(session.id)}
                        startIcon={<Trash2 size={14} />}
                      >
                        Đăng xuất
                      </Button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

SecurityTab.propTypes = {
  profile: PropTypes.object.isRequired,
  sessions: PropTypes.array.isRequired,
  onChangePassword: PropTypes.func.isRequired,
  onRevokeSession: PropTypes.func.isRequired,
  onLogoutAllSessions: PropTypes.func.isRequired,
  isChangingPassword: PropTypes.bool,
  isRevokingSession: PropTypes.bool,
  isLoggingOutAll: PropTypes.bool,
};

export default memo(SecurityTab);
