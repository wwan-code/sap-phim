/**
 * @file MfaSetupStep.jsx
 * @module Pages/Auth/Components/MfaSetupStep
 * @component MfaSetupStep
 * @description Bước thiết lập bắt buộc xác thực hai yếu tố (MFA/2FA) dành cho Quản trị viên (Admin/Boss) tại LoginPage.
 */

import React, { memo, useCallback, useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { ArrowLeft, Check, Copy, KeyRound, QrCode, ShieldAlert, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';

import Button from '@/shared/components/ui/button/Button';
import TextField from '@/shared/components/ui/text-field/TextField';
import authService from '@/shared/services/auth.service';
import { useMfaSetupQuery } from '@/hooks/queries/use-auth.queries';

/**
 * @component MfaSetupStep
 * @description Hiển thị mã QR và khóa bí mật để quét ứng dụng Authenticator, sau đó kích hoạt bằng mã OTP đầu tiên.
 */
const MfaSetupStep = ({ tempToken, onBack, onSetupSuccess }) => {
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [copied, setCopied] = useState(false);

  // Truy vấn dữ liệu thiết lập MFA bằng TanStack Query (ngăn chặn duplicate call)
  const {
    data: setupData,
    isLoading: loadingSetup,
    error: queryError,
  } = useMfaSetupQuery(tempToken);

  const error =
    submitError ||
    (queryError?.response?.data?.message || queryError?.message || '');

  const handleCopySecret = useCallback(() => {
    if (!setupData?.secret) return;
    navigator.clipboard.writeText(setupData.secret);
    setCopied(true);
    toast.success('Đã sao chép khóa bí mật!');
    setTimeout(() => setCopied(false), 2000);
  }, [setupData?.secret]);

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      if (!code.trim() || code.trim().length < 6) {
        setSubmitError('Vui lòng nhập đủ 6 chữ số OTP từ ứng dụng');
        return;
      }

      try {
        setSubmitting(true);
        setSubmitError('');
        const result = await authService.enableMfa(
          {
            code: code.trim(),
            secret: setupData?.secret,
          },
          tempToken
        );

        toast.success('Đã kích hoạt bảo mật 2FA thành công!', { icon: '🛡️' });
        onSetupSuccess(result);
      } catch (err) {
        const msg =
          err?.response?.data?.message ||
          err?.message ||
          'Mã xác thực không hợp lệ. Vui lòng thử lại.';
        setSubmitError(msg);
      } finally {
        setSubmitting(false);
      }
    },
    [code, onSetupSuccess, setupData?.secret, tempToken]
  );

  return (
    <div className="mfa-verify-step mfa-setup-step">
      <div className="mfa-verify-step__header">
        <div className="mfa-verify-step__icon-wrapper">
          <ShieldAlert size={28} className="mfa-verify-step__icon" aria-hidden="true" />
        </div>
        <h2 className="auth-form__title">Thiết lập bảo mật 2FA</h2>
        <p className="auth-form__subtitle">
          Tài khoản quản trị viên yêu cầu kích hoạt xác thực 2 bước (Google Authenticator / Authy) trước khi truy cập hệ thống.
        </p>
      </div>

      {loadingSetup ? (
        <div className="auth-form__loading-box" style={{ padding: '32px 0', textAlign: 'center' }}>
          <p style={{ color: 'var(--sp-color-text-secondary)' }}>Đang tạo mã QR bảo mật...</p>
        </div>
      ) : error && !setupData ? (
        <div className="auth-form__error-banner" style={{ marginBottom: '20px' }}>
          <span>{error}</span>
          <Button
            type="button"
            variant="tonal"
            size="small"
            onClick={onBack}
            style={{ marginTop: '12px' }}
          >
            Quay lại
          </Button>
        </div>
      ) : (
        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          {/* QR Code Container */}
          {setupData?.secret && (
            <div
              className="mfa-setup-step__qr-container"
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '20px 16px',
                background: 'var(--sp-color-surface-container-high, #1B1F2B)',
                borderRadius: 'var(--sp-radius-md, 12px)',
                marginBottom: '20px',
              }}
            >
              {setupData?.otpauthUrl && (
                <div
                  style={{
                    backgroundColor: '#FFFFFF',
                    padding: '10px',
                    borderRadius: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: 'var(--sp-shadow-flat)',
                  }}
                >
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(
                      setupData.otpauthUrl
                    )}`}
                    alt="QR Code MFA"
                    style={{
                      width: '150px',
                      height: '150px',
                      display: 'block',
                    }}
                    loading="eager"
                  />
                </div>
              )}

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginTop: '14px',
                  padding: '8px 12px',
                  background: 'var(--sp-color-surface-container-lowest, #07080A)',
                  borderRadius: 'var(--sp-radius-sm, 6px)',
                  border: '1px solid var(--sp-border-subtle)',
                  fontSize: '0.875rem',
                  width: '100%',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', overflow: 'hidden' }}>
                  <span style={{ fontSize: '0.6875rem', color: 'var(--sp-color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Khóa bí mật thủ công
                  </span>
                  <code
                    style={{
                      color: 'var(--sp-color-brand-primary, #E50914)',
                      fontWeight: 700,
                      fontFamily: 'var(--sp-font-mono)',
                      fontSize: '0.8125rem',
                      letterSpacing: '0.08em',
                      wordBreak: 'break-all',
                    }}
                  >
                    {setupData.secret}
                  </code>
                </div>

                <button
                  type="button"
                  onClick={handleCopySecret}
                  style={{
                    background: 'var(--sp-color-surface-container-high, #1B1F2B)',
                    border: '1px solid var(--sp-border-subtle)',
                    borderRadius: '6px',
                    color: 'var(--sp-color-text-primary)',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '6px 10px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    flexShrink: 0,
                    transition: 'background var(--sp-transition-fast)',
                  }}
                  title="Sao chép khóa"
                >
                  {copied ? (
                    <>
                      <Check size={14} color="#10B981" />
                      <span style={{ color: '#10B981' }}>Đã chép</span>
                    </>
                  ) : (
                    <>
                      <Copy size={14} />
                      <span>Sao chép</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          <TextField
            label="Nhập mã OTP 6 số để kích hoạt"
            name="mfaCode"
            type="text"
            value={code}
            onChange={(e) => {
              setCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6));
              setSubmitError('');
            }}
            error={Boolean(error)}
            helperText={error || 'Quét mã QR bằng ứng dụng Authenticator và nhập 6 số hiển thị'}
            placeholder="Ví dụ: 123456"
            required
            fullWidth
            size="medium"
            variant="outlined"
            disabled={submitting}
            autoComplete="one-time-code"
            inputProps={{
              inputMode: 'numeric',
              maxLength: 6,
            }}
            InputProps={{
              startAdornment: (
                <KeyRound size={18} className="auth-form__input-icon" aria-hidden="true" />
              ),
            }}
          />

          <div className="auth-form__actions" style={{ marginTop: '20px' }}>
            <Button
              type="submit"
              variant="filled"
              color="primary"
              size="medium"
              fullWidth
              loading={submitting}
              disabled={submitting || code.length < 6}
              className="auth-form__submit-btn"
            >
              Kích hoạt & Tiếp tục
            </Button>

            <Button
              type="button"
              variant="text"
              color="inherit"
              size="medium"
              fullWidth
              disabled={submitting}
              onClick={onBack}
              startIcon={<ArrowLeft size={16} />}
              className="auth-form__back-btn"
            >
              Quay lại đăng nhập
            </Button>
          </div>
        </form>
      )}
    </div>
  );
};

MfaSetupStep.propTypes = {
  tempToken: PropTypes.string.isRequired,
  onBack: PropTypes.func.isRequired,
  onSetupSuccess: PropTypes.func.isRequired,
};

export default memo(MfaSetupStep);
