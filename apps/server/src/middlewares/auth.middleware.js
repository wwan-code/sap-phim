/**
 * Middleware Xác thực & Phân quyền (Auth Middleware)
 *
 * @file auth.middleware.js
 * @module Middlewares
 * @description Xử lý xác thực người dùng qua JWT, kiểm soát truy cập dựa trên vai trò (RBAC).
 * Sử dụng cơ chế Cache-first (Redis) để tối ưu hiệu suất và DB fallback để đảm bảo tính nhất quán.
 */

import jwt from "jsonwebtoken";
import { Op } from "sequelize";
import { verifyAccessToken } from "../utils/jwt.util.js";
import {
  User,
  Role,
  Permission,
  Subscription,
  MembershipPlan,
} from "../models/index.js";
import jwtConfig from "../config/jwt.config.js";
import { cacheConfig, cacheHelper } from "../config/redis.config.js";
import responseUtil from "../utils/response.util.js";
import { logger } from "../utils/logger.js";
import { ROLES, ROLE_HIERARCHY } from "../constants/roles.constant.js";

/**
 * Truy vấn thông tin người dùng từ cơ sở dữ liệu kèm vai trò và quyền hạn.
 *
 * @param {string} userId - ID người dùng cần truy vấn
 * @returns {Promise<Object|null>} Dữ liệu người dùng hoặc null nếu không tìm thấy
 */
const fetchUserFromDB = async (userId) => {
  const dbUser = await User.findByPk(userId, {
    attributes: [
      "id",
      "username",
      "email",
      "status",
      "avatar_url",
      "token_version",
    ],
    include: [
      {
        model: Role,
        as: "role",
        attributes: ["slug"],
        include: [
          {
            model: Permission,
            as: "permissions",
            attributes: ["slug"],
            through: { attributes: [] },
          },
        ],
      },
      {
        model: Subscription,
        as: "subscriptions",
        where: { status: "active" },
        required: false,
        include: [
          {
            model: MembershipPlan,
            as: "plan",
            attributes: ["id", "slug", "name", "badge_color", "features"],
          },
        ],
      },
    ],
  });

  if (!dbUser) return null;

  const permsSet = new Set();
  const rolesSet = new Set();

  if (dbUser.role) {
    rolesSet.add(dbUser.role.slug);
    if (dbUser.role.permissions) {
      for (const perm of dbUser.role.permissions) {
        permsSet.add(perm.slug);
      }
    }
  }

  const user = {
    id: dbUser.id,
    username: dbUser.username,
    email: dbUser.email,
    status: dbUser.status,
    avatar_url: dbUser.avatar_url,
    subscriptions: dbUser.subscriptions
      ? dbUser.subscriptions.map((s) => s.get({ plain: true }))
      : [],
  };

  return {
    user,
    rolesSlugs: Array.from(rolesSet),
    permissions: Array.from(permsSet),
    tokenVersion: dbUser.token_version ?? 1,
  };
};

/**
 * Lấy dữ liệu người dùng theo thứ tự: Redis Cache -> Database Fallback.
 * Tận dụng Redis để giảm tải truy vấn cho Database chính.
 *
 * @param {string} userId - ID người dùng
 * @returns {Promise<Object|null>} Dữ liệu người dùng đã được định dạng
 */
const resolveUserData = async (userId) => {
  const cacheKey = `${cacheConfig.prefix.user}${userId}`;

  try {
    const cachedData = await cacheHelper.get(cacheKey);

    if (cachedData && cachedData.user) {
      return {
        user: cachedData.user,
        rolesSlugs: new Set(cachedData.rolesSlugs),
        permissions: new Set(cachedData.permissions),
        tokenVersion: cachedData.tokenVersion ?? 1,
      };
    }
  } catch (cacheError) {
    logger.warn(
      `[AuthMiddleware] Lỗi đọc cache cho user ${userId}, chuyển sang truy vấn DB: ${cacheError.message}`,
    );
  }

  const dbData = await fetchUserFromDB(userId);
  if (!dbData) return null;

  // Cập nhật lại cache trong tiến trình chạy ngầm
  cacheHelper
    .set(
      cacheKey,
      {
        user: dbData.user,
        rolesSlugs: dbData.rolesSlugs,
        permissions: dbData.permissions,
        tokenVersion: dbData.tokenVersion,
      },
      cacheConfig.ttl.user,
    )
    .catch((err) =>
      logger.warn(`[AuthMiddleware] Cập nhật cache thất bại: ${err.message}`),
    );

  return {
    user: dbData.user,
    rolesSlugs: new Set(dbData.rolesSlugs),
    permissions: new Set(dbData.permissions),
    tokenVersion: dbData.tokenVersion,
  };
};

/**
 * Gán thông tin người dùng vào đối tượng Request của Express.
 *
 * @param {Object} req - Express Request
 * @param {Object} data - Dữ liệu người dùng
 */
const attachUserToRequest = (req, data) => {
  req.user = data.user;
  req.userId = data.user.id;
  req.userRoles = data.rolesSlugs;
  req.userPermissions = data.permissions;
  req.tokenVersion = data.tokenVersion;
};

const MFA_SETUP_ALLOWED_PATHS = new Set([
  "/api/v1/auth/mfa/setup",
  "/api/v1/auth/mfa/enable",
  "/api/v1/auth/logout",
  "/api/v1/auth/me",
  "/mfa/setup",
  "/mfa/enable",
  "/logout",
  "/me",
]);

/**
 * Middleware: Xác thực mã Access Token (JWT).
 * Kiểm tra tính hợp lệ của Token, trạng thái tài khoản, token_version và danh sách đen (Blacklist).
 */
export const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return responseUtil.error(res, "Vui lòng đăng nhập để tiếp tục", 401);
    }

    const token = authHeader.split(" ")[1];

    if (jwtConfig.blacklist.enabled) {
      try {
        const isBlacklisted = await cacheHelper.exists(
          `${jwtConfig.blacklist.prefix}${token}`,
        );
        if (isBlacklisted) {
          return responseUtil.error(
            res,
            "Phiên đăng nhập đã hết hạn hoặc bị thu hồi",
            401,
          );
        }
      } catch {
        logger.warn(
          "[AuthMiddleware] Không thể kiểm tra Blacklist (Redis mất kết nối)",
        );
      }
    }

    const decoded = verifyAccessToken(token);
    const userData = await resolveUserData(decoded.id);

    if (!userData) {
      return responseUtil.error(
        res,
        "Tài khoản không tồn tại trên hệ thống",
        401,
      );
    }

    if (
      decoded.tokenVersion === undefined ||
      decoded.tokenVersion === null ||
      decoded.tokenVersion !== userData.tokenVersion
    ) {
      return responseUtil.error(
        res,
        "Phiên đăng nhập đã bị thu hồi. Vui lòng đăng nhập lại",
        401,
        "TOKEN_VERSION_MISMATCH",
      );
    }

    if (decoded.isMfaSetupPending) {
      const fullPath = (req.baseUrl || "") + req.path;
      const targetPath = req.originalUrl ? req.originalUrl.split("?")[0] : fullPath;
      if (
        !MFA_SETUP_ALLOWED_PATHS.has(targetPath) &&
        !MFA_SETUP_ALLOWED_PATHS.has(fullPath) &&
        !MFA_SETUP_ALLOWED_PATHS.has(req.path)
      ) {
        return responseUtil.error(
          res,
          "Tài khoản yêu cầu thiết lập MFA trước khi truy cập tài nguyên này",
          401,
          "MFA_SETUP_PENDING",
        );
      }
    }

    if (userData.user.status === "banned") {
      return responseUtil.error(res, "Tài khoản của bạn đã bị khóa", 403);
    }

    if (userData.user.status === "inactive") {
      return responseUtil.error(
        res,
        "Tài khoản chưa được kích hoạt hoặc đã bị vô hiệu hóa",
        403,
      );
    }

    attachUserToRequest(req, userData);
    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return responseUtil.error(
        res,
        "Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại",
        401,
      );
    }
    if (error.name === "JsonWebTokenError") {
      return responseUtil.error(res, "Mã xác thực không hợp lệ", 401);
    }
    next(error);
  }
};

/**
 * Middleware: Xác thực không bắt buộc (Optional Auth).
 * Gắn thông tin người dùng nếu có token hợp lệ, ngược lại cho phép truy cập dưới quyền khách.
 */
export const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return next();
    }

    const token = authHeader.split(" ")[1];
    const decoded = verifyAccessToken(token);

    const userData = await resolveUserData(decoded.id);

    if (
      userData &&
      decoded.tokenVersion !== undefined &&
      decoded.tokenVersion === userData.tokenVersion &&
      userData.user.status !== "banned" &&
      userData.user.status !== "inactive"
    ) {
      attachUserToRequest(req, userData);
    }
  } catch {
    // Chế độ khách: Bỏ qua lỗi token và tiếp tục luồng xử lý
  }
  next();
};

/**
 * Kiểm tra xem người dùng có sở hữu bất kỳ vai trò nào trong danh sách yêu cầu hay không.
 *
 * @param {Set<string>} userRoles - Tập hợp vai trò hiện có của người dùng
 * @param {string[]} requiredRoles - Danh sách mã vai trò yêu cầu
 * @returns {boolean} Kết quả kiểm tra
 */
export const hasAnyRole = (userRoles, requiredRoles) => {
  if (!userRoles || !(userRoles instanceof Set) || userRoles.size === 0) {
    return false;
  }
  return requiredRoles.some((role) => userRoles.has(role));
};

/**
 * Xác định role slug "cao nhất" (đặc quyền lớn nhất) trong tập hợp role của 1 user,
 * dựa trên ROLE_HIERARCHY. Dùng khi 1 service cần biết chính xác "quyền hiệu lực" của actor
 * dưới dạng 1 slug duy nhất (VD: admin-user.service.js#assertCanManageTarget), thay vì làm
 * việc với cả Set nhiều role.
 *
 * @param {Set<string>} userRoles - Tập role slug của user (req.userRoles)
 * @returns {string|null} Role slug có priority cao nhất, hoặc null nếu rỗng
 */
export const getHighestRoleSlug = (userRoles) => {
  if (!userRoles || !(userRoles instanceof Set) || userRoles.size === 0) {
    return null;
  }

  let highestSlug = null;
  let highestPriority = -1;

  for (const slug of userRoles) {
    const priority = ROLE_HIERARCHY[slug] ?? 0;
    if (priority > highestPriority) {
      highestPriority = priority;
      highestSlug = slug;
    }
  }

  return highestSlug;
};

/**
 * Middleware: Yêu cầu quyền Quản trị (Admin hoặc Boss).
 */
export const isAdmin = (req, res, next) => {
  if (
    !req.userRoles ||
    !hasAnyRole(req.userRoles, [ROLES.BOSS, ROLES.ADMIN])
  ) {
    return responseUtil.error(
      res,
      "Chỉ Quản trị viên mới có quyền thực hiện thao tác này",
      403,
    );
  }
  next();
};

/**
 * Middleware: Yêu cầu quyền Kiểm duyệt (Moderator trở lên).
 */
export const isModerator = (req, res, next) => {
  if (
    !req.userRoles ||
    !hasAnyRole(req.userRoles, [
      ROLES.BOSS,
      ROLES.ADMIN,
      ROLES.MODERATOR,
    ])
  ) {
    return responseUtil.error(
      res,
      "Bạn không đủ quyền hạn để thực hiện thao tác này",
      403,
    );
  }
  next();
};

/**
 * Middleware: Kiểm tra quyền hạn cụ thể (Permission Slug).
 * Boss mặc định có tất cả các quyền trong hệ thống.
 *
 * @param {string} permissionSlug - Mã định danh quyền hạn
 * @returns {Function} Express Middleware
 */
export const hasPermission = (permissionSlug) => {
  return (req, res, next) => {
    if (req.userRoles && req.userRoles.has(ROLES.BOSS)) {
      return next();
    }

    if (!req.userPermissions || !req.userPermissions.has(permissionSlug)) {
      return responseUtil.error(
        res,
        "Tài khoản của bạn không có quyền truy cập chức năng này",
        403,
      );
    }
    next();
  };
};

/**
 * Middleware: Kiểm tra danh sách vai trò cho phép truy cập.
 *
 * @param {...string} roles - Danh sách các mã vai trò
 * @returns {Function} Express Middleware
 */
export const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.userRoles) {
      return responseUtil.error(res, "Vui lòng đăng nhập để tiếp tục", 401);
    }

    if (req.userRoles.has(ROLES.BOSS)) {
      return next();
    }

    if (!hasAnyRole(req.userRoles, roles)) {
      return responseUtil.error(
        res,
        "Vai trò hiện tại không có quyền truy cập tài nguyên này",
        403,
      );
    }

    next();
  };
};

/**
 * Các hàm Alias để hỗ trợ đa dạng phong cách gọi trong Routes.
 */
export const authorizePermissions = hasPermission;
export const authenticate = verifyToken;
export const authorize = authorizeRoles;

/**
 * Đưa mã Token vào danh sách đen (Blacklist) khi người dùng Đăng xuất.
 *
 * @param {string} token - Mã JWT cần thu hồi
 */
export const blacklistToken = async (token) => {
  if (!jwtConfig.blacklist.enabled) return;

  try {
    const decoded = jwt.decode(token);
    if (decoded?.exp) {
      const ttl = decoded.exp - Math.floor(Date.now() / 1000);
      if (ttl > 0) {
        await cacheHelper.set(
          `${jwtConfig.blacklist.prefix}${token}`,
          true,
          ttl,
        );
      }
    }
  } catch (error) {
    logger.error(
      "[AuthMiddleware] Lỗi khi đưa token vào danh sách đen:",
      error,
    );
  }
};

/**
 * Làm sạch Cache thông tin người dùng.
 * Cần được gọi sau khi cập nhật hồ sơ, thay đổi quyền hạn, HOẶC bump token_version.
 *
 * @param {string} userId - ID người dùng
 */
export const clearUserCache = async (userId) => {
  await Promise.all([
    cacheHelper.del(`${cacheConfig.prefix.user}${userId}`),
    cacheHelper.del(`me:${userId}`),
  ]);
};

/**
 * Kiểm tra trạng thái gói hội viên VIP (Premium) còn hiệu lực.
 *
 * @param {string} userId - ID người dùng
 * @returns {Promise<boolean>} Trả về true nếu có gói VIP còn hạn
 */
export const hasActiveVipSubscription = async (userId) => {
  try {
    const subscription = await Subscription.findOne({
      where: {
        user_id: userId,
        status: "active",
        expires_at: { [Op.gte]: new Date() },
      },
      include: [
        {
          model: MembershipPlan,
          as: "plan",
          where: {
            is_active: true,
            price: { [Op.gt]: 0 },
          },
        },
      ],
    });

    return !!subscription;
  } catch (error) {
    logger.error("[AuthMiddleware] Lỗi kiểm tra gói hội viên VIP:", error);
    return false;
  }
};

/**
 * Danh sách các vai trò được phép thực hiện các thao tác Premium mặc định.
 */
export const AVATAR_ALLOWED_ROLES = [
  ROLES.BOSS,
  ROLES.ADMIN,
  ROLES.MODERATOR,
  ROLES.PREMIUM_USER,
];

/**
 * Middleware: Kiểm tra quyền thay đổi ảnh đại diện.
 * Người dùng cần có vai trò đặc quyền hoặc sở hữu gói VIP đang hoạt động.
 */
export const authorizeAvatarChange = async (req, res, next) => {
  try {
    if (!req.userRoles) {
      return responseUtil.error(res, "Vui lòng đăng nhập để tiếp tục", 401);
    }

    // Ưu tiên kiểm tra quyền theo vai trò hệ thống
    if (hasAnyRole(req.userRoles, AVATAR_ALLOWED_ROLES)) {
      return next();
    }

    // Kiểm tra quyền theo gói dịch vụ (VIP)
    const hasVip = await hasActiveVipSubscription(req.userId);
    if (hasVip) {
      return next();
    }

    logger.warn(
      `[AuthMiddleware] Từ chối quyền đổi ảnh đại diện cho user ${req.userId} (Không phải VIP)`,
    );

    return responseUtil.error(
      res,
      "Tính năng thay đổi ảnh đại diện chỉ dành cho thành viên VIP hoặc Quản trị viên",
      403,
      { errorCode: "AVATAR_VIP_REQUIRED" },
    );
  } catch (error) {
    logger.error("[AuthMiddleware] Lỗi kiểm tra quyền đổi ảnh đại diện:", error);
    next(error);
  }
};

export default {
  verifyToken,
  authenticate,
  optionalAuth,
  isAdmin,
  isModerator,
  hasPermission,
  authorizeRoles,
  authorize,
  authorizePermissions,
  blacklistToken,
  clearUserCache,
  hasActiveVipSubscription,
  authorizeAvatarChange,
  getHighestRoleSlug,
};