/**
 * @file episode.controller.js
 * @module Controller_Episode
 * @description Controller HTTP cho tập phim và playback.
 */

import { responseUtil } from "../../../utils/response.util.js";
import { episodeService } from "../services/episode.service.js";

export const episodeController = {
  async getAll(req, res, next) {
    try {
      const result = await episodeService.getAll(req.query, {
        page: parseInt(req.query.page, 10) || 1,
        limit: parseInt(req.query.limit, 10) || 10,
        sortBy: req.query.order_by || req.query.sortBy || "episode_number",
        sortOrder: req.query.sort || req.query.sortOrder || "ASC",
      });
      return responseUtil.success(res, result, "Lấy danh sách tập thành công");
    } catch (error) {
      next(error);
    }
  },

  async listByMovie(req, res, next) {
    try {
      const result = await episodeService.listByMovie(req.params.movieId);
      return responseUtil.success(res, result, "Lấy danh sách tập theo phim thành công");
    } catch (error) {
      next(error);
    }
  },

  async getPlayback(req, res, next) {
    try {
      const result = await episodeService.getPlayback(req.params.id, req.user || null);
      return responseUtil.success(res, result, "Lấy dữ liệu phát video thành công");
    } catch (error) {
      next(error);
    }
  },

  async create(req, res, next) {
    try {
      const episode = await episodeService.create(req.body, req.userId);
      return responseUtil.success(res, episode, "Tạo tập phim thành công", 201);
    } catch (error) {
      next(error);
    }
  },

  async update(req, res, next) {
    try {
      const episode = await episodeService.update(req.params.id, req.body, req.userId);
      return responseUtil.success(res, episode, "Cập nhật tập phim thành công");
    } catch (error) {
      next(error);
    }
  },

  async delete(req, res, next) {
    try {
      await episodeService.delete(req.params.id, req.userId);
      return responseUtil.success(res, null, "Xóa tập phim thành công");
    } catch (error) {
      next(error);
    }
  },

  async requestUploadToken(req, res, next) {
    try {
      const result = await episodeService.requestUploadToken(req.params.id, req.userId);
      return responseUtil.success(res, result, "Cấp token tải lên thành công");
    } catch (error) {
      next(error);
    }
  },

  async retryJob(req, res, next) {
    try {
      const result = await episodeService.retryJob(req.params.id);
      return responseUtil.success(res, result, "Yêu cầu xử lý lại video thành công");
    } catch (error) {
      next(error);
    }
  },

  async deleteVideoAsset(req, res, next) {
    try {
      const result = await episodeService.deleteVideoAsset(req.params.id, req.userId);
      return responseUtil.success(res, result, "Xóa tài nguyên video thành công");
    } catch (error) {
      next(error);
    }
  },

  async uploadSubtitle(req, res, next) {
    try {
      const { language, label, is_default, isDefault } = req.body;
      if (!req.file) {
        return responseUtil.error(res, "Không có tệp tin tải lên", 400);
      }
      const result = await episodeService.uploadSubtitle(req.params.id, req.file, {
        language,
        label,
        is_default: is_default !== undefined ? is_default : isDefault,
      });
      return responseUtil.success(res, result, "Tải lên phụ đề thành công", 201);
    } catch (error) {
      next(error);
    }
  },

  async listSubtitles(req, res, next) {
    try {
      const result = await episodeService.listSubtitles(req.params.id);
      return responseUtil.success(res, result, "Lấy danh sách phụ đề thành công");
    } catch (error) {
      next(error);
    }
  },

  async deleteSubtitle(req, res, next) {
    try {
      const { language } = req.params;
      const result = await episodeService.deleteSubtitle(req.params.id, language);
      return responseUtil.success(res, result, "Xóa phụ đề thành công");
    } catch (error) {
      next(error);
    }
  },
};

export default episodeController;