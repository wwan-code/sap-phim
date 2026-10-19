/**
 * @file PrivacyTab.jsx
 * @module Pages/Account/Components/Tabs/PrivacyTab
 * @component PrivacyTab
 * @description Tab quản lý quyền riêng tư tài khoản (Ẩn/Hiện Email, Ngày sinh, Mạng xã hội, Hoạt động xem phim).
 */

import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import {
  Activity,
  Calendar,
  Eye,
  EyeOff,
  Globe,
  Lock,
  Mail,
  Save,
  Share2,
  Shield,
  Users,
} from 'lucide-react';

import Button from '@/shared/components/ui/button/Button';

import './_account-tabs.scss';

const VISIBILITY_OPTIONS = [
  { value: 'private', label: 'Chỉ mình tôi', icon: Lock, desc: 'Không ai có thể nhìn thấy' },
  { value: 'friends_only', label: 'Bạn bè', icon: Users, desc: 'Chỉ những người trong danh sách bạn bè' },
  { value: 'public', label: 'Mọi người', icon: Globe, desc: 'Hiển thị công khai trên hồ sơ' },
];

/**
 * @component PrivacyTab
 */
export const PrivacyTab = ({
  profile,
  onUpdatePrivacy,
  onApplyPreset,
  isUpdatingPrivacy,
}) => {
  const [privacySettings, setPrivacySettings] = useState({
    show_email: 'private',
    show_dob: 'friends_only',
    show_social: 'public',
    show_activity: 'public',
  });

  const [initialSettings, setInitialSettings] = useState({});

  useEffect(() => {
    if (!profile) return;
    const settings = profile.privacy_settings || {};
    const data = {
      show_email: settings.show_email || 'private',
      show_dob: settings.show_dob || 'friends_only',
      show_social: settings.show_social || 'public',
      show_activity: settings.show_activity || 'public',
    };
    setPrivacySettings(data);
    setInitialSettings(data);
  }, [profile]);

  const isDirty = useMemo(() => {
    return Object.keys(privacySettings).some((key) => privacySettings[key] !== initialSettings[key]);
  }, [privacySettings, initialSettings]);

  const handleSettingChange = useCallback((field, value) => {
    setPrivacySettings((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleApplyPresetClick = useCallback(
    async (presetType) => {
      let newPreset = {};
      if (presetType === 'public') {
        newPreset = {
          show_email: 'public',
          show_dob: 'public',
          show_social: 'public',
          show_activity: 'public',
        };
      } else if (presetType === 'balanced') {
        newPreset = {
          show_email: 'private',
          show_dob: 'friends_only',
          show_social: 'public',
          show_activity: 'public',
        };
      } else if (presetType === 'strict') {
        newPreset = {
          show_email: 'private',
          show_dob: 'private',
          show_social: 'friends_only',
          show_activity: 'private',
        };
      }
      setPrivacySettings(newPreset);
    },
    []
  );

  const currentPreset = useMemo(() => {
    if (
      privacySettings.show_email === 'public' &&
      privacySettings.show_dob === 'public' &&
      privacySettings.show_social === 'public' &&
      privacySettings.show_activity === 'public'
    ) {
      return 'public';
    }
    if (
      privacySettings.show_email === 'private' &&
      privacySettings.show_dob === 'friends_only' &&
      privacySettings.show_social === 'public' &&
      privacySettings.show_activity === 'public'
    ) {
      return 'balanced';
    }
    if (
      privacySettings.show_email === 'private' &&
      privacySettings.show_dob === 'private' &&
      privacySettings.show_social === 'friends_only' &&
      privacySettings.show_activity === 'private'
    ) {
      return 'strict';
    }
    return null;
  }, [privacySettings]);

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      if (!isDirty || isUpdatingPrivacy) return;

      try {
        await onUpdatePrivacy(privacySettings);
        setInitialSettings(privacySettings);
      } catch (err) {
        // Handled in hook
      }
    },
    [isDirty, isUpdatingPrivacy, onUpdatePrivacy, privacySettings]
  );

  return (
    <div className="account-tab-panel" id="account-panel-privacy" role="tabpanel" aria-labelledby="account-tab-privacy">
      {/* Header */}
      <div className="account-tab-panel__header">
        <div>
          <h2 className="account-tab-panel__title">Quyền riêng tư</h2>
          <p className="account-tab-panel__subtitle">
            Kiểm soát thông tin nào của bạn được hiển thị công khai hoặc ẩn đi với người dùng khác trên hệ thống.
          </p>
        </div>
      </div>

      {/* Quick Presets */}
      <div className="account-card account-card--presets">
        <div className="account-card__header">
          <h3 className="account-card__title">Cấu hình mẫu nhanh (Presets)</h3>
          <p className="account-card__desc">Chọn mức độ riêng tư nhanh chỉ với một cú nhấp chuột.</p>
        </div>

        <div className="account-card__body account-presets-row">
          <button
            type="button"
            className={`account-preset-chip ${currentPreset === 'public' ? 'account-preset-chip--active' : ''}`}
            onClick={() => handleApplyPresetClick('public')}
          >
            <div className="account-preset-chip__icon-box">
              <Globe size={18} className="account-preset-chip__icon" aria-hidden="true" />
            </div>
            <div className="account-preset-chip__text">
              <strong>Công khai (Public)</strong>
              <span>Mở toàn bộ thông tin</span>
            </div>
          </button>

          <button
            type="button"
            className={`account-preset-chip ${currentPreset === 'balanced' ? 'account-preset-chip--active' : ''}`}
            onClick={() => handleApplyPresetClick('balanced')}
          >
            <div className="account-preset-chip__icon-box">
              <Shield size={18} className="account-preset-chip__icon" aria-hidden="true" />
            </div>
            <div className="account-preset-chip__text">
              <strong>Cân bằng (Tiêu chuẩn)</strong>
              <span>Ẩn email, hiện bạn bè</span>
            </div>
          </button>

          <button
            type="button"
            className={`account-preset-chip ${currentPreset === 'strict' ? 'account-preset-chip--active' : ''}`}
            onClick={() => handleApplyPresetClick('strict')}
          >
            <div className="account-preset-chip__icon-box">
              <Lock size={18} className="account-preset-chip__icon" aria-hidden="true" />
            </div>
            <div className="account-preset-chip__text">
              <strong>Riêng tư tối đa (Strict)</strong>
              <span>Ẩn toàn bộ thông tin</span>
            </div>
          </button>
        </div>
      </div>

      {/* Main Privacy Controls */}
      <form onSubmit={handleSubmit} noValidate className="account-form">
        <div className="account-card">
          <div className="account-card__header">
            <h3 className="account-card__title">Quyền hiển thị thông tin</h3>
            <p className="account-card__desc">Tùy chỉnh đối tượng có thể nhìn thấy từng trường thông tin trên hồ sơ của bạn.</p>
          </div>

          <div className="account-card__body account-privacy-list">
            {/* 1. Email */}
            <div className="account-privacy-item">
              <div className="account-privacy-item__info">
                <div className="account-privacy-item__icon-title">
                  <Mail size={18} className="account-privacy-item__icon" aria-hidden="true" />
                  <div>
                    <h4 className="account-privacy-item__name">Địa chỉ Email</h4>
                    <p className="account-privacy-item__desc">Hiển thị email tài khoản trên trang cá nhân.</p>
                  </div>
                </div>
              </div>

              <div className="account-privacy-item__options">
                {VISIBILITY_OPTIONS.map((opt) => (
                  <label key={opt.value} className="account-privacy-item__radio-label">
                    <input
                      type="radio"
                      name="show_email"
                      value={opt.value}
                      checked={privacySettings.show_email === opt.value}
                      onChange={() => handleSettingChange('show_email', opt.value)}
                    />
                    <span>{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* 2. Ngày sinh */}
            <div className="account-privacy-item">
              <div className="account-privacy-item__info">
                <div className="account-privacy-item__icon-title">
                  <Calendar size={18} className="account-privacy-item__icon" aria-hidden="true" />
                  <div>
                    <h4 className="account-privacy-item__name">Ngày sinh (Date of Birth)</h4>
                    <p className="account-privacy-item__desc">Cho phép bạn bè gửi lời chúc sinh nhật trên trang cá nhân.</p>
                  </div>
                </div>
              </div>

              <div className="account-privacy-item__options">
                {VISIBILITY_OPTIONS.map((opt) => (
                  <label key={opt.value} className="account-privacy-item__radio-label">
                    <input
                      type="radio"
                      name="show_dob"
                      value={opt.value}
                      checked={privacySettings.show_dob === opt.value}
                      onChange={() => handleSettingChange('show_dob', opt.value)}
                    />
                    <span>{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* 3. Mạng xã hội */}
            <div className="account-privacy-item">
              <div className="account-privacy-item__info">
                <div className="account-privacy-item__icon-title">
                  <Share2 size={18} className="account-privacy-item__icon" aria-hidden="true" />
                  <div>
                    <h4 className="account-privacy-item__name">Liên kết Mạng xã hội</h4>
                    <p className="account-privacy-item__desc">Hiển thị các tài khoản Facebook, Twitter, Discord đã kết nối.</p>
                  </div>
                </div>
              </div>

              <div className="account-privacy-item__options">
                {VISIBILITY_OPTIONS.map((opt) => (
                  <label key={opt.value} className="account-privacy-item__radio-label">
                    <input
                      type="radio"
                      name="show_social"
                      value={opt.value}
                      checked={privacySettings.show_social === opt.value}
                      onChange={() => handleSettingChange('show_social', opt.value)}
                    />
                    <span>{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* 4. Hoạt động xem phim */}
            <div className="account-privacy-item">
              <div className="account-privacy-item__info">
                <div className="account-privacy-item__icon-title">
                  <Activity size={18} className="account-privacy-item__icon" aria-hidden="true" />
                  <div>
                    <h4 className="account-privacy-item__name">Lịch sử xem &amp; Đánh giá phim</h4>
                    <p className="account-privacy-item__desc">Hiển thị số phim đã xem, tổng số bình luận và đánh giá sao của bạn.</p>
                  </div>
                </div>
              </div>

              <div className="account-privacy-item__options">
                {VISIBILITY_OPTIONS.map((opt) => (
                  <label key={opt.value} className="account-privacy-item__radio-label">
                    <input
                      type="radio"
                      name="show_activity"
                      value={opt.value}
                      checked={privacySettings.show_activity === opt.value}
                      onChange={() => handleSettingChange('show_activity', opt.value)}
                    />
                    <span>{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Action Bar */}
        <div className="account-form__actions">
          <Button
            type="submit"
            variant="filled"
            color="primary"
            size="medium"
            loading={isUpdatingPrivacy}
            disabled={!isDirty || isUpdatingPrivacy}
            startIcon={<Save size={16} />}
          >
            {isDirty ? 'Lưu quyền riêng tư' : 'Đã cập nhật'}
          </Button>
        </div>
      </form>
    </div>
  );
};

PrivacyTab.propTypes = {
  profile: PropTypes.object.isRequired,
  onUpdatePrivacy: PropTypes.func.isRequired,
  onApplyPreset: PropTypes.func.isRequired,
  isUpdatingPrivacy: PropTypes.bool,
};

export default memo(PrivacyTab);
