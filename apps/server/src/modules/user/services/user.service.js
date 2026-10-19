/**
 * Dịch vụ Người dùng (User Service — Barrel Facade)
 *
 * @description Đóng vai trò là một "Cổng giao tiếp duy nhất" (Facade) cho toàn bộ module User.
 * Nó gộp tất cả các sub-services (account, profile, social, admin-user, preferences)
 * vào một đối tượng duy nhất để các module khác dễ dàng truy cập và duy trì tính tương thích ngược.
 * Các module nội bộ nên import trực tiếp từ các sub-service để tối ưu hóa hiệu năng (tree-shaking).
 */
import { profileService } from "./profile.service.js";
import { preferencesService } from "./preferences.service.js";
import { socialService } from "./social.service.js";
import { accountService } from "./account.service.js";
import { adminUserService } from "./admin-user.service.js";

/**
 * @const userService
 * @description Facade gom nhóm toàn bộ các API của User Module.
 */
export const userService = {
  // 1. Profile (Công khai & Cá nhân)
  getProfile: profileService.getProfile,
  updateProfile: profileService.updateProfile,
  updateAvatar: profileService.updateAvatar,
  updateCover: profileService.updateCover,

  // 2. Preferences & Privacy
  getPreferences: preferencesService.getPreferences,
  updatePreferences: preferencesService.updatePreferences,
  updatePrivacySettings: preferencesService.updatePrivacySettings,
  resetPreferences: preferencesService.resetPreferences,
  applyPreset: preferencesService.applyPreset,

  // 3. Social (Theo dõi & Mạng xã hội)
  follow: socialService.follow,
  unfollow: socialService.unfollow,
  getFollowers: socialService.getFollowers,
  getFollowing: socialService.getFollowing,

  // 4. Account Management (Tài khoản cá nhân)
  getProfileStats: accountService.getProfileStats,
  exportUserData: accountService.exportUserData,
  deleteAccount: accountService.deleteAccount,

  // 5. Admin Actions (Quản trị viên)
  getUsersAdmin: adminUserService.getUsersAdmin,
  getUserAdmin: adminUserService.getUserAdmin,
  createUserAdmin: adminUserService.createUserAdmin,
  updateUserAdmin: adminUserService.updateUserAdmin,
  updateUserLevelStats: adminUserService.updateUserLevelStats,
  deleteUserAdmin: adminUserService.deleteUserAdmin,
  restoreUserAdmin: adminUserService.restoreUserAdmin,
  getAdminUsers: adminUserService.getAdminUsers,

  // 6. [NEW] Admin — Session Management
  getUserSessionsAdmin: adminUserService.getUserSessionsAdmin,
  revokeUserSessionAdmin: adminUserService.revokeUserSessionAdmin,

  // 7. [NEW] Admin — Wallet Oversight
  getUserWalletAdmin: adminUserService.getUserWalletAdmin,
  lockUserWalletAdmin: adminUserService.lockUserWalletAdmin,
  unlockUserWalletAdmin: adminUserService.unlockUserWalletAdmin,

  // 8. [NEW] Admin — Subscription History
  getUserSubscriptionsAdmin: adminUserService.getUserSubscriptionsAdmin,

  // 9. [NEW] Admin — Bulk Actions
  bulkUpdateStatusAdmin: adminUserService.bulkUpdateStatusAdmin,
};

export default userService;

// Xuất các sub-services để truy cập trực tiếp khi cần
export {
  profileService,
  preferencesService,
  socialService,
  accountService,
  adminUserService
};