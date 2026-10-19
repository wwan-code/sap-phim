/**
 * Cookie Helper
 * Standardized refresh-token cookie handling.
 */
import jwtConfig from "../../../config/jwt.config.js";
import { TOKEN_CONFIG } from "../../../constants/auth.constant.js";
import { issueCsrfCookie, clearCsrfCookie } from "../../../middlewares/csrf.middleware.js";

const LEGACY_REFRESH_COOKIE_PATHS = [
  jwtConfig.cookie.path,
  "/api/v1/auth",
  "/api/v1/auth/refresh-token",
];

const pushUniqueToken = (tokens, token) => {
  if (typeof token !== "string") return;

  const trimmed = token.trim();
  if (!trimmed || tokens.includes(trimmed)) return;

  tokens.push(trimmed);
};

const parseRawRefreshTokenCookies = (req) => {
  const rawCookie = req.headers?.cookie;
  if (!rawCookie) return [];

  const tokens = [];
  const cookieName = jwtConfig.cookie.name;

  for (const part of rawCookie.split(";")) {
    const separatorIndex = part.indexOf("=");
    if (separatorIndex === -1) continue;

    const name = part.slice(0, separatorIndex).trim();
    if (name !== cookieName) continue;

    const rawValue = part.slice(separatorIndex + 1).trim();
    try {
      pushUniqueToken(tokens, decodeURIComponent(rawValue));
    } catch {
      pushUniqueToken(tokens, rawValue);
    }
  }

  return tokens;
};

/**
 * Store refresh token in an httpOnly cookie.
 *
 * @param {Response} res Express response
 * @param {string} token Raw refresh token
 * @param {boolean} [rememberMe=false] Remember-me state
 */
export const setRefreshTokenCookie = (res, token, rememberMe = false) => {
  const maxAge = rememberMe
    ? TOKEN_CONFIG.REMEMBER_ME_EXPIRY_MS
    : TOKEN_CONFIG.REFRESH_TOKEN_EXPIRY_MS;

  clearRefreshTokenCookie(res);

  res.cookie(jwtConfig.cookie.name, token, {
    httpOnly: jwtConfig.cookie.httpOnly,
    secure: jwtConfig.cookie.secure,
    sameSite: jwtConfig.cookie.sameSite,
    maxAge,
    path: jwtConfig.cookie.path,
  });
};

/**
 * Clear refresh-token cookies from the canonical and known legacy paths.
 *
 * @param {Response} res Express response
 */
export const clearRefreshTokenCookie = (res) => {
  for (const path of LEGACY_REFRESH_COOKIE_PATHS) {
    res.clearCookie(jwtConfig.cookie.name, {
      httpOnly: jwtConfig.cookie.httpOnly,
      secure: jwtConfig.cookie.secure,
      sameSite: jwtConfig.cookie.sameSite,
      path,
    });
  }
};

/**
 * Set đồng thời cookie refresh-token VÀ cookie CSRF (XSRF-TOKEN).
 * Dùng hàm này ở mọi nơi cấp phiên mới thay vì gọi riêng lẻ
 * `setRefreshTokenCookie`, để đảm bảo không có endpoint nào quên phát hành
 * CSRF token (login, refresh-token, verify-email tự động đăng nhập, v.v.)
 *
 * @param {Response} res Express response
 * @param {string} refreshToken Refresh token thô
 * @param {boolean} [rememberMe=false]
 * @returns {string} CSRF token vừa phát hành (hữu ích nếu muốn trả kèm trong body)
 */
export const setAuthCookies = (res, refreshToken, rememberMe = false) => {
  setRefreshTokenCookie(res, refreshToken, rememberMe);
  return issueCsrfCookie(res);
};

export const clearAuthCookies = (res) => {
  clearRefreshTokenCookie(res);
  clearCsrfCookie(res);
};

/**
 * Extract all refresh-token candidates from request cookies and body.
 * Raw cookie parsing is required because cookie-parser keeps only the first
 * duplicate cookie name, while browsers can send several path-scoped cookies.
 *
 * @param {Request} req Express request
 * @returns {string[]} Refresh-token candidates in priority order
 */
export const getRefreshTokenCandidatesFromRequest = (req) => {
  const tokens = [];

  for (const token of parseRawRefreshTokenCookies(req)) {
    pushUniqueToken(tokens, token);
  }

  pushUniqueToken(tokens, req.cookies?.[jwtConfig.cookie.name]);
  pushUniqueToken(tokens, req.body?.refreshToken);
  pushUniqueToken(tokens, req.body?.refresh_token);

  return tokens;
};

/**
 * Extract the first refresh-token candidate from a request.
 *
 * @param {Request} req Express request
 * @returns {string|null} Refresh token or null
 */
export const getRefreshTokenFromRequest = (req) => {
  return getRefreshTokenCandidatesFromRequest(req)[0] || null;
};

export default {
  setRefreshTokenCookie,
  clearRefreshTokenCookie,
  setAuthCookies,
  clearAuthCookies,
  getRefreshTokenCandidatesFromRequest,
  getRefreshTokenFromRequest,
};