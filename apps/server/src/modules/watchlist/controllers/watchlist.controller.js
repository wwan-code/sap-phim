/**
 * @file watchlist.controller.js
 * @module Controller_Watchlist
 * @description Controller HTTP cho watchlist cá nhân.
 */

import { responseUtil } from "../../../utils/response.util.js";
import { watchlistService } from "../services/watchlist.service.js";

export const watchlistController = {
  async upsert(req, res, next) {
    try {
      const item = await watchlistService.upsert(req.userId, req.body);
      return responseUtil.success(res, item, "Lưu watchlist thành công");
    } catch (error) {
      next(error);
    }
  },

  async listMine(req, res, next) {
    try {
      const items = await watchlistService.listMine(req.userId, { status: req.query.status });
      return responseUtil.success(res, items, "Lấy watchlist thành công");
    } catch (error) {
      next(error);
    }
  },

  async remove(req, res, next) {
    try {
      await watchlistService.remove(req.userId, req.params.movieId);
      return responseUtil.success(res, null, "Xóa khỏi watchlist thành công");
    } catch (error) {
      next(error);
    }
  },
};

export default watchlistController;
