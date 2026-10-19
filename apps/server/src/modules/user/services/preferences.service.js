/**
 * @file preferences.service.js
 * @module Modules_User_Services
 * @description Xử lý nghiệp vụ liên quan đến tùy chọn người dùng và thiết lập quyền riêng tư.
 */

import { User } from "../../../models/index.js";
import { cacheConfig, cacheHelper } from "../../../config/redis.config.js";
import { AppError } from "../../../utils/app-error.js";

export const PRIVACY_ALLOWED_KEYS = ["show_email", "show_dob", "show_social", "show_activity"];

export const DEFAULT_PREFERENCES = {
  theme: "dark",
  language: "vi",
  autoplay_next_episode: true,
  skip_intro: false,
  email_notifications: true,
  push_notifications: true,
};

export const PRIVACY_PRESETS = {
  public: {
    show_email: "private", // Email luôn private theo mặc định để chống spam
    show_dob: "public",
    show_social: "public",
    show_activity: "public",
  },
  friends_only: {
    show_email: "private",
    show_dob: "friends_only",
    show_social: "friends_only",
    show_activity: "friends_only",
  },
  private: {
    show_email: "private",
    show_dob: "private",
    show_social: "private",
    show_activity: "private",
  },
};

export const preferencesService = {
  /**
   * Lấy cấu hình tuỳ chọn và riêng tư.
   */
  async getPreferences(userId) {
    const user = await User.findByPk(userId, {
      attributes: ["preferences", "privacy_settings"],
    });

    if (!user) throw new AppError("Người dùng không tồn tại", 404);

    return {
      preferences: user.preferences || DEFAULT_PREFERENCES,
      privacy_settings: user.privacy_settings || PRIVACY_PRESETS.public,
    };
  },

  /**
   * Cập nhật tuỳ chọn ứng dụng.
   */
  async updatePreferences(userId, data) {
    const user = await User.findByPk(userId, { attributes: ["id", "preferences"] });
    if (!user) throw new AppError("Người dùng không tồn tại", 404);

    const currentPreferences = user.preferences || DEFAULT_PREFERENCES;
    const newPreferences = { ...currentPreferences, ...data };

    await User.update({ preferences: newPreferences }, { where: { id: userId } });

    return newPreferences;
  },

  /**
   * Cập nhật thiết lập quyền riêng tư.
   */
  async updatePrivacySettings(userId, data) {
    const user = await User.findByPk(userId, { attributes: ["id", "privacy_settings"] });
    if (!user) throw new AppError("Người dùng không tồn tại", 404);

    const currentSettings = user.privacy_settings || PRIVACY_PRESETS.public;
    const newSettings = { ...currentSettings };

    for (const key of PRIVACY_ALLOWED_KEYS) {
      if (data[key] !== undefined) {
        newSettings[key] = data[key];
      }
    }

    await User.update({ privacy_settings: newSettings }, { where: { id: userId } });

    // Xóa cache vì privacy thay đổi ảnh hưởng đến hiển thị profile
    await cacheHelper.del(`${cacheConfig.prefix.profile}${userId}`);

    return newSettings;
  },

  /**
   * Khôi phục cài đặt gốc cho preferences.
   */
  async resetPreferences(userId) {
    await User.update({ preferences: DEFAULT_PREFERENCES }, { where: { id: userId } });
    return DEFAULT_PREFERENCES;
  },

  /**
   * Áp dụng preset cho privacy settings.
   */
  async applyPreset(userId, presetName) {
    const preset = PRIVACY_PRESETS[presetName];
    if (!preset) {
      throw new AppError("Preset không hợp lệ", 400);
    }

    await User.update({ privacy_settings: preset }, { where: { id: userId } });
    await cacheHelper.del(`${cacheConfig.prefix.profile}${userId}`);

    return preset;
  },
};
