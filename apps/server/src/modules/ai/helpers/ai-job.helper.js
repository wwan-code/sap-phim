/**
 * @file ai-job.helper.js
 * @module AI_Job_Helper
 * @description Helper quản lý quyền truy cập AI (RBAC), tìm kiếm catalog DB nội bộ và cache key binding.
 */

import { createHash } from "node:crypto";
import { AppError } from "../../../utils/app-error.js";
import { foldSearchTitle, identityYear, normalizeMediaType } from "./ai-metadata.helper.js";

// ============================================================================
// 1. ACCESS CONTROL & JOB CONTRACT (from ai-job-policy)
// ============================================================================

export const ACTIVE_AI_STATUSES = ["queued", "processing"];
export const TERMINAL_AI_STATUSES = ["completed", "failed", "cancelled"];

/** Tạo lỗi nghiệp vụ có mã ổn định cho client. */
export const aiJobError = (message, statusCode, code) => {
  const error = new AppError(message, statusCode);
  error.code = code;
  return error;
};

export const hasAiPermission = (actor, permission) => {
  const roles = new Set(actor?.roles || []);
  const permissions = new Set(actor?.permissions || []);
  return roles.has("boss") || permissions.has(permission);
};

/** Từ chối truy cập nếu quyền quản trị hoặc quyền chỉnh sửa hiện tại đã bị thu hồi. */
export const assertAiAccess = (actor, options = {}) => {
  const { target = null, ownerId = null, manage = false } = options;
  const checkingOwner = Object.hasOwn(options, "ownerId");
  if (!actor?.id) throw aiJobError("Vui lòng đăng nhập.", 401, "UNAUTHENTICATED");
  if (!hasAiPermission(actor, "admin.access")) {
    throw aiJobError("Bạn không có quyền truy cập trợ lý quản trị.", 403, "AI_FORBIDDEN");
  }
  const isManager = hasAiPermission(actor, "ai.manage");
  if (manage && !isManager) throw aiJobError("Bạn không có quyền quản lý AI.", 403, "AI_FORBIDDEN");
  if (checkingOwner && (!ownerId || (ownerId !== actor.id && !isManager))) {
    throw aiJobError("Bạn không có quyền truy cập job AI này.", 403, "AI_FORBIDDEN");
  }
  if (isManager && (checkingOwner || manage)) return;
  const allowed = target?.movieId
    ? hasAiPermission(actor, "movies.edit")
    : target?.draftId
      ? hasAiPermission(actor, "movies.create")
      : hasAiPermission(actor, "movies.create") || hasAiPermission(actor, "movies.edit");
  if (!allowed) throw aiJobError("Bạn không có quyền dùng AI cho form phim này.", 403, "AI_FORBIDDEN");
};

/** Chỉ xuất trường công khai, không gửi prompt/context riêng tư qua Socket. */
export const toAiJobDto = (record) => {
  const job = record?.get ? record.get({ plain: true }) : record;
  return {
    jobId: job.job_id,
    requestId: job.request_id,
    ownerId: job.user_id,
    target: job.target,
    jobType: "ai",
    title: job.request_payload?.title || "",
    status: job.status,
    stage: job.stage,
    progress: job.progress,
    percent: job.progress,
    attempt: job.attempt,
    sequence: job.sequence,
    result: job.result || null,
    outputs: job.result || null,
    error: job.error || null,
    terminal: TERMINAL_AI_STATUSES.includes(job.status),
    createdAt: job.created_at || job.createdAt,
    updatedAt: job.updated_at || job.updatedAt,
  };
};

// ============================================================================
// 2. RESOLUTION BINDING (from resolution-binding.util)
// ============================================================================

const normalizedText = (value) => String(value ?? "").normalize("NFKC").trim().toLowerCase().replace(/\s+/g, " ");

/** Form values are search hints, never source evidence. Ignore presentation-only context. */
export const createResolutionBinding = (input, ownerId) => {
  const context = input.context || {};
  const identityHints = Object.fromEntries([
    "current_title", "romaji_title", "type", "release_year", "release_date",
    "tmdb_id", "mal_id", "anilist_id", "imdb_id",
  ].map((key) => [key, normalizedText(context[key])]));
  return createHash("sha256").update(JSON.stringify({
    version: 3,
    ownerId,
    title: normalizedText(input.title),
    year: input.year ? Number(input.year) : null,
    mediaType: input.media_type || "all",
    target: { movieId: input.target?.movieId || null, draftId: input.target?.draftId || null },
    identityHints,
  })).digest("hex");
};

// ============================================================================
// 3. MOVIE CATALOG LOOKUP (from movie-catalog.repository)
// ============================================================================

const ACCENTED = "àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ";
const FOLDED = "a".repeat(17) + "e".repeat(11) + "i".repeat(5) + "o".repeat(17) + "u".repeat(11) + "y".repeat(5) + "d";

export const createMovieCatalogLookup = ({ sequelize }) => async ({ title, year, mediaType = "all", target, signal }) => {
  const searchKey = foldSearchTitle(title);
  if (!searchKey) return { matches: [], truncated: false };
  signal?.throwIfAborted();
  const type = normalizeMediaType(mediaType);
  const rows = await sequelize.query(`
    SELECT id, titles, type, release_year, release_date, tmdb_id, mal_id, anilist_id, imdb_id
    FROM movies
    WHERE deleted_at IS NULL
      AND (:year IS NULL OR COALESCE(release_year, EXTRACT(YEAR FROM release_date)::int) = :year)
      AND (:mediaType IS NULL OR CASE WHEN type = 'tv' THEN 'series' ELSE type END = :mediaType)
      AND ((:movieId IS NOT NULL AND id = :movieId) OR EXISTS (
        SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(titles) = 'array' THEN titles ELSE '[]'::jsonb END) AS alias
        WHERE trim(regexp_replace(translate(regexp_replace(lower(alias->>'title'), '[\u0300-\u036f]', '', 'g'),
          :accented, :folded), '[^[:alnum:]]+', ' ', 'g')) = :searchKey
      ))
    ORDER BY id ASC
    LIMIT 11`, {
    replacements: {
      searchKey,
      year: year ? Number(year) : null,
      mediaType: type,
      movieId: target?.movieId || null,
      accented: ACCENTED,
      folded: FOLDED,
    },
    type: "SELECT",
    raw: true,
    retry: { max: 0 },
  });
  signal?.throwIfAborted();
  const matches = rows.filter((row) => Array.isArray(row.titles)
    && row.titles.some((alias) => foldSearchTitle(alias?.title) === searchKey)
    && (!year || identityYear(row.release_year || row.release_date) === Number(year))
    && (!type || normalizeMediaType(row.type) === type));
  return { matches: matches.slice(0, 10), truncated: rows.length > 10 };
};

export default {
  ACTIVE_AI_STATUSES,
  TERMINAL_AI_STATUSES,
  aiJobError,
  hasAiPermission,
  assertAiAccess,
  toAiJobDto,
  createResolutionBinding,
  createMovieCatalogLookup,
};
