/**
 * @file watch-history.controller.js
 * @module Controller_WatchHistory
 * @description Controller HTTP cho tiến độ xem và danh sách xem tiếp.
 */

import { responseUtil } from "../../../utils/response.util.js";
import { watchHistoryService } from "../services/watch-history.service.js";

export const watchHistoryController = {
  async saveProgress(req, res, next) {
    try {
      const result = await watchHistoryService.saveProgress(req.userId, req.body);
      return responseUtil.success(res, result, "Lưu tiến độ xem thành công");
    } catch (error) {
      next(error);
    }
  },

  async continueWatching(req, res, next) {
    try {
      const result = await watchHistoryService.getContinueWatching(req.userId, {
        limit: Math.min(parseInt(req.query.limit || 12, 10), 50),
      });
      return responseUtil.success(res, result, "Lấy danh sách xem tiếp thành công");
    } catch (error) {
      next(error);
    }
  },
};

export default watchHistoryController;
