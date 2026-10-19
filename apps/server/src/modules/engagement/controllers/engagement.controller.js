/**
 * @file engagement.controller.js
 * @module Controller_Engagement
 * @description Controller HTTP cho đánh giá và bình luận.
 */

import { responseUtil } from "../../../utils/response.util.js";
import { engagementService } from "../services/engagement.service.js";

export const engagementController = {
  async rate(req, res, next) {
    try {
      const rating = await engagementService.rate(req.userId, req.body);
      return responseUtil.success(res, rating, "Gửi đánh giá thành công");
    } catch (error) {
      next(error);
    }
  },

  async createComment(req, res, next) {
    try {
      const comment = await engagementService.createComment(req.userId, req.body);
      return responseUtil.success(res, comment, "Gửi bình luận thành công", 201);
    } catch (error) {
      next(error);
    }
  },

  async listComments(req, res, next) {
    try {
      const comments = await engagementService.listComments(req.params.movieId, {
        episode_id: req.query.episode_id,
        limit: req.query.limit,
      });
      return responseUtil.success(res, comments, "Lấy bình luận thành công");
    } catch (error) {
      next(error);
    }
  },
};

export default engagementController;
