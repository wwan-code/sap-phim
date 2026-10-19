/**
 * @file admin-user.service.js
 * @module Modules_User_Services
 * @description Xử lý nghiệp vụ quản trị người dùng cho trang quản trị (Admin Dashboard).
 */

import { Op } from "sequelize";
import * as argon2 from "argon2";
import { v4 as uuidv4 } from "uuid";
import { User, Role, UserSession, Wallet, Subscription, MembershipPlan, sequelize } from "../../../models/index.js";
import { AppError } from "../../../utils/app-error.js";
import { cacheConfig, cacheHelper } from "../../../config/redis.config.js";
import { ROLES, ROLE_HIERARCHY } from "../../../constants/roles.constant.js";
import { MAX_LEVEL, getExpForLevel, getLevelFromExp } from "../../../constants/level.constant.js";
import { revokeAllUserSessions } from "../../auth/helpers/session.helper.js";
import { emitToUser } from "../../../sockets/services/emit.service.js";
import { SOCKET_EVENTS } from "../../../sockets/constants/socket-events.constants.js";
import { levelService } from "./level.service.js";
import { entitlementService } from "../../subscription/services/entitlement.service.js";
import { logger } from "../../../utils/logger.js";

/**
 * Lấy độ ưu tiên (priority) của 1 role slug từ ROLE_HIERARCHY. Slug lạ/không xác định
 * được coi là quyền thấp nhất (0) — an toàn theo hướng "deny by default".
 */
const priorityOf = (roleSlug) => ROLE_HIERARCHY[roleSlug] ?? 0;

/**
 * [SECURITY] Đảm bảo actor (người thực hiện thao tác admin) có đủ quyền hạn để quản lý
 * một target, dựa trên `ROLE_HIERARCHY` (số càng cao = quyền càng lớn).
 *
 * Quy tắc:
 * 1. Không thể tự xóa tài khoản của chính mình trong trang quản trị.
 * 2. Quản trị tối cao (Boss - cấp 5): Có toàn quyền quản trị và chỉnh sửa mọi tài khoản trong
 *    hệ thống (kể cả Boss khác và chính mình). Ngoại lệ: Không thể tự hạ vai trò của chính mình.
 * 3. Tự quản lý (Self-management của Admin / Mod): Được phép tự cập nhật thông tin cá nhân
 *    (họ tên, mật khẩu,...), nhưng không được tự thay đổi vai trò hoặc tự khóa/vô hiệu hóa chính mình.
 * 4. Quản trị tài khoản khác (Target khác Actor):
 *    - actorPriority PHẢI LỚN HƠN targetCurrentPriority.
 *    - actorPriority PHẢI LỚN HƠN targetNewPriority.
 *
 * @param {Object|string} actorRoleOrOptions
 * @param {string|null} [targetCurrentRoleSlug]
 * @param {string|null} [targetNewRoleSlug]
 * @param {string|null} [actorUserId]
 * @param {string|null} [targetUserId]
 * @param {boolean} [isDelete]
 */
const assertCanManageTarget = (
  actorRoleOrOptions,
  targetCurrentRoleSlug = null,
  targetNewRoleSlug = null,
  actorUserId = null,
  targetUserId = null,
  isDelete = false
) => {
  let opts = {};
  if (typeof actorRoleOrOptions === "object" && actorRoleOrOptions !== null) {
    opts = actorRoleOrOptions;
  } else {
    opts = {
      actorRoleSlug: actorRoleOrOptions,
      targetCurrentRoleSlug,
      targetNewRoleSlug,
      actorUserId,
      targetUserId,
      isDelete,
    };
  }

  const {
    actorRoleSlug,
    targetCurrentRoleSlug: currRole = null,
    targetNewRoleSlug: newRole = null,
    actorUserId: actorId = null,
    targetUserId: targetId = null,
    isDelete: deleting = false,
  } = opts;

  const actorPriority = priorityOf(actorRoleSlug);

  if (!actorRoleSlug || actorPriority === 0) {
    throw new AppError("Không xác định được vai trò người thực hiện", 403);
  }

  const isSelf = Boolean(actorId && targetId && String(actorId) === String(targetId));

  // 1. Chặn tự xóa tài khoản của chính mình trong trang quản trị
  if (isSelf && deleting) {
    throw new AppError("Bạn không thể tự xóa tài khoản của chính mình trong trang quản trị", 400);
  }

  // 2. BOSS (Quản trị tối cao - Cấp 5)
  if (actorRoleSlug === ROLES.BOSS) {
    // Boss có toàn quyền quản trị mọi tài khoản.
    // Ngoại lệ duy nhất: Boss không thể tự hạ cấp vai trò của chính mình
    if (isSelf && newRole && newRole !== ROLES.BOSS) {
      throw new AppError("Quản trị tối cao (Boss) không thể tự hạ cấp vai trò của chính mình", 400);
    }
    return;
  }

  // 3. Tự thao tác trên chính mình (Self-management của Admin / Mod / User)
  if (isSelf) {
    if (newRole && newRole !== currRole) {
      throw new AppError("Bạn không có quyền tự thay đổi vai trò của chính mình", 403);
    }
    return;
  }

  // 4. Quản lý tài khoản người khác (Target khác Actor):
  if (currRole && actorPriority <= priorityOf(currRole)) {
    throw new AppError("Bạn không có quyền thao tác trên tài khoản có vai trò ngang hoặc cao hơn mình", 403);
  }

  if (newRole && actorPriority <= priorityOf(newRole)) {
    throw new AppError("Bạn không có quyền cấp một vai trò ngang hoặc cao hơn vai trò của chính mình", 403);
  }
};

/**
 * Clamp & validate & synchronize level/exp/point cho thao tác ghi trực tiếp của admin.
 * Đảm bảo tính nhất quán chặt chẽ giữa Level và EXP (EXP = 999999 -> Level = 100).
 */
const sanitizeLevelStatsInput = ({ level, exp, point }) => {
  const out = {};
  let parsedLevel = undefined;
  let parsedExp = undefined;

  if (level !== undefined && level !== null && level !== "") {
    const n = Number(level);
    if (!Number.isFinite(n)) throw new AppError("Level không hợp lệ", 400);
    parsedLevel = Math.min(Math.max(Math.trunc(n), 1), MAX_LEVEL);
  }

  if (exp !== undefined && exp !== null && exp !== "") {
    const n = Number(exp);
    if (!Number.isFinite(n)) throw new AppError("EXP không hợp lệ", 400);
    parsedExp = Math.max(Math.trunc(n), 0);
  }

  if (point !== undefined && point !== null && point !== "") {
    const n = Number(point);
    if (!Number.isFinite(n)) throw new AppError("Point không hợp lệ", 400);
    out.point = Math.max(Math.trunc(n), 0);
  }

  // Đồng bộ hai chiều giữa Level và EXP:
  if (parsedExp !== undefined && parsedLevel !== undefined) {
    const expCalculatedLevel = getLevelFromExp(parsedExp);
    if (parsedLevel !== expCalculatedLevel) {
      if (parsedExp === 0 && parsedLevel > 1) {
        out.level = parsedLevel;
        out.exp = getExpForLevel(parsedLevel);
      } else {
        out.level = expCalculatedLevel;
        out.exp = parsedExp;
      }
    } else {
      out.level = parsedLevel;
      out.exp = parsedExp;
    }
  } else if (parsedExp !== undefined) {
    out.exp = parsedExp;
    out.level = getLevelFromExp(parsedExp);
  } else if (parsedLevel !== undefined) {
    out.level = parsedLevel;
    out.exp = getExpForLevel(parsedLevel);
  }

  return out;
};

export const adminUserService = {
  /**
   * Lấy danh sách người dùng (Phân trang & Lọc).
   */
  async getUsersAdmin({
    page = 1,
    limit = 20,
    pageSize,
    search,
    q,
    status,
    role,
    membership_tier,
    order_by = "created_at",
    sortBy,
    sort = "desc",
    sortOrder,
  }) {
    const searchVal = search || q;
    const limitVal = parseInt(limit || pageSize || 20, 10);
    const pageVal = parseInt(page || 1, 10);
    const offset = (pageVal - 1) * limitVal;
    const where = {};
    const roleWhere = {};

    if (searchVal) {
      where[Op.or] = [
        { username: { [Op.iLike]: `%${searchVal}%` } },
        { email: { [Op.iLike]: `%${searchVal}%` } },
        { full_name: { [Op.iLike]: `%${searchVal}%` } },
      ];
    }

    if (status) {
      where.status = status;
    }

    if (membership_tier) {
      where.membership_tier = membership_tier;
    }

    if (role) {
      roleWhere.slug = role;
    }

    // Sắp xếp động & ánh xạ cột hợp lệ (Tránh lỗi SQL khi sort cột quan hệ hoặc cột ảo)
    let orderClause = [];
    const sortVal = (sort || sortOrder || "desc").toUpperCase();
    const effectiveSortOrder = sortVal === "ASC" ? "ASC" : "DESC";
    const orderByVal = order_by || sortBy || "created_at";

    if (orderByVal === "role") {
      orderClause = [[{ model: Role, as: "role" }, "slug", effectiveSortOrder]];
    } else if (orderByVal === "level_info" || orderByVal === "level") {
      orderClause = [["level", effectiveSortOrder]];
    } else {
      const allowedSortFields = ["username", "email", "status", "created_at", "updated_at", "level", "exp", "point", "membership_tier"];
      const sortField = allowedSortFields.includes(orderByVal) ? orderByVal : "created_at";
      orderClause = [[sortField, effectiveSortOrder]];
    }

    const { count, rows } = await User.findAndCountAll({
      where,
      limit: limitVal,
      offset,
      order: orderClause,
      attributes: { exclude: ["password_hash", "preferences", "privacy_settings"] },
      include: [
        {
          model: Role,
          as: "role",
          where: Object.keys(roleWhere).length ? roleWhere : undefined,
          attributes: ["id", "name", "slug"],
        },
      ],
      distinct: true,
    });

    // Thống kê counts theo trạng thái người dùng (không phụ thuộc vào status filter để các tab hiển thị đầy đủ badge)
    const baseWhere = {};
    if (searchVal) {
      baseWhere[Op.or] = [
        { username: { [Op.iLike]: `%${searchVal}%` } },
        { email: { [Op.iLike]: `%${searchVal}%` } },
        { full_name: { [Op.iLike]: `%${searchVal}%` } },
      ];
    }
    if (membership_tier) {
      baseWhere.membership_tier = membership_tier;
    }

    const statusGroup = await User.findAll({
      attributes: ["status", [sequelize.fn("COUNT", sequelize.col("User.id")), "count"]],
      where: baseWhere,
      include: Object.keys(roleWhere).length ? [
        {
          model: Role,
          as: "role",
          where: roleWhere,
          attributes: [],
        }
      ] : undefined,
      group: ["User.status"],
      raw: true,
    });

    let activeCount = 0;
    let bannedCount = 0;
    let inactiveCount = 0;
    let totalAll = 0;

    statusGroup.forEach((row) => {
      const c = parseInt(row.count, 10) || 0;
      totalAll += c;
      if (row.status === "active") activeCount += c;
      else if (row.status === "banned") bannedCount += c;
      else if (row.status === "inactive") inactiveCount += c;
    });

    const counts = {
      all: totalAll,
      active: activeCount,
      banned: bannedCount,
      inactive: inactiveCount,
    };

    // Bổ sung level_info cho mỗi item và đồng bộ thuộc tính level
    const items = rows.map((row) => {
      const plain = row.toJSON();
      plain.level_info = levelService.buildLevelInfo(plain);
      plain.level = plain.level_info.level;
      return plain;
    });

    return {
      items,
      total: count,
      page: pageVal,
      limit: limitVal,
      counts,
    };
  },

  /**
   * Lấy chi tiết một người dùng bất kỳ cho Admin.
   */
  async getUserAdmin(userId) {
    const user = await User.findByPk(userId, {
      attributes: { exclude: ["password_hash"] },
      include: [
        {
          model: Role,
          as: "role",
          attributes: ["id", "name", "slug"],
        },
      ],
    });

    if (!user) throw new AppError("Người dùng không tồn tại", 404);

    const plain = user.toJSON();
    plain.level_info = levelService.buildLevelInfo(plain);
    plain.level = plain.level_info.level;
    return plain;
  },

  /**
   * Admin tạo người dùng mới.
   * @param {Object} data - Dữ liệu user mới
   * @param {string|null} [actorRoleSlug] - Role slug của admin đang tạo
   * @param {string|null} [actorUserId] - ID người dùng đang thực hiện
   */
  async createUserAdmin(data, actorRoleSlug = null, actorUserId = null) {
    const { username, email, password, role_slug, full_name, membership_tier } = data;

    // Kiem tra ton tai
    const existingUser = await User.findOne({
      where: {
        [Op.or]: [{ username }, { email }]
      }
    });

    if (existingUser) {
      if (existingUser.username === username) throw new AppError("Username đã tồn tại", 400);
      if (existingUser.email === email) throw new AppError("Email đã tồn tại", 400);
    }

    const role = await Role.findOne({ where: { slug: role_slug } });
    if (!role) throw new AppError("Vai trò không tồn tại", 400);

    if (actorRoleSlug) {
      assertCanManageTarget({
        actorRoleSlug,
        targetCurrentRoleSlug: null,
        targetNewRoleSlug: role.slug,
        actorUserId,
      });
    }

    const initialStats = sanitizeLevelStatsInput(data);
    const targetTier = membership_tier || "free";
    const isPremium = targetTier !== "free";
    const password_hash = await argon2.hash(password);

    let newUser = null;
    await sequelize.transaction(async (t) => {
      newUser = await User.create({
        username,
        email,
        password_hash,
        role_id: role.id,
        full_name,
        status: "active",
        is_verified: true, // Admin tạo thì mặc định verified
        membership_tier: targetTier,
        is_premium: isPremium,
        ...(initialStats.level !== undefined && { level: initialStats.level }),
        ...(initialStats.exp !== undefined && { exp: initialStats.exp }),
        ...(initialStats.point !== undefined && { point: initialStats.point }),
      }, { transaction: t });

      // Tự động tạo bản ghi Subscription tương ứng
      const targetPlan = await MembershipPlan.findOne({ where: { tier: targetTier } }, { transaction: t });
      if (targetPlan) {
        const isFree = targetTier === "free";
        const now = new Date();
        const expiresAt = isFree
          ? new Date(now.getTime() + 100 * 365 * 24 * 60 * 60 * 1000)
          : new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);

        await Subscription.create({
          user_id: newUser.id,
          plan_id: targetPlan.id,
          tier: targetPlan.tier,
          billing_cycle: "monthly",
          status: "active",
          amount: isFree ? 0 : targetPlan.price_monthly,
          amount_paid: 0,
          currency: "VND",
          payment_method: isFree ? "free" : "admin_grant",
          starts_at: now,
          expires_at: expiresAt,
          auto_renew: isFree,
          metadata: {
            granted_by_admin_id: actorUserId || "admin",
            note: isFree ? "Gói miễn phí mặc định" : `Khởi tạo gói VIP ${targetPlan.name} từ Quản trị viên`,
          },
        }, { transaction: t });
      }
    });

    const userResponse = newUser.toJSON();
    delete userResponse.password_hash;
    userResponse.level_info = levelService.buildLevelInfo(userResponse);
    userResponse.level = userResponse.level_info.level;

    return userResponse;
  },

  /**
   * Cập nhật thông tin người dùng (Status, Role, Verification...).
   * @param {string} userId
   * @param {Object} data
   * @param {string|null} [actorRoleSlug] - Role slug của admin gọi API.
   * @param {string|null} [actorUserId] - ID của admin đang thực hiện thao tác.
   */
  async updateUserAdmin(userId, data, actorRoleSlug = null, actorUserId = null) {
    const user = await User.findByPk(userId, {
      include: [{ model: Role, as: "role", attributes: ["id", "name", "slug"] }],
    });
    if (!user) throw new AppError("Người dùng không tồn tại", 404);

    const updateData = {};
    const updatableFields = ["status", "is_verified", "is_premium", "membership_tier", "full_name"];

    for (const field of updatableFields) {
      if (data[field] !== undefined) {
        updateData[field] = data[field];
      }
    }

    // Tự động đồng bộ is_premium theo membership_tier nếu có truyền membership_tier
    if (updateData.membership_tier !== undefined) {
      if (updateData.membership_tier !== "free") {
        updateData.is_premium = true;
      } else if (data.is_premium === undefined) {
        updateData.is_premium = false;
      }
    }

    let roleChanged = false;
    let newRole = null;
    if (data.role_slug) {
      newRole = await Role.findOne({ where: { slug: data.role_slug } });
      if (!newRole) throw new AppError("Vai trò không tồn tại", 400);

      if (user.role_id !== newRole.id) {
        updateData.role_id = newRole.id;
        roleChanged = true;
      }
    }

    // [SECURITY] Chặn sửa/hạ/thăng cấp user ngang hoặc cao hơn actor và bảo vệ self-management.
    if (actorRoleSlug) {
      assertCanManageTarget({
        actorRoleSlug,
        targetCurrentRoleSlug: user.role?.slug,
        targetNewRoleSlug: roleChanged ? newRole.slug : (data.role_slug || null),
        actorUserId,
        targetUserId: userId,
      });
    }

    // Chặn tự khóa hoặc vô hiệu hóa tài khoản của chính mình
    if (actorUserId && String(actorUserId) === String(userId)) {
      if (updateData.status && (updateData.status === "banned" || updateData.status === "inactive")) {
        throw new AppError("Bạn không thể tự khóa hoặc vô hiệu hóa tài khoản của chính mình", 400);
      }
    }

    if (data.password) {
      updateData.password_hash = await argon2.hash(data.password);
    }

    const tierChanged = updateData.membership_tier !== undefined && updateData.membership_tier !== user.membership_tier;

    await sequelize.transaction(async (t) => {
      if (Object.keys(updateData).length > 0) {
        // Nếu đổi role, cập nhật mật khẩu hoặc khóa tài khoản, tăng token_version để hủy bỏ tokens cũ
        if (roleChanged || (updateData.status && updateData.status !== "active") || data.password) {
          updateData.token_version = (user.token_version || 1) + 1;
        }

        await User.update(updateData, { where: { id: userId }, transaction: t });
      }

      // Nếu Hạng VIP (membership_tier) thay đổi -> Đồng bộ hai chiều với bảng Subscriptions
      if (tierChanged) {
        const newTier = updateData.membership_tier;
        const now = new Date();

        // 1. Hủy bỏ tất cả gói active/grace_period hiện tại
        await Subscription.update(
          {
            status: "cancelled",
            cancelled_at: now,
            auto_renew: false,
            metadata: {
              cancelled_reason: `Admin thay đổi hạng VIP thành '${newTier}' trong Quản lý người dùng`,
            },
          },
          {
            where: {
              user_id: userId,
              status: ["active", "grace_period"],
            },
            transaction: t,
          }
        );

        // 2. Tìm plan theo tier mới
        const targetPlan = await MembershipPlan.findOne({ where: { tier: newTier } }, { transaction: t });
        if (targetPlan) {
          const isFree = newTier === "free";
          const expiresAt = isFree
            ? new Date(now.getTime() + 100 * 365 * 24 * 60 * 60 * 1000)
            : new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);

          await Subscription.create(
            {
              user_id: userId,
              plan_id: targetPlan.id,
              tier: targetPlan.tier,
              billing_cycle: "monthly",
              status: "active",
              amount: isFree ? 0 : targetPlan.price_monthly,
              amount_paid: 0,
              currency: "VND",
              payment_method: isFree ? "free" : "admin_grant",
              starts_at: now,
              expires_at: expiresAt,
              auto_renew: isFree,
              metadata: {
                granted_by_admin_id: actorUserId || "admin",
                note: isFree ? "Gói miễn phí mặc định" : `Cập nhật hạng VIP thành ${targetPlan.name} từ Quản lý người dùng`,
              },
            },
            { transaction: t }
          );

          // Tự động nâng role lên premium_user nếu user thường lên VIP
          if (!isFree && !roleChanged && user.role?.slug === ROLES.USER) {
            const premiumRole = await Role.findOne({ where: { slug: ROLES.PREMIUM_USER } }, { transaction: t });
            if (premiumRole) {
              await User.update({ role_id: premiumRole.id }, { where: { id: userId }, transaction: t });
            }
          }
        }
      }
    });

    // Xóa cache
    await Promise.all([
      cacheHelper.del(`${cacheConfig.prefix.profile}${userId}`),
      cacheHelper.del(`${cacheConfig.prefix.user}${userId}`),
      entitlementService.invalidateUserEntitlements(userId),
    ]);

    // Buộc đăng xuất ngay lập tức qua session revocation & socket event nếu bị banned hoặc inactive
    if (updateData.status && (updateData.status === "banned" || updateData.status === "inactive")) {
      await revokeAllUserSessions(userId, `admin_${updateData.status}`);
      emitToUser(userId, SOCKET_EVENTS.FORCE_LOGOUT, { reason: updateData.status });
    }

    return await this.getUserAdmin(userId);
  },

  /**
   * Cập nhật trực tiếp các chỉ số Cấp độ, EXP và Điểm (Admin)
   *
   * @description Thực hiện cập nhật thủ công, bỏ qua logic cộng dồn thông thường.
   * Sau khi cập nhật sẽ đẩy sự kiện WebSocket để giao diện người dùng cập nhật ngay lập tức.
   * Giá trị đầu vào được clamp/validate để không phá vỡ tính nhất quán với level.constant.js
   * (level ∈ [1, MAX_LEVEL], exp/point ≥ 0).
   * @param {string} userId - ID người dùng mục tiêu
   * @param {object} data - Dữ liệu chỉ số mới { level, exp, point }
   * @param {string|null} [actorRoleSlug] - Role slug của người thực hiện
   * @param {string|null} [actorUserId] - ID người dùng đang thực hiện
   * @returns {Promise<object>} - Thông tin sau khi cập nhật
   */
  async updateUserLevelStats(userId, data, actorRoleSlug = null, actorUserId = null) {
    const user = await User.findByPk(userId, {
      include: [{ model: Role, as: "role", attributes: ["id", "name", "slug"] }],
    });
    if (!user) throw new AppError("Người dùng không tồn tại", 404);

    if (actorRoleSlug) {
      assertCanManageTarget({
        actorRoleSlug,
        targetCurrentRoleSlug: user.role?.slug,
        targetNewRoleSlug: null,
        actorUserId,
        targetUserId: userId,
      });
    }

    const updateData = sanitizeLevelStatsInput(data);

    if (Object.keys(updateData).length === 0) {
      return await this.getUserAdmin(userId);
    }

    await User.update(updateData, { where: { id: userId } });

    await Promise.all([
      cacheHelper.del(`${cacheConfig.prefix.profile}${userId}`),
      cacheHelper.del(`${cacheConfig.prefix.user}${userId}`),
    ]);

    emitToUser(userId, SOCKET_EVENTS.USER_LEVEL_UPDATED, {
      level: updateData.level,
      exp: updateData.exp,
      point: updateData.point,
      updated_by: "admin",
    });

    logger.info(
      `[AdminUser] PATCH level userId=${userId} level=${updateData.level ?? "-"} exp=${updateData.exp ?? "-"} point=${updateData.point ?? "-"}`
    );

    return await this.getUserAdmin(userId);
  },

  /**
   * Xóa người dùng (Soft delete).
   * @param {string} userId
   * @param {string|null} [actorRoleSlug] - Role slug của admin gọi API.
   * @param {string|null} [actorUserId] - ID người dùng đang thực hiện
   */
  async deleteUserAdmin(userId, actorRoleSlug = null, actorUserId = null) {
    const user = await User.findByPk(userId, {
      include: [{ model: Role, as: "role", attributes: ["id", "name", "slug"] }],
    });
    if (!user) throw new AppError("Người dùng không tồn tại", 404);

    if (user.status === "inactive") {
      throw new AppError("Tài khoản đã bị xóa", 400);
    }

    if (actorRoleSlug) {
      assertCanManageTarget({
        actorRoleSlug,
        targetCurrentRoleSlug: user.role?.slug,
        targetNewRoleSlug: null,
        actorUserId,
        targetUserId: userId,
        isDelete: true,
      });
    }

    const shortId = user.id.split('-')[0];
    const originalPii = {
      email: user.email,
      username: user.username,
      phone_number: user.phone_number,
      full_name: user.full_name,
    };

    await User.update({
      status: "inactive",
      email: `deleted_${uuidv4()}@anon.local`,
      username: `deleted_${shortId}`,
      phone_number: null,
      full_name: "Deleted User (Admin)",
      metadata: { ...user.metadata, original_pii: originalPii, deleted_at: new Date(), deleted_by: "admin" },
      token_version: (user.token_version || 1) + 1,
    }, { where: { id: userId } });

    await Promise.all([
      cacheHelper.del(`${cacheConfig.prefix.profile}${userId}`),
      cacheHelper.del(`${cacheConfig.prefix.user}${userId}`),
    ]);

    await revokeAllUserSessions(userId, "admin_delete");
    emitToUser(userId, SOCKET_EVENTS.FORCE_LOGOUT, { reason: "account_deleted" });

    return { success: true };
  },

  /**
   * Khôi phục người dùng đã xóa.
   */
  async restoreUserAdmin(userId) {
    const user = await User.findByPk(userId);
    if (!user) throw new AppError("Người dùng không tồn tại", 404);

    if (user.status !== "inactive") {
      throw new AppError("Tài khoản chưa bị xóa", 400);
    }

    const metadata = user.metadata || {};
    const originalPii = metadata.original_pii;

    if (originalPii) {
      const orClauses = [{ username: originalPii.username }, { email: originalPii.email }];
      if (originalPii.phone_number) {
        orClauses.push({ phone_number: originalPii.phone_number });
      }

      const existingUser = await User.findOne({
        where: {
          [Op.or]: orClauses,
          id: { [Op.ne]: userId } // Bỏ qua user hiện tại
        }
      });

      if (existingUser) {
        throw new AppError("Không thể khôi phục do Username, Email hoặc SĐT gốc đã được đăng ký bởi người khác", 400);
      }

      delete metadata.original_pii;
      delete metadata.deleted_at;
      delete metadata.deleted_by;

      await User.update({
        status: "active",
        email: originalPii.email,
        username: originalPii.username,
        phone_number: originalPii.phone_number,
        full_name: originalPii.full_name,
        metadata: metadata,
        token_version: (user.token_version || 1) + 1, // Vẫn force logout cho an toàn sau khi restore
      }, { where: { id: userId } });
    } else {
      // User bị set inactive thông thường, PII chưa bị thay đổi
      await User.update({
        status: "active",
        token_version: (user.token_version || 1) + 1,
      }, { where: { id: userId } });
    }

    await Promise.all([
      cacheHelper.del(`${cacheConfig.prefix.profile}${userId}`),
      cacheHelper.del(`${cacheConfig.prefix.user}${userId}`),
    ]);

    return await this.getUserAdmin(userId);
  },

  /**
   * Alias: Lấy danh sách admin và moderator.
   */
  async getAdminUsers(query) {
    return this.getUsersAdmin({
      ...query,
      role: [ROLES.BOSS, ROLES.ADMIN, ROLES.MODERATOR],
    });
  },

  // ── Session Management ─────────────────────────────────────────

  /**
   * Liệt kê các phiên đăng nhập (session) đang hoạt động của 1 user, phục vụ điều tra
   * bảo mật (thiết bị lạ, IP bất thường, risk_score cao...).
   */
  async getUserSessionsAdmin(userId) {
    const user = await User.findByPk(userId, { attributes: ["id"] });
    if (!user) throw new AppError("Người dùng không tồn tại", 404);

    const sessions = await UserSession.findAll({
      where: { user_id: userId, is_revoked: false },
      order: [["last_used_at", "DESC"]],
      attributes: [
        "id", "ip_address", "user_agent", "device_info",
        "risk_score", "anomaly_flags", "expires_at", "last_used_at", "created_at",
      ],
    });

    return sessions;
  },

  /**
   * Thu hồi 1 session cụ thể của user (khác với revokeAllUserSessions dùng khi ban toàn bộ).
   * Hữu ích khi admin phát hiện 1 thiết bị/IP đáng ngờ nhưng không muốn đăng xuất user khỏi
   * mọi thiết bị.
   */
  async revokeUserSessionAdmin(userId, sessionId) {
    const session = await UserSession.findOne({ where: { id: sessionId, user_id: userId } });
    if (!session) throw new AppError("Phiên đăng nhập không tồn tại", 404);

    if (session.is_revoked) {
      throw new AppError("Phiên đăng nhập đã bị thu hồi trước đó", 400);
    }

    await session.update({
      is_revoked: true,
      revoked_reason: "admin_revoked",
      revoked_at: new Date(),
    });

    emitToUser(userId, SOCKET_EVENTS.FORCE_LOGOUT, { reason: "session_revoked", session_id: sessionId });

    return { success: true };
  },

  // ── Wallet Oversight ───────────────────────────────────────────

  /**
   * Xem tổng quan ví của 1 user (số dư, tổng nạp/chi/nhận, trạng thái khoá).
   */
  async getUserWalletAdmin(userId) {
    let wallet = await Wallet.findOne({ where: { user_id: userId } });
    if (!wallet) {
      // Tự động khởi tạo ví cho người dùng cũ chưa có ví
      wallet = await Wallet.create({
        user_id: userId,
        balance: 0,
        is_locked: false,
      });
    }
    return wallet.toJSON();
  },

  /**
   * Khoá ví của user độc lập với việc khoá cả tài khoản — dùng khi nghi ngờ gian lận
   * thanh toán/nạp tiền nhưng chưa đủ căn cứ để ban toàn bộ tài khoản.
   */
  async lockUserWalletAdmin(userId, reason, actorAdminId) {
    let wallet = await Wallet.findOne({ where: { user_id: userId } });
    if (!wallet) {
      wallet = await Wallet.create({
        user_id: userId,
        balance: 0,
        is_locked: false,
      });
    }

    if (wallet.is_locked) {
      throw new AppError("Ví đã bị khoá trước đó", 400);
    }

    await wallet.update({
      is_locked: true,
      locked_reason: reason || "Khoá bởi quản trị viên",
      locked_at: new Date(),
      locked_by: actorAdminId || null,
    });

    return wallet.toJSON();
  },

  async unlockUserWalletAdmin(userId) {
    let wallet = await Wallet.findOne({ where: { user_id: userId } });
    if (!wallet) {
      wallet = await Wallet.create({
        user_id: userId,
        balance: 0,
        is_locked: false,
      });
    }

    if (!wallet.is_locked) {
      throw new AppError("Ví hiện không bị khoá", 400);
    }

    await wallet.update({
      is_locked: false,
      locked_reason: null,
      locked_at: null,
      locked_by: null,
    });

    return wallet.toJSON();
  },

  // ── Subscription History ───────────────────────────────────────

  /**
   * Lấy lịch sử các gói hội viên user đã từng đăng ký (phục vụ hỗ trợ/khiếu nại/hoàn tiền).
   */
  async getUserSubscriptionsAdmin(userId, { page = 1, limit = 20 } = {}) {
    const offset = (page - 1) * limit;

    const { count, rows } = await Subscription.findAndCountAll({
      where: { user_id: userId },
      limit,
      offset,
      order: [["created_at", "DESC"]],
    });

    return { items: rows, total: count, page, limit };
  },

  // ── Bulk Actions ───────────────────────────────────────────────

  /**
   * Cập nhật trạng thái (ban/khoá/khôi phục) cho nhiều user cùng lúc, trong 1 transaction.
   * Mỗi user vẫn được check hierarchy riêng lẻ — nếu 1 user trong danh sách vượt quyền của
   * actor, TOÀN BỘ batch sẽ rollback (an toàn hơn là âm thầm bỏ qua user đó).
   *
   * @param {string[]} userIds
   * @param {'active'|'inactive'|'banned'} status
   * @param {string} actorRoleSlug - Role slug của admin gọi API — bắt buộc.
   * @param {string|null} [actorUserId] - ID người dùng đang thực hiện
   */
  async bulkUpdateStatusAdmin(userIds, status, actorRoleSlug, actorUserId = null) {
    if (!Array.isArray(userIds) || userIds.length === 0) {
      throw new AppError("Danh sách người dùng không hợp lệ", 400);
    }
    if (!["active", "inactive", "banned"].includes(status)) {
      throw new AppError("Trạng thái không hợp lệ", 400);
    }
    if (!actorRoleSlug) {
      throw new AppError("Không xác định được vai trò người thực hiện", 403);
    }

    // Chặn tự khóa hoặc vô hiệu hóa chính mình qua bulk action
    if (actorUserId && (status === "banned" || status === "inactive")) {
      if (userIds.map(String).includes(String(actorUserId))) {
        throw new AppError("Không thể tự khóa hoặc vô hiệu hóa tài khoản của chính mình trong thao tác hàng loạt", 400);
      }
    }

    const users = await User.findAll({
      where: { id: { [Op.in]: userIds } },
      include: [{ model: Role, as: "role", attributes: ["id", "name", "slug"] }],
    });

    if (users.length !== userIds.length) {
      throw new AppError("Một số người dùng trong danh sách không tồn tại", 404);
    }

    // Check hierarchy cho từng user trước khi ghi bất cứ thứ gì (fail-fast).
    for (const u of users) {
      assertCanManageTarget({
        actorRoleSlug,
        targetCurrentRoleSlug: u.role?.slug,
        targetNewRoleSlug: null,
        actorUserId,
        targetUserId: u.id,
      });
    }

    const results = await sequelize.transaction(async (t) => {
      for (const u of users) {
        await u.update(
          { status, token_version: (u.token_version || 1) + 1 },
          { transaction: t }
        );
      }
      return users.map((u) => u.id);
    });

    // Side-effects sau khi transaction commit thành công.
    await Promise.all(
      results.flatMap((id) => [
        cacheHelper.del(`${cacheConfig.prefix.profile}${id}`),
        cacheHelper.del(`${cacheConfig.prefix.user}${id}`),
      ])
    );

    if (status === "banned" || status === "inactive") {
      await Promise.all(
        results.map(async (id) => {
          await revokeAllUserSessions(id, `admin_bulk_${status}`);
          emitToUser(id, SOCKET_EVENTS.FORCE_LOGOUT, { reason: status });
        })
      );
    }

    logger.info(`[AdminUser] Bulk status update: ${results.length} users → ${status}`);

    return { success: true, affected: results.length, userIds: results };
  },
};