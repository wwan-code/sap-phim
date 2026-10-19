/**
 * @file engagement.service.js
 * @module Service_Engagement
 * @description Lớp dịch vụ xử lý rating và comment cơ bản cho anime/tập phim.
 */

import { fn, col } from "sequelize";

import { sequelize, Rating, Comment, Movie, Episode, User } from "../../../models/index.js";
import { logger } from "../../../utils/logger.js";

const createEngagementError = (message, statusCode, errorCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.errorCode = errorCode;
  error.isOperational = true;
  return error;
};

const userAttributes = ["id", "username", "avatar_url", "level"];

export const engagementService = {
  async rate(userId, data) {
    const transaction = await sequelize.transaction();

    try {
      const movie = await Movie.findByPk(data.movie_id, { transaction });
      if (!movie) {
        throw createEngagementError("Anime không tồn tại", 404, "RATING_MOVIE_NOT_FOUND");
      }

      if (data.episode_id) {
        const episode = await Episode.findOne({
          where: { id: data.episode_id, movie_id: data.movie_id },
          transaction,
        });
        if (!episode) {
          throw createEngagementError("Tập phim không thuộc anime này", 404, "RATING_EPISODE_NOT_FOUND");
        }
      }

      const [rating, created] = await Rating.findOrCreate({
        where: {
          user_id: userId,
          movie_id: data.movie_id,
          episode_id: data.episode_id || null,
        },
        defaults: {
          user_id: userId,
          movie_id: data.movie_id,
          episode_id: data.episode_id || null,
          score: data.score,
          review: data.review || null,
          is_spoiler: data.is_spoiler || false,
        },
        transaction,
      });

      if (!created) {
        await rating.update(
          {
            score: data.score,
            review: data.review !== undefined ? data.review : rating.review,
            is_spoiler: data.is_spoiler !== undefined ? data.is_spoiler : rating.is_spoiler,
          },
          { transaction },
        );
      }

      const summary = await Rating.findOne({
        where: { movie_id: data.movie_id, episode_id: null },
        attributes: [
          [fn("AVG", col("score")), "average"],
          [fn("COUNT", col("id")), "count"],
        ],
        raw: true,
        transaction,
      });

      await movie.update(
        {
          rating_average: Number(summary?.average || 0).toFixed(2),
          rating_count: parseInt(summary?.count || 0, 10),
        },
        { transaction },
      );

      await transaction.commit();
      return Rating.findByPk(rating.id, { include: [{ model: User, as: "user", attributes: userAttributes }] });
    } catch (error) {
      await transaction.rollback();
      if (error.isOperational) throw error;
      logger.error("[Engagement] Rating error:", error);
      throw createEngagementError("Lỗi gửi đánh giá", 500, "RATING_SAVE_ERR");
    }
  },

  async createComment(userId, data) {
    try {
      const movie = await Movie.findByPk(data.movie_id);
      if (!movie) {
        throw createEngagementError("Anime không tồn tại", 404, "COMMENT_MOVIE_NOT_FOUND");
      }

      if (data.episode_id) {
        const episode = await Episode.findOne({ where: { id: data.episode_id, movie_id: data.movie_id } });
        if (!episode) {
          throw createEngagementError("Tập phim không thuộc anime này", 404, "COMMENT_EPISODE_NOT_FOUND");
        }
      }

      const comment = await Comment.create({
        user_id: userId,
        movie_id: data.movie_id,
        episode_id: data.episode_id || null,
        parent_id: data.parent_id || null,
        content: data.content,
        is_spoiler: data.is_spoiler || false,
        status: "visible",
      });

      return Comment.findByPk(comment.id, { include: [{ model: User, as: "user", attributes: userAttributes }] });
    } catch (error) {
      if (error.isOperational) throw error;
      logger.error("[Engagement] Create comment error:", error);
      throw createEngagementError("Lỗi gửi bình luận", 500, "COMMENT_CREATE_ERR");
    }
  },

  async listComments(movieId, options = {}) {
    try {
      const where = {
        movie_id: movieId,
        parent_id: null,
        status: "visible",
      };

      if (options.episode_id) {
        where.episode_id = options.episode_id;
      }

      return Comment.findAll({
        where,
        include: [
          { model: User, as: "user", attributes: userAttributes },
          {
            model: Comment,
            as: "replies",
            where: { status: "visible" },
            required: false,
            include: [{ model: User, as: "user", attributes: userAttributes }],
          },
        ],
        order: [["created_at", "DESC"]],
        limit: Math.min(parseInt(options.limit || 20, 10), 100),
      });
    } catch (error) {
      logger.error("[Engagement] List comments error:", error);
      throw createEngagementError("Lỗi lấy bình luận", 500, "COMMENT_LIST_ERR");
    }
  },
};

export default engagementService;
