/**
 * @file watchlist.service.js
 * @module Service_Watchlist
 * @description Lớp dịch vụ quản lý danh sách anime cá nhân.
 */

import { Watchlist, Movie, Genre, Category } from "../../../models/index.js";
import { logger } from "../../../utils/logger.js";

const createWatchlistError = (message, statusCode, errorCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.errorCode = errorCode;
  error.isOperational = true;
  return error;
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

export const watchlistService = {
  async upsert(userId, data) {
    try {
      const movie = await Movie.findByPk(data.movie_id);
      if (!movie) {
        throw createWatchlistError("Anime không tồn tại", 404, "WATCHLIST_MOVIE_NOT_FOUND");
      }

      const [item, created] = await Watchlist.findOrCreate({
        where: { user_id: userId, movie_id: data.movie_id },
        defaults: {
          user_id: userId,
          movie_id: data.movie_id,
          status: data.status || "planned",
          is_public: data.is_public || false,
          note: data.note || null,
        },
      });

      if (!created) {
        await item.update({
          status: data.status || item.status,
          is_public: data.is_public !== undefined ? data.is_public : item.is_public,
          note: data.note !== undefined ? data.note : item.note,
        });
      }

      return Watchlist.findByPk(item.id, {
        include: [{ model: Movie, as: "movie", include: movieInclude }],
      });
    } catch (error) {
      if (error.isOperational) throw error;
      logger.error("[Watchlist] Upsert error:", error);
      throw createWatchlistError("Lỗi lưu danh sách anime", 500, "WATCHLIST_SAVE_ERR");
    }
  },

  async listMine(userId, options = {}) {
    try {
      const where = { user_id: userId };
      if (options.status) where.status = options.status;

      return Watchlist.findAll({
        where,
        include: [{ model: Movie, as: "movie", include: movieInclude }],
        order: [["updated_at", "DESC"]],
      });
    } catch (error) {
      logger.error("[Watchlist] List mine error:", error);
      throw createWatchlistError("Lỗi lấy watchlist", 500, "WATCHLIST_LIST_ERR");
    }
  },

  async remove(userId, movieId) {
    const deleted = await Watchlist.destroy({ where: { user_id: userId, movie_id: movieId } });
    return deleted > 0;
  },
};

export default watchlistService;
