/**
 * @file ProfileTab.jsx
 * @module Pages/Account/Components/Tabs/ProfileTab
 * @component ProfileTab
 * @description Tab quản lý thông tin cá nhân (Họ tên, Username, Email, Ngày sinh, Giới tính, Vị trí, Bio, MXH) và Cập nhật Avatar/Cover.
 */

import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import {
  Camera,
  Check,
  Globe,
  Lock,
  Mail,
  MapPin,
  Save,
  ShieldCheck,
  Sparkles,
  User,
  UserCheck,
} from 'lucide-react';
import toast from 'react-hot-toast';

import Avatar from '@/shared/components/ui/avatar/Avatar';
import Badge from '@/shared/components/ui/badge/Badge';
import Button from '@/shared/components/ui/button/Button';
import TextField from '@/shared/components/ui/text-field/TextField';
import EditMediaModal from '@/shared/components/common/edit-media-modal/EditMediaModal';

import './_account-tabs.scss';

const GENDER_OPTIONS = [
  { value: 'male', label: 'Nam' },
  { value: 'female', label: 'Nữ' },
  { value: 'other', label: 'Khác / Không tiết lộ' },
];

/**
 * @component ProfileTab
 */
export const ProfileTab = ({
  profile,
  onUpdateProfile,
  onUpdateAvatar,
  onUpdateCover,
  isUpdatingProfile,
  isUpdatingAvatar,
  isUpdatingCover,
}) => {
  const fileInputRef = useRef(null);

  // Edit Media Modal State for Avatar
  const [cropImageSrc, setCropImageSrc] = useState(null);
  const [isCropModalOpen, setIsCropModalOpen] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    full_name: '',
    bio: '',
    date_of_birth: '',
    gender: 'other',
    country: '',
    city: '',
    location: '',
    social_facebook: '',
    social_twitter: '',
    social_discord: '',
    social_youtube: '',
    social_github: '',
  });

  const [initialData, setInitialData] = useState({});

  // Sync state with incoming profile
  useEffect(() => {
    if (!profile) return;

    const social = profile.social_links || {};
    const locationStr =
      typeof profile.location === 'object' && profile.location !== null
        ? profile.location.address || ''
        : profile.location || '';

    const data = {
      full_name: profile.full_name || '',
      bio: profile.bio || '',
      date_of_birth: profile.date_of_birth || '',
      gender: profile.gender || 'other',
      country: profile.country || 'Việt Nam',
      city: profile.city || '',
      location: locationStr,
      social_facebook: social.facebook || '',
      social_twitter: social.twitter || '',
      social_discord: social.discord || '',
      social_youtube: social.youtube || '',
      social_github: social.github || '',
    };

    setFormData(data);
    setInitialData(data);
  }, [profile]);

  // Dirty State Tracking
  const isDirty = useMemo(() => {
    return Object.keys(formData).some((key) => formData[key] !== initialData[key]);
  }, [formData, initialData]);

  const handleInputChange = useCallback((e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  }, []);

  // Handle Form Submit
  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      if (!isDirty || isUpdatingProfile) return;

      const socialLinks = {};
      if (formData.social_facebook.trim()) socialLinks.facebook = formData.social_facebook.trim();
      if (formData.social_twitter.trim()) socialLinks.twitter = formData.social_twitter.trim();
      if (formData.social_discord.trim()) socialLinks.discord = formData.social_discord.trim();
      if (formData.social_youtube.trim()) socialLinks.youtube = formData.social_youtube.trim();
      if (formData.social_github.trim()) socialLinks.github = formData.social_github.trim();

      const payload = {
        full_name: formData.full_name.trim(),
        bio: formData.bio.trim(),
        date_of_birth: formData.date_of_birth || null,
        gender: formData.gender,
        country: formData.country.trim(),
        city: formData.city.trim(),
        location: formData.location.trim() ? { address: formData.location.trim() } : null,
        social_links: socialLinks,
      };

      try {
        await onUpdateProfile(payload);
        setInitialData(formData);
      } catch (err) {
        // Error handled in hook
      }
    },
    [formData, isDirty, isUpdatingProfile, onUpdateProfile]
  );

  // Avatar File Selection -> Open EditMediaModal
  const handleAvatarFileChange = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Vui lòng chọn tệp hình ảnh hợp lệ (PNG, JPG, WEBP).');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('Kích thước ảnh tối đa là 10MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      const base64Url = uploadEvent.target?.result;
      if (typeof base64Url === 'string') {
        setCropImageSrc(base64Url);
        setIsCropModalOpen(true);
      }
    };
    reader.readAsDataURL(file);
  }, []);

  // Handle Apply Cropped Avatar
  const handleApplyCroppedAvatar = useCallback(
    async (croppedFile) => {
      setIsCropModalOpen(false);
      setCropImageSrc(null);
      if (fileInputRef.current) fileInputRef.current.value = '';

      try {
        await onUpdateAvatar(croppedFile);
      } catch (err) {
        // Handled in hook
      }
    },
    [onUpdateAvatar]
  );

  // Handle Close Crop Modal
  const handleCloseCropModal = useCallback(() => {
    setIsCropModalOpen(false);
    setCropImageSrc(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  return (
    <div className="account-tab-panel" id="account-panel-profile" role="tabpanel" aria-labelledby="account-tab-profile">
      {/* Header */}
      <div className="account-tab-panel__header">
        <div>
          <h2 className="account-tab-panel__title">Thông tin cá nhân</h2>
          <p className="account-tab-panel__subtitle">
            Quản lý hồ sơ công khai, ảnh đại diện và thông tin liên hệ của bạn trên Sạp Phim.
          </p>
        </div>
      </div>

      {/* Avatar & Profile Hero Card */}
      <div className="account-card account-card--hero">
        <div className="account-card__hero-avatar-section">
          <div className="account-card__avatar-wrapper">
            <Avatar
              src={profile.avatar_url}
              alt={profile.full_name || profile.username || 'User'}
              name={profile.full_name || profile.username || 'User'}
              size="2xl"
              variant="circle"
              loading="eager"
            />
            <button
              type="button"
              className="account-card__avatar-upload-btn"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUpdatingAvatar}
              aria-label="Thay đổi ảnh đại diện"
            >
              <Camera size={16} />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="account-card__hidden-file-input"
              onChange={handleAvatarFileChange}
            />
          </div>

          <div className="account-card__hero-info">
            <div className="account-card__hero-name-row">
              <h3 className="account-card__hero-name">
                {profile.full_name || profile.username || 'Người dùng Sạp Phim'}
              </h3>
              {profile.is_verified && (
                <Badge variant="primary" size="small">
                  <ShieldCheck size={12} style={{ marginRight: 4 }} /> Đã xác thực
                </Badge>
              )}
              {profile.is_premium && (
                <Badge variant="premium" size="small">
                  <Sparkles size={12} style={{ marginRight: 4 }} /> Thành viên VIP
                </Badge>
              )}
            </div>
            <p className="account-card__hero-handle">@{profile.username}</p>
            <p className="account-card__hero-meta">
              Cấp độ: <strong>Level {profile.level || 1}</strong> &bull; Điểm tích lũy: <strong>{profile.exp || 0} EXP</strong>
            </p>
          </div>
        </div>
      </div>

      {/* Main Profile Edit Form */}
      <form onSubmit={handleSubmit} noValidate className="account-form">
        {/* Card: Thông tin cơ bản */}
        <div className="account-card">
          <div className="account-card__header">
            <h3 className="account-card__title">Thông tin định danh</h3>
            <p className="account-card__desc">Các thông tin cơ bản giúp nhận diện tài khoản của bạn.</p>
          </div>

          <div className="account-card__body account-form__grid">
            <div className="account-form__col-12 account-form__col-md-6">
              <TextField
                label="Họ và tên"
                name="full_name"
                value={formData.full_name}
                onChange={handleInputChange}
                placeholder="Ví dụ: Nguyễn Văn A"
                fullWidth
                size="medium"
                variant="outlined"
                disabled={isUpdatingProfile}
                InputProps={{
                  startAdornment: <UserCheck size={18} className="account-form__input-icon" aria-hidden="true" />,
                }}
              />
            </div>

            <div className="account-form__col-12 account-form__col-md-6">
              <TextField
                label="Tên đăng nhập (Username)"
                value={profile.username || ''}
                readOnly
                fullWidth
                size="medium"
                variant="outlined"
                helperText="Tên đăng nhập là cố định để bảo vệ định danh tài khoản"
                InputProps={{
                  startAdornment: <User size={18} className="account-form__input-icon" aria-hidden="true" />,
                  endAdornment: <Lock size={16} className="account-form__lock-icon" aria-hidden="true" />,
                }}
              />
            </div>

            <div className="account-form__col-12 account-form__col-md-6">
              <TextField
                label="Địa chỉ Email"
                value={profile.email || ''}
                readOnly
                fullWidth
                size="medium"
                variant="outlined"
                helperText={profile.is_verified ? 'Email đã được xác thực an toàn' : 'Email chưa xác minh'}
                InputProps={{
                  startAdornment: <Mail size={18} className="account-form__input-icon" aria-hidden="true" />,
                  endAdornment: profile.is_verified ? (
                    <Check size={16} style={{ color: 'var(--sp-color-status-success)' }} aria-hidden="true" />
                  ) : null,
                }}
              />
            </div>

            <div className="account-form__col-12 account-form__col-md-6">
              <TextField
                label="Ngày sinh"
                name="date_of_birth"
                type="date"
                value={formData.date_of_birth}
                onChange={handleInputChange}
                fullWidth
                size="medium"
                variant="outlined"
                disabled={isUpdatingProfile}
                inputProps={{ max: new Date().toISOString().slice(0, 10) }}
              />
            </div>

            <div className="account-form__col-12 account-form__col-md-6">
              <div className="account-form__field-group">
                <label className="account-form__label">Giới tính</label>
                <div className="account-form__radio-group">
                  {GENDER_OPTIONS.map((opt) => (
                    <label key={opt.value} className="account-form__radio-label">
                      <input
                        type="radio"
                        name="gender"
                        value={opt.value}
                        checked={formData.gender === opt.value}
                        onChange={handleInputChange}
                        disabled={isUpdatingProfile}
                      />
                      <span>{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="account-form__col-12">
              <TextField
                label="Tiểu sử (Bio)"
                name="bio"
                value={formData.bio}
                onChange={handleInputChange}
                placeholder="Viết một vài dòng giới thiệu về sở thích xem phim, anime của bạn..."
                fullWidth
                multiline
                rows={3}
                size="medium"
                variant="outlined"
                disabled={isUpdatingProfile}
                helperText={`${formData.bio.length}/500 ký tự`}
              />
            </div>
          </div>
        </div>

        {/* Card: Khu vực & Địa chỉ */}
        <div className="account-card">
          <div className="account-card__header">
            <h3 className="account-card__title">Vị trí & Khu vực</h3>
            <p className="account-card__desc">Cung cấp vị trí để chúng tôi đề xuất nội dung phim phù hợp khu vực của bạn.</p>
          </div>

          <div className="account-card__body account-form__grid">
            <div className="account-form__col-12 account-form__col-md-4">
              <TextField
                label="Quốc gia"
                name="country"
                value={formData.country}
                onChange={handleInputChange}
                placeholder="Việt Nam"
                fullWidth
                size="medium"
                variant="outlined"
                disabled={isUpdatingProfile}
                InputProps={{
                  startAdornment: <Globe size={18} className="account-form__input-icon" aria-hidden="true" />,
                }}
              />
            </div>

            <div className="account-form__col-12 account-form__col-md-4">
              <TextField
                label="Thành phố / Tỉnh"
                name="city"
                value={formData.city}
                onChange={handleInputChange}
                placeholder="Ví dụ: TP. Hồ Chí Minh"
                fullWidth
                size="medium"
                variant="outlined"
                disabled={isUpdatingProfile}
                InputProps={{
                  startAdornment: <MapPin size={18} className="account-form__input-icon" aria-hidden="true" />,
                }}
              />
            </div>

            <div className="account-form__col-12 account-form__col-md-4">
              <TextField
                label="Địa chỉ chi tiết"
                name="location"
                value={formData.location}
                onChange={handleInputChange}
                placeholder="Quận / Huyện, Phường / Xã"
                fullWidth
                size="medium"
                variant="outlined"
                disabled={isUpdatingProfile}
              />
            </div>
          </div>
        </div>

        {/* Card: Liên kết mạng xã hội */}
        <div className="account-card">
          <div className="account-card__header">
            <h3 className="account-card__title">Liên kết Mạng xã hội</h3>
            <p className="account-card__desc">Kết nối các trang cá nhân để bạn bè dễ dàng tìm kiếm bạn.</p>
          </div>

          <div className="account-card__body account-form__grid">
            <div className="account-form__col-12 account-form__col-md-6">
              <TextField
                label="Facebook"
                name="social_facebook"
                value={formData.social_facebook}
                onChange={handleInputChange}
                placeholder="https://facebook.com/username"
                fullWidth
                size="medium"
                variant="outlined"
                disabled={isUpdatingProfile}
              />
            </div>

            <div className="account-form__col-12 account-form__col-md-6">
              <TextField
                label="Twitter / X"
                name="social_twitter"
                value={formData.social_twitter}
                onChange={handleInputChange}
                placeholder="https://x.com/username"
                fullWidth
                size="medium"
                variant="outlined"
                disabled={isUpdatingProfile}
              />
            </div>

            <div className="account-form__col-12 account-form__col-md-6">
              <TextField
                label="Discord"
                name="social_discord"
                value={formData.social_discord}
                onChange={handleInputChange}
                placeholder="username#0000 hoặc discord.gg/..."
                fullWidth
                size="medium"
                variant="outlined"
                disabled={isUpdatingProfile}
              />
            </div>

            <div className="account-form__col-12 account-form__col-md-6">
              <TextField
                label="YouTube"
                name="social_youtube"
                value={formData.social_youtube}
                onChange={handleInputChange}
                placeholder="https://youtube.com/@channel"
                fullWidth
                size="medium"
                variant="outlined"
                disabled={isUpdatingProfile}
              />
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
            loading={isUpdatingProfile}
            disabled={!isDirty || isUpdatingProfile}
            startIcon={<Save size={16} />}
          >
            {isDirty ? 'Lưu thay đổi' : 'Đã cập nhật'}
          </Button>
        </div>
      </form>

      {/* Edit Media Modal for Avatar Crop & Transform */}
      {cropImageSrc && (
        <EditMediaModal
          open={isCropModalOpen}
          isOpen={isCropModalOpen}
          imageSrc={cropImageSrc}
          aspectRatio={1}
          title="Chỉnh sửa ảnh đại diện"
          onClose={handleCloseCropModal}
          onApply={handleApplyCroppedAvatar}
          options={{
            filename: 'avatar.jpeg',
            outputType: 'image/jpeg',
            quality: 0.92,
          }}
        />
      )}
    </div>
  );
};

ProfileTab.propTypes = {
  profile: PropTypes.object.isRequired,
  onUpdateProfile: PropTypes.func.isRequired,
  onUpdateAvatar: PropTypes.func.isRequired,
  onUpdateCover: PropTypes.func.isRequired,
  isUpdatingProfile: PropTypes.bool,
  isUpdatingAvatar: PropTypes.bool,
  isUpdatingCover: PropTypes.bool,
};

export default memo(ProfileTab);
