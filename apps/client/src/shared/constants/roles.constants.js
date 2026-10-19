/**
 * @file roles.constants.js
 * @module Constants/Roles
 * @description Định nghĩa tập trung các Roles, Phân cấp Role và Permissions đồng bộ 100% với Database Seeder của Backend.
 */

export const ROLES = {
  BOSS: 'boss',
  ADMIN: 'admin',
  MODERATOR: 'moderator',
  PREMIUM_USER: 'premium_user',
  USER: 'user',
};

export const ROLE_HIERARCHY = {
  [ROLES.BOSS]: 100,
  [ROLES.ADMIN]: 80,
  [ROLES.MODERATOR]: 50,
  [ROLES.PREMIUM_USER]: 30,
  [ROLES.USER]: 10,
};

export const PERMISSIONS = {
  // ── Movies ──────────────────────────────────────────────────
  MOVIES_VIEW: 'movies.view',
  MOVIES_CREATE: 'movies.create',
  MOVIES_EDIT: 'movies.edit',
  MOVIES_DELETE: 'movies.delete',
  MOVIES_FEATURE: 'movies.feature',

  // ── Users ───────────────────────────────────────────────────
  USERS_VIEW: 'users.view',
  USERS_EDIT: 'users.edit',
  USERS_BAN: 'users.ban',
  USERS_DELETE: 'users.delete',
  USERS_ASSIGN_ROLES: 'users.assign_roles',
  USERS_MANAGE: 'users.edit', // Alias

  // ── Comments ────────────────────────────────────────────────
  COMMENTS_CREATE: 'comments.create',
  COMMENTS_EDIT_OWN: 'comments.edit_own',
  COMMENTS_DELETE_ANY: 'comments.delete_any',
  COMMENTS_PIN: 'comments.pin',

  // ── Series & Episodes ───────────────────────────────────────
  SERIES_VIEW: 'series.view',
  SERIES_CREATE: 'series.create',
  SERIES_EDIT: 'series.edit',
  SERIES_DELETE: 'series.delete',
  EPISODES_VIEW: 'episodes.view',
  EPISODES_CREATE: 'episodes.create',
  EPISODES_EDIT: 'episodes.edit',
  EPISODES_DELETE: 'episodes.delete',
  EPISODES_MANAGE: 'episodes.edit', // Alias

  // ── Taxonomy ────────────────────────────────────────────────
  CATEGORIES_MANAGE: 'categories.manage',
  COUNTRIES_MANAGE: 'countries.manage',
  GENRES_MANAGE: 'genres.manage',
  TOPICS_MANAGE: 'topics.manage',
  COLLECTIONS_MANAGE: 'collections.manage',
  STUDIOS_MANAGE: 'studios.manage',
  ACTORS_MANAGE: 'actors.manage',

  // ── Ratings ─────────────────────────────────────────────────
  RATINGS_CREATE: 'ratings.create',

  // ── Wallet ──────────────────────────────────────────────────
  WALLET_VIEW: 'wallet.view',
  WALLET_ADJUST: 'wallet.adjust',
  WALLET_LOCK: 'wallet.lock',
  WALLET_UNLOCK: 'wallet.unlock',
  WALLET_MANAGE: 'wallet.adjust', // Alias

  // ── Payment Requests ────────────────────────────────────────
  PAYMENT_VIEW: 'payment.view',
  PAYMENT_APPROVE: 'payment.approve',
  PAYMENT_REJECT: 'payment.reject',

  // ── Membership Plans ────────────────────────────────────────
  MEMBERSHIP_READ: 'membership_plan.read',
  MEMBERSHIP_CREATE: 'membership_plan.create',
  MEMBERSHIP_UPDATE: 'membership_plan.update',
  MEMBERSHIP_DELETE: 'membership_plan.delete',
  MEMBERSHIP_MANAGE: 'membership_plan.update', // Alias

  // ── Subscriptions ───────────────────────────────────────────
  SUBSCRIPTIONS_VIEW: 'subscriptions.view',
  SUBSCRIPTIONS_CREATE: 'subscriptions.create',
  SUBSCRIPTIONS_EDIT: 'subscriptions.edit',
  SUBSCRIPTIONS_DELETE: 'subscriptions.delete',
  SUBSCRIPTIONS_CANCEL: 'subscriptions.cancel',

  // ── Admin & System ──────────────────────────────────────────
  AI_MANAGE: 'ai.manage',
  NOTIFICATIONS_MANAGE: 'notifications.manage',
  UPLOADS_MANAGE: 'uploads.manage',
  ADMIN_ACCESS: 'admin.access',
  ADMIN_DASHBOARD: 'admin.dashboard',
  ADMIN_LOGS: 'admin.logs',
  ADMIN_SETTINGS: 'admin.settings',
  SETTINGS_MANAGE: 'admin.settings', // Alias
  MODERATION_VIEW: 'movies.view', // Alias
};

export default { ROLES, ROLE_HIERARCHY, PERMISSIONS };
