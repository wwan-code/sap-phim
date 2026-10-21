/**
 * @file ai.validator.js
 * @module AI_Validator
 * @description Kiểm thực hợp nhất cho Module AI: Schema HTTP request (Joi) và Bộ kiểm định/làm sạch output từ LLM.
 */

import Joi from "joi";
import {
  AI_AUDIT_FLAGS,
  AI_KNOWN_MANGA_AUTHORS,
  AI_SOURCE_RELIABILITY_MATRIX,
  FIELD_CATEGORIES,
  boundedNumber,
  boundedSourceSynopsis,
  buildEvidenceFields,
  buildLocalizedSeo,
  cleanSourceText,
  fieldValuesEqual,
  localizedTitleObservations,
  normalizeTitle,
  selectSynopsisBasis,
  sourceIdentity,
  validateVietnameseSynopsis,
  validDate,
  validUrl,
} from "../helpers/ai-metadata.helper.js";

// ============================================================================
// 1. HTTP REQUEST VALIDATION SCHEMAS (Joi)
// ============================================================================

const title = Joi.string().trim().min(1).max(500).required();
const year = Joi.number().integer().min(1900).max(2100).allow(null, "").optional();
const target = Joi.object({ movieId: Joi.string().uuid().allow(null), draftId: Joi.string().uuid().allow(null) })
  .custom((value, helpers) => Boolean(value.movieId) === Boolean(value.draftId) ? helpers.error("any.invalid") : value);
const context = Joi.object({
  current_title: Joi.string().max(500).allow(""), romaji_title: Joi.string().max(500).allow(""),
  slug: Joi.string().max(500).allow(""), type: Joi.string().max(30).allow(""),
  release_date: Joi.string().max(30).allow(""), release_year: Joi.alternatives().try(Joi.string().max(4).allow(""), Joi.number().integer().min(1900).max(2100)),
  quality: Joi.string().max(30).allow(""), sub_dub_type: Joi.string().max(30).allow(""), source_type: Joi.string().max(50).allow(""),
  category_id: Joi.string().uuid().allow("", null), country_id: Joi.string().uuid().allow("", null), studio_id: Joi.string().uuid().allow("", null),
  genre_ids: Joi.array().items(Joi.string().uuid()).max(50),
  tmdb_id: Joi.number().integer().positive().allow(null, ""),
  mal_id: Joi.number().integer().positive().allow(null, ""),
  anilist_id: Joi.number().integer().positive().allow(null, ""),
  imdb_id: Joi.string().pattern(/^tt\d{7,12}$/).allow(null, ""),
}).default({});
const pagination = { page: Joi.number().integer().min(1).default(1), limit: Joi.number().integer().min(1).max(50).default(20) };

export const aiValidator = {
  resolve: Joi.object({ title, year, target, context, media_type: Joi.string().valid("all", "movie", "series", "tv", "ova", "ona", "special").default("all") }),
  suggest: Joi.object({
    title, year, target, requestId: Joi.string().uuid(), resolutionId: Joi.string().uuid(), candidateId: Joi.string().max(128),
    media_type: Joi.string().valid("all", "movie", "series", "tv", "ova", "ona", "special").default("all"),
    type: Joi.string().valid("all", "movie", "series", "metadata", "cast", "synopsis", "seo").default("all"),
    mode: Joi.string().valid("auto", "fast", "deep").default("auto"),
    force_refresh: Joi.boolean().default(false), enable_web_search: Joi.boolean().default(false), context,
  }).with("candidateId", "resolutionId"),
  jobId: Joi.object({ jobId: Joi.string().pattern(/^ai-[0-9a-f-]{36}$/i).required() }),
  list: Joi.object({ ...pagination, movieId: Joi.string().uuid(), draftId: Joi.string().uuid(), status: Joi.string().valid("queued", "processing", "completed", "failed", "cancelled") }).oxor("movieId", "draftId"),
  history: Joi.object(pagination),
  review: Joi.object({
    appliedFields: Joi.array().items(Joi.string().pattern(/^[a-z][a-z0-9_]{0,63}$/)).unique().max(100).required(),
    skippedCount: Joi.number().integer().min(0).max(100).required(),
    consideredCount: Joi.number().integer().min(0).max(100).required(),
  }),
};

// ============================================================================
// 2. LLM OUTPUT SANITIZER & VALIDATOR (AIOutputValidator)
// ============================================================================

const TITLE_TYPE_ORDER = ["default", "vietnamese", "romaji", "english", "native", "synonym"];
const TITLE_TYPES = new Set(TITLE_TYPE_ORDER);
const RELATIONSHIP_FIELDS = ["category_id", "country_id", "studio_id", "series_id"];

const text = (value, max = 255) => cleanSourceText(value, max);

const typedTitleObservations = (snapshot) => ["anilist", "jikan", "tmdb", "omdb"].flatMap((source) => {
  const record = snapshot[source];
  if (!record || snapshot.source_presence?.[source] === false) return [];
  const identity = sourceIdentity(source, record);
  const sourceId = identity.sourceIds[source === "jikan" ? "mal" : source === "omdb" ? "imdb" : source] || null;
  const typed = source === "anilist" ? [["native", record.title?.native], ["romaji", record.title?.romaji], ["english", record.title?.english]]
    : source === "jikan" ? [["native", record.title_japanese], ["english", record.title_english],
      ...(record.titles || []).map((item) => [({ Japanese: "native", English: "english" })[item?.type] || "synonym", item?.title])]
      : source === "tmdb" ? [["native", record.original_title || record.original_name]] : [];
  const observations = [...(source === "tmdb" ? localizedTitleObservations(snapshot) : []), ...typed.flatMap(([type, value]) => {
    const titleVal = text(value, 500);
    return titleVal ? [{ type, value: titleVal, source, sourceId }] : [];
  })];
  for (const alias of identity.titles) {
    const titleVal = text(alias, 500);
    if (titleVal && !observations.some((item) => normalizeTitle(item.value) === normalizeTitle(titleVal))) {
      observations.push({ type: "synonym", value: titleVal, source, sourceId });
    }
  }
  const seen = new Set();
  return observations.filter((item) => {
    const key = `${item.type}:${normalizeTitle(item.value)}`;
    if (seen.has(key)) return false;
    seen.add(key); return true;
  });
});

export class AIOutputValidator {
  normalizeName(value = "") { return normalizeTitle(value); }

  validateAndSanitize(rawData = {}, snapshot = {}, conflicts = []) {
    const raw = rawData && typeof rawData === "object" && !Array.isArray(rawData) ? rawData : {};
    const flags = [];
    const sanitized = {};
    const observations = buildEvidenceFields(snapshot);
    const provenance = {}, fieldEvidence = {};
    const category = (field) => FIELD_CATEGORIES[field] || "core_identifiers";
    const reliability = (field, source) => AI_SOURCE_RELIABILITY_MATRIX[source]?.[category(field)]
      ?? AI_SOURCE_RELIABILITY_MATRIX[source]?.default ?? 0;

    for (const [field, values] of Object.entries(observations)) {
      if (["actor_cast", "studio", "country", "genres", "description"].includes(field)) continue;
      const supported = values.find((item) => fieldValuesEqual(item.value, raw[field]));
      const vietnameseTitle = field === "title" ? localizedTitleObservations(snapshot).find((item) => item.type === "vietnamese") : null;
      const selected = vietnameseTitle || supported || [...values].sort((a, b) => reliability(field, b.source) - reliability(field, a.source))[0];
      sanitized[field] = selected.value;
      const matching = values.filter((item) => fieldValuesEqual(item.value, selected.value));
      provenance[field] = matching.map((item) => item.source).join(" + ");
      fieldEvidence[field] = matching;
      if (raw[field] != null && !supported) flags.push("UNSUPPORTED_FIELD_REMOVED");
    }

    const synopsisBasis = selectSynopsisBasis(snapshot);
    const translated = validateVietnameseSynopsis(raw.description, synopsisBasis, sanitized.title);
    const sourceFallback = synopsisBasis?.locale === "vi" ? boundedSourceSynopsis(synopsisBasis.value) : null;
    sanitized.description = translated || sourceFallback;
    if (sanitized.description) {
      const derived = sanitized.description !== synopsisBasis.value;
      provenance.description = derived ? `ai_translation (${synopsisBasis.source})` : synopsisBasis.source;
      if (!translated && derived) provenance.description = `source_excerpt (${synopsisBasis.source})`;
      fieldEvidence.description = [{ ...synopsisBasis, derived }];
    }
    if (!translated && synopsisBasis?.locale !== "vi") flags.push(AI_AUDIT_FLAGS.LOCALIZATION_INCOMPLETE);
    const titleObservations = typedTitleObservations(snapshot);
    const titleKey = (t, titleVal) => `${t}:${normalizeTitle(titleVal)}`;
    const observedTypes = new Set(titleObservations.map((item) => titleKey(item.type, item.value)));
    if (Array.isArray(raw.titles)) for (const item of raw.titles) {
      const allowed = item && TITLE_TYPES.has(item.type) && typeof item.title === "string"
        && (item.type === "default" ? normalizeTitle(item.title) === normalizeTitle(sanitized.title)
          : observedTypes.has(titleKey(item.type, item.title)));
      if (!allowed) flags.push("UNSUPPORTED_TITLE_TYPE_REMOVED");
    }
    const titles = sanitized.title ? [{ type: "default", title: sanitized.title }] : [];
    for (const type of TITLE_TYPE_ORDER.filter((role) => !["default", "synonym"].includes(role))) {
      const candidates = titleObservations.filter((item) => item.type === type);
      const preferredValue = type === "vietnamese" ? sanitized.title : type === "native" ? sanitized.original_title : null;
      const selected = candidates.find((item) => preferredValue && normalizeTitle(item.value) === normalizeTitle(preferredValue)) || candidates[0];
      if (selected) titles.push({ type, title: selected.value });
    }
    const mainNames = new Set(titles.map((item) => normalizeTitle(item.title)));
    const alias = titleObservations.find((item) => item.type === "synonym" && !mainNames.has(normalizeTitle(item.value)));
    if (alias) titles.push({ type: "synonym", title: alias.value });
    sanitized.titles = titles;
    if (sanitized.titles.length) {
      const selectedTitles = new Set(sanitized.titles.map((item) => titleKey(item.type, item.title)));
      fieldEvidence.titles = [
        ...(fieldEvidence.title || []).map((item) => ({ ...item, type: "default" })),
        ...titleObservations.filter((item) => selectedTitles.has(titleKey(item.type, item.value))),
      ];
      provenance.titles = [...new Set(fieldEvidence.titles.map((item) => item.source))].join(" + ");
    }
    if (sanitized.title) {
      sanitized.slug = sanitized.title.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
        .replace(/đ/g, "d").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      provenance.slug = "derived_title";
    }
    const genres = (observations.genres || []).flatMap((item) => item.value);
    Object.assign(sanitized, buildLocalizedSeo({ title: sanitized.title, titles: sanitized.titles, description: sanitized.description, genres }));
    if (sanitized.title) {
      provenance.meta_title = "derived_title";
      provenance.seo_keywords = "derived_source_names";
      fieldEvidence.meta_title = (fieldEvidence.title || []).map((item) => ({ ...item, derived: true }));
      fieldEvidence.seo_keywords = [...(fieldEvidence.titles || []), ...(observations.genres || [])].map((item) => ({ ...item, derived: true }));
    }
    if (sanitized.meta_description) {
      provenance.meta_description = "derived_synopsis";
      fieldEvidence.meta_description = (fieldEvidence.description || []).map((item) => ({ ...item, derived: true }));
    }

    for (const field of RELATIONSHIP_FIELDS) sanitized[field] = null;
    sanitized.genre_ids = [];
    sanitized.actor_cast = [];
    sanitized.suggested_entities = {};
    sanitized.quality = null;
    sanitized.sub_dub_type = null;
    sanitized.season_number = null;
    sanitized.is_published = false;
    sanitized.is_premium = false;

    for (const field of ["tmdb_id", "mal_id", "anilist_id"]) if (sanitized[field] != null) {
      sanitized[field] = boundedNumber(sanitized[field], 1, 2147483647);
    }
    if (sanitized.release_date != null) sanitized.release_date = validDate(sanitized.release_date);
    if (sanitized.release_year != null) sanitized.release_year = boundedNumber(sanitized.release_year, 1900, 2100);
    if (sanitized.imdb_rating != null) sanitized.imdb_rating = boundedNumber(sanitized.imdb_rating, 0, 10, false);
    if (sanitized.trailer_url != null) sanitized.trailer_url = validUrl(sanitized.trailer_url);
    if (sanitized.season && !["spring", "summer", "fall", "winter"].includes(String(sanitized.season).toLowerCase())) delete sanitized.season;

    if (typeof raw.release_date === "string" && /^\d{4}$/.test(raw.release_date) && !sanitized.release_year) {
      const yr = boundedNumber(raw.release_date, 1900, 2100);
      if (observations.release_year?.some((item) => item.value === yr)) sanitized.release_year = yr;
    }
    if (raw.release_date && !validDate(raw.release_date)) flags.push("INVALID_RELEASE_DATE");
    if (sanitized.type === "movie" && sanitized.total_episodes > 1) flags.push(AI_AUDIT_FLAGS.SUSPICIOUS_EPISODE_COUNT);
    const creators = [...AI_KNOWN_MANGA_AUTHORS, ...(snapshot.anilist?.staff || []).filter((item) => /original creator|story/i.test(item.role)).map((item) => item.name)];
    if (sanitized.director && creators.some((name) => normalizeTitle(name) === normalizeTitle(sanitized.director))) {
      flags.push(AI_AUDIT_FLAGS.POSSIBLE_DIRECTOR_AUTHOR_CONFUSION);
    }
    if (conflicts.some((conflict) => conflict.severity === "high" && conflict.resolution_verified !== true)) {
      flags.push(AI_AUDIT_FLAGS.SEVERE_UNRESOLVED_CONFLICT);
    }
    if (!Object.keys(observations).length) flags.push(AI_AUDIT_FLAGS.LOW_EVIDENCE_QUALITY);
    const reported = boundedNumber(raw.confidence_score, 0, 1, false);
    sanitized.confidence_score = reported;
    sanitized.field_provenance = provenance;
    sanitized.field_evidence = fieldEvidence;
    sanitized.field_provenance_reasoning = Object.fromEntries(conflicts.flatMap((conflict) =>
      typeof raw.field_provenance_reasoning?.[conflict.field] === "string"
        ? [[conflict.field, text(raw.field_provenance_reasoning[conflict.field], 1000)]] : []));
    return { sanitizedData: sanitized, flags: [...new Set(flags)] };
  }
}

export const aiOutputValidator = new AIOutputValidator();

export default {
  aiValidator,
  AIOutputValidator,
  aiOutputValidator,
};
