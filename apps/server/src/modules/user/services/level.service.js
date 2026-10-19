/**
 * @file level.service.js
 * @module Modules_User_Services
 * @description Xử lý nghiệp vụ quản lý cấp độ và kinh nghiệm người dùng.
 */

import { User, sequelize } from "../../../models/index.js";
import {
  EXP_REWARDS,
  getLevelFromExp,
  getLevelProgress,
  MAX_LEVEL,
  getRankByLevel,
  getNextRank,
} from "../../../constants/level.constant.js";
import { logger } from "../../../utils/logger.js";

export const levelService = {
  /**
   * Lấy thông tin chi tiết về cấp độ của người dùng
   *
   * @param {string} userId - ID người dùng
   * @returns {Promise<object>} - Thông tin { level, exp, point, progress... }
   */
  async getUserLevelInfo(userId) {
    const user = await User.findByPk(userId, {
      attributes: ["id", "level", "exp", "point"],
    });

    if (!user) return null;

    return this.buildLevelInfo(user);
  },

  /**
   * Xây dựng thông tin cấp độ từ dữ liệu người dùng có sẵn (không truy vấn DB)
   *
   * @param {object} user - Đối tượng người dùng chứa level, exp, point
   * @returns {object} - Thông tin cấp độ đã xử lý progress
   */
  buildLevelInfo(user) {
    const rawExp = typeof user.exp === "number" ? user.exp : Number(user.exp || 0);
    const safeExp = Math.max(0, isNaN(rawExp) ? 0 : rawExp);
    const progressInfo = getLevelProgress(safeExp);

    // Tính level thực tế dựa trên EXP; không hạ level nếu user.level được gán thủ công cao hơn
    const calculatedLevel = progressInfo.level;
    const rawLevel = user.level !== undefined ? Number(user.level) : calculatedLevel;
    const safeUserLevel = isNaN(rawLevel) ? calculatedLevel : rawLevel;
    const displayLevel = Math.max(safeUserLevel, calculatedLevel);

    let finalRank = progressInfo.rank;
    let finalNextRank = progressInfo.nextRank;

    if (displayLevel !== progressInfo.level) {
      finalRank = getRankByLevel(displayLevel);
      finalNextRank = getNextRank(displayLevel);
    }

    return {
      ...progressInfo,
      level: displayLevel,
      exp: safeExp,
      point: Number(user.point || 0),
      rank: finalRank,
      nextRank: finalNextRank,
    };
  },

  /**
   * Cộng EXP và Điểm thưởng cho người dùng
   *
   * @description [MÔ HÌNH FIRE-AND-FORGET] Phương thức này tự bắt mọi lỗi và log lại,
   * không quăng lỗi ra ngoài để tránh làm gián đoạn luồng xử lý chính (như xem phim).
   * Hỗ trợ Transaction để đảm bảo tính toàn vẹn dữ liệu khi gộp chung với các thao tác khác.
   * @param {string} userId - ID người dùng
   * @param {string} action - Loại hành động (Key trong EXP_REWARDS)
   * @param {object} [externalTransaction] - Transaction bên ngoài (nếu có)
   * @returns {Promise<object|null>} - Kết quả thưởng hoặc null nếu lỗi
   */
  async awardExp(userId, action, externalTransaction = null) {
    try {
      const reward = EXP_REWARDS[action];
      if (!reward) {
        logger.warn(`[LevelService] Unknown action: ${action}`);
        return null;
      }

      // Use external transaction or create our own
      const shouldManageTransaction = !externalTransaction;
      const transaction = externalTransaction || (await sequelize.transaction());

      try {
        // Atomically increment exp and point
        await User.increment(
          { exp: reward.exp, point: reward.point },
          { where: { id: userId }, transaction },
        );

        // Fetch updated user to recalculate level
        const user = await User.findByPk(userId, {
          attributes: ["id", "level", "exp", "point"],
          transaction,
        });

        if (!user) {
          if (shouldManageTransaction) await transaction.rollback();
          return null;
        }

        const newLevel = getLevelFromExp(user.exp);
        const leveledUp = newLevel > user.level;

        // Update level if changed
        if (leveledUp && newLevel <= MAX_LEVEL) {
          await user.update({ level: newLevel }, { transaction });
        }

        if (shouldManageTransaction) await transaction.commit();

        if (leveledUp) {
          logger.info(
            `[LevelService] 🎉 User ${userId} leveled up: ${user.level} → ${newLevel} (+${reward.exp} EXP from ${action})`,
          );
        } else {
          logger.debug(
            `[LevelService] User ${userId} gained +${reward.exp} EXP from ${action} (total: ${user.exp})`,
          );
        }

        return {
          exp_gained: reward.exp,
          point_gained: reward.point,
          total_exp: user.exp,
          total_point: user.point,
          old_level: user.level,
          new_level: newLevel,
          leveled_up: leveledUp,
          action,
        };
      } catch (innerError) {
        if (shouldManageTransaction && !transaction.finished) {
          await transaction.rollback();
        }
        throw innerError;
      }
    } catch (error) {
      // Fire-and-forget: log but never propagate
      logger.error(
        `[LevelService] awardExp failed for user=${userId}, action=${action}: ${error.message}`,
      );
      return null;
    }
  },
};
