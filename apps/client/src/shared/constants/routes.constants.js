/**
 * @file routes.constants.js
 * @module Constants/Routes
 * @description Định nghĩa tập trung toàn bộ URL paths và dynamic URL builders trong ứng dụng Sạp Phim (Client, Auth, Admin).
 */

export const ROUTES = {
  // ── Client Routes ───────────────────────────────────────────
  HOME: '/',
  CATALOG: '/catalog',
  SEARCH: '/search',
  MOVIE_DETAIL: (slug = ':slug') => '/movie/' + slug,
  WATCH: (slug = ':slug', episodeId = ':episodeId') => '/watch/' + slug + '/' + episodeId,
  WALLET: '/wallet',
  VIP: '/vip',
  ACCOUNT: '/account',
  PROFILE: '/profile',
  USER_SETTINGS: '/settings',

  // ── Auth Routes ─────────────────────────────────────────────
  LOGIN: '/login',
  REGISTER: '/register',
  FORGOT_PW: '/forgot-password',
  RESET_PW: '/reset-password',
  RESET_PW_TOKEN: (token = ':token') => '/reset-password/' + token,
  VERIFY_EMAIL: '/verify-email',
  VERIFY_EMAIL_TOKEN: (token = ':token') => '/verify-email/' + token,

  // ── Error & Status Routes ───────────────────────────────────
  UNAUTHORIZED: '/unauthorized',
  FORBIDDEN: '/forbidden',
  NOT_FOUND: '/404',

  // ── Admin Portal Routes ─────────────────────────────────────
  ADMIN: {
    ROOT: '/admin',
    DASHBOARD: '/admin/dashboard',
    BROADCAST_SCHEDULES: '/admin/broadcast-schedules',
    CALENDAR: '/admin/broadcast-schedules',
    MOVIES: '/admin/movies',
    MOVIE: '/admin/movies',
    MOVIE_CREATE: '/admin/movies/create',
    MOVIE_EDIT: (id = ':id') => '/admin/movies/edit/' + id,
    MOVIE_DETAIL: (id = ':id') => '/admin/movies/detail/' + id,
    EPISODES: '/admin/episodes',
    SERIES: '/admin/series',
    GENRES: '/admin/genres',
    CATEGORIES: '/admin/categories',
    COUNTRIES: '/admin/countries',
    STUDIOS: '/admin/studios',
    ACTORS: '/admin/actors',
    USERS: '/admin/users',
    WALLETS: '/admin/wallets',
    PAYMENT_REQUESTS: '/admin/payment-requests',
    MEMBERSHIP_PLANS: '/admin/membership-plans',
    SUBSCRIPTIONS: '/admin/subscriptions',
    NOTIFICATIONS: '/admin/notifications',
    SESSIONS: '/admin/sessions',
    COMMENTS: '/admin/comments',
    UPLOADS: '/admin/uploads',
    SETTINGS: '/admin/settings',
  },
};

export default ROUTES;
