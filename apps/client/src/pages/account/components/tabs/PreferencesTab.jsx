/**
 * @file PreferencesTab.jsx
 * @module Pages/Account/Components/Tabs/PreferencesTab
 * @component PreferencesTab
 * @description Tab quản lý tùy chọn trải nghiệm (Cài đặt trình phát phim, Thông báo hệ thống và Khôi phục mặc định).
 */

import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import {
  Bell,
  CheckCircle2,
  Film,
  Play,
  RotateCcw,
  Save,
  Sliders,
  Tv,
} from 'lucide-react';

import Button from '@/shared/components/ui/button/Button';
import Switch from '@/shared/components/ui/switch/Switch';

import './_account-tabs.scss';

const STREAMING_QUALITY_OPTIONS = [
  { value: 'auto', label: 'Tự động thích ứng (Auto)' },
  { value: '1080p', label: 'Full HD (1080p)' },
  { value: '720p', label: 'HD (720p)' },
  { value: '4k', label: 'Ultra HD 4K (Dành riêng VIP)' },
];

/**
 * @component PreferencesTab
 */
export const PreferencesTab = ({
  preferences,
  onUpdatePreferences,
  onResetPreferences,
  isUpdatingPreferences,
}) => {
  const [prefData, setPrefData] = useState({
    autoplay_next_episode: true,
    auto_skip_intro: true,
    default_quality: 'auto',
    default_subtitles: true,
    notify_new_episodes: true,
    notify_comments: true,
    notify_promotions: false,
  });

  const [initialPref, setInitialPref] = useState({});

  useEffect(() => {
    if (!preferences) return;
    const playback = preferences.playback || {};
    const notifications = preferences.notifications || {};

    const data = {
      autoplay_next_episode: playback.autoplay_next ?? true,
      auto_skip_intro: playback.auto_skip_intro ?? true,
      default_quality: playback.default_quality || 'auto',
      default_subtitles: playback.default_subtitles ?? true,
      notify_new_episodes: notifications.new_episodes ?? true,
      notify_comments: notifications.comments ?? true,
      notify_promotions: notifications.promotions ?? false,
    };

    setPrefData(data);
    setInitialPref(data);
  }, [preferences]);

  const isDirty = useMemo(() => {
    return Object.keys(prefData).some((key) => prefData[key] !== initialPref[key]);
  }, [prefData, initialPref]);

  const handleToggleChange = useCallback((field, checked) => {
    setPrefData((prev) => ({ ...prev, [field]: checked }));
  }, []);

  const handleQualityChange = useCallback((e) => {
    setPrefData((prev) => ({ ...prev, default_quality: e.target.value }));
  }, []);

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      if (!isDirty || isUpdatingPreferences) return;

      const payload = {
        playback: {
          autoplay_next: prefData.autoplay_next_episode,
          auto_skip_intro: prefData.auto_skip_intro,
          default_quality: prefData.default_quality,
          default_subtitles: prefData.default_subtitles,
        },
        notifications: {
          new_episodes: prefData.notify_new_episodes,
          comments: prefData.notify_comments,
          promotions: prefData.notify_promotions,
        },
      };

      try {
        await onUpdatePreferences(payload);
        setInitialPref(prefData);
      } catch (err) {
        // Handled in hook
      }
    },
    [isDirty, isUpdatingPreferences, onUpdatePreferences, prefData]
  );

  return (
    <div className="account-tab-panel" id="account-panel-preferences" role="tabpanel" aria-labelledby="account-tab-preferences">
      {/* Header */}
      <div className="account-tab-panel__header">
        <div>
          <h2 className="account-tab-panel__title">Tùy chọn trải nghiệm</h2>
          <p className="account-tab-panel__subtitle">
            Cá nhân hóa trải nghiệm xem phim trực tuyến và thiết lập nhận thông báo từ Sạp Phim.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} noValidate className="account-form">
        {/* Card: Trình phát phim */}
        <div className="account-card">
          <div className="account-card__header">
            <div className="account-card__header-icon-title">
              <Tv size={20} className="account-card__header-icon" aria-hidden="true" />
              <div>
                <h3 className="account-card__title">Cài đặt Trình phát video (Player)</h3>
                <p className="account-card__desc">Tối ưu hóa các thao tác điều khiển khi xem phim và anime.</p>
              </div>
            </div>
          </div>

          <div className="account-card__body account-toggle-list">
            <div className="account-toggle-item">
              <Switch
                checked={prefData.autoplay_next_episode}
                onChange={(e) => handleToggleChange('autoplay_next_episode', e.target.checked)}
                label="Tự động phát tập tiếp theo"
                description="Tự động chuyển tiếp sang tập phim mới khi tập hiện tại kết thúc mà không cần bấm nút."
                color="primary"
              />
            </div>

            <div className="account-toggle-item">
              <Switch
                checked={prefData.auto_skip_intro}
                onChange={(e) => handleToggleChange('auto_skip_intro', e.target.checked)}
                label="Tự động bỏ qua đoạn nhạc mở đầu (Skip Intro)"
                description="Tự động nhảy qua bài hát Opening/Intro của Anime để bắt đầu nội dung tập phim ngay."
                color="primary"
              />
            </div>

            <div className="account-toggle-item">
              <Switch
                checked={prefData.default_subtitles}
                onChange={(e) => handleToggleChange('default_subtitles', e.target.checked)}
                label="Tự động bật phụ đề tiếng Việt"
                description="Luôn bật phụ đề Vietsub chất lượng cao khi phát video."
                color="primary"
              />
            </div>

            <div className="account-toggle-item account-toggle-item--select">
              <div className="account-toggle-item__text-block">
                <span className="account-toggle-item__title">Chất lượng phát mặc định</span>
                <span className="account-toggle-item__desc">
                  Hệ thống sẽ ưu tiên tải video ở độ phân giải này nếu đường truyền mạng cho phép.
                </span>
              </div>

              <select
                className="account-select-native"
                value={prefData.default_quality}
                onChange={handleQualityChange}
                aria-label="Chất lượng phát mặc định"
              >
                {STREAMING_QUALITY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Card: Thông báo */}
        <div className="account-card">
          <div className="account-card__header">
            <div className="account-card__header-icon-title">
              <Bell size={20} className="account-card__header-icon" aria-hidden="true" />
              <div>
                <h3 className="account-card__title">Tùy chọn Thông báo &amp; Email</h3>
                <p className="account-card__desc">Kiểm soát các thông báo bạn muốn nhận qua Email và trên hệ thống.</p>
              </div>
            </div>
          </div>

          <div className="account-card__body account-toggle-list">
            <div className="account-toggle-item">
              <Switch
                checked={prefData.notify_new_episodes}
                onChange={(e) => handleToggleChange('notify_new_episodes', e.target.checked)}
                label="Thông báo khi có tập phim mới"
                description="Gửi thông báo khi các bộ phim trong danh sách Yêu thích / Theo dõi của bạn có tập mới ra mắt."
                color="primary"
              />
            </div>

            <div className="account-toggle-item">
              <Switch
                checked={prefData.notify_comments}
                onChange={(e) => handleToggleChange('notify_comments', e.target.checked)}
                label="Thông báo khi có người trả lời bình luận"
                description="Nhận thông báo khi có thành viên khác phản hồi hoặc thả tim bình luận của bạn."
                color="primary"
              />
            </div>

            <div className="account-toggle-item">
              <Switch
                checked={prefData.notify_promotions}
                onChange={(e) => handleToggleChange('notify_promotions', e.target.checked)}
                label="Tin tức sự kiện &amp; Khuyến mãi VIP"
                description="Nhận thông tin về các chương trình tặng gói VIP, mã giảm giá và sự kiện đặc biệt."
                color="primary"
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="account-form__actions account-form__actions--between">
          <Button
            type="button"
            variant="outlined"
            color="inherit"
            size="medium"
            onClick={onResetPreferences}
            startIcon={<RotateCcw size={16} />}
          >
            Khôi phục mặc định
          </Button>

          <Button
            type="submit"
            variant="filled"
            color="primary"
            size="medium"
            loading={isUpdatingPreferences}
            disabled={!isDirty || isUpdatingPreferences}
            startIcon={<Save size={16} />}
          >
            {isDirty ? 'Lưu tùy chọn' : 'Đã cập nhật'}
          </Button>
        </div>
      </form>
    </div>
  );
};

PreferencesTab.propTypes = {
  preferences: PropTypes.object.isRequired,
  onUpdatePreferences: PropTypes.func.isRequired,
  onResetPreferences: PropTypes.func.isRequired,
  isUpdatingPreferences: PropTypes.bool,
};

export default memo(PreferencesTab);
