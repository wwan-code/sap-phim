/**
 * Dịch vụ Tập phim (Episode Service)
 *
 * @description Cung cấp các phương thức nghiệp vụ cốt lõi cho tập phim: CRUD, quản lý video, phụ đề và đồng bộ hóa trạng thái xử lý.
 */
import { Op, UniqueConstraintError } from "sequelize";
import FormData from "form-data";
import jwt from "jsonwebtoken";
import env from "../../../config/env.config.js";
import { Episode, Movie, User, sequelize } from "../../../models/index.js";
import { getRedisClient } from "../../../config/redis.config.js";
import {
  NotFoundError,
  ConflictError,
  BadRequestError,
} from "../../../utils/app-error.js";
import { logger } from "../../../utils/logger.js";
import {
  UPLOAD_LOCK_TTL,
  MAX_RETRIES,
} from "../constants/episode.constant.js";
import { videoServerService } from "../../../video-server.client.js";

export const episodeService = {
  // ════════════════════════════════════════
  // PHƯƠNG THỨC TRUY VẤN (GET METHODS)
  // ════════════════════════════════════════

  /**
   * Lấy danh sách tập phim với phân trang và bộ lọc
   * @param {Object} filters - movie_id, status, publish_state
   * @param {Object} pagination - page, limit, sortBy, sortOrder
   * @returns {Promise<Object>} { items, pagination }
   */
  async getAll(filters = {}, pagination = {}) {
    const { movie_id, status, publish_state, search, q } = filters;
    const searchTerm = (search || q || "").trim();

    const {
      page = 1,
      limit = 10,
      sortBy = "episode_number",
      sortOrder = "ASC",
    } = pagination;

    const where = {};

    if (movie_id && movie_id !== "all") where.movie_id = movie_id;
    if (status && status !== "all") where.status = status;
    if (publish_state && publish_state !== "all") where.publish_state = publish_state;

    if (searchTerm) {
      const orConditions = [
        { title: { [Op.iLike]: `%${searchTerm}%` } },
      ];
      if (!isNaN(Number(searchTerm))) {
        orConditions.push({ episode_number: Number(searchTerm) });
      }
      where[Op.or] = orConditions;
    }

    const offset = (page - 1) * limit;

    const { count, rows } = await Episode.findAndCountAll({
      where,
      include: [
        {
          model: Movie,
          as: "movie",
          attributes: ["id", "titles", "slug", "type"],
        },
      ],
      order: [[sortBy, sortOrder]],
      limit: parseInt(limit),
      offset: parseInt(offset),
    });

    // Thống kê counts theo publish_state
    const countsWhere = {};
    if (movie_id && movie_id !== "all") countsWhere.movie_id = movie_id;
    if (status && status !== "all") countsWhere.status = status;

    const countsGroup = await Episode.findAll({
      attributes: [
        "publish_state",
        [sequelize.fn("COUNT", sequelize.col("id")), "count"],
      ],
      where: countsWhere,
      group: ["publish_state"],
      raw: true,
    });

    let publishedCount = 0;
    let draftCount = 0;
    let scheduledCount = 0;
    let totalAllCount = 0;

    countsGroup.forEach((row) => {
      const c = parseInt(row.count, 10) || 0;
      totalAllCount += c;
      if (row.publish_state === "published") publishedCount += c;
      else if (row.publish_state === "draft") draftCount += c;
      else if (row.publish_state === "scheduled") scheduledCount += c;
    });

    const counts = {
      all: totalAllCount,
      published: publishedCount,
      draft: draftCount,
      scheduled: scheduledCount,
    };

    return {
      items: rows,
      pagination: {
        total: count,
        page: parseInt(page),
        totalPages: Math.ceil(count / limit),
        limit: parseInt(limit),
      },
      meta: { counts },
      counts,
    };
  },

  /**
   * Lấy danh sách tài nguyên video (Video Assets)
   * @description Lọc các tập phim đã bắt đầu quá trình xử lý (status != 'pending')
   * @param {Object} filters - movie_id, status
   * @param {Object} pagination - page, limit, sortBy, sortOrder
   * @returns {Promise<Object>} { items, pagination }
   */
  async getAssets(filters = {}, pagination = {}) {
    const { movie_id, status } = filters;

    const {
      page = 1,
      limit = 10,
      sortBy = "updated_at",
      sortOrder = "DESC",
    } = pagination;

    const where = {
      status: {
        [Op.ne]: "pending",
      },
    };

    if (movie_id) where.movie_id = movie_id;
    if (status) where.status = status;

    const offset = (page - 1) * limit;

    const { count, rows } = await Episode.findAndCountAll({
      where,
      include: [
        {
          model: Movie,
          as: "movie",
          attributes: ["id", "titles", "slug", "type"],
        },
      ],
      order: [[sortBy, sortOrder]],
      limit: parseInt(limit),
      offset: parseInt(offset),
    });

    return {
      items: rows,
      pagination: {
        total: count,
        page: parseInt(page),
        totalPages: Math.ceil(count / limit),
        limit: parseInt(limit),
      },
    };
  },

  /**
   * Lấy chi tiết tập phim theo ID
   * @param {string} id - UUID của tập phim
   * @returns {Promise<Object>}
   * @throws {NotFoundError} Nếu không tìm thấy tập phim
   */
  async getById(id) {
    const episode = await Episode.findByPk(id, {
      include: [
        {
          model: Movie,
          as: "movie",
          attributes: ["id", "titles", "slug", "type"],
        },
      ],
    });

    if (!episode) throw new NotFoundError("tập phim");

    return episode;
  },

  // ════════════════════════════════════════
  // PHƯƠNG THỨC THAY ĐỔI DỮ LIỆU (MUTATION METHODS)
  // ════════════════════════════════════════

  /**
   * Tạo mới một tập phim
   * @param {Object} data - Dữ liệu tập phim
   * @param {string} userId - ID người thực hiện
   * @returns {Promise<Object>}
   * @throws {NotFoundError} Nếu phim không tồn tại
   * @throws {ConflictError} Nếu số tập đã tồn tại trong phim này
   */
  async create(data, userId) {
    const episodeId = await sequelize.transaction(async (t) => {
      const movie = await Movie.findByPk(data.movie_id, { transaction: t });
      if (!movie) throw new NotFoundError("phim");

      const existing = await Episode.findOne({
        where: { movie_id: data.movie_id, episode_number: data.episode_number },
        transaction: t,
      });
      if (existing)
        throw new ConflictError(`Tập ${data.episode_number} đã tồn tại`);

      let episode;
      try {
        episode = await Episode.create(
          {
            ...data,
            created_by: userId,
            updated_by: userId,
          },
          { transaction: t },
        );
      } catch (err) {
        if (err instanceof UniqueConstraintError) {
          throw new ConflictError(`Tập ${data.episode_number} đã tồn tại`);
        }
        throw err;
      }

      return episode.id;
    });

    return this.getById(episodeId);
  },

  /**
   * Cập nhật thông tin tập phim
   * @param {string} id - ID tập phim
   * @param {Object} data - Dữ liệu cập nhật
   * @param {string} userId - ID người thực hiện
   * @returns {Promise<Object>}
   * @throws {NotFoundError} Nếu không tìm thấy tập phim
   * @throws {ConflictError} Nếu số tập mới trùng lặp với tập khác trong cùng phim
   */
  async update(id, data, userId) {
    await sequelize.transaction(async (t) => {
      const episode = await Episode.findByPk(id, { transaction: t });
      if (!episode) throw new NotFoundError("tập phim");

      // Kiểm tra trùng lặp số tập nếu có sự thay đổi
      if (
        data.episode_number &&
        data.episode_number !== episode.episode_number
      ) {
        const existing = await Episode.findOne({
          where: {
            movie_id: episode.movie_id,
            episode_number: data.episode_number,
          },
          transaction: t,
        });
        if (existing)
          throw new ConflictError(`Tập ${data.episode_number} đã tồn tại`);
      }

      const resultingStatus = data.status ?? episode.status;
      const resultingVideoSources = data.video_sources ?? episode.video_sources;
      if (
        resultingStatus === "ready" &&
        (!Array.isArray(resultingVideoSources) || resultingVideoSources.length === 0)
      ) {
        throw new ConflictError(
          'Không thể chuyển trạng thái sang "ready" khi tập phim chưa có video_sources',
        );
      }

      try {
        await episode.update(
          {
            ...data,
            updated_by: userId,
            ...(data.publish_state === "published" && !episode.published_at
              ? { published_at: new Date() }
              : {}),
          },
          { transaction: t },
        );
      } catch (err) {
        if (err instanceof UniqueConstraintError) {
          throw new ConflictError(`Tập ${data.episode_number} đã tồn tại`);
        }
        throw err;
      }
    });

    return this.getById(id);
  },

  /**
   * Xóa tập phim (Xóa mềm)
   * @description Đồng thời giải phóng Redis Lock tải lên nếu tồn tại.
   * @param {string} id - ID tập phim
   * @throws {NotFoundError} Nếu không tìm thấy tập phim
   */
  async delete(id) {
    await sequelize.transaction(async (t) => {
      const episode = await Episode.findByPk(id, { transaction: t });
      if (!episode) throw new NotFoundError("tập phim");

      await episode.destroy({ transaction: t });
    });

    // Giải phóng khóa upload nếu đang tồn tại (không chặn nếu Redis lỗi)
    try {
      const redis = getRedisClient();
      await redis.del(`episode:upload:lock:${id}`);
    } catch (_) {
      /* Bỏ qua lỗi Redis */
    }
  },

  /**
   * Xóa tài nguyên video vật lý
   * @description Gửi yêu cầu dọn dẹp tới Video Server và reset trạng thái DB nội bộ.
   * @param {string} id - ID tập phim
   * @param {string} userId - ID người thực hiện
   * @returns {Promise<Object>} Thông báo kết quả
   */
  async deleteVideoAsset(id, userId) {
    const episode = await this.getById(id);

    // Gửi yêu cầu dọn dẹp tới Video Server (xử lý lỗi mềm dẻo)
    try {
      const response = await fetch(`${env.videoServer.url}/internal/cleanup`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "X-Internal-Key": env.videoServer.internalKey,
        },
        body: JSON.stringify({
          movie_id: episode.movie_id,
          episode_id: episode.id,
          job_id: episode.job_id,
        }),
      });

      if (!response.ok) {
        logger.warn(
          `[Episode Service] Video Server cleanup trả về ${response.status}. Tiến hành reset dữ liệu nội bộ.`,
        );
      }
    } catch (error) {
      logger.warn(
        `[Episode Service] Không thể kết nối tới Video Server để dọn dẹp: ${error.message}`,
      );
    }

    // Đồng bộ reset trạng thái tập phim về mặc định
    await sequelize.transaction(async (t) => {
      const epToUpdate = await Episode.findByPk(id, { transaction: t });
      if (epToUpdate) {
        await epToUpdate.update(
          {
            video_sources: [],
            status: "pending",
            job_id: null,
            processing_error: null,
            updated_by: userId,
          },
          { transaction: t },
        );
      }
    });

    try {
      const redis = getRedisClient();
      await redis.del(`episode:upload:lock:${id}`);
    } catch (_) {
      /* Bỏ qua lỗi Redis */
    }

    return {
      success: true,
      message: "Đã xóa tài nguyên video, hệ thống đã đồng bộ",
    };
  },

  /**
   * Cấp Token tải lên (Upload Token)
   * @description Thực hiện kiểm tra Redis Lock để đảm bảo chỉ một người upload tại một thời điểm.
   * @param {string} episodeId - ID tập phim
   * @param {string} userId - ID người tải lên
   * @returns {Promise<Object>} URL TUS và Token bảo mật
   * @throws {ConflictError} Nếu tập phim đang xử lý hoặc đang được upload bởi người khác
   */
  async requestUploadToken(episodeId, userId) {
    const episode = await this.getById(episodeId);

    // Nếu đang trong trạng thái 'processing', kiểm tra xem công việc có thực sự đang chạy không
    if (episode.status === "processing") {
      const isJobAlive = await this._checkVideoServerJobActive(episodeId);

      if (isJobAlive) {
        throw new ConflictError(
          "Tập phim đang trong quá trình xử lý video. Vui lòng đợi.",
        );
      }

      // Nếu Job đã chết/treo → Reset trạng thái để cho phép tải lên lại
      logger.warn(
        `[Episode Service] Phát hiện job treo cho tập ${episodeId}, đang reset trạng thái...`,
      );
      await episode.update({
        status: "pending",
        processing_error: null,
        job_id: null,
      });
    }

    const redis = getRedisClient();
    const lockKey = `episode:upload:lock:${episodeId}`;
    const timestamp = Date.now();
    const lockValue = `${userId}:${timestamp}`;

    // Kiểm tra khóa hiện tại
    const existingLock = await redis.get(lockKey);
    if (existingLock) {
      const [existingUserId] = existingLock.split(":");
      // Nếu cùng một người dùng → Cho phép ghi đè (Tiếp tục upload hoặc thử lại)
      if (String(existingUserId) !== String(userId)) {
        throw new ConflictError(
          "Tập phim đang được tải lên bởi người dùng khác. Vui lòng đợi.",
        );
      }
    }

    // Thiết lập hoặc làm mới khóa (TTL mặc định 1 giờ)
    await redis.set(lockKey, lockValue, "EX", UPLOAD_LOCK_TTL);

    logger.info(
      `[Episode Service] Đã cấp khóa upload: episode=${episodeId}, user=${userId}`,
    );

    // Ký JWT Token bảo mật cho TUS upload
    const uploadToken = jwt.sign(
      {
        episodeId: episode.id,
        movieId: episode.movie_id,
        userId: String(userId),
      },
      env.videoServer.uploadTokenSecret,
      { expiresIn: "2h" },
    );

    const tusEndpoint = env.videoServer.tusPublicUrl || "/upload/tus/";

    return {
      tus_url: tusEndpoint,
      upload_token: uploadToken,
      episode_id: episode.id,
      movie_id: episode.movie_id,
      status: episode.status,
    };
  },

  /**
   * Kiểm tra xem Job có thực sự đang chạy trên Video Server không
   * @private
   * @param {string} episodeId
   * @returns {Promise<boolean>}
   */
  async _checkVideoServerJobActive(episodeId) {
    try {
      const response = await fetch(
        `${env.videoServer.url}/internal/pipeline/episode/${episodeId}/active`,
        {
          method: "GET",
          headers: {
            "X-Internal-Key": env.videoServer.internalKey,
          },
          signal: AbortSignal.timeout(5000),
        },
      );

      if (!response.ok) {
        logger.warn(
          `[Episode Service] Video server trả về ${response.status} khi kiểm tra pipeline`,
        );
        return false;
      }

      const result = await response.json();
      return result.data?.active === true;
    } catch (error) {
      logger.warn(
        `[Episode Service] Không thể kết nối Video server để kiểm tra pipeline: ${error.message}`,
      );
      return false;
    }
  },

  /**
   * Cập nhật trạng thái xử lý video
   * @param {string} id - ID tập phim
   * @param {string} status - Trạng thái mới
   * @param {string} userId - ID người thực hiện
   */
  async updateStatus(id, status, userId) {
    await sequelize.transaction(async (t) => {
      const episode = await Episode.findByPk(id, { transaction: t });
      if (episode) {
        await episode.update(
          {
            status,
            updated_by: userId,
            ...(status === "failed"
              ? { retry_count: episode.retry_count + 1 }
              : {}),
          },
          { transaction: t },
        );
      }
    });
    return this.getById(id);
  },

  /**
   * Ghi nhận một lượt xem cho tập phim
   * @description Tăng bộ đếm lượt xem một cách nguyên tử (Atomic increment).
   * @param {string} id - ID tập phim
   * @throws {NotFoundError} Nếu không tìm thấy tập phim
   */
  async recordView(id) {
    const episode = await Episode.findByPk(id);
    if (!episode) throw new NotFoundError("tập phim");
    await episode.increment("view_count");
  },

  /**
   * Thử lại quá trình xử lý video bị lỗi (Retry Job)
   * @param {string} episodeId - ID tập phim
   * @returns {Promise<Object>} Kết quả yêu cầu thử lại
   * @throws {Error} Nếu không thuộc điều kiện retry (sai trạng thái, vượt giới hạn)
   */
  async retryJob(episodeId) {
    let reservedRetryCount;
    let episodeSnapshot;

    try {
      await sequelize.transaction(async (t) => {
        const episode = await Episode.findByPk(episodeId, {
          transaction: t,
          lock: t.LOCK.UPDATE,
        });
        if (!episode) {
          throw new Error("Không tìm thấy tập phim");
        }

        if (episode.status !== "failed") {
          throw new Error(
            `Chỉ có thể thử lại các tập phim xử lý thất bại (Trạng thái hiện tại: ${episode.status})`,
          );
        }

        const currentRetryCount = episode.retry_count || 0;
        if (currentRetryCount >= MAX_RETRIES) {
          throw new Error(
            `Đã vượt quá số lần thử lại tối đa (${MAX_RETRIES} lần)`,
          );
        }

        // "Đặt chỗ" ngay trong transaction: chuyển sang "processing" và tăng
        // retry_count NGAY, trước khi gọi Video Server — request thứ 2 (double
        // click) sẽ thấy status="processing" thay vì "failed" và bị chặn ở
        // bước kiểm tra status phía trên.
        reservedRetryCount = currentRetryCount + 1;
        episodeSnapshot = episode;
        await episode.update(
          { status: "processing", retry_count: reservedRetryCount },
          { transaction: t },
        );
      });
    } catch (error) {
      logger.error("[Episode Service] Lỗi retry job (pre-check):", error);
      throw error;
    }

    try {
      // Gọi Video Server để khởi động lại Job — thực hiện SAU khi đã khoá/đặt chỗ.
      const response = await fetch(`${env.videoServer.url}/internal/retry`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Internal-Key": env.videoServer.internalKey,
        },
        body: JSON.stringify({
          movie_id: episodeSnapshot.movie_id,
          episode_id: episodeSnapshot.id,
          job_id: episodeSnapshot.job_id,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.message || `Video Server trả về lỗi: ${response.status}`,
        );
      }

      const result = await response.json();

      if (result.job_id && result.job_id !== episodeSnapshot.job_id) {
        await Episode.update(
          { job_id: result.job_id },
          { where: { id: episodeId } },
        );
      }

      logger.info(
        `[Episode Service] Retry job thành công cho tập phim ${episodeId}`,
        { newJobId: result.job_id, retryCount: reservedRetryCount },
      );

      return {
        success: true,
        job_id: result.job_id || episodeSnapshot.job_id,
        retry_count: reservedRetryCount,
        message: "Đã gửi yêu cầu xử lý lại video",
      };
    } catch (error) {
      // Gọi Video Server thất bại sau khi đã "đặt chỗ" ở DB — rollback trạng
      // thái về "failed" để không kẹt episode ở "processing" ma (không job nào
      // thực sự chạy), và trả lại 1 lượt retry đã tiêu.
      logger.error("[Episode Service] Lỗi retry job (gọi Video Server):", error);
      try {
        await Episode.update(
          {
            status: "failed",
            retry_count: Math.max(0, (reservedRetryCount || 1) - 1),
          },
          { where: { id: episodeId } },
        );
      } catch (rollbackError) {
        logger.error(
          `[Episode Service] Lỗi khi rollback trạng thái retry cho ${episodeId}: ${rollbackError.message}`,
        );
      }
      throw error;
    }
  },

  /**
   * Lấy trạng thái công việc từ Video Server
   * @param {string} jobId - ID của công việc
   * @returns {Promise<Object>} Dữ liệu trạng thái chi tiết
   */
  async getJobStatus(jobId) {
    try {
      const response = await fetch(
        `${env.videoServer.url}/internal/job/${jobId}`,
        {
          method: "GET",
          headers: {
            "X-Internal-Key": env.videoServer.internalKey,
          },
        },
      );

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("Không tìm thấy thông tin xử lý");
        }
        throw new Error(`Video Server trả về lỗi: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      logger.error("[Episode Service] Lỗi lấy trạng thái job:", error);
      throw error;
    }
  },

  // ════════════════════════════════════════
  // QUẢN LÝ PHỤ ĐỀ (SUBTITLE MANAGEMENT)
  // ════════════════════════════════════════

  /**
   * Tải lên tệp phụ đề cho tập phim (Proxy tới Video Server và đồng bộ PostgreSQL)
   * @param {string} episodeId
   * @param {Object} file - Đối tượng file từ Multer
   * @param {Object} params - { language, label, is_default }
   */
  async uploadSubtitle(episodeId, file, params) {
    const episode = await Episode.findByPk(episodeId);
    if (!episode) throw new NotFoundError("tập phim");

    const formData = new FormData();
    formData.append("file", file.buffer, {
      filename: file.originalname,
      contentType: file.mimetype,
    });
    formData.append("episode_id", episodeId);
    formData.append("movie_id", episode.movie_id);
    formData.append("language", params.language);
    formData.append("label", params.label);
    if (params.is_default !== undefined) {
      formData.append("is_default", String(params.is_default));
    }

    const result = await videoServerService.uploadSubtitle(formData);
    const subData = result?.data || result;

    // Cập nhật và đồng bộ subtitle_sources trong cơ sở dữ liệu PostgreSQL
    const currentSubs = Array.isArray(episode.subtitle_sources) ? [...episode.subtitle_sources] : [];
    const isDefault = params.is_default === true || params.is_default === "true" || currentSubs.length === 0;

    const newSubEntry = {
      id: params.language,
      language: params.language,
      label: params.label || (params.language === "vi" ? "Tiếng Việt" : params.language === "en" ? "English" : params.language.toUpperCase()),
      srclang: params.language,
      url: subData.url || subData.src || `/media/${episode.movie_id}/${episodeId}/subs/${params.language}.vtt`,
      src: subData.src || subData.url || `/media/${episode.movie_id}/${episodeId}/subs/${params.language}.vtt`,
      default: isDefault,
      isDefault: isDefault,
    };

    // Nếu newSubEntry là default, hủy default ở các phụ đề khác
    let updatedSubs = isDefault
      ? currentSubs.map((s) => ({ ...s, default: false, isDefault: false }))
      : currentSubs;

    const existingIdx = updatedSubs.findIndex(
      (s) => s.srclang === params.language || s.language === params.language || s.id === params.language,
    );
    if (existingIdx >= 0) {
      updatedSubs[existingIdx] = newSubEntry;
    } else {
      updatedSubs.push(newSubEntry);
    }

    await episode.update({ subtitle_sources: updatedSubs });

    // Xóa cache Redis liên quan
    try {
      const redis = getRedisClient();
      await redis.del(`movie:${episode.movie_id}:episodes-list`);
      await redis.del(`episode:${episode.id}`);
    } catch (_) {
      /* Bỏ qua lỗi Redis */
    }

    logger.info(
      `[Episode Service] Phụ đề đã tải lên và lưu DB: ${params.label} (${params.language}) cho tập ${episodeId}`,
    );
    return newSubEntry;
  },

  /**
   * Lấy danh sách các bản phụ đề của tập phim
   * @param {string} episodeId
   */
  async listSubtitles(episodeId) {
    const episode = await Episode.findByPk(episodeId);
    if (!episode) throw new NotFoundError("tập phim");

    // Ưu tiên đọc từ DB
    if (Array.isArray(episode.subtitle_sources) && episode.subtitle_sources.length > 0) {
      return episode.subtitle_sources;
    }

    // Fallback sang Video Server và tự động đồng bộ vào DB nếu tìm thấy file
    try {
      const remote = await videoServerService.listSubtitles(episodeId, episode.movie_id);
      const list = Array.isArray(remote?.data)
        ? remote.data
        : Array.isArray(remote)
          ? remote
          : [];

      if (list.length > 0) {
        await episode.update({ subtitle_sources: list });
      }
      return list;
    } catch {
      return [];
    }
  },

  /**
   * Xóa một bản phụ đề
   * @param {string} episodeId
   * @param {string} language - Mã ngôn ngữ của phụ đề cần xóa
   */
  async deleteSubtitle(episodeId, language) {
    const episode = await Episode.findByPk(episodeId);
    if (!episode) throw new NotFoundError("tập phim");

    const result = await videoServerService.deleteSubtitle(
      episodeId,
      language,
      episode.movie_id,
    );

    // Cập nhật DB loại bỏ phụ đề
    const currentSubs = Array.isArray(episode.subtitle_sources) ? [...episode.subtitle_sources] : [];
    let updatedSubs = currentSubs.filter(
      (s) => s.srclang !== language && s.language !== language && s.id !== language,
    );

    // Nếu vừa xóa phụ đề mặc định và còn phụ đề khác, đặt phụ đề đầu tiên làm mặc định
    const hasDefault = updatedSubs.some((s) => s.default || s.isDefault);
    if (!hasDefault && updatedSubs.length > 0) {
      updatedSubs[0] = { ...updatedSubs[0], default: true, isDefault: true };
    }

    await episode.update({ subtitle_sources: updatedSubs });

    // Xóa cache Redis liên quan
    try {
      const redis = getRedisClient();
      await redis.del(`movie:${episode.movie_id}:episodes-list`);
      await redis.del(`episode:${episode.id}`);
    } catch (_) {
      /* Bỏ qua lỗi Redis */
    }

    logger.info(
      `[Episode Service] Đã xóa phụ đề: ${language} khỏi tập ${episodeId} (đã đồng bộ DB)`,
    );
    return result;
  },

  // ════════════════════════════════════════
  // PHÁT VIDEO (PLAYBACK FOR CLIENT PLAYER)
  // ════════════════════════════════════════

  /**
   * Lấy thông tin phát video (Playback) chuẩn hóa cho Custom Video Player
   * @param {string} episodeId - ID tập phim
   * @param {Object} [user=null] - Thông tin người dùng hiện tại (nếu có)
   * @returns {Promise<Object>}
   */
  async getPlayback(episodeId, user = null) {
    const episode = await Episode.findByPk(episodeId, {
      include: [
        {
          model: Movie,
          as: "movie",
          attributes: ["id", "titles", "slug", "images", "type"],
        },
      ],
    });

    if (!episode) throw new NotFoundError("tập phim");

    const hasVideo = Array.isArray(episode.video_sources) && episode.video_sources.length > 0;
    if (episode.status !== "ready" || !hasVideo) {
      throw new BadRequestError("Tập phim chưa có video nguồn hoặc chưa hoàn tất chuyển mã");
    }

    // Tìm tập phim tiếp theo và tập trước đó
    const [nextEpisode, prevEpisode] = await Promise.all([
      Episode.findOne({
        where: {
          movie_id: episode.movie_id,
          episode_number: { [Op.gt]: episode.episode_number },
          status: "ready",
        },
        order: [["episode_number", "ASC"]],
        attributes: ["id", "episode_number", "title"],
      }),
      Episode.findOne({
        where: {
          movie_id: episode.movie_id,
          episode_number: { [Op.lt]: episode.episode_number },
          status: "ready",
        },
        order: [["episode_number", "DESC"]],
        attributes: ["id", "episode_number", "title"],
      }),
    ]);

    // Lấy danh sách phụ đề (Ưu tiên DB, tự động phục hồi nếu có file trên Video Server)
    let subtitles = Array.isArray(episode.subtitle_sources) && episode.subtitle_sources.length > 0
      ? episode.subtitle_sources
      : [];

    if (subtitles.length === 0) {
      try {
        const subsResult = await videoServerService.listSubtitles(
          episode.id,
          episode.movie_id,
        );
        if (subsResult && Array.isArray(subsResult.data) && subsResult.data.length > 0) {
          subtitles = subsResult.data;
          // Tự phục hồi lưu vào DB bất đồng bộ
          Episode.update({ subtitle_sources: subtitles }, { where: { id: episode.id } }).catch(() => {});
        }
      } catch (e) {
        logger.debug(`[EpisodeService] Chưa có phụ đề cho tập ${episodeId}: ${e.message}`);
      }
    }

    // Tăng view một cách bất đồng bộ không chặn trả về
    this.recordView(episodeId).catch((err) => {
      logger.warn(`[EpisodeService] Lỗi tăng view cho tập ${episodeId}: ${err.message}`);
    });

    let movieTitle = "Chưa có tiêu đề";
    let posterUrl = null;
    if (episode.movie) {
      if (Array.isArray(episode.movie.titles) && episode.movie.titles.length > 0) {
        const vi = episode.movie.titles.find((t) => t.type === "vietnamese");
        const def = episode.movie.titles.find((t) => t.type === "default");
        movieTitle = vi?.title || def?.title || episode.movie.titles[0]?.title || "Chưa có tiêu đề";
      } else if (typeof episode.movie.titles === "string") {
        movieTitle = episode.movie.titles;
      }
      const rawPoster = episode.movie.images?.poster;
      posterUrl = typeof rawPoster === "object" && rawPoster !== null
        ? (rawPoster.url || null)
        : (rawPoster || null);
    }

    return {
      playbackUrl: `/media/${episode.movie_id}/${episode.id}/master.m3u8`,
      storyboard: {
        vttUrl: episode.vtt_url || `/media/${episode.movie_id}/${episode.id}/sprites/storyboard.vtt`,
        spriteUrl: episode.sprite_url || `/media/${episode.movie_id}/${episode.id}/sprites/storyboard_001.jpg`,
      },
      subtitles,
      episode: {
        id: episode.id,
        movieId: episode.movie_id,
        episodeNumber: episode.episode_number,
        title: episode.title || `Tập ${episode.episode_number}`,
        duration: episode.duration || 0,
        nextEpisodeId: nextEpisode?.id || null,
        prevEpisodeId: prevEpisode?.id || null,
        movie: episode.movie
          ? {
              id: episode.movie.id,
              title: movieTitle,
              titles: episode.movie.titles,
              slug: episode.movie.slug,
              posterUrl,
            }
          : null,
      },
    };
  },
};