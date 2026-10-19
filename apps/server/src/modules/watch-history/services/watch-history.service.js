/**
 * @file watch-history.service.js
 * @module Service_WatchHistory
 * @description Lớp dịch vụ lưu và truy xuất tiến độ xem của người dùng.
 */

import { Op } from "sequelize";

import { sequelize, WatchHistory, Movie, Episode, Genre, Category, User } from "../../../models/index.js";
import { logger } from "../../../utils/logger.js";

const createWatchHistoryError = (message, statusCode, errorCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.errorCode = errorCode;
  error.isOperational = true;
  return error;
};

const calculateProgress = (positionSeconds, durationSeconds) => {
  if (!durationSeconds || durationSeconds <= 0) return 0;
  return Math.min(100, Math.max(0, (positionSeconds / durationSeconds) * 100));
};

const movieInclude = [
  {
    model: Genre,
    as: "genres",
    attributes: ["id", "name", "slug"],
    through: { attributes: [] },
    required: false,
  },
  { model: Category, as: "category", attributes: ["id", "name", "slug"], required: false },
];

export const watchHistoryService = {
  async saveProgress(userId, data) {
    const transaction = await sequelize.transaction();

    try {
      const episode = await Episode.findByPk(data.episode_id, {
        include: [{ model: Movie, as: "movie" }],
        transaction,
      });

      if (!episode || !episode.movie) {
        throw createWatchHistoryError("Tập phim không tồn tại", 404, "WATCH_HISTORY_EPISODE_NOT_FOUND");
      }

      const durationSeconds = data.duration_seconds || episode.duration || 0;
      const positionSeconds = Math.min(Math.max(data.position_seconds || 0, 0), durationSeconds || Number.MAX_SAFE_INTEGER);
      const progressPercent = calculateProgress(positionSeconds, durationSeconds);
      const isCompleted = Boolean(data.is_completed) || progressPercent >= 90;
      const now = new Date();

      const [history, created] = await WatchHistory.findOrCreate({
        where: {
          user_id: userId,
          episode_id: episode.id,
        },
        defaults: {
          user_id: userId,
          movie_id: episode.movie_id,
          episode_id: episode.id,
          position_seconds: positionSeconds,
          duration_seconds: durationSeconds,
          progress_percent: progressPercent,
          completed_at: isCompleted ? now : null,
          last_watched_at: now,
          metadata: data.metadata || {},
        },
        transaction,
      });

      if (!created) {
        const wasCompleted = Boolean(history.completed_at);
        await history.update(
          {
            movie_id: episode.movie_id,
            position_seconds: positionSeconds,
            duration_seconds: durationSeconds,
            progress_percent: progressPercent,
            completed_at: history.completed_at || (isCompleted ? now : null),
            last_watched_at: now,
            metadata: data.metadata || history.metadata || {},
          },
          { transaction },
        );

        if (isCompleted && !wasCompleted) {
          await User.increment("movies_watched", { by: 1, where: { id: userId }, transaction });
        }
      }

      if (created) {
        await Episode.increment("view_count", { by: 1, where: { id: episode.id }, transaction });
        await Movie.increment("total_views", { by: 1, where: { id: episode.movie_id }, transaction });
      }

      if (created && isCompleted) {
        await User.increment("movies_watched", { by: 1, where: { id: userId }, transaction });
      }

      await transaction.commit();
      return WatchHistory.findByPk(history.id, {
        include: [
          {
            model: Movie,
            as: "movie",
            include: movieInclude,
          },
          { model: Episode, as: "episode" },
        ],
      });
    } catch (error) {
      await transaction.rollback();
      if (error.isOperational) throw error;
      logger.error("[WatchHistory] Save progress error:", error);
      throw createWatchHistoryError("Lỗi lưu tiến độ xem", 500, "WATCH_HISTORY_SAVE_ERR");
    }
  },

  async getContinueWatching(userId, options = {}) {
    try {
      const { limit = 12 } = options;

      const histories = await WatchHistory.findAll({
        where: {
          user_id: userId,
          [Op.or]: [
            { completed_at: null },
            { progress_percent: { [Op.lt]: 95 } },
          ],
        },
        include: [
          {
            model: Movie,
            as: "movie",
            where: { is_published: true },
            include: movieInclude,
          },
          {
            model: Episode,
            as: "episode",
            where: { publish_state: "published" },
          },
        ],
        order: [["last_watched_at", "DESC"]],
        limit,
      });

      return histories;
    } catch (error) {
      logger.error("[WatchHistory] Continue watching error:", error);
      throw createWatchHistoryError("Lỗi lấy danh sách xem tiếp", 500, "WATCH_HISTORY_CONTINUE_ERR");
    }
  },
};

export default watchHistoryService;
