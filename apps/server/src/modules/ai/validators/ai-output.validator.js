/**
 * @file ai-output.validator.js
 * @module AI_Output_Validator
 * @description Validate synthesis against observed source values and strip untrusted IDs and relationships.
 */

import { AI_KNOWN_MANGA_AUTHORS, AI_AUDIT_FLAGS, AI_SOURCE_RELIABILITY_MATRIX } from "../constants/ai.constants.js";
import { buildEvidenceFields, FIELD_CATEGORIES, fieldValuesEqual, boundedNumber, validDate, validUrl } from "../services/evidence-fields.util.js";
import { sourceIdentity, normalizeTitle } from "../services/movie-identity.util.js";

const TEXT_FIELDS = { description: 20000, meta_title: 255, meta_description: 500 };
const TITLE_TYPES = new Set(["default", "vietnamese", "english", "romaji", "native", "synonym"]);
const RELATIONSHIP_FIELDS = ["category_id", "country_id", "studio_id", "series_id"];

/** Plain bounded text never carries source markup into the form. */
const text = (value, max = 255) => typeof value === "string"
  ? value.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "").replace(/<[^>]*>/g, "").trim().slice(0, max)
  : null;

/** Preserve only title roles explicitly supplied by a source, without guessing language. */
const typedTitleObservations = (snapshot) => ["anilist", "jikan", "tmdb", "omdb"].flatMap((source) => {
  const record = snapshot[source];
  if (!record || snapshot.source_presence?.[source] === false) return [];
  const identity = sourceIdentity(source, record);
  const sourceId = identity.sourceIds[source === "jikan" ? "mal" : source === "omdb" ? "imdb" : source] || null;
  const typed = source === "anilist" ? [["native", record.title?.native], ["romaji", record.title?.romaji], ["english", record.title?.english]]
    : source === "jikan" ? [["native", record.title_japanese], ["english", record.title_english],
      ...(record.titles || []).map((item) => [({ Japanese: "native", English: "english" })[item?.type] || "synonym", item?.title])]
      : source === "tmdb" ? [["native", record.original_title || record.original_name]] : [];
  const observations = typed.flatMap(([type, value]) => {
    const title = text(value, 500);
    return title ? [{ type, value: title, source, sourceId }] : [];
  });
  for (const alias of identity.titles) {
    const title = text(alias, 500);
    if (title && !observations.some((item) => normalizeTitle(item.value) === normalizeTitle(title))) {
      observations.push({ type: "synonym", value: title, source, sourceId });
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

  /** Enforce an explicit output schema; factual fields require matching observations. */
  validateAndSanitize(rawData = {}, snapshot = {}, conflicts = []) {
    const raw = rawData && typeof rawData === "object" && !Array.isArray(rawData) ? rawData : {};
    const flags = [];
    const sanitized = {};
    const observations = buildEvidenceFields(snapshot);
    const provenance = {}, fieldEvidence = {};
    const category = (field) => FIELD_CATEGORIES[field] || "core_identifiers";
    const reliability = (field, source) => AI_SOURCE_RELIABILITY_MATRIX[source]?.[category(field)]
      ?? AI_SOURCE_RELIABILITY_MATRIX[source]?.default ?? 0;
    // Select only observed values, preferring a matching model choice and then source weights.
    for (const [field, values] of Object.entries(observations)) {
      if (["actor_cast", "studio", "country", "genres"].includes(field)) continue;
      const supported = values.find((item) => fieldValuesEqual(item.value, raw[field]));
      const selected = supported || [...values].sort((a, b) => reliability(field, b.source) - reliability(field, a.source))[0];
      sanitized[field] = selected.value;
      const matching = values.filter((item) => fieldValuesEqual(item.value, selected.value));
      provenance[field] = matching.map((item) => item.source).join(" + ");
      fieldEvidence[field] = matching;
      if (raw[field] != null && !supported) flags.push("UNSUPPORTED_FIELD_REMOVED");
    }

    // Derivation is allowed only when the original source text actually exists.
    for (const [field, limit] of Object.entries(TEXT_FIELDS)) {
      const value = text(raw[field], limit);
      const basis = field === "description" ? observations.description : observations.title;
      if (value && basis?.length) {
        sanitized[field] = value;
        provenance[field] = `ai_translation (${basis.map((item) => item.source).join(" + ")})`;
        fieldEvidence[field] = basis.map((item) => ({ ...item, derived: true }));
      }
    }
    const titleObservations = typedTitleObservations(snapshot);
    const titleKey = (type, title) => `${type}:${normalizeTitle(title)}`;
    const observedTypes = new Set(titleObservations.map((item) => titleKey(item.type, item.value)));
    // All known aliases already come from sources; the model cannot add or relabel a title.
    if (Array.isArray(raw.titles)) for (const item of raw.titles) {
      const allowed = item && TITLE_TYPES.has(item.type) && typeof item.title === "string"
        && (item.type === "default" ? normalizeTitle(item.title) === normalizeTitle(sanitized.title)
          : observedTypes.has(titleKey(item.type, item.title)));
      if (!allowed) flags.push("UNSUPPORTED_TITLE_TYPE_REMOVED");
    }
    const typeOrder = ["native", "romaji", "english", "vietnamese", "synonym"];
    const ordered = [...titleObservations].sort((left, right) => typeOrder.indexOf(left.type) - typeOrder.indexOf(right.type));
    const titles = sanitized.title ? [{ type: "default", title: sanitized.title }] : [];
    const seenTitles = new Set(titles.map((item) => titleKey(item.type, item.title)));
    for (const item of ordered) {
      const key = titleKey(item.type, item.value);
      if (!seenTitles.has(key)) { titles.push({ type: item.type, title: item.value }); seenTitles.add(key); }
    }
    sanitized.titles = titles.slice(0, 30);
    if (sanitized.titles.length) {
      const selectedTitles = new Set(sanitized.titles.map((item) => titleKey(item.type, item.title)));
      fieldEvidence.titles = titleObservations.filter((item) => selectedTitles.has(titleKey(item.type, item.value))
        || normalizeTitle(item.value) === normalizeTitle(sanitized.title));
      provenance.titles = [...new Set(fieldEvidence.titles.map((item) => item.source))].join(" + ");
    }
    if (sanitized.title) {
      sanitized.slug = sanitized.title.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
        .replace(/đ/g, "d").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      provenance.slug = "derived_title";
      const keywords = Array.isArray(raw.seo_keywords) ? raw.seo_keywords.filter((item) => typeof item === "string" && item.trim()).slice(0, 20).map((item) => text(item, 100)) : [];
      sanitized.seo_keywords = keywords.length ? keywords : [sanitized.title];
      provenance.seo_keywords = "ai_synthesis";
    } else sanitized.seo_keywords = [];

    // No quality, localization, database relation or cast ID may come from the LLM.
    for (const field of RELATIONSHIP_FIELDS) sanitized[field] = null;
    sanitized.genre_ids = [];
    sanitized.actor_cast = [];
    sanitized.suggested_entities = {};
    sanitized.quality = null;
    sanitized.sub_dub_type = null;
    sanitized.season_number = null;
    sanitized.is_published = false;
    sanitized.is_premium = false;

    // Strict numeric/date/URL validation also applies to upstream source values.
    for (const field of ["tmdb_id", "mal_id", "anilist_id"]) if (sanitized[field] != null) {
      sanitized[field] = boundedNumber(sanitized[field], 1, 2147483647);
    }
    if (sanitized.release_date != null) sanitized.release_date = validDate(sanitized.release_date);
    if (sanitized.release_year != null) sanitized.release_year = boundedNumber(sanitized.release_year, 1900, 2100);
    if (sanitized.imdb_rating != null) sanitized.imdb_rating = boundedNumber(sanitized.imdb_rating, 0, 10, false);
    if (sanitized.trailer_url != null) sanitized.trailer_url = validUrl(sanitized.trailer_url);
    if (sanitized.season && !["spring", "summer", "fall", "winter"].includes(String(sanitized.season).toLowerCase())) delete sanitized.season;

    if (typeof raw.release_date === "string" && /^\d{4}$/.test(raw.release_date) && !sanitized.release_year) {
      // Retain a year only if source evidence supports it; never fabricate January 1.
      const year = boundedNumber(raw.release_date, 1900, 2100);
      if (observations.release_year?.some((item) => item.value === year)) sanitized.release_year = year;
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
export default aiOutputValidator;

