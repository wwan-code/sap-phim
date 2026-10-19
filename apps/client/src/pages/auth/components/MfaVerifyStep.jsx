/**
 * @file MfaVerifyStep.jsx
 * @module Pages/Auth/Components/MfaVerifyStep
 * @component MfaVerifyStep
 * @description Bước nhập mã xác thực hai yếu tố (2FA/MFA) 6 số chuyển tiếp nội tuyến trong LoginPage.
 */

import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { ArrowLeft, KeyRound, ShieldCheck } from 'lucide-react';

import Button from '@/shared/components/ui/button/Button';
import TextField from '@/shared/components/ui/text-field/TextField';

/**
 * @component MfaVerifyStep
 * @description Màn hình nhập mã xác thực OTP từ ứng dụng Google Authenticator / 2FA.
 */
const MfaVerifyStep = ({
  error,
  isPending = false,
  onBack,
  onVerify,
}) => {
  const [code, setCode] = useState('');
  const [localError, setLocalError] = useState('');
  const inputRef = useRef(null);

  // Tự động focus vào ô nhập OTP khi bước 2FA xuất hiện
  useEffect(() => {
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 150);
    return () => clearTimeout(timer);
  }, []);

  const handleChange = useCallback((e) => {
    const val = e.target.value.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8);
    setCode(val);
    setLocalError('');
  }, []);

  const handleSubmit = useCallback(
    (e) => {
      e.preventDefault();
      if (!code.trim()) {
        setLocalError('Vui lòng nhập mã xác thực 2FA');
        return;
      }

      if (code.trim().length < 6) {
        setLocalError('Mã xác thực phải có ít nhất 6 chữ số');
        return;
      }

      onVerify(code.trim());
    },
    [code, onVerify]
  );

  const displayError = localError || error;

  return (
    <div className="mfa-verify-step">
      <div className="mfa-verify-step__header">
        <div className="mfa-verify-step__icon-wrapper">
          <ShieldCheck size={28} className="mfa-verify-step__icon" aria-hidden="true" />
        </div>
        <h2 className="auth-form__title">Xác thực 2 yếu tố (2FA)</h2>
        <p className="auth-form__subtitle">
          Tài khoản của bạn đã được bảo vệ. Vui lòng mở ứng dụng xác thực (Google Authenticator / Authy) và nhập mã OTP 6 số để hoàn tất.
        </p>
      </div>

      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <TextField
          ref={inputRef}
          label="Mã xác thực 6 số"
          name="mfaCode"
          type="text"
          value={code}
          onChange={handleChange}
          error={Boolean(displayError)}
          helperText={displayError || 'Nhập 6 chữ số hiển thị trên ứng dụng của bạn'}
          placeholder="Ví dụ: 123456"
          required
          fullWidth
          size="medium"
          variant="outlined"
          disabled={isPending}
          autoComplete="one-time-code"
          inputProps={{
            inputMode: 'numeric',
            maxLength: 8,
            autoCapitalize: 'none',
            autoCorrect: 'off',
            spellCheck: 'false',
          }}
          InputProps={{
            startAdornment: <KeyRound size={18} className="auth-form__input-icon" aria-hidden="true" />,
          }}
        />

        <div className="auth-form__actions">
          <Button
            type="submit"
            variant="filled"
            color="primary"
            size="medium"
            fullWidth
            loading={isPending}
            disabled={isPending || code.length < 6}
            className="auth-form__submit-btn"
          >
            Xác nhận đăng nhập
          </Button>

          <Button
            type="button"
            variant="text"
            color="inherit"
            size="medium"
            fullWidth
            disabled={isPending}
            onClick={onBack}
            startIcon={<ArrowLeft size={16} />}
            className="auth-form__back-btn"
          >
            Quay lại đăng nhập
          </Button>
        </div>
      </form>
    </div>
  );
};

MfaVerifyStep.propTypes = {
  error: PropTypes.string,
  isPending: PropTypes.bool,
  onBack: PropTypes.func.isRequired,
  onVerify: PropTypes.func.isRequired,
};

export default memo(MfaVerifyStep);
