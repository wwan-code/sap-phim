import { responseUtil } from "../../../utils/response.util.js";
import { movieService } from "../services/movie.service.js";

const parseListQuery = (query) => {
  const filters = {
    page: parseInt(query.page || 1, 10),
    limit: Math.min(parseInt(query.limit || 20, 10), 100),
    search: query.search,
    search_field: query.search_field, sort_by: query.sort_by, order_by: query.order_by,
    genre: query.genre,
    category: query.category,
    country: query.country,
    studio: query.studio,
    series: query.series,
    year: query.year ? parseInt(query.year, 10) : undefined,
    season: query.season,
    status: query.status,
    type: query.type,
    sort: query.sort,
  };

  if (query.is_published !== undefined) {
    filters.is_published =
      typeof query.is_published === "boolean" ? query.is_published : query.is_published === "true";
  }

  if (query.is_trash !== undefined) {
    filters.is_trash =
      typeof query.is_trash === "boolean" ? query.is_trash : query.is_trash === "true";
  }

  if (query.tab) {
    filters.tab = query.tab;
  }

  return filters;
};

const getJobId = (req) =>
  req.body?.jobId ||
  req.body?.job_id ||
  req.get("X-Job-Id") ||
  req.query?.jobId ||
  req.query?.job_id ||
  null;

export const movieController = {
  async listPublic(req, res, next) {
    try {
      const result = await movieService.getPublicList(parseListQuery(req.validatedQuery || req.query));

      return responseUtil.paginated(res, {
        items: result.items,
        total: result.total,
        page: result.page,
        limit: result.limit,
        message: "Fetched movies successfully",
      });
    } catch (error) {
      next(error);
    }
  },

  async homeSections(req, res, next) {
    try {
      const result = await movieService.getHomeSections(req.userId || null);
      return responseUtil.success(res, { sections: result.sections }, "Fetched home sections successfully", 200, result.meta);
    } catch (error) {
      next(error);
    }
  },

  async getBySlug(req, res, next) {
    try {
      const movie = await movieService.getBySlug(req.params.slug);
      return responseUtil.success(res, movie, "Fetched movie successfully");
    } catch (error) {
      next(error);
    }
  },

  async create(req, res, next) {
    try {
      const result = await movieService.create(req.body, req.files || {}, req.userId, getJobId(req));
      return responseUtil.success(res, result.movie, "Created movie successfully", 201, result.meta);
    } catch (error) {
      next(error);
    }
  },

  async listAdmin(req, res, next) {
    try {
      const result = await movieService.getAdminList(parseListQuery(req.validatedQuery || req.query));

      return responseUtil.paginated(res, {
        items: result.items,
        total: result.total,
        page: result.page,
        limit: result.limit,
        message: "Fetched admin movies successfully",
        meta: { counts: result.counts },
      });
    } catch (error) {
      next(error);
    }
  },

  async getAdminById(req, res, next) {
    try {
      const movie = await movieService.getAdminById(req.params.id);
      return responseUtil.success(res, movie, "Fetched admin movie successfully");
    } catch (error) {
      next(error);
    }
  },

  async update(req, res, next) {
    try {
      const result = await movieService.update(req.params.id, req.body, req.files || {}, req.userId, getJobId(req));
      return responseUtil.success(res, result.movie, "Updated movie successfully", 200, result.meta);
    } catch (error) {
      next(error);
    }
  },

  async updateImages(req, res, next) {
    try {
      const result = await movieService.updateImages(req.params.id, req.files || {}, req.userId, getJobId(req));
      return responseUtil.success(res, result.movie, "Queued movie images successfully", 200, result.meta);
    } catch (error) {
      next(error);
    }
  },

  async delete(req, res, next) {
    try {
      await movieService.delete(req.params.id, req.userId);
      return responseUtil.success(res, null, "Chuyển phim vào thùng rác thành công");
    } catch (error) {
      next(error);
    }
  },

  async restore(req, res, next) {
    try {
      const movie = await movieService.restore(req.params.id, req.userId);
      return responseUtil.success(res, movie, "Khôi phục phim từ thùng rác thành công");
    } catch (error) {
      next(error);
    }
  },

  async forceDelete(req, res, next) {
    try {
      await movieService.forceDelete(req.params.id, req.userId);
      return responseUtil.success(res, null, "Xóa vĩnh viễn phim thành công");
    } catch (error) {
      next(error);
    }
  },

  async bulkRestore(req, res, next) {
    try {
      const count = await movieService.bulkRestore(req.body.ids, req.userId);
      return responseUtil.success(res, { count }, `Đã khôi phục ${count} phim thành công`);
    } catch (error) {
      next(error);
    }
  },

  async bulkForceDelete(req, res, next) {
    try {
      const count = await movieService.bulkForceDelete(req.body.ids, req.userId);
      return responseUtil.success(res, { count }, `Đã xóa vĩnh viễn ${count} phim thành công`);
    } catch (error) {
      next(error);
    }
  },

  async emptyTrash(req, res, next) {
    try {
      const count = await movieService.emptyTrash(req.userId);
      return responseUtil.success(res, { count }, `Đã dọn sạch thùng rác (${count} phim đã bị xóa vĩnh viễn)`);
    } catch (error) {
      next(error);
    }
  },

  /**
   * [ADMIN] Lấy dữ liệu Metadata gộp cho trang chỉnh sửa/tạo phim.
   * @route GET /api/v1/admin/movies/metadata
   * @access Admin
   */
  async getMetadata(req, res, next) {
    try {
      const result = await movieService.getMetadata();
      return responseUtil.success(res, result, "Lấy dữ liệu metadata gộp thành công");
    } catch (error) {
      next(error);
    }
  },
};

export default movieController;
