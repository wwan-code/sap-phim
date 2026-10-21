/**
 * @file ai-metadata.helper.js
 * @module AI_Metadata_Helper
 * @description Tập hợp các hằng số và hàm tiện ích chuẩn hóa thực thể, danh mục, localization và identity phim.
 */

import crypto from "node:crypto";

// ============================================================================
// 1. CONSTANTS
// ============================================================================

export const AI_JOB_STATUS = {
  PENDING: "pending",
  PROCESSING: "processing",
  COMPLETED: "completed",
  FAILED: "failed",
  DLQ: "dlq",
};

export const AI_JOB_STAGES = {
  QUEUED: { stage: "QUEUED", progress: 0, message: "Đang xếp hàng đợi xử lý..." },
  EVIDENCE_COLLECTION: { stage: "EVIDENCE_COLLECTION", progress: 15, message: "Đang thu thập dữ liệu đa nguồn (TMDB, AniList, MAL, OMDb)..." },
  ENTITY_MATCHING: { stage: "ENTITY_MATCHING", progress: 35, message: "Đang đối soát quan hệ thực thể với cơ sở dữ liệu..." },
  LLM_REASONING: { stage: "LLM_REASONING", progress: 50, message: "Đang tổng hợp thông tin, phân giải xung đột và dịch thuật..." },
  SECONDARY_EVIDENCE_SEARCH: { stage: "SECONDARY_EVIDENCE_SEARCH", progress: 65, message: "Đang tìm kiếm bổ sung trên AniList, Jikan, TMDB bằng tên quốc tế..." },
  LLM_REFINEMENT: { stage: "LLM_REFINEMENT", progress: 75, message: "Đang tái tổng hợp và hoàn thiện dữ liệu với bằng chứng mới..." },
  SELF_AUDIT_VALIDATION: { stage: "SELF_AUDIT_VALIDATION", progress: 85, message: "Đang tự kiểm toán, chấm điểm tin cậy và gắn nhãn nguồn gốc..." },
  COMPLETED: { stage: "COMPLETED", progress: 100, message: "Hoàn tất xử lý dữ liệu AI thành công!" },
  FAILED: { stage: "FAILED", progress: 100, message: "Quá trình xử lý AI thất bại." },
};

export const AI_PROVIDERS = {
  GEMINI: "gemini",
  OPENROUTER: "openrouter",
};

export const PROMPT_VERSIONS = {
  MOVIE_SUGGESTION: "v2.1.1",
};

export const AI_CONFIDENCE_LEVELS = {
  HIGH: 0.85,
  MEDIUM: 0.70,
  LOW: 0.0,
};

export const AI_TOKEN_COST_ESTIMATES = {
  "gemini-2.5-flash": { promptPer1k: 0.000075, completionPer1k: 0.0003 },
  "gemini-1.5-flash": { promptPer1k: 0.000075, completionPer1k: 0.0003 },
  "minimax/minimax-m3:free": { promptPer1k: 0.0, completionPer1k: 0.0 },
  "nvidia/nemotron-3-ultra-550b-a55b:free": { promptPer1k: 0.0, completionPer1k: 0.0 },
  "z-ai/glm-5.2:free": { promptPer1k: 0.0, completionPer1k: 0.0 },
  "default": { promptPer1k: 0.0001, completionPer1k: 0.0004 },
};

export const AI_CACHE_TTL = {
  EVIDENCE_SECONDS: 86400,
  RESULT_SECONDS: 3600,
  IDEMPOTENCY_LOCK_SECONDS: 60,
  PERSON_ENRICHMENT_SECONDS: 604800,
  NEGATIVE_ENRICHMENT_SECONDS: 900,
};

export const AI_ENRICHMENT_LIMITS = {
  ACTOR_LIMIT: 10,
  DIRECTOR_LIMIT: 1,
  MAX_CONCURRENCY: 3,
  TIMEOUT_MS: 8000,
};

export const AI_SOURCE_RELIABILITY_MATRIX = {
  anilist: {
    core_identifiers: 0.95,
    media_specs: 0.95,
    synopsis: 0.85,
    people: 0.90,
    ratings: 0.80,
    taxonomies: 0.90,
    default: 0.85,
  },
  jikan: {
    core_identifiers: 0.90,
    media_specs: 0.90,
    synopsis: 0.90,
    people: 0.85,
    ratings: 0.85,
    taxonomies: 0.85,
    default: 0.85,
  },
  tmdb: {
    core_identifiers: 0.95,
    media_specs: 0.85,
    synopsis: 0.90,
    people: 0.95,
    ratings: 0.80,
    taxonomies: 0.85,
    default: 0.85,
  },
  omdb: {
    core_identifiers: 0.80,
    media_specs: 0.75,
    synopsis: 0.70,
    people: 0.80,
    ratings: 0.98,
    taxonomies: 0.70,
    default: 0.75,
  },
  web_search: {
    core_identifiers: 0.90,
    media_specs: 0.85,
    synopsis: 0.80,
    people: 0.80,
    ratings: 0.70,
    taxonomies: 0.80,
    default: 0.80,
  },
  ai_translation: {
    core_identifiers: 0.75,
    media_specs: 0.70,
    synopsis: 0.90,
    people: 0.65,
    ratings: 0.50,
    taxonomies: 0.75,
    default: 0.70,
  },
};

export const AI_KNOWN_MANGA_AUTHORS = [
  "Akira Toriyama", "Eiichiro Oda", "Masashi Kishimoto", "Hiromu Arakawa", "Hajime Isayama",
  "Gege Akutami", "Tatsuke Fujimoto", "Tatsuki Fujimoto", "Tite Kubo", "Koyoharu Gotouge",
  "ONE", "Yusuke Murata", "Rumiko Takahashi", "Gosho Aoyama", "Kentaro Miura",
  "Yoshihiro Togashi", "Naoko Takeuchi", "Takehiko Inoue", "Hirohiko Araki", "Sui Ishida",
  "Kohei Horikoshi", "Ken Wakui", "Aka Akasaka", "Mengo Yokoyari", "Tappei Nagatsuki",
  "Rifujin na Magonote", "Fuse", "Kumo Kagyu", "Chugong", "SIU", "Reiji Miyajima", "Negi Haruba",
];

export const AI_AUDIT_FLAGS = {
  LOCALIZATION_INCOMPLETE: "LOCALIZATION_INCOMPLETE",
  POSSIBLE_DIRECTOR_AUTHOR_CONFUSION: "POSSIBLE_DIRECTOR_AUTHOR_CONFUSION",
  INVALID_ENUM_FALLBACK: "INVALID_ENUM_FALLBACK",
  SEVERE_UNRESOLVED_CONFLICT: "SEVERE_UNRESOLVED_CONFLICT",
  LOW_EVIDENCE_QUALITY: "LOW_EVIDENCE_QUALITY",
  SUSPICIOUS_EPISODE_COUNT: "SUSPICIOUS_EPISODE_COUNT",
  DATE_FORMAT_CORRECTED: "DATE_FORMAT_CORRECTED",
  SECONDARY_SEARCH_ENRICHED: "SECONDARY_SEARCH_ENRICHED",
};

export const AI_RESEARCH_LIMITS = {
  MAX_EXTRA_LLM_CALLS_PER_JOB: 1,
  CONFLICT_CONFIDENCE_PENALTY_HIGH: 0.15,
  CONFLICT_CONFIDENCE_PENALTY_MEDIUM: 0.05,
};

export const FIELD_CATEGORIES = {
  title: "core_identifiers", original_title: "core_identifiers", release_year: "media_specs",
  release_date: "media_specs", type: "media_specs", status: "media_specs", total_episodes: "media_specs",
  duration: "media_specs", season: "media_specs", description: "synopsis", director: "people",
  actor_cast: "people", studio: "taxonomies", country: "taxonomies", genres: "taxonomies",
  imdb_rating: "ratings", age_rating: "media_specs",
};

export const TRACKED_FIELDS = [
  "title", "type", "release_year", "release_date", "description", "director", "duration",
  "total_episodes", "status", "studio",
];

export const generateAiCacheKey = ({
  title, year, type = "all", mode = "auto", enable_web_search = false,
  context = {}, ownerId = null, target = null, selectedCandidate = null,
}) => {
  const canonicalize = (value) => {
    if (Array.isArray(value)) return value.map(canonicalize);
    if (value && typeof value === 'object') {
      return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
    }
    return value ?? null;
  };
  const normalizedKey = JSON.stringify(canonicalize({
    version: 'v3-entity-review', prompt: PROMPT_VERSIONS.MOVIE_SUGGESTION,
    title: (title || '').normalize('NFKC').trim().toLowerCase().replace(/\s+/g, ' '),
    year: year || null, type, mode, enable_web_search, context, ownerId, target, selectedCandidate,
  }));
  const hash = crypto.createHash("sha256").update(normalizedKey).digest("hex");
  return {
    hash,
    resultCacheKey: `ai:v2:result:${hash}`,
    lockKey: `ai:v2:enqueue:${hash}`,
  };
};

// ============================================================================
// 2. IDENTITY UTILITIES
// ============================================================================

export const normalizeTitle = (value) => typeof value === "string"
  ? value.normalize("NFKC").toLocaleLowerCase().replace(/[\p{P}\p{S}\s]+/gu, " ").trim()
  : "";

export const foldSearchTitle = (value) => normalizeTitle(value).normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d");

export const titleSearchRank = (candidate, title) => {
  const query = normalizeTitle(title), folded = foldSearchTitle(title);
  if (!query) return 0;
  const aliases = [candidate.title, ...(candidate.titles || [])].filter((value) => typeof value === "string");
  if (aliases.some((alias) => normalizeTitle(alias) === query)) return 3;
  if (aliases.some((alias) => foldSearchTitle(alias) === folded)) return 2;
  const tokens = folded.split(" ");
  return aliases.some((alias) => tokens.every((token) => foldSearchTitle(alias).split(" ").includes(token))) ? 1 : 0;
};

export const rankSearchCandidates = (candidates, title) => [...candidates]
  .sort((left, right) => titleSearchRank(right, title) - titleSearchRank(left, title));

export const normalizeMediaType = (value) => {
  const format = String(value || "").toLowerCase().replace(/_/g, " ");
  if (["tv", "tv short", "series", "miniseries"].includes(format)) return "series";
  if (["movie", "film"].includes(format)) return "movie";
  if (["ova", "ona", "special"].includes(format)) return format;
  return null;
};

export const identityYear = (value) => {
  const year = Number(String(value ?? "").match(/^\d{4}/)?.[0]);
  return Number.isInteger(year) && year >= 1888 && year <= 2200 ? year : null;
};

export const sourceIdentity = (source, data = {}) => {
  const titles = source === "anilist"
    ? [...Object.values(data.title || {}), ...(data.synonyms || [])]
    : [data.title, data.name, data.original_title, data.original_name, data.title_english,
      data.title_japanese, ...(data.titles || []).map((item) => typeof item === "string" ? item : item?.title),
      ...(data.localized_titles || []).map((item) => item?.title)];
  const ids = {
    tmdb: source === "tmdb" ? data.id : undefined,
    anilist: source === "anilist" ? data.id : undefined,
    mal: source === "jikan" ? data.mal_id : data.idMal,
    imdb: data.imdb_id || data.imdbID || data.external_ids?.imdb_id,
  };
  const sourceIds = Object.fromEntries(Object.entries(ids).filter(([key, id]) => key === "imdb"
    ? /^tt\d{5,12}$/.test(id)
    : id != null && id !== "" && Number.isSafeInteger(Number(id)) && Number(id) > 0 && Number(id) <= 2147483647)
    .map(([key, id]) => [key, key === "imdb" ? id : Number(id)]));
  const mediaType = normalizeMediaType(data.media_type || data.format || data.type || data.Type);
  const year = identityYear(data.release_date || data.first_air_date || data.seasonYear ||
    data.year || data.Year || data.aired?.from || data.startDate?.year);
  const uniqueTitles = [...new Set(titles.filter((item) => typeof item === "string" && item.trim()).map((item) => item.trim()))];
  return {
    title: uniqueTitles[0] || "", titles: uniqueTitles, year, mediaType, sourceIds, sources: [source],
    isAnimation: ["anilist", "jikan"].includes(source) ? true : source === "tmdb"
      ? Boolean(data.is_animation ?? ((data.genre_ids || []).includes(16) || (data.genres || []).some((genre) => /animation|hoạt hình/i.test(genre?.name || genre))))
      : undefined,
    imageUrl: [data.poster_path, data.cover_image, data.image_url, data.Poster].find((value) => typeof value === "string" && /^https?:\/\//.test(value)) || null,
  };
};

export const sameWork = (left = {}, right = {}) => {
  const leftIds = left.sourceIds || {};
  const rightIds = right.sourceIds || {};
  const shared = Object.keys(leftIds).filter((key) => rightIds[key] != null);
  if (shared.some((key) => String(leftIds[key]) !== String(rightIds[key]))) return false;
  if (shared.length > 0) {
    return !(shared.includes("tmdb") && left.mediaType && right.mediaType && left.mediaType !== right.mediaType);
  }
  if (left.isAnimation != null && right.isAnimation != null && left.isAnimation !== right.isAnimation) return false;
  if (!left.year || !right.year || Number(left.year) !== Number(right.year)) return false;
  if (!left.mediaType || !right.mediaType || left.mediaType !== right.mediaType) return false;
  const aliases = new Set([left.title, ...(left.titles || [])].map(normalizeTitle).filter(Boolean));
  return [right.title, ...(right.titles || [])].some((title) => aliases.has(normalizeTitle(title)));
};

export const candidateFingerprint = (candidate) => crypto.createHash("sha256")
  .update(JSON.stringify({ ids: Object.entries(candidate.sourceIds || {}).sort(), type: candidate.mediaType }))
  .digest("hex").slice(0, 32);

export const groupCandidates = (candidates = []) => {
  const groups = [];
  for (const candidate of candidates) {
    if (!candidate.title || !Object.keys(candidate.sourceIds || {}).length) continue;
    const existing = groups.find((group) => sameWork(group, candidate));
    if (existing) {
      existing.titles = [...new Set([...existing.titles, ...candidate.titles])];
      existing.sourceIds = { ...existing.sourceIds, ...candidate.sourceIds };
      existing.sources = [...new Set([...existing.sources, ...candidate.sources])];
      existing.imageUrl ||= candidate.imageUrl;
      existing.isAnimation ??= candidate.isAnimation;
    } else groups.push({ ...candidate, titles: [...candidate.titles], sourceIds: { ...candidate.sourceIds } });
  }
  return groups.map((candidate) => ({ ...candidate, candidateId: candidateFingerprint(candidate) }));
};

export const selectUnambiguousCandidate = (candidates, { title, year, mediaType }) => {
  const normalized = normalizeTitle(title);
  const eligible = candidates.filter((candidate) => candidate.year && candidate.mediaType
    && (!year || Number(year) === candidate.year)
    && (!normalizeMediaType(mediaType) || normalizeMediaType(mediaType) === candidate.mediaType));
  const matches = eligible.filter((candidate) => titleSearchRank(candidate, title) >=
    (normalized !== foldSearchTitle(title) && eligible.some((item) => titleSearchRank(item, title) === 3) ? 3 : 2));
  return matches.length === 1 ? matches[0] : null;
};

// ============================================================================
// 3. LOCALIZATION & EDITORIAL UTILITIES
// ============================================================================

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
const VI_LETTERS = /[ăâđêôơư\u1ea0-\u1ef9]/iu;
const VI_WORDS = new Set(["và", "của", "một", "những", "trong", "khi", "với", "là", "được", "để", "không", "trên", "cùng", "các", "đã", "này", "người", "cuộc"]);
const PLACEHOLDER = /^(?:n\/?a|none|null|tba|unknown|no (?:overview|synopsis|description)(?: available)?[.!]?|chưa có (?:nội dung|tóm tắt))[.!]?$/iu;

export const cleanSourceText = (value, max = 20000) => {
  if (typeof value !== "string") return null;
  const decoded = value.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (entity, code) => {
    if (code[0] !== "#") return ENTITIES[code.toLowerCase()] ?? entity;
    const point = Number.parseInt(code.slice(/^#x/i.test(code) ? 2 : 1), /^#x/i.test(code) ? 16 : 10);
    return point > 0 && point <= 0x10ffff && !(point >= 0xd800 && point <= 0xdfff) ? String.fromCodePoint(point) : "";
  });
  const plain = decoded.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?\s*>|<\/p>/gi, " ").replace(/<[^>]*>/g, " ")
    .replace(/\[(?:Written by|Source:)[\s\S]*?\]\s*$/gi, "")
    .replace(/\(Source:[^)]*\)\s*$/gi, "")
    .normalize("NFC").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .replace(/\s+/gu, " ").trim().slice(0, max).trim();
  return plain && !PLACEHOLDER.test(plain) ? plain : null;
};

export const synopsisWordCount = (value) => String(value || "").trim().split(/\s+/u).filter(Boolean).length;
const admitted = (snapshot, source) => snapshot[source] && snapshot.source_presence?.[source] !== false;
const translations = (record = {}) => Array.isArray(record.translations?.translations) ? record.translations.translations
  : Array.isArray(record.translations) ? record.translations : [];

export const localizedTitleObservations = (snapshot = {}) => {
  if (!admitted(snapshot, "tmdb")) return [];
  const record = snapshot.tmdb;
  const values = [
    ...(record.localized_titles || []).filter((item) => typeof item?.language === "string" && ["vi", "en", record.original_language].includes(item.language))
      .map((item) => ({ type: item.language === "vi" ? "vietnamese" : item.language === "en" ? "english" : "native", value: item.title, locale: item.language })),
    ...translations(record).flatMap((item) => {
      const type = item.iso_639_1 === "vi" ? "vietnamese" : item.iso_639_1 === "en" ? "english" : null;
      return type ? [{ type, value: item.data?.title || item.data?.name, locale: item.iso_639_1 }] : [];
    }),
    ...(record.original_language === "vi" ? [{ type: "vietnamese", value: record.original_title || record.original_name, locale: "vi" }] : []),
  ];
  const seen = new Set();
  return values.flatMap((item) => {
    const value = cleanSourceText(item.value, 500), key = `${item.type}:${normalizeTitle(value)}`;
    if (!value || seen.has(key)) return [];
    seen.add(key);
    return [{ ...item, value, source: "tmdb", sourceId: record.id ?? null }];
  });
};

export const selectSynopsisBasis = (snapshot = {}) => {
  const choices = [];
  const add = (source, sourceId, value, locale, rank) => {
    const text = cleanSourceText(value);
    if (text) choices.push({ source, sourceId: sourceId ?? null, value: text, locale, rank });
  };
  if (admitted(snapshot, "tmdb")) {
    const record = snapshot.tmdb;
    for (const item of translations(record)) if (["vi", "en"].includes(item.iso_639_1)) {
      add("tmdb", record.id, item.data?.overview, item.iso_639_1, item.iso_639_1 === "vi" ? 0 : 2);
    }
    for (const item of record.localized_overviews || []) if (["vi", "en"].includes(item?.language)) {
      add("tmdb", record.id, item.text, item.language, item.language === "vi" ? 0 : 2);
    }
    add("tmdb", record.id, record.overview, "und", 2);
  }
  if (admitted(snapshot, "jikan")) add("jikan", snapshot.jikan.mal_id, snapshot.jikan.synopsis, "en", 1);
  if (admitted(snapshot, "anilist")) add("anilist", snapshot.anilist.id, snapshot.anilist.description, "en", 3);
  if (admitted(snapshot, "omdb")) add("omdb", snapshot.omdb.imdb_id, snapshot.omdb.plot, "en", 4);
  const selected = choices.sort((left, right) => left.rank - right.rank)[0];
  if (!selected) return null;
  const { rank, ...basis } = selected;
  return basis;
};

export const validateVietnameseSynopsis = (raw, basis, title = "") => {
  if (!basis || typeof raw !== "string") return null;
  if (/<[^>]+>|https?:\/\/|(?:^|\n)\s*(?:#{1,6}|```)|as an ai|tôi là (?:một )?(?:trợ lý|ai)|dưới đây là/iu.test(raw)) return null;
  const value = cleanSourceText(raw);
  if (!value || synopsisWordCount(value) > 150) return null;
  if (basis.locale !== "vi" && normalizeTitle(value) === normalizeTitle(basis.value)) return null;
  const words = value.toLocaleLowerCase("vi").match(/[\p{L}\p{M}]+/gu) || [];
  if (!VI_LETTERS.test(value) || (words.length >= 20 && words.filter((word) => VI_WORDS.has(word)).length < 2)) return null;
  const allowedNumbers = new Set(`${basis.value} ${title}`.match(/\d+(?:[.,]\d+)*/g) || []);
  if ((value.match(/\d+(?:[.,]\d+)*/g) || []).some((number) => !allowedNumbers.has(number))) return null;
  return value;
};

export const boundedSourceSynopsis = (value, maxWords = 150) => {
  const text = cleanSourceText(value);
  if (!text) return null;
  const words = text.split(/\s+/u);
  if (words.length <= maxWords) return text;
  const truncated = words.slice(0, maxWords).join(" ");
  const sentence = truncated.replace(/[,;:\s-]+$/u, "").match(/^[\s\S]*[.!?]/u)?.[0];
  return sentence && sentence.split(/\s+/u).length >= 40 ? sentence : `${truncated.trim()}...`;
};

export const buildLocalizedSeo = ({ title, titles = [], releaseYear, description }) => {
  const primaryTitle = titles.find((item) => item.type === "vietnamese")?.title
    || titles.find((item) => item.type === "default")?.title || title || "";
  const originalTitle = titles.find((item) => ["english", "romaji", "native"].includes(item.type))?.title || null;
  const titleSegment = primaryTitle && originalTitle && normalizeTitle(primaryTitle) !== normalizeTitle(originalTitle)
    ? `${primaryTitle} (${originalTitle})` : primaryTitle;
  const metaTitle = [titleSegment, releaseYear, "Xem Phim Online | Sạp Phim"].filter(Boolean).join(" - ").slice(0, 160);
  const basis = cleanSourceText(description) || "";
  const metaDescription = basis ? boundedSourceSynopsis(basis, 35).slice(0, 255) : null;
  const keywords = [...new Set([
    primaryTitle, originalTitle, ...titles.map((item) => item.title),
    primaryTitle && releaseYear ? `${primaryTitle} ${releaseYear}` : null,
    primaryTitle ? `xem phim ${primaryTitle}` : null,
  ].filter((item) => typeof item === "string" && item.trim()).map((item) => item.trim()))].slice(0, 15);
  return { meta_title: metaTitle || null, meta_description: metaDescription, seo_keywords: keywords };
};

// ============================================================================
// 4. EVIDENCE FIELDS UTILITIES
// ============================================================================

export const boundedNumber = (value, min, max, integer = true) => {
  if (value == null || value === "" || typeof value === "boolean") return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= min && number <= max && (!integer || Number.isInteger(number)) ? number : null;
};

export const validDate = (value) => {
  if (typeof value !== "string") return null;
  const match = value.trim().match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:T.*)?$/);
  if (!match) return null;
  const [, rawYear, rawMonth, rawDay] = match;
  const year = Number(rawYear), month = Number(rawMonth), day = Number(rawDay);
  if (year < 1900 || year > 2100) return null;
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() + 1 !== month || parsed.getUTCDate() !== day) return null;
  return `${rawYear}-${rawMonth.padStart(2, "0")}-${rawDay.padStart(2, "0")}`;
};

export const validUrl = (value) => {
  if (typeof value !== "string" || value.length > 4096) return null;
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch { return null; }
};

const omdbDate = (value) => {
  const match = String(value || "").match(/^(\d{1,2}) ([A-Z][a-z]{2}) (\d{4})$/);
  if (!match) return null;
  const month = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].indexOf(match[2]) + 1;
  return month ? validDate(`${match[3]}-${month}-${match[1]}`) : null;
};

export const normalizeStatus = (value) => ({
  FINISHED: "completed", "FINISHED AIRING": "completed", ENDED: "completed", RELEASED: "completed",
  RELEASING: "ongoing", "CURRENTLY AIRING": "ongoing", "RETURNING SERIES": "ongoing", "IN PRODUCTION": "upcoming",
  NOT_YET_RELEASED: "upcoming", "NOT YET AIRED": "upcoming", PLANNED: "upcoming", "POST PRODUCTION": "upcoming",
  CANCELLED: "cancelled", CANCELED: "cancelled", HIATUS: "hiatus", "ON HIATUS": "hiatus",
})[String(value || "").trim().toUpperCase()] || null;

export const fieldValuesEqual = (left, right) => {
  if (left === right) return true;
  if (left == null || right == null) return false;
  if (Array.isArray(left) && Array.isArray(right)) {
    return left.length === right.length && left.every((item, index) => fieldValuesEqual(item, right[index]));
  }
  if (Number.isFinite(Number(left)) && Number.isFinite(Number(right))) return Number(left) === Number(right);
  return normalizeTitle(String(left)) === normalizeTitle(String(right));
};

export const buildEvidenceFields = (snapshot = {}) => {
  const fields = {};
  const add = (field, source, value, sourceId = null) => {
    if (value == null || value === "" || (Array.isArray(value) && !value.length)) return;
    fields[field] ||= [];
    fields[field].push({ source, sourceId, value });
  };
  if (admitted(snapshot, "tmdb")) {
    const record = snapshot.tmdb, id = record.id;
    add("title", "tmdb", cleanSourceText(record.title || record.name, 500), id);
    add("original_title", "tmdb", cleanSourceText(record.original_title || record.original_name, 500), id);
    add("type", "tmdb", normalizeMediaType(record.media_type), id);
    add("status", "tmdb", normalizeStatus(record.status), id);
    add("release_date", "tmdb", validDate(record.release_date || record.first_air_date), id);
    add("release_year", "tmdb", identityYear(record.release_date || record.first_air_date), id);
    add("total_episodes", "tmdb", boundedNumber(record.number_of_episodes, 1, 5000), id);
    add("duration", "tmdb", boundedNumber(record.runtime || record.episode_run_time?.[0], 1, 600), id);
    add("description", "tmdb", cleanSourceText(record.overview), id);
    add("director", "tmdb", cleanSourceText((record.credits?.crew || []).find((p) => p.job === "Director")?.name, 255), id);
    for (const name of (record.production_companies || []).map((c) => cleanSourceText(c?.name, 255)).filter(Boolean)) add("studio", "tmdb", name, id);
    for (const genre of (record.genres || []).map((g) => cleanSourceText(g?.name, 100)).filter(Boolean)) add("genres", "tmdb", genre, id);
    for (const country of (record.production_countries || []).map((c) => c?.iso_3166_1).filter(Boolean)) add("country", "tmdb", country, id);
    add("trailer_url", "tmdb", validUrl((record.videos?.results || []).find((v) => v.site === "YouTube" && v.type === "Trailer")?.key ? `https://www.youtube.com/watch?v=${(record.videos.results.find((v) => v.site === "YouTube" && v.type === "Trailer")).key}` : null), id);
  }
  if (admitted(snapshot, "anilist")) {
    const record = snapshot.anilist, id = record.id;
    add("title", "anilist", cleanSourceText(record.title?.romaji || record.title?.english, 500), id);
    add("original_title", "anilist", cleanSourceText(record.title?.native, 500), id);
    add("type", "anilist", normalizeMediaType(record.format), id);
    add("status", "anilist", normalizeStatus(record.status), id);
    const date = record.startDate?.year && record.startDate?.month && record.startDate?.day
      ? validDate(`${record.startDate.year}-${record.startDate.month}-${record.startDate.day}`) : null;
    add("release_date", "anilist", date, id);
    add("release_year", "anilist", identityYear(record.startDate?.year || record.seasonYear), id);
    add("total_episodes", "anilist", boundedNumber(record.episodes, 1, 5000), id);
    add("duration", "anilist", boundedNumber(record.duration, 1, 600), id);
    add("season", "anilist", (["WINTER", "SPRING", "SUMMER", "FALL"].includes(record.season) ? record.season.toLowerCase() : null), id);
    add("description", "anilist", cleanSourceText(record.description), id);
    add("source_type", "anilist", (record.source || "").toLowerCase().replace(/_/g, " "), id);
    const studio = record.studios?.nodes?.find((s) => s.isAnimationStudio)?.name || record.studios?.nodes?.[0]?.name;
    add("studio", "anilist", cleanSourceText(studio, 255), id);
    for (const genre of (record.genres || []).map((g) => cleanSourceText(g, 100)).filter(Boolean)) add("genres", "anilist", genre, id);
    add("country", "anilist", record.countryOfOrigin, id);
    add("director", "anilist", cleanSourceText(record.staff?.edges?.find((e) => /director/i.test(e.role || ""))?.node?.name?.full, 255), id);
  }
  if (admitted(snapshot, "jikan")) {
    const record = snapshot.jikan, id = record.mal_id;
    add("title", "jikan", cleanSourceText(record.title, 500), id);
    add("original_title", "jikan", cleanSourceText(record.title_japanese, 500), id);
    add("type", "jikan", normalizeMediaType(record.type), id);
    add("status", "jikan", normalizeStatus(record.status), id);
    add("release_date", "jikan", validDate(record.aired?.from), id);
    add("release_year", "jikan", identityYear(record.aired?.from || record.year), id);
    add("total_episodes", "jikan", boundedNumber(record.episodes, 1, 5000), id);
    add("duration", "jikan", boundedNumber(record.duration?.match(/^(\d+)\s*min/)?.[1], 1, 600), id);
    add("season", "jikan", (["winter", "spring", "summer", "fall"].includes(record.season) ? record.season : null), id);
    add("description", "jikan", cleanSourceText(record.synopsis), id);
    add("source_type", "jikan", (record.source || "").toLowerCase().replace(/_/g, " "), id);
    add("studio", "jikan", cleanSourceText(record.studios?.[0]?.name, 255), id);
    for (const genre of (record.genres || []).map((g) => cleanSourceText(g?.name, 100)).filter(Boolean)) add("genres", "jikan", genre, id);
    add("age_rating", "jikan", cleanSourceText(record.rating, 100), id);
  }
  if (admitted(snapshot, "omdb")) {
    const record = snapshot.omdb, id = record.imdb_id;
    add("title", "omdb", cleanSourceText(record.title, 500), id);
    add("type", "omdb", normalizeMediaType(record.type), id);
    add("release_date", "omdb", omdbDate(record.released), id);
    add("release_year", "omdb", identityYear(record.year), id);
    add("duration", "omdb", boundedNumber(String(record.runtime || "").match(/^(\d+)\s*min/i)?.[1], 1, 600), id);
    add("total_episodes", "omdb", boundedNumber(record.total_seasons, 1, 100), id);
    const omdbDirector = Array.isArray(record.director) ? record.director[0] : typeof record.director === "string" ? record.director.split(",")?.[0] : null;
    add("director", "omdb", cleanSourceText(omdbDirector, 255), id);
    const omdbGenres = Array.isArray(record.genre) ? record.genre : typeof record.genre === "string" ? record.genre.split(",") : [];
    for (const genre of omdbGenres.map((g) => cleanSourceText(g, 100)).filter(Boolean)) add("genres", "omdb", genre, id);
    add("imdb_rating", "omdb", boundedNumber(record.imdb_rating, 0, 10, false), id);
    add("description", "omdb", cleanSourceText(record.plot), id);
  }
  return fields;
};

export const extractVisualAssets = (snapshot = {}) => {
  const assets = { posters: [], covers: [], banners: [] };
  const add = (kind, url, source, isPrimary = false, extra = {}) => {
    const valid = validUrl(url);
    if (!valid || assets[kind].some((item) => item.url === valid)) return;
    assets[kind].push({ url: valid, source, is_primary: isPrimary, ...extra });
  };
  if (admitted(snapshot, "tmdb")) {
    const record = snapshot.tmdb;
    if (record.poster_path) add("posters", `https://image.tmdb.org/t/p/original${record.poster_path}`, "tmdb", true, { aspect_ratio: "2:3" });
    if (record.backdrop_path) add("banners", `https://image.tmdb.org/t/p/original${record.backdrop_path}`, "tmdb", true, { aspect_ratio: "16:9" });
  }
  if (admitted(snapshot, "anilist")) {
    const record = snapshot.anilist;
    const cover = record.coverImage?.extraLarge || record.coverImage?.large;
    if (cover) add("posters", cover, "anilist", !assets.posters.length, { aspect_ratio: "2:3" });
    if (record.bannerImage) add("banners", record.bannerImage, "anilist", !assets.banners.length, { aspect_ratio: "16:9" });
  }
  if (admitted(snapshot, "jikan")) {
    const record = snapshot.jikan;
    const img = record.images?.webp?.large_image_url || record.images?.jpg?.large_image_url;
    if (img) add("posters", img, "jikan", !assets.posters.length, { aspect_ratio: "2:3" });
  }
  if (admitted(snapshot, "omdb")) {
    const record = snapshot.omdb;
    if (record.poster && record.poster !== "N/A") add("posters", record.poster, "omdb", !assets.posters.length, { aspect_ratio: "2:3" });
  }
  return assets;
};

// ============================================================================
// 5. TAXONOMY MATCHING UTILITIES
// ============================================================================

export const normalizeTaxonomyName = (value) => normalizeTitle(String(value || "").normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "").replace(/[đĐ]/g, "d"));

const GENRE_GROUPS = [
  ["action", "Hành Động"], ["adventure", "Phiêu Lưu"], ["animation", "Phim Hoạt Hình", "Hoạt Hình", "anime"],
  ["comedy", "Hài", "Hài Hước"], ["crime", "Tội Phạm"], ["documentary", "Tài Liệu"],
  ["drama", "Kịch Tính", "Chính Kịch", "Tâm Lý / Chính Kịch"], ["family", "Gia Đình"],
  ["psychological", "Tâm Lý"],
  ["fantasy", "Kỳ Ảo"], ["history", "Lịch Sử"], ["horror", "Kinh Dị"], ["music", "Nhạc", "Âm Nhạc"],
  ["mystery", "Trinh Thám", "Bí Ẩn"], ["romance", "Lãng Mạn", "Lãng Mạn / Tình Cảm", "Tình Cảm"],
  ["sci-fi", "science fiction", "Viễn Tưởng", "Khoa Học Viễn Tưởng"], ["supernatural", "Siêu Nhiên"],
  ["thriller", "Gây Cấn"], ["war", "Chiến Tranh"], ["western", "Viễn Tây"],
  ["slice of life", "Đời Thường"], ["shounen", "Thiếu Niên / Shounen"],
  ["isekai", "Thế Giới Khác", "Chuyển Sinh / Isekai"], ["mecha", "Robot / Mecha"],
  ["sports", "Thể Thao"], ["martial arts", "Võ Thuật"], ["school", "Học Đường"], ["magic", "Phép Thuật"],
];

const COUNTRY_GROUPS = {
  JP: ["JP", "JPN", "Japan", "Japanese", "Nhật Bản"],
  KR: ["KR", "KOR", "South Korea", "Republic of Korea", "Hàn Quốc"],
  CN: ["CN", "CHN", "China", "People's Republic of China", "Trung Quốc"],
  US: ["US", "USA", "United States", "United States of America", "Hoa Kỳ", "Mỹ"],
  VN: ["VN", "VNM", "Vietnam", "Viet Nam", "Việt Nam"],
  TW: ["TW", "TWN", "Taiwan", "Đài Loan"],
};

const uniqueRow = (rows) => {
  const ids = new Set(rows.map((row) => row.id));
  return ids.size === 1 ? rows[0] : null;
};

export const matchGenreEvidence = (raw, rows = []) => {
  if (typeof raw !== "string" || !raw.trim()) return null;
  const genreName = (value) => normalizeTaxonomyName(value).replace(/^phim\s+/u, "");
  const key = genreName(raw);
  const exact = rows.filter((row) => [row.name, row.slug].some((value) => value && genreName(value) === key));
  if (exact.length) return uniqueRow(exact);
  const group = GENRE_GROUPS.find((names) => names.some((name) => genreName(name) === key));
  if (!group) return null;
  const names = new Set(group.map(genreName));
  return uniqueRow(rows.filter((row) => [row.name, row.slug].some((value) => value && names.has(genreName(value)))));
};

export const matchCountryEvidence = (raw, rows = []) => {
  if (typeof raw !== "string" || !raw.trim()) return null;
  const key = normalizeTaxonomyName(raw);
  const code = Object.entries(COUNTRY_GROUPS).find(([, names]) => names.some((name) => normalizeTaxonomyName(name) === key))?.[0]
    || (/^[a-z]{2}$/i.test(raw.trim()) ? raw.trim().toUpperCase() : null);
  if (code) {
    const coded = rows.filter((row) => typeof row.code === "string" && row.code.toUpperCase() === code);
    if (coded.length) return uniqueRow(coded);
  }
  const aliases = new Set([key, ...(COUNTRY_GROUPS[code] || []).map(normalizeTaxonomyName)]);
  return uniqueRow(rows.filter((row) => [row.name, row.slug, row.code].some((value) => value && aliases.has(normalizeTaxonomyName(value)))));
};

export default {
  AI_JOB_STATUS, AI_JOB_STAGES, AI_PROVIDERS, PROMPT_VERSIONS, AI_CONFIDENCE_LEVELS,
  AI_TOKEN_COST_ESTIMATES, AI_CACHE_TTL, AI_ENRICHMENT_LIMITS, AI_SOURCE_RELIABILITY_MATRIX,
  AI_KNOWN_MANGA_AUTHORS, AI_AUDIT_FLAGS, AI_RESEARCH_LIMITS, FIELD_CATEGORIES, TRACKED_FIELDS,
  generateAiCacheKey, normalizeTitle, foldSearchTitle, titleSearchRank, rankSearchCandidates,
  normalizeMediaType, identityYear, sourceIdentity, sameWork, candidateFingerprint, groupCandidates,
  selectUnambiguousCandidate, cleanSourceText, synopsisWordCount, localizedTitleObservations,
  selectSynopsisBasis, validateVietnameseSynopsis, boundedSourceSynopsis, buildLocalizedSeo,
  boundedNumber, validDate, validUrl, normalizeStatus, fieldValuesEqual, buildEvidenceFields,
  extractVisualAssets, normalizeTaxonomyName, matchGenreEvidence, matchCountryEvidence,
};
