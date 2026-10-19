/**
 * @file admin-session.service.js
 * @module Modules_Security_Services
 * @description Dịch vụ quản trị phiên đăng nhập toàn hệ thống, giám sát rủi ro, phân tích bất thường và thu hồi phiên với phân cấp vai trò.
 */

import { Op } from "sequelize";
import {
  UserSession,
  User,
  Role,
  AuditLog,
  sequelize,
} from "../../../models/index.js";
import { AppError } from "../../../utils/app-error.js";
import { logger } from "../../../utils/logger.js";
import { emitToUser } from "../../../sockets/services/emit.service.js";
import { SOCKET_EVENTS } from "../../../sockets/constants/socket-events.constants.js";
import { ROLES, ROLE_HIERARCHY } from "../../../constants/roles.constant.js";

/**
 * Lấy mức độ ưu tiên của vai trò
 * @param {string} roleSlug
 * @returns {number}
 */
const priorityOf = (roleSlug) => ROLE_HIERARCHY[roleSlug] || 0;

/**
 * Kiểm tra phân cấp quyền khi thu hồi phiên
 * @param {string} actorRoleSlug
 * @param {string} actorUserId
 * @param {string} targetRoleSlug
 * @param {string} targetUserId
 */
const assertCanRevokeSession = (
  actorRoleSlug,
  actorUserId,
  targetRoleSlug,
  targetUserId
) => {
  const actorPriority = priorityOf(actorRoleSlug);
  if (!actorRoleSlug || actorPriority === 0) {
    throw new AppError("Không xác định được vai trò người thực hiện", 403);
  }

  // 1. Boss có quyền tối cao thu hồi bất kỳ phiên nào
  if (actorRoleSlug === ROLES.BOSS) {
    return;
  }

  // 2. Cho phép tự thu hồi phiên của chính mình (đăng xuất thiết bị cá nhân)
  const isSelf =
    Boolean(actorUserId && targetUserId && String(actorUserId) === String(targetUserId));
  if (isSelf) {
    return;
  }

  // 3. Với tài khoản người khác, chỉ được thu hồi nếu vai trò mục tiêu thấp hơn
  const targetPriority = priorityOf(targetRoleSlug);
  if (actorPriority <= targetPriority) {
    throw new AppError(
      "Bạn không có quyền thu hồi phiên của tài khoản có vai trò ngang hoặc cao hơn mình",
      403
    );
  }
};

export const adminSessionService = {
  /**
   * Lấy danh sách phiên đăng nhập kèm phân trang và bộ lọc chuyên sâu
   * @param {Object} query - Tham số tìm kiếm & phân trang
   * @returns {Promise<{ sessions: Array, pagination: Object }>}
   */
  async getSessionsAdmin(query = {}) {
    const {
      page = 1,
      limit = 10,
      search = "",
      role = "all",
      min_risk_score = null,
      anomaly = "",
      status = "active",
      sort_by = "last_used_at",
      sort_order = "DESC",
    } = query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
    const offset = (pageNum - 1) * limitNum;

    const andConditions = [];
    const now = new Date();

    // 1. Lọc trạng thái (Active / Revoked / All)
    if (status === "active") {
      andConditions.push({
        is_revoked: false,
        expires_at: { [Op.gt]: now },
      });
    } else if (status === "revoked") {
      andConditions.push({
        [Op.or]: [
          { is_revoked: true },
          { expires_at: { [Op.lte]: now } },
        ],
      });
    }

    // 2. Lọc điểm rủi ro tối thiểu
    if (
      min_risk_score !== null &&
      min_risk_score !== undefined &&
      min_risk_score !== ""
    ) {
      andConditions.push({
        risk_score: { [Op.gte]: Number(min_risk_score) },
      });
    }

    // 3. Lọc cờ bất thường (Anomaly Flags trong JSONB)
    if (anomaly && anomaly.trim() !== "") {
      const sanitizedAnomaly = anomaly.trim().replace(/'/g, "''");
      andConditions.push(
        sequelize.literal(
          `"UserSession"."anomaly_flags"::jsonb @> '["${sanitizedAnomaly}"]'`
        )
      );
    }

    const searchVal = (query.search || query.q || "").trim();
    const rawSortBy = query.order_by || query.sortBy || query.sort_by || "last_used_at";
    const rawSortOrder = (query.sort || query.sortOrder || query.sort_order || "DESC").toUpperCase();
    const effectiveSortOrder = rawSortOrder === "ASC" ? "ASC" : "DESC";

    // 4. Tìm kiếm IP, User-agent, hoặc thông tin User
    if (searchVal) {
      const searchPattern = `%${searchVal}%`;
      andConditions.push({
        [Op.or]: [
          { ip_address: { [Op.iLike]: searchPattern } },
          { user_agent: { [Op.iLike]: searchPattern } },
          { "$user.username$": { [Op.iLike]: searchPattern } },
          { "$user.email$": { [Op.iLike]: searchPattern } },
          { "$user.full_name$": { [Op.iLike]: searchPattern } },
        ],
      });
    }

    const where = andConditions.length > 0 ? { [Op.and]: andConditions } : {};

    // 5. Cấu hình Include User & Role
    const roleInclude = {
      model: Role,
      as: "role",
      attributes: ["id", "name", "slug"],
    };
    if (role && role !== "all") {
      roleInclude.where = { slug: role };
    }

    const userInclude = {
      model: User,
      as: "user",
      attributes: ["id", "username", "email", "full_name", "avatar_url", "status"],
      include: [roleInclude],
      required: role !== "all" || Boolean(searchVal) || rawSortBy === "user" || rawSortBy === "username",
    };

    // Sắp xếp động & ánh xạ cột hợp lệ (Bảo vệ an toàn SQL)
    let orderClause = [];
    if (rawSortBy === "user" || rawSortBy === "username") {
      orderClause = [[{ model: User, as: "user" }, "username", effectiveSortOrder]];
    } else {
      const allowedSortFields = ["last_used_at", "created_at", "risk_score", "expires_at", "ip_address"];
      const sortField = allowedSortFields.includes(rawSortBy) ? rawSortBy : "last_used_at";
      orderClause = [[sortField, effectiveSortOrder]];
    }

    const { count, rows } = await UserSession.findAndCountAll({
      where,
      include: [userInclude],
      order: orderClause,
      limit: limitNum,
      offset,
      distinct: true,
    });

    const sessions = rows.map((session) => {
      const plain = session.toJSON();
      const isExpired = new Date(plain.expires_at) <= now;
      const effectiveStatus = plain.is_revoked
        ? "revoked"
        : isExpired
        ? "expired"
        : "active";

      return {
        ...plain,
        status: effectiveStatus,
        is_active: effectiveStatus === "active",
      };
    });

    return {
      sessions,
      pagination: {
        total: count,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(count / limitNum) || 1,
      },
    };
  },

  /**
   * Lấy số liệu thống kê tổng hợp phục vụ KPI Bar
   * @returns {Promise<Object>}
   */
  async getSessionStatsAdmin() {
    const now = new Date();
    const past24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [
      totalActive,
      highRisk,
      revokedCount,
      failedLogins24h,
      securityThreats24h,
    ] = await Promise.all([
      // 1. Tổng phiên đang hoạt động
      UserSession.count({
        where: {
          is_revoked: false,
          expires_at: { [Op.gt]: now },
        },
      }),

      // 2. Phiên có điểm rủi ro cao (>= 50)
      UserSession.count({
        where: {
          is_revoked: false,
          expires_at: { [Op.gt]: now },
          risk_score: { [Op.gte]: 50 },
        },
      }),

      // 3. Tổng phiên đã bị thu hồi
      UserSession.count({
        where: {
          is_revoked: true,
        },
      }),

      // 4. Số lần đăng nhập thất bại trong 24h qua
      AuditLog.count({
        where: {
          event_type: "auth.login.failed",
          created_at: { [Op.gte]: past24h },
        },
      }),

      // 5. Số sự kiện bảo mật mức độ cảnh báo/lỗi/nguy cấp trong 24h qua
      AuditLog.count({
        where: {
          severity: { [Op.in]: ["warn", "error", "critical"] },
          created_at: { [Op.gte]: past24h },
        },
      }),
    ]);

    return {
      total_active: totalActive,
      high_risk: highRisk,
      total_revoked: revokedCount,
      failed_logins_24h: failedLogins24h,
      security_threats_24h: securityThreats24h,
    };
  },

  /**
   * Thu hồi một phiên đăng nhập cụ thể với kiểm soát phân cấp vai trò
   * @param {string} sessionId - ID phiên cần thu hồi
   * @param {string} actorRoleSlug - Role của admin thực hiện
   * @param {string} actorUserId - ID của admin thực hiện
   * @returns {Promise<Object>}
   */
  async revokeSessionAdmin(sessionId, actorRoleSlug, actorUserId) {
    const session = await UserSession.findByPk(sessionId, {
      include: [
        {
          model: User,
          as: "user",
          attributes: ["id", "username", "email"],
          include: [{ model: Role, as: "role", attributes: ["id", "slug", "name"] }],
        },
      ],
    });

    if (!session) {
      throw new AppError("Phiên đăng nhập không tồn tại", 404);
    }

    if (session.is_revoked) {
      throw new AppError("Phiên đăng nhập này đã bị thu hồi trước đó", 400);
    }

    // Kiểm tra phân cấp vai trò
    assertCanRevokeSession(
      actorRoleSlug,
      actorUserId,
      session.user?.role?.slug,
      session.user_id
    );

    // Cập nhật trạng thái thu hồi
    await session.update({
      is_revoked: true,
      revoked_reason: "admin_revoked",
      revoked_at: new Date(),
    });

    // Phát sự kiện WebSocket cưỡng chế đăng xuất thiết bị của người dùng
    emitToUser(session.user_id, SOCKET_EVENTS.FORCE_LOGOUT, {
      reason: "session_revoked",
      session_id: sessionId,
      message: "Phiên đăng nhập trên thiết bị này đã bị quản trị viên thu hồi",
    });

    // Ghi nhận nhật ký kiểm toán (Audit Log)
    try {
      await AuditLog.logEvent({
        eventType: "session.revoked",
        eventCategory: "session",
        severity: "warn",
        userId: actorUserId,
        metadata: {
          revoked_session_id: sessionId,
          target_user_id: session.user_id,
          target_username: session.user?.username,
          ip_address: session.ip_address,
          device_info: session.device_info,
          risk_score: session.risk_score,
        },
        description: `Quản trị viên đã thu hồi phiên ${sessionId} của tài khoản ${session.user?.username || session.user_id}`,
        status: "success",
      });
    } catch (auditErr) {
      logger.error(`[AdminSecurity][Session] Ghi AuditLog thất bại: ${auditErr.message}`);
    }

    logger.info(
      `[AdminSecurity][Session] Thu hồi phiên sessionId=${sessionId} userId=${session.user_id} bởi actorId=${actorUserId}`
    );

    return {
      success: true,
      message: "Thu hồi phiên đăng nhập thành công",
    };
  },

  /**
   * Cưỡng chế thu hồi toàn bộ các phiên của một người dùng
   * @param {string} userId - ID người dùng cần đăng xuất khỏi mọi thiết bị
   * @param {string} reason - Lý do cưỡng chế thu hồi
   * @param {string} actorRoleSlug - Role của admin thực hiện
   * @param {string} actorUserId - ID của admin thực hiện
   * @returns {Promise<Object>}
   */
  async revokeAllUserSessionsAdmin(userId, reason, actorRoleSlug, actorUserId) {
    const user = await User.findByPk(userId, {
      include: [{ model: Role, as: "role", attributes: ["id", "slug", "name"] }],
    });

    if (!user) {
      throw new AppError("Người dùng không tồn tại", 404);
    }

    // Kiểm tra phân cấp vai trò
    assertCanRevokeSession(
      actorRoleSlug,
      actorUserId,
      user.role?.slug,
      userId
    );

    const revokedReason = reason?.trim() || "admin_force_logout";
    const now = new Date();

    // Thu hồi toàn bộ phiên đang hoạt động của người dùng
    const [revokedCount] = await UserSession.update(
      {
        is_revoked: true,
        revoked_reason: revokedReason,
        revoked_at: now,
      },
      {
        where: {
          user_id: userId,
          is_revoked: false,
        },
      }
    );

    // Tăng token_version của User để vô hiệu hóa ngay Access Token hiện hành
    await user.update({
      token_version: (user.token_version || 1) + 1,
    });

    // Phát sự kiện WebSocket đăng xuất toàn bộ thiết bị
    emitToUser(userId, SOCKET_EVENTS.FORCE_LOGOUT, {
      reason: "all_sessions_revoked",
      custom_reason: revokedReason,
      message: `Quản trị viên đã đăng xuất tài khoản khỏi tất cả thiết bị. Lý do: ${revokedReason}`,
    });

    // Ghi nhận nhật ký kiểm toán (Audit Log)
    try {
      await AuditLog.logEvent({
        eventType: "session.revoke_all",
        eventCategory: "session",
        severity: "warn",
        userId: actorUserId,
        metadata: {
          target_user_id: userId,
          target_username: user.username,
          revoked_count: revokedCount,
          reason: revokedReason,
        },
        description: `Quản trị viên đã đăng xuất tất cả ${revokedCount} phiên của tài khoản ${user.username}. Lý do: ${revokedReason}`,
        status: "success",
      });
    } catch (auditErr) {
      logger.error(`[AdminSecurity][Session] Ghi AuditLog thất bại: ${auditErr.message}`);
    }

    logger.info(
      `[AdminSecurity][Session] Đã thu hồi toàn bộ ${revokedCount} phiên của userId=${userId} bởi actorId=${actorUserId}`
    );

    return {
      success: true,
      message: `Đã thu hồi thành công ${revokedCount} phiên đăng nhập của người dùng`,
      revoked_count: revokedCount,
    };
  },
};
