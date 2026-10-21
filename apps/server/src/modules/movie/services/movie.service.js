import { getAdminSearch } from './movie-search.service.js';
import { literal } from 'sequelize';
import { createEntityPersistence } from '../../ai/services/entity-persistence.service.js';
import { Op, col, cast, where as sqlWhere, QueryTypes } from "sequelize";

import {
  sequelize,
  Movie,
  Episode,
  Genre,
  Category,
  Country,
  Studio,
  Series,
  Actor,
  MovieActor,
  AuditLog,
  WatchHistory,
  AIJob,
} from "../../../models/index.js";
import { slugify } from "../../../utils/slugify.util.js";
import { logger } from "../../../utils/logger.js";
import movieCacheService from "./movie-cache.service.js";
import { cacheHelper } from "../../../config/redis.config.js";
import movieImageService from "./movie-image.service.js";
import jobsService from "../../jobs/services/jobs.service.js";
import { QUEUE_NAMES } from "../../../config/queue.config.js";
import homeConfigHelper from "./../helpers/home-config.helper.js";

const applyAiEntities = createEntityPersistence({ AIJob, Actor, Studio, sequelize });

const MOVIE_ERROR_CODES = {
  MOVIE_NOT_FOUND: "MOVIE_001",
  MOVIE_DUPLICATE_SLUG: "MOVIE_002",
  MOVIE_TITLE_REQUIRED: "MOVIE_003",
  MOVIE_INVALID_REFERENCE: "MOVIE_004",
  MOVIE_IMAGE_REQUIRED: "MOVIE_005",
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MOVIE_IMAGE_FIELDS = ["poster", "banner", "cover", "logo"];
const MOVIE_MUTABLE_FIELDS = [
  "series_id",
  "country_id",
  "category_id",
  "studio_id",
  "type",
  "status",
  "is_published",
  "description",
  "images",
  "trailer_url",
  "release_date",
  "release_year",
  "duration",
  "quality",
  "sub_dub_type",
  "source_type",
  "imdb_id",
  "tmdb_id",
  "mal_id",
  "anilist_id",
  "imdb_rating",
  "age_rating",
  "director",
  "director_metadata",
  "marketing_content",
  "tags",
  "season",
  "season_number",
  "total_episodes",
  "daily_views",
  "weekly_views",
  "monthly_views",
  "favorite_count",
  "comment_count",
  "trending_score",
  "meta_title",
  "meta_description",
  "meta_keywords",
  "is_premium",
  "seo_keywords",
];

const sortMap = {
  newest: [["release_date", "DESC"], ["created_at", "DESC"]],
  updated: [["updated_at", "DESC"]],
  trending: [["trending_score", "DESC"], ["total_views", "DESC"]],
  views: [["total_views", "DESC"]],
  daily_views: [["daily_views", "DESC"]],
  weekly_views: [["weekly_views", "DESC"]],
  monthly_views: [["monthly_views", "DESC"]],
  favorites: [["favorite_count", "DESC"]],
  rating: [["rating_average", "DESC"], ["rating_count", "DESC"]],
  year: [["release_year", "DESC"], ["release_date", "DESC"]],
  title: [["slug", "ASC"]],
};

const createMovieError = (message, statusCode, errorCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.errorCode = errorCode;
  error.isOperational = true;
  return error;
};

const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj || {}, key);
const unique = (values = []) => [...new Set(values.filter(Boolean))];
const hasMovieFiles = (files = {}) => MOVIE_IMAGE_FIELDS.some((field) => Boolean(files?.[field]?.[0]));
const countMovieFiles = (files = {}) => MOVIE_IMAGE_FIELDS.filter((field) => Boolean(files?.[field]?.[0])).length;

const buildMutationMeta = (jobId, imageResult, files = {}) => {
  const imageCount = countMovieFiles(files);
  const imageJobQueued = Boolean(imageResult?.queued);

  return {
    jobId: imageResult?.jobId || jobId || null,
    imageJobQueued,
    imageCount,
    queueJobId: imageResult?.queueJobId || null,
    imageStatus:
      imageResult?.imageStatus ||
      (imageCount === 0 ? "not_required" : imageJobQueued ? "queued" : "queue_failed"),
    ...(imageResult?.error && { imageError: imageResult.error }),
  };
};

const normalizeTitles = (data = {}) => {
  let rawTitles = data.titles;
  if (typeof rawTitles === "string") {
    try {
      rawTitles = JSON.parse(rawTitles);
    } catch {
      rawTitles = [];
    }
  }

  const source = Array.isArray(rawTitles)
    ? rawTitles
    : data.title
      ? [{ type: "default", title: data.title }]
      : [];

  return source
    .map((item) => ({
      type: String(item?.type || "default").trim() || "default",
      title: String(item?.title || "").trim(),
    }))
    .filter((item) => item.title);
};

const getPrimaryTitle = (movie) => {
  const titles = movie?.titles || [];
  return (
    titles.find((item) => item.type === "default")?.title ||
    titles.find((item) => item.type === "vietnamese")?.title ||
    titles[0]?.title ||
    movie?.slug ||
    "anime"
  );
};

const normalizeSlugValue = (value) => {
  const slug = slugify(value);
  if (!slug) {
    throw createMovieError("Movie slug is invalid", 400, "MOVIE_INVALID_SLUG");
  }
  return slug;
};

const generateUniqueActorSlug = async (name, transaction) => {
  const baseSlug = slugify(name);
  let slug = baseSlug;
  let count = 0;

  while (true) {
    const existing = await Actor.findOne({
      where: { slug },
      paranoid: false,
      transaction,
    });

    if (!existing) return slug;

    count += 1;
    slug = `${baseSlug}-${count}`;
  }
};

const buildIdentifierWhere = (value) => {
  if (!value) return null;
  return UUID_RE.test(value) ? { id: value } : { slug: value };
};

const baseIncludes = ({ genreFilter, categoryFilter, countryFilter, studioFilter, seriesFilter } = {}) => [
  {
    model: Genre,
    as: "genres",
    attributes: ["id", "name", "slug"],
    through: { attributes: [] },
    required: Boolean(genreFilter),
    ...(genreFilter && { where: buildIdentifierWhere(genreFilter) }),
  },
  {
    model: Category,
    as: "category",
    attributes: ["id", "name", "slug"],
    required: Boolean(categoryFilter),
    ...(categoryFilter && { where: buildIdentifierWhere(categoryFilter) }),
  },
  {
    model: Country,
    as: "country",
    attributes: ["id", "name", "slug"],
    required: Boolean(countryFilter),
    ...(countryFilter && { where: buildIdentifierWhere(countryFilter) }),
  },
  {
    model: Studio,
    as: "studio",
    attributes: ["id", "name", "slug"],
    required: Boolean(studioFilter),
    ...(studioFilter && { where: buildIdentifierWhere(studioFilter) }),
  },
  {
    model: Series,
    as: "series",
    attributes: ["id", "name", "slug"],
    required: Boolean(seriesFilter),
    ...(seriesFilter && { where: buildIdentifierWhere(seriesFilter) }),
  },
];

const actorInclude = {
  model: Actor,
  as: "actors",
  attributes: ["id", "name", "slug", "image_url"],
  through: {
    attributes: ["role", "role_name", "character_name", "character_image", "cast_order", "is_main_cast", "notes"],
  },
  required: false,
};

const publicEpisodeInclude = {
  model: Episode,
  as: "episodes",
  attributes: [
    "id",
    "episode_number",
    "title",
    "duration",
    "thumbnail_url",
    "status",
    "publish_state",
    "published_at",
    "is_premium",
    "view_count",
  ],
  where: { publish_state: "published" },
  required: false,
  separate: true,
  order: [["episode_number", "ASC"]],
};

const adminEpisodeInclude = {
  model: Episode,
  as: "episodes",
  required: false,
  separate: true,
  order: [["episode_number", "ASC"]],
};

const pickMovieFields = (data = {}) =>
  MOVIE_MUTABLE_FIELDS.reduce((payload, field) => {
    if (hasOwn(data, field)) payload[field] = data[field];
    return payload;
  }, {});

const mergeImages = (currentImages = {}, incomingImages = {}) => {
  const nextImages = { ...(currentImages || {}) };

  Object.entries(incomingImages || {}).forEach(([key, value]) => {
    if (!MOVIE_IMAGE_FIELDS.includes(key)) {
      nextImages[key] = value;
      return;
    }

    if (value === null || value === "") {
      delete nextImages[key];
      return;
    }

    nextImages[key] = value;
  });

  return nextImages;
};

const getChangedImagePaths = (currentImages = {}, incomingImages = {}) => {
  const paths = [];

  Object.entries(incomingImages || {}).forEach(([key, value]) => {
    if (!MOVIE_IMAGE_FIELDS.includes(key)) return;

    const currentValue = currentImages?.[key];
    const isRemoval = value === null || value === "";
    const isReplacement = !isRemoval && JSON.stringify(currentValue || null) !== JSON.stringify(value || null);

    if (isRemoval || isReplacement) {
      paths.push(...movieImageService.extractImagePaths({ [key]: currentValue }));
    }
  });

  return [...new Set(paths)];
};

const normalizeListOptions = (options = {}) => {
  const page = Math.max(parseInt(options.page || 1, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(options.limit || 20, 10) || 20, 1), 100);
  const search = typeof options.search === "string" ? options.search.trim() : options.search;

  return {
    ...options,
    page,
    limit,
    search: search || undefined,
    year: options.year ? parseInt(options.year, 10) : undefined,
  };
};

const normalizeActorCast = (data = {}) => {
  const raw = hasOwn(data, "actor_cast")
    ? data.actor_cast
    : hasOwn(data, "actors")
      ? data.actors
      : hasOwn(data, "cast")
        ? data.cast
        : hasOwn(data, "actor_ids")
          ? data.actor_ids
          : undefined;

  if (raw === undefined) return null;
  if (!Array.isArray(raw)) return [];

  const rows = raw
    .map((item, index) => {
      const actorId = typeof item === "string" ? item : item?.actor_id || item?.actorId || item?.id;
      const actorName = typeof item === "object" ? item.actor_name || item.name || null : null;
      if (!actorId && !actorName) return null;
      return {
        ai_verified: item?.ai_verified === true,
        actor_id: actorId,
        actor_name: actorName,
        actor_image_url: typeof item === "object"
          ? item.actor_image_url || item.image_url || item.avatar_url || null
          : null,
        role: typeof item === "object" ? item.role || null : null,
        role_name: typeof item === "object" ? item.role_name || item.role || null : null,
        character_name: typeof item === "object" ? item.character_name || null : null,
        character_image: typeof item === "object" ? item.character_image || null : null,
        cast_order: typeof item === "object" && item.cast_order !== undefined ? item.cast_order : index,
        is_main_cast: typeof item === "object" ? Boolean(item.is_main_cast) : false,
        notes: typeof item === "object" ? item.notes || null : null,
      };
    })
    .filter(Boolean);

  const seen = new Set();
  return rows.filter((row) => {
    const key = row.actor_id || `name:${String(row.actor_name || "").toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const assertRecordsExist = async (Model, ids, label, transaction) => {
  const values = unique(ids);
  if (values.length === 0) return;

  const count = await Model.count({
    where: { id: { [Op.in]: values } },
    transaction,
  });

  if (count !== values.length) {
    throw createMovieError(`Invalid ${label} reference`, 400, MOVIE_ERROR_CODES.MOVIE_INVALID_REFERENCE);
  }
};

const findActorByName = async (name, transaction) => {
  const actorName = String(name || "").trim();
  if (!actorName) return null;

  return Actor.findOne({
    where: { name: { [Op.iLike]: actorName } },
    transaction,
  });
};

const findOrCreateActorByName = async (name, imageUrl, transaction, userId = null) => {
  const actorName = String(name || "").trim();
  if (!actorName) return null;

  const existing = await findActorByName(actorName, transaction);
  if (existing) {
    if (!existing.image_url && imageUrl) {
      await existing.update({ image_url: imageUrl, updated_by: userId }, { transaction }).catch(() => { });
    }
    return existing;
  }

  const slug = await generateUniqueActorSlug(actorName, transaction);
  try {
    return await Actor.create(
      {
        name: actorName,
        slug,
        image_url: imageUrl || null,
        created_by: userId,
        updated_by: userId,
        movies_count: 0,
      },
      { transaction },
    );
  } catch (error) {
    logger.warn("[Movie] Actor auto-create failed, trying refetch by name", {
      actorName,
      error: error.message,
    });
    return findActorByName(actorName, transaction);
  }
};

const resolveActorCastReferences = async (actorCast, transaction, userId = null) => {
  if (actorCast === null) return null;
  if (!Array.isArray(actorCast) || actorCast.length === 0) return [];

  const actorIds = unique(actorCast.map((item) => item.actor_id));
  const existingActors = actorIds.length > 0
    ? await Actor.findAll({
      where: { id: { [Op.in]: actorIds } },
      transaction,
    })
    : [];
  const existingById = new Map(existingActors.map((actor) => [actor.id, actor]));
  const resolved = [];
  const seen = new Set();

  for (const item of actorCast) {
    let actor = item.actor_id ? existingById.get(item.actor_id) : null;
    const actorName = item.actor_name || item.name;

    if (!actor && actorName) {
      actor = await findOrCreateActorByName(actorName, item.actor_image_url, transaction, userId);
    }

    if (
      actor &&
      !item.ai_verified &&
      actorName &&
      /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uac00-\ud7af]/u.test(actor.name) &&
      !/[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uac00-\ud7af]/u.test(actorName)
    ) {
      const commonActor = await findActorByName(actorName, transaction);
      if (commonActor && commonActor.id !== actor.id) {
        actor = commonActor;
      } else {
        const aliases = Array.isArray(actor.aliases) ? actor.aliases : [];
        await actor.update(
          {
            name: actorName,
            slug: await generateUniqueActorSlug(actorName, transaction),
            aliases: unique([...aliases, actor.name]),
            updated_by: userId,
          },
          { transaction },
        );
      }
    }

    if (!actor?.id && item.ai_verified) throw createMovieError('Invalid verified actor', 409, 'AI_ENTITY_CHANGED');
    if (!actor?.id) {
      logger.warn("[Movie] Dropping invalid actor reference from cast", {
        actorId: item.actor_id,
        actorName,
      });
      continue;
    }

    if (seen.has(actor.id)) continue;
    seen.add(actor.id);

    resolved.push({
      ...item,
      actor_id: actor.id,
    });
  }

  return resolved;
};

const validateReferences = async (data, actorCast, transaction) => {
  const singleChecks = [
    ["category_id", Category, "category"],
    ["country_id", Country, "country"],
    ["studio_id", Studio, "studio"],
    ["series_id", Series, "series"],
  ];

  await Promise.all(
    singleChecks.map(([field, Model, label]) => {
      if (!hasOwn(data, field) || data[field] === null) return null;
      return assertRecordsExist(Model, [data[field]], label, transaction);
    }),
  );

  if (Array.isArray(data.genre_ids)) {
    await assertRecordsExist(Genre, data.genre_ids, "genre", transaction);
  }

  if (Array.isArray(actorCast)) {
    await assertRecordsExist(Actor, actorCast.map((item) => item.actor_id), "actor", transaction);
  }
};

const replaceActorCast = async (movieId, actorCast, transaction) => {
  if (actorCast === null) return;

  await MovieActor.destroy({ where: { movie_id: movieId }, transaction });
  if (actorCast.length === 0) return;

  await MovieActor.bulkCreate(
    actorCast.map((item, index) => {
      const { actor_name, actor_image_url, name, image_url, avatar_url, ...castRow } = item;
      return {
        ...castRow,
        cast_order: item.cast_order !== undefined && item.cast_order !== null ? Number(item.cast_order) : index,
        movie_id: movieId,
      };
    }),
    { transaction },
  );
};

const getMovieGenreIds = async (movie, transaction) => {
  const genres = await movie.getGenres({
    attributes: ["id"],
    joinTableAttributes: [],
    transaction,
  });
  return genres.map((genre) => genre.id);
};

const getMovieActorIds = async (movieId, transaction) => {
  const rows = await MovieActor.findAll({
    where: { movie_id: movieId },
    attributes: ["actor_id"],
    raw: true,
    transaction,
  });
  return rows.map((row) => row.actor_id);
};

const syncGenreCounts = async (genreIds = []) => {
  await Promise.all(
    unique(genreIds).map(async (genreId) => {
      const [row] = await sequelize.query(
        "SELECT COUNT(*)::int AS count FROM movie_genres WHERE genre_id = :genreId",
        { replacements: { genreId }, type: QueryTypes.SELECT },
      );
      await Genre.update({ movies_count: Number(row?.count || 0) }, { where: { id: genreId } });
    }),
  );
};

const syncReferenceCounters = async ({
  genreIds = [],
  categoryIds = [],
  countryIds = [],
  seriesIds = [],
  actorIds = [],
} = {}) => {
  await Promise.all([
    syncGenreCounts(genreIds),
    ...unique(categoryIds).map(async (id) => {
      const count = await Movie.count({ where: { category_id: id } });
      await Category.update({ movies_count: count }, { where: { id } });
    }),
    ...unique(countryIds).map(async (id) => {
      const count = await Movie.count({ where: { country_id: id } });
      await Country.update({ movies_count: count }, { where: { id } });
    }),
    ...unique(seriesIds).map(async (id) => {
      const count = await Movie.count({ where: { series_id: id } });
      await Series.update({ total_movies: count }, { where: { id }, paranoid: false });
    }),
    ...unique(actorIds).map(async (id) => {
      const count = await MovieActor.count({ where: { actor_id: id } });
      await Actor.update({ movies_count: count }, { where: { id }, paranoid: false });
    }),
  ]);
};

const safeAudit = async (payload) => {
  try {
    await AuditLog.logEvent(payload);
  } catch (error) {
    logger.warn("[Movie] Audit log failed", { error: error.message, eventType: payload.eventType });
  }
};

const runPostCommitTasks = async (tasks = [], context = {}) => {
  const results = await Promise.allSettled(tasks);

  results.forEach((result) => {
    if (result.status === "rejected") {
      logger.warn("[Movie] Post-commit task failed", {
        ...context,
        error: result.reason?.message || String(result.reason),
      });
    }
  });
};

const rollbackQuietly = async (transaction) => {
  if (transaction && !transaction.finished) {
    await transaction.rollback().catch((error) => {
      logger.error("[Movie] Transaction rollback failed", { error: error.message });
    });
  }
};

const isUniqueConstraintError = (error) =>
  error?.name === "SequelizeUniqueConstraintError" || error?.original?.code === "23505";

const toMutationError = (error, fallbackMessage, fallbackCode) => {
  if (error.isOperational) return error;
  if (isUniqueConstraintError(error)) {
    return createMovieError("Movie slug already exists", 409, MOVIE_ERROR_CODES.MOVIE_DUPLICATE_SLUG);
  }
  logger.error(`[Movie] ${fallbackCode}:`, error);
  return createMovieError(fallbackMessage, 500, fallbackCode);
};

export const movieService = {
  async generateUniqueSlug(title, excludeId = null, transaction = null) {
    const baseSlug = normalizeSlugValue(title || "anime");
    const where = { slug: { [Op.like]: `${baseSlug}%` } };

    if (excludeId) {
      where.id = { [Op.ne]: excludeId };
    }

    const existingSlugs = await Movie.findAll({
      where,
      attributes: ["slug"],
      raw: true,
      transaction,
    });

    if (existingSlugs.length === 0) return baseSlug;

    const slugSet = new Set(existingSlugs.map((row) => row.slug));
    if (!slugSet.has(baseSlug)) return baseSlug;

    let index = 1;
    while (slugSet.has(`${baseSlug}-${index}`)) {
      index += 1;
    }
    return `${baseSlug}-${index}`;
  },

  async assertSlugAvailable(slug, excludeId = null, transaction = null) {
    const where = { slug };
    if (excludeId) where.id = { [Op.ne]: excludeId };

    const existing = await Movie.findOne({
      where,
      attributes: ["id"],
      transaction,
    });

    if (existing) {
      throw createMovieError("Movie slug already exists", 409, MOVIE_ERROR_CODES.MOVIE_DUPLICATE_SLUG);
    }
  },

  async queueImages(files, movie, jobId, { throwOnError = false } = {}) {
    if (!hasMovieFiles(files)) {
      jobsService.completeJob(jobId, {
        movieId: movie.id,
        slug: movie.slug,
      });
      return {
        success: true,
        queued: false,
        jobCount: 0,
        jobId,
        imageStatus: "not_required",
      };
    }

    try {
      jobsService.updateStage(jobId, "PREPARING_IMAGES", {
        movieId: movie.id,
        totalImages: countMovieFiles(files),
      });

      const imagePayload = movieImageService.prepareImagePayload(files, movie.id, jobId);
      if (!imagePayload.hasFiles) {
        return { success: true, jobCount: 0, jobId: imagePayload.jobId };
      }

      const job = await jobsService.enqueueJob(
        QUEUE_NAMES.IMAGE_PROCESSING,
        "process-all-movie-images",
        imagePayload.payload,
        {
          jobId: `movie-images-${imagePayload.jobId}`,
          attempts: 3,
          backoff: { type: "exponential", delay: 1000 },
        }
      );
      
      const result = { success: true, jobCount: imagePayload.jobCount, jobId: imagePayload.jobId, queueJobId: job.id };

      jobsService.updateStage(jobId, "QUEUED", {
        movieId: movie.id,
        queueJobId: result.queueJobId,
        imageCount: result.jobCount,
        status: "queued",
      });
      jobsService.releaseJob(jobId);
      return {
        ...result,
        queued: true,
        imageStatus: "queued",
      };
    } catch (error) {
      await movieImageService.deleteUploadedTempFiles(files);
      jobsService.failJob(jobId, error, { movieId: movie.id });
      logger.error("[Movie] Failed to queue movie images", {
        movieId: movie.id,
        jobId,
        error: error.message,
      });
      if (throwOnError) {
        throw createMovieError("Image processing queue is unavailable", 503, "MOVIE_IMAGE_QUEUE_ERR");
      }
      return {
        success: false,
        queued: false,
        jobCount: countMovieFiles(files),
        jobId,
        imageStatus: "queue_failed",
        error: error.message,
      };
    }
  },

  async create(data, files = {}, userId = null, jobId = null) {
    const titles = normalizeTitles(data);
    let actorCast = normalizeActorCast(data);
    let transaction = null;
    let movie = null;

    jobsService.createTracker(jobId, "create", {
      title: titles[0]?.title || data.title || "Unknown",
      ownerId: userId,
    });
    jobsService.startJob(jobId, { operation: "create" });

    try {
      jobsService.updateStage(jobId, "VALIDATING", { percent: 10 });
      if (titles.length === 0) {
        throw createMovieError("Movie requires at least one title", 400, MOVIE_ERROR_CODES.MOVIE_TITLE_REQUIRED);
      }

      transaction = await sequelize.transaction();
      data = await applyAiEntities(data, { userId, movieId: movie?.id || null, transaction });
      actorCast = normalizeActorCast(data);
      actorCast = await resolveActorCastReferences(actorCast, transaction, userId);
      await validateReferences(data, actorCast, transaction);

      jobsService.updateStage(jobId, "CHECKING_SLUG", { percent: 25 });
      const slug = hasOwn(data, "slug")
        ? normalizeSlugValue(data.slug)
        : await this.generateUniqueSlug(titles[0].title, null, transaction);
      if (hasOwn(data, "slug")) {
        await this.assertSlugAvailable(slug, null, transaction);
      }

      const payload = {
        ...pickMovieFields(data),
        titles,
        slug,
        type: data.type || "series",
        status: data.status || "ongoing",
        images: data.images || {},
        tags: data.tags || [],
        seo_keywords: data.seo_keywords || [],
        created_by: userId,
        updated_by: userId,
      };

      jobsService.updateStage(jobId, "SAVING_DATABASE", { percent: 45 });
      movie = await Movie.create(payload, { transaction });

      if (Array.isArray(data.genre_ids)) {
        jobsService.updateStage(jobId, "SAVING_GENRES", { percent: 60 });
        await movie.setGenres(unique(data.genre_ids), { transaction });
      }

      await replaceActorCast(movie.id, actorCast, transaction);

      jobsService.updateStage(jobId, "COMMITTING", { percent: 75 });
      await transaction.commit();
    } catch (error) {
      await rollbackQuietly(transaction);
      await movieImageService.deleteUploadedTempFiles(files);
      jobsService.failJob(jobId, error);
      throw toMutationError(error, "Movie creation failed", "MOVIE_CREATE_ERR");
    }

    await runPostCommitTasks([
      movieCacheService.invalidateMovie(movie.id, movie.slug),
      syncReferenceCounters({
        genreIds: data.genre_ids || [],
        categoryIds: [data.category_id],
        countryIds: [data.country_id],
        seriesIds: [data.series_id],
        actorIds: actorCast?.map((item) => item.actor_id) || [],
      }),
    ], { movieId: movie.id, operation: "create" });

    logger.info("[Movie] Created movie", { movieId: movie.id, userId });
    await safeAudit({
      eventType: "movie.create",
      eventCategory: "admin",
      severity: "info",
      userId,
      metadata: { movieId: movie.id, slug: movie.slug },
      description: `Created movie: ${getPrimaryTitle(movie)}`,
      status: "success",
    });

    const imageResult = await this.queueImages(files, movie, jobId);
    const savedMovie = await this.getAdminById(movie.id);
    return {
      movie: savedMovie,
      meta: buildMutationMeta(jobId, imageResult, files),
    };
  },

  async getPublicList(options = {}) {
    try {
      const {
        page,
        limit,
        search,
        genre,
        category,
        country,
        studio,
        series,
        year,
        season,
        status,
        type,
        quality,
        sub_dub_type,
        source_type,
        sort = "newest",
      } = normalizeListOptions(options);

      const cacheQuery = { page, limit, genre, category, country, studio, series, year, season, status, type, quality, sub_dub_type, source_type, sort };
      if (!search) {
        const cached = await movieCacheService.getList(cacheQuery, false);
        if (cached.hit) return cached.data;
      }

      const where = { is_published: true };
      const offset = (page - 1) * limit;

      if (status) where.status = status;
      if (type) where.type = type;
      if (season) where.season = season;
      if (quality) where.quality = quality;
      if (sub_dub_type) where.sub_dub_type = sub_dub_type;
      if (source_type) where.source_type = source_type;
      if (year) {
        where[Op.or] = [
          { release_year: year },
          {
            release_date: {
              [Op.gte]: `${year}-01-01`,
              [Op.lte]: `${year}-12-31`,
            },
          },
        ];
      }
      if (search) {
        where[Op.or] = [
          { slug: { [Op.iLike]: `%${search}%` } },
          { description: { [Op.iLike]: `%${search}%` } },
          sqlWhere(cast(col("Movie.titles"), "text"), { [Op.iLike]: `%${search}%` }),
        ];
      }

      const { count: total, rows: items } = await Movie.findAndCountAll({
        where,
        include: baseIncludes({
          genreFilter: genre,
          categoryFilter: category,
          countryFilter: country,
          studioFilter: studio,
          seriesFilter: series,
        }),
        distinct: true,
        limit,
        offset,
        order: sortMap[sort] || sortMap.newest,
      });

      const result = { items, total, page, limit };
      if (!search) {
        movieCacheService.setList(cacheQuery, result, false).catch(() => { });
      }
      return result;
    } catch (error) {
      logger.error("[Movie] Public list error:", error);
      throw createMovieError("Failed to fetch movies", 500, "MOVIE_LIST_ERR");
    }
  },

  async getAdminList(options = {}) {
    try {
      const {
        page,
        limit,
        search,
        is_published,
        is_trash,
        status,
        type,
        category,
        genre,
        country,
        studio,
        series,
        year,
        season,
        quality,
        sub_dub_type,
        source_type,
        order_by = "updated_at",
        sort = "DESC",
      } = normalizeListOptions(options);
      const indexedSearch = await getAdminSearch(search, options.search_field || "all");
      const offset = (page - 1) * limit;
      const where = {};
      const baseWhere = {};

      if (status) {
        where.status = status;
        baseWhere.status = status;
      }
      if (type) {
        where.type = type;
        baseWhere.type = type;
      }
      if (season) {
        where.season = season;
        baseWhere.season = season;
      }
      if (quality) {
        where.quality = quality;
        baseWhere.quality = quality;
      }
      if (sub_dub_type) {
        where.sub_dub_type = sub_dub_type;
        baseWhere.sub_dub_type = sub_dub_type;
      }
      if (source_type) {
        where.source_type = source_type;
        baseWhere.source_type = source_type;
      }
      if (year) {
        where[Op.or] = [
          { release_year: year },
          {
            release_date: {
              [Op.gte]: `${year}-01-01`,
              [Op.lte]: `${year}-12-31`,
            },
          },
        ];
        baseWhere[Op.or] = where[Op.or];
      }
      if (indexedSearch) {
        where[Op.and] = [literal(indexedSearch.condition)];
        baseWhere[Op.and] = [literal(indexedSearch.condition)];
      } else if (search) {
        const searchCond = [
          { slug: { [Op.iLike]: `%${search}%` } },
          { description: { [Op.iLike]: `%${search}%` } },
          sqlWhere(cast(col("Movie.titles"), "text"), { [Op.iLike]: `%${search}%` }),
        ];
        where[Op.and] = [{ [Op.or]: searchCond }];
        baseWhere[Op.and] = [{ [Op.or]: searchCond }];
      }

      const isTrashTab = is_trash === true || options.is_trash === "true" || options.tab === "trash";

      if (isTrashTab) {
        where.deleted_at = { [Op.ne]: null };
      } else if (is_published !== undefined) {
        where.is_published = is_published;
      }

      const orderDirection = sort.toUpperCase() === "ASC" ? "ASC" : "DESC";
      const orderClause = [];
      const allowedOrderFields = [
        "updated_at",
        "created_at",
        "release_date",
        "release_year",
        "trending_score",
        "daily_views",
        "weekly_views",
        "monthly_views",
        "total_views",
        "rating_average",
      ];
      if (allowedOrderFields.includes(order_by)) {
        orderClause.push([order_by, orderDirection]);
      } else if (order_by === "title") {
        orderClause.push(["slug", orderDirection]);
      } else {
        orderClause.push(["updated_at", "DESC"]);
      }

      if (indexedSearch && (options.sort_by === 'relevance' || (!options.sort_by && !options.order_by))) orderClause.unshift([literal(indexedSearch.rank), 'DESC']);
      orderClause.push(['id', 'ASC']);
      const { count: total, rows: items } = await Movie.findAndCountAll({
        where,
        include: baseIncludes({
          categoryFilter: category,
          genreFilter: genre,
          countryFilter: country,
          studioFilter: studio,
          seriesFilter: series,
        }),
        distinct: true,
        limit,
        offset,
        order: orderClause,
        paranoid: !isTrashTab,
      });

      const activeGroup = await Movie.findAll({
        attributes: [
          "is_published",
          [sequelize.fn("COUNT", sequelize.col("id")), "count"],
        ],
        where: baseWhere,
        group: ["is_published"],
        raw: true,
        paranoid: true,
      });

      const trashCountResult = await Movie.count({
        where: { ...baseWhere, deleted_at: { [Op.ne]: null } },
        paranoid: false,
      });

      let publishedCount = 0;
      let draftCount = 0;
      let totalActive = 0;

      activeGroup.forEach((row) => {
        const count = parseInt(row.count, 10) || 0;
        totalActive += count;
        if (row.is_published === true || row.is_published === 'true' || row.is_published === 1) {
          publishedCount += count;
        } else {
          draftCount += count;
        }
      });

      const counts = {
        all: totalActive,
        published: publishedCount,
        drafts: draftCount,
        trash: trashCountResult || 0,
      };

      return { items, total, page, limit, counts };
    } catch (error) {
      logger.error("[Movie] Admin list error:", error);
      throw createMovieError("Failed to fetch admin movies", 500, "MOVIE_ADMIN_LIST_ERR");
    }
  },

  async getBySlug(slug) {
    try {
      const cached = await movieCacheService.getBySlug(slug);
      if (cached.hit) return cached.data;

      const movie = await Movie.findOne({
        where: { slug, is_published: true },
        include: [
          ...baseIncludes(),
          actorInclude,
          publicEpisodeInclude,
        ],
      });

      if (!movie) {
        throw createMovieError("Movie does not exist or is not published", 404, MOVIE_ERROR_CODES.MOVIE_NOT_FOUND);
      }

      const plain = movie.get({ plain: true });
      movieCacheService.setBySlug(slug, plain).catch(() => { });
      return plain;
    } catch (error) {
      if (error.isOperational) throw error;
      logger.error("[Movie] Get by slug error:", error);
      throw createMovieError("Failed to fetch movie detail", 500, "MOVIE_DETAIL_ERR");
    }
  },

  async getAdminById(id) {
    try {
      const movie = await Movie.findByPk(id, {
        include: [
          ...baseIncludes(),
          actorInclude,
          adminEpisodeInclude,
        ],
      });

      if (!movie) {
        throw createMovieError("Movie does not exist", 404, MOVIE_ERROR_CODES.MOVIE_NOT_FOUND);
      }

      return movie;
    } catch (error) {
      if (error.isOperational) throw error;
      logger.error("[Movie] Admin get error:", error);
      throw createMovieError("Failed to fetch admin movie", 500, "MOVIE_ADMIN_DETAIL_ERR");
    }
  },

  async update(id, data, files = {}, userId = null, jobId = null) {
    const titles = hasOwn(data, "title") || hasOwn(data, "titles") ? normalizeTitles(data) : null;
    let actorCast = normalizeActorCast(data);
    let transaction = null;
    let movie = null;
    let oldRefs = {};
    let oldImagePaths = [];
    let newSlug = null;

    jobsService.createTracker(jobId, "update", { movieId: id, ownerId: userId });
    jobsService.startJob(jobId, { operation: "update", movieId: id });

    try {
      transaction = await sequelize.transaction();
      movie = await Movie.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
      if (!movie) {
        throw createMovieError("Movie does not exist", 404, MOVIE_ERROR_CODES.MOVIE_NOT_FOUND);
      }

      oldRefs = {
        slug: movie.slug,
        genreIds: await getMovieGenreIds(movie, transaction),
        actorIds: await getMovieActorIds(movie.id, transaction),
        categoryId: movie.category_id,
        countryId: movie.country_id,
        seriesId: movie.series_id,
      };

      if (titles && titles.length === 0) {
        throw createMovieError("Movie requires at least one title", 400, MOVIE_ERROR_CODES.MOVIE_TITLE_REQUIRED);
      }

      data = await applyAiEntities(data, { userId, movieId: movie?.id || null, transaction });
      actorCast = normalizeActorCast(data);
      actorCast = await resolveActorCastReferences(actorCast, transaction, userId);
      await validateReferences(data, actorCast, transaction);

      const updateData = {
        ...pickMovieFields(data),
        updated_by: userId,
      };

      if (titles?.length > 0) {
        updateData.titles = titles;
      }

      if (hasOwn(data, "images")) {
        oldImagePaths = getChangedImagePaths(movie.images, data.images);
        updateData.images = mergeImages(movie.images, data.images);
      }

      if (hasOwn(data, "slug")) {
        updateData.slug = normalizeSlugValue(data.slug);
        await this.assertSlugAvailable(updateData.slug, id, transaction);
      } else if (titles?.length > 0) {
        updateData.slug = await this.generateUniqueSlug(titles[0].title, id, transaction);
      }

      newSlug = updateData.slug || movie.slug;

      jobsService.updateStage(jobId, "UPDATING_DATABASE", { percent: 45 });
      await movie.update(updateData, { transaction });

      if (Array.isArray(data.genre_ids)) {
        jobsService.updateStage(jobId, "SAVING_GENRES", { percent: 60 });
        await movie.setGenres(unique(data.genre_ids), { transaction });
      }

      await replaceActorCast(movie.id, actorCast, transaction);

      jobsService.updateStage(jobId, "COMMITTING", { percent: 75 });
      await transaction.commit();
    } catch (error) {
      await rollbackQuietly(transaction);
      await movieImageService.deleteUploadedTempFiles(files);
      jobsService.failJob(jobId, error, { movieId: id });
      throw toMutationError(error, "Movie update failed", "MOVIE_UPDATE_ERR");
    }

    const newGenreIds = Array.isArray(data.genre_ids) ? data.genre_ids : oldRefs.genreIds;
    const newActorIds = actorCast === null ? oldRefs.actorIds : actorCast.map((item) => item.actor_id);

    await runPostCommitTasks([
      movieCacheService.invalidateMovie(id, unique([oldRefs.slug, newSlug])),
      movieImageService.deleteImages(oldImagePaths),
      syncReferenceCounters({
        genreIds: [...oldRefs.genreIds, ...newGenreIds],
        categoryIds: [oldRefs.categoryId, hasOwn(data, "category_id") ? data.category_id : oldRefs.categoryId],
        countryIds: [oldRefs.countryId, hasOwn(data, "country_id") ? data.country_id : oldRefs.countryId],
        seriesIds: [oldRefs.seriesId, hasOwn(data, "series_id") ? data.series_id : oldRefs.seriesId],
        actorIds: [...oldRefs.actorIds, ...newActorIds],
      }),
    ], { movieId: id, operation: "update" });

    logger.info("[Movie] Updated movie", { movieId: id, userId });
    await safeAudit({
      eventType: "movie.update",
      eventCategory: "admin",
      severity: "info",
      userId,
      metadata: { movieId: id, fields: Object.keys(data) },
      description: `Updated movie: ${getPrimaryTitle(movie)}`,
      status: "success",
    });

    const imageResult = await this.queueImages(files, { id, slug: newSlug }, jobId);
    const savedMovie = await this.getAdminById(id);
    return {
      movie: savedMovie,
      meta: buildMutationMeta(jobId, imageResult, files),
    };
  },

  async updateImages(id, files = {}, userId = null, jobId = null) {
    jobsService.createTracker(jobId, "images", { movieId: id, ownerId: userId });
    jobsService.startJob(jobId, { operation: "images", movieId: id });

    try {
      if (!hasMovieFiles(files)) {
        throw createMovieError("At least one movie image is required", 400, MOVIE_ERROR_CODES.MOVIE_IMAGE_REQUIRED);
      }

      const movie = await Movie.findByPk(id);
      if (!movie) {
        throw createMovieError("Movie does not exist", 404, MOVIE_ERROR_CODES.MOVIE_NOT_FOUND);
      }

      await movieCacheService.invalidateMovie(id, movie.slug);
      await safeAudit({
        eventType: "movie.images.update",
        eventCategory: "admin",
        severity: "info",
        userId,
        metadata: { movieId: id, imageFields: MOVIE_IMAGE_FIELDS.filter((field) => files?.[field]?.[0]) },
        description: `Queued image update for movie: ${getPrimaryTitle(movie)}`,
        status: "success",
      });

      const imageResult = await this.queueImages(files, movie, jobId, { throwOnError: true });
      const savedMovie = await this.getAdminById(id);
      return {
        movie: savedMovie,
        meta: buildMutationMeta(jobId, imageResult, files),
      };
    } catch (error) {
      await movieImageService.deleteUploadedTempFiles(files);
      jobsService.failJob(jobId, error, { movieId: id });
      if (error.isOperational) throw error;
      logger.error("[Movie] Update images error:", error);
      throw createMovieError("Movie image update failed", 500, "MOVIE_IMAGE_UPDATE_ERR");
    }
  },

  async delete(id, userId = null) {
    try {
      const movie = await Movie.findByPk(id);
      if (!movie) {
        throw createMovieError("Movie does not exist", 404, MOVIE_ERROR_CODES.MOVIE_NOT_FOUND);
      }

      await movie.destroy();
      await movieCacheService.invalidateMovie(id, movie.slug);
      logger.info("[Movie] Soft-deleted movie to trash", { movieId: id, userId });

      await safeAudit({
        eventType: "movie.delete",
        eventCategory: "admin",
        severity: "warn",
        userId,
        metadata: { movieId: id },
        description: `Chuyển phim vào thùng rác: ${getPrimaryTitle(movie)}`,
        status: "success",
      });

      return true;
    } catch (error) {
      if (error.isOperational) throw error;
      logger.error("[Movie] Delete error:", error);
      throw createMovieError("Movie deletion failed", 500, "MOVIE_DELETE_ERR");
    }
  },

  async restore(id, userId = null) {
    try {
      const movie = await Movie.findByPk(id, { paranoid: false });
      if (!movie) {
        throw createMovieError("Movie does not exist", 404, MOVIE_ERROR_CODES.MOVIE_NOT_FOUND);
      }

      if (!movie.deleted_at) {
        return movie;
      }

      await movie.restore();
      await movieCacheService.invalidateMovie(id, movie.slug);
      logger.info("[Movie] Restored movie from trash", { movieId: id, userId });

      await safeAudit({
        eventType: "movie.restore",
        eventCategory: "admin",
        severity: "info",
        userId,
        metadata: { movieId: id },
        description: `Khôi phục phim từ thùng rác: ${getPrimaryTitle(movie)}`,
        status: "success",
      });

      return movie;
    } catch (error) {
      if (error.isOperational) throw error;
      logger.error("[Movie] Restore error:", error);
      throw createMovieError("Movie restore failed", 500, "MOVIE_RESTORE_ERR");
    }
  },

  async forceDelete(id, userId = null) {
    try {
      const movie = await Movie.findByPk(id, { paranoid: false });
      if (!movie) {
        throw createMovieError("Movie does not exist", 404, MOVIE_ERROR_CODES.MOVIE_NOT_FOUND);
      }

      // Xóa các dữ liệu phụ thuộc
      await MovieActor.destroy({ where: { movie_id: id } }).catch(() => {});
      await Episode.destroy({ where: { movie_id: id }, force: true }).catch(() => {});

      // Dọn dẹp toàn bộ file ảnh vật lý trên ổ đĩa
      await movieImageService.cleanupMovieAssets(movie).catch((error) => {
        logger.warn("[Movie] Failed to cleanup movie assets on force delete", {
          movieId: id,
          error: error.message,
        });
      });

      // Xóa cứng trong Database
      await movie.destroy({ force: true });
      await movieCacheService.invalidateMovie(id, movie.slug);
      logger.info("[Movie] Permanently deleted movie", { movieId: id, userId });

      await safeAudit({
        eventType: "movie.force_delete",
        eventCategory: "admin",
        severity: "warn",
        userId,
        metadata: { movieId: id },
        description: `Xóa vĩnh viễn phim: ${getPrimaryTitle(movie)}`,
        status: "success",
      });

      return true;
    } catch (error) {
      if (error.isOperational) throw error;
      logger.error("[Movie] Force delete error:", error);
      throw createMovieError("Movie permanent deletion failed", 500, "MOVIE_FORCE_DELETE_ERR");
    }
  },

  async bulkRestore(ids, userId = null) {
    try {
      if (!Array.isArray(ids) || ids.length === 0) {
        return 0;
      }

      const restoredCount = await Movie.restore({
        where: { id: { [Op.in]: ids } },
      });

      for (const id of ids) {
        await movieCacheService.invalidateMovie(id).catch(() => {});
      }

      logger.info(`[Movie] Bulk restored ${restoredCount} movies`, { ids, userId });

      await safeAudit({
        eventType: "movie.bulk_restore",
        eventCategory: "admin",
        severity: "info",
        userId,
        metadata: { ids, count: restoredCount },
        description: `Khôi phục hàng loạt ${restoredCount} phim từ thùng rác`,
        status: "success",
      });

      return restoredCount;
    } catch (error) {
      if (error.isOperational) throw error;
      logger.error("[Movie] Bulk restore error:", error);
      throw createMovieError("Bulk restore movies failed", 500, "MOVIE_BULK_RESTORE_ERR");
    }
  },

  async bulkForceDelete(ids, userId = null) {
    try {
      if (!Array.isArray(ids) || ids.length === 0) {
        return 0;
      }

      const movies = await Movie.findAll({
        where: { id: { [Op.in]: ids } },
        paranoid: false,
      });

      for (const m of movies) {
        await MovieActor.destroy({ where: { movie_id: m.id } }).catch(() => {});
        await Episode.destroy({ where: { movie_id: m.id }, force: true }).catch(() => {});
        await movieImageService.cleanupMovieAssets(m).catch((error) => {
          logger.warn("[Movie] Failed to cleanup movie assets on bulk force delete", {
            movieId: m.id,
            error: error.message,
          });
        });
        await movieCacheService.invalidateMovie(m.id, m.slug).catch(() => {});
      }

      const deletedCount = await Movie.destroy({
        where: { id: { [Op.in]: ids } },
        force: true,
      });

      logger.info(`[Movie] Bulk permanently deleted ${deletedCount} movies`, { ids, userId });

      await safeAudit({
        eventType: "movie.bulk_force_delete",
        eventCategory: "admin",
        severity: "warn",
        userId,
        metadata: { ids, count: deletedCount },
        description: `Xóa vĩnh viễn hàng loạt ${deletedCount} phim`,
        status: "success",
      });

      return deletedCount;
    } catch (error) {
      if (error.isOperational) throw error;
      logger.error("[Movie] Bulk force delete error:", error);
      throw createMovieError("Bulk force delete movies failed", 500, "MOVIE_BULK_FORCE_DELETE_ERR");
    }
  },

  async emptyTrash(userId = null) {
    try {
      const trashedMovies = await Movie.findAll({
        where: { deleted_at: { [Op.not]: null } },
        paranoid: false,
      });

      if (trashedMovies.length === 0) {
        return 0;
      }

      const ids = trashedMovies.map((m) => m.id);
      return await this.bulkForceDelete(ids, userId);
    } catch (error) {
      if (error.isOperational) throw error;
      logger.error("[Movie] Empty trash error:", error);
      throw createMovieError("Empty trash failed", 500, "MOVIE_EMPTY_TRASH_ERR");
    }
  },

  async syncEpisodeCount(movieId) {
    return await Episode.count({ where: { movie_id: movieId } });
  },

  async getHomeSections(userId = null) {
    try {
      const variant = userId ? "auth" : "guest";
      const cached = await movieCacheService.getHome(variant);
      if (cached.hit) return cached.data;

      const meta = {
        generatedAt: new Date().toISOString(),
        seed: homeConfigHelper.getDailySeed(),
        cacheTTL: homeConfigHelper.HOME_CONFIG_RULES.cache.defaultTTL,
        degraded: false,
      };

      const baseQuery = {
        where: { is_published: true },
        attributes: homeConfigHelper.buildLeanAttributes(),
        include: homeConfigHelper.buildLeanInclude(),
      };

      // 1. Prepare queries
      const queries = {};

      // Hero Query (fetch pool of 20)
      queries.hero = Movie.findAll({
        ...baseQuery,
        limit: homeConfigHelper.HOME_CONFIG_RULES.limits.heroPool,
        order: [["total_views", "DESC"]], // Proxy for trending pool
      });

      // Top Ranking Query (fetch pool of 30)
      queries.topRanking = Movie.findAll({
        ...baseQuery,
        limit: homeConfigHelper.HOME_CONFIG_RULES.limits.topRankingPool,
        order: [["total_views", "DESC"], ["rating_average", "DESC"]],
      });

      // Daily Watch Query (Personalization)
      let excludeMovieIds = [];
      if (userId) {
        try {
          const watched = await WatchHistory.findAll({
            where: { user_id: userId },
            attributes: ["movie_id"],
            limit: 50,
            order: [["updated_at", "DESC"]],
          });
          excludeMovieIds = watched.map(w => w.movie_id);
        } catch (error) {
          logger.warn("[MovieService] Failed to fetch watch history for personalization", { userId, error: error.message });
        }
      }

      const dailyWatchWhere = { ...baseQuery.where };
      if (excludeMovieIds.length > 0) {
        dailyWatchWhere.id = { [Op.notIn]: excludeMovieIds };
      }
      queries.dailyWatch = Movie.findAll({
        ...baseQuery,
        where: dailyWatchWhere,
        limit: homeConfigHelper.HOME_CONFIG_RULES.limits.dailyWatchPool,
        order: [["created_at", "DESC"]],
      });

      // Upcoming Query
      queries.upcoming = Movie.findAll({
        where: {
          ...baseQuery.where,
          ...homeConfigHelper.buildUpcomingWhere(),
        },
        attributes: baseQuery.attributes,
        include: baseQuery.include,
        limit: homeConfigHelper.HOME_CONFIG_RULES.limits.upcoming,
        order: [["release_date", "ASC"]],
      });

      // Theater Query
      queries.theater = Movie.findAll({
        ...baseQuery,
        include: [
          ...baseQuery.include,
          {
            model: Category,
            as: "category", // Assuming relation is set, we must inner join
            where: { slug: homeConfigHelper.THEATER_CATEGORY_SLUG },
            attributes: [],
            required: true,
          }
        ],
        limit: homeConfigHelper.HOME_CONFIG_RULES.limits.theater,
        order: [["release_date", "DESC"]],
      });

      // By Country Query
      queries.byCountryInfo = Country.findAll({
        where: { is_active: true },
        order: [["movies_count", "DESC"]],
        limit: homeConfigHelper.HOME_CONFIG_RULES.featuredCountriesCount,
        attributes: ["id", "name", "slug", "code", "flag_url"],
      });

      // 2. Execute parallel queries
      const queryNames = Object.keys(queries);
      const results = await Promise.allSettled(Object.values(queries));
      const sectionData = {};
      let allFailed = true;

      results.forEach((result, index) => {
        const name = queryNames[index];
        if (result.status === "fulfilled") {
          sectionData[name] = result.value;
          allFailed = false;
        } else {
          logger.error(`[MovieService] Failed to fetch section: ${name}`, { error: result.reason });
          sectionData[name] = [];
        }
      });

      if (allFailed) {
        meta.degraded = true;
        return {
          sections: homeConfigHelper.EMPTY_HOME_SECTIONS,
          meta,
        };
      }

      // 3. Resolve byCountry nested queries
      const byCountry = [];
      if (sectionData.byCountryInfo && sectionData.byCountryInfo.length > 0) {
        const countryQueries = sectionData.byCountryInfo.map(country => 
          Movie.findAll({
            ...baseQuery,
            where: { ...baseQuery.where, country_id: country.id },
            limit: homeConfigHelper.HOME_CONFIG_RULES.limits.perCountry,
            order: [["release_date", "DESC"]],
          })
        );
        const countryResults = await Promise.allSettled(countryQueries);
        
        countryResults.forEach((result, idx) => {
          if (result.status === "fulfilled") {
            byCountry.push({
              country: sectionData.byCountryInfo[idx],
              movies: result.value,
            });
          }
        });
      }

      // 4. Process and format sections
      let processedSections = {
        hero: sectionData.hero && sectionData.hero.length > 0 ? homeConfigHelper.selectDiverseHero(homeConfigHelper.sortByTrendingScore(sectionData.hero)) : [],
        topRanking: sectionData.topRanking && sectionData.topRanking.length > 0 ? homeConfigHelper.sortByTrendingScore(sectionData.topRanking).slice(0, homeConfigHelper.HOME_CONFIG_RULES.limits.topRanking) : [],
        dailyWatch: sectionData.dailyWatch && sectionData.dailyWatch.length > 0 ? homeConfigHelper.seededShuffle(sectionData.dailyWatch, meta.seed).slice(0, homeConfigHelper.HOME_CONFIG_RULES.limits.dailyWatch) : [],
        upcoming: sectionData.upcoming || [],
        theater: sectionData.theater || [],
      };

      // 5. Deduplicate
      processedSections = homeConfigHelper.dedupeAcrossSections(processedSections);
      
      // Filter out countries with no movies (do not dedupe against upper sections to allow hot movies to appear in their respective country categories)
      const finalByCountry = byCountry.filter(item => item.movies && item.movies.length > 0);

      // 6. Normalize
      const finalSections = {
        hero: homeConfigHelper.normalizeMovies(processedSections.hero),
        topRanking: homeConfigHelper.normalizeMovies(processedSections.topRanking),
        dailyWatch: homeConfigHelper.normalizeMovies(processedSections.dailyWatch),
        upcoming: homeConfigHelper.normalizeMovies(processedSections.upcoming),
        theater: homeConfigHelper.normalizeMovies(processedSections.theater),
        byCountry: finalByCountry.map(item => ({
          country: item.country,
          movies: homeConfigHelper.normalizeMovies(item.movies)
        })),
      };

      const responseData = { sections: finalSections, meta };
      
      // 7. Cache
      movieCacheService.setHome(variant, responseData).catch(() => {});
      
      return responseData;

    } catch (error) {
      logger.error("[MovieService] getHomeSections critical error:", error);
      return {
        sections: homeConfigHelper.EMPTY_HOME_SECTIONS,
        meta: {
          generatedAt: new Date().toISOString(),
          degraded: true,
        }
      };
    }
  },

  /**
   * Lấy dữ liệu Metadata gộp cho trang quản trị phim (Edit/Create Movie)
   * Sử dụng cơ chế Cache-first (Redis) với TTL 10 phút.
   * 
   * @returns {Promise<Object>} Object chứa danh sách genres, categories, countries, studios, actors, series
   */
  async getMetadata() {
    const cacheKey = "movies:metadata";
    try {
      // 1. Kiểm tra cache Redis
      const cached = await cacheHelper.get(cacheKey);
      if (cached) {
        logger.debug("[MovieService] Lấy metadata gộp từ Redis cache (Hit)");
        return cached;
      }
    } catch (cacheError) {
      logger.warn(`[MovieService] Lỗi đọc cache metadata: ${cacheError.message}`);
    }

    try {
      logger.info("[MovieService] Cache miss. Đang truy vấn database lấy metadata gộp...");

      // 2. Cache miss: Truy vấn song song tất cả các bảng dữ liệu tĩnh
      const [genres, categories, countries, studios, actors, series] = await Promise.all([
        Genre.findAll({
          order: [["name", "ASC"]],
        }),
        Category.findAll({
          order: [["order_num", "ASC"]],
        }),
        Country.findAll({
          order: [["name", "ASC"]],
        }),
        Studio.findAll({
          order: [["name", "ASC"]],
        }),
        Actor.findAll({
          limit: 50,
          order: [["popularity_score", "DESC"]],
        }),
        Series.findAll({
          limit: 50,
          order: [["name", "ASC"]],
        }),
      ]);

      const metadata = {
        genres,
        categories,
        countries,
        studios,
        actors,
        series,
      };

      // 3. Lưu vào cache Redis (TTL 10 phút = 600 giây)
      try {
        await cacheHelper.set(cacheKey, metadata, 600);
        logger.debug("[MovieService] Đã lưu metadata gộp vào Redis cache");
      } catch (cacheSaveError) {
        logger.warn(`[MovieService] Không thể lưu cache metadata: ${cacheSaveError.message}`);
      }

      return metadata;
    } catch (error) {
      logger.error("[MovieService] getMetadata error:", error);
      throw error;
    }
  }
};

export default movieService;
