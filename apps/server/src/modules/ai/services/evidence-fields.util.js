/**
 * @file evidence-fields.util.js
 * @module AI_Evidence_Fields
 * @description Pure field normalization shared by validation, confidence and conflict detection.
 */

import { normalizeMediaType, normalizeTitle, identityYear } from "./movie-identity.util.js";

export const FIELD_CATEGORIES = {
  title: "core_identifiers", original_title: "core_identifiers", release_year: "media_specs",
  release_date: "media_specs", type: "media_specs", status: "media_specs", total_episodes: "media_specs",
  duration: "media_specs", season: "media_specs", description: "synopsis", director: "people",
  actor_cast: "people", studio: "taxonomies", country: "taxonomies", genres: "taxonomies",
  imdb_rating: "ratings", age_rating: "media_specs",
};
export const TRACKED_FIELDS = ["title", "type", "release_year", "release_date", "description", "director", "duration", "total_episodes", "status", "studio"];

/** Strict finite numeric range; an invalid string is never silently parsed. */
export const boundedNumber = (value, min, max, integer = true) => {
  if (value == null || value === "" || typeof value === "boolean") return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= min && number <= max && (!integer || Number.isInteger(number)) ? number : null;
};

/** Accept complete real calendar dates only; a year is not a release date. */
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

/** Source HTTP(S) URLs only; reject credentials and executable schemes. */
export const validUrl = (value) => {
  if (typeof value !== "string" || value.length > 4096) return null;
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch { return null; }
};

/** Source date with an English month is supported without locale-dependent Date parsing. */
const omdbDate = (value) => {
  const match = String(value || "").match(/^(\d{1,2}) ([A-Z][a-z]{2}) (\d{4})$/);
  if (!match) return null;
  const month = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].indexOf(match[2]) + 1;
  return month ? validDate(`${match[3]}-${month}-${match[1]}`) : null;
};

/** Normalize an actual source status; missing status stays missing. */
export const normalizeStatus = (value) => ({
  FINISHED: "completed", "FINISHED AIRING": "completed", ENDED: "completed", RELEASED: "completed",
  RELEASING: "ongoing", "CURRENTLY AIRING": "ongoing", "RETURNING SERIES": "ongoing", "IN PRODUCTION": "upcoming",
  NOT_YET_RELEASED: "upcoming", "NOT YET AIRED": "upcoming", PLANNED: "upcoming", "POST PRODUCTION": "upcoming",
  CANCELLED: "cancelled", CANCELED: "cancelled", HIATUS: "hiatus",
  ONGOING: "ongoing", COMPLETED: "completed", UPCOMING: "upcoming",
})[String(value || "").toUpperCase()] || null;

/** Extract duration only when a source explicitly supplies minutes/hours. */
const durationMinutes = (value) => {
  if (typeof value === "number") return boundedNumber(value, 1, 10000);
  const text = String(value || "");
  const minutes = text.match(/(\d+)\s*min/i);
  const hours = text.match(/(\d+)\s*h(?:ou)?r/i);
  return minutes || hours ? boundedNumber(Number(hours?.[1] || 0) * 60 + Number(minutes?.[1] || 0), 1, 10000) : null;
};

/** Normalize evidence age classifications to application enums, with no default rating. */
export const normalizeAgeRating = (value) => {
  const text = String(value || "").toUpperCase().trim();
  const code = text.split(" - ")[0];
  const mapped = ({ "TV-14": "PG-13", PG13: "PG-13", "TV-MA": "R", "TV-G": "G", "TV-PG": "PG", "NC-17": "18+" })[code] || code;
  return ["G", "PG", "PG-13", "R", "R+", "13+", "16+", "18+", "P"].includes(mapped) ? mapped : null;
};

/** Build normalized observations solely from source objects admitted by identity validation. */
export const buildEvidenceFields = (snapshot = {}) => {
  const fields = {};
  const add = (field, value, source, sourceId) => {
    if (["title", "original_title", "description", "director", "trailer_url", "imdb_id", "country", "source_type"].includes(field) && !Array.isArray(value)) {
      if (typeof value !== "string") return;
      value = value.trim();
    }
    if (["studio", "country", "genres"].includes(field) && Array.isArray(value)) {
      value = value.filter((item) => typeof item === "string" && item.trim()).map((item) => item.trim());
    }
    if (value == null || value === "" || (Array.isArray(value) && !value.length)) return;
    (fields[field] ||= []).push({ source, value, sourceId: sourceId ?? null });
  };
  const addRecord = (source, data, values, id) => {
    if (!data || snapshot.source_presence?.[source] === false) return;
    for (const [field, value] of Object.entries(values)) add(field, value, source, id);
  };
  const a = snapshot.anilist, j = snapshot.jikan, t = snapshot.tmdb, o = snapshot.omdb;
  const animeDate = a?.startDate?.year && a?.startDate?.month && a?.startDate?.day
    ? validDate(`${a.startDate.year}-${a.startDate.month}-${a.startDate.day}`) : null;
  const sourceType = ({ MANGA: "manga", WEB_MANGA: "manga", DOUJINSHI: "manga", LIGHT_NOVEL: "light_novel", ORIGINAL: "original", MULTIMEDIA_PROJECT: "original", VIDEO_GAME: "game", VISUAL_NOVEL: "visual_novel", NOVEL: "novel", OTHER: "other" })[a?.source];
  addRecord("anilist", a, {
    title: a?.title?.userPreferred || a?.title?.romaji || a?.title?.english || a?.title?.native,
    original_title: a?.title?.native || a?.title?.romaji,
    type: normalizeMediaType(a?.format), status: normalizeStatus(a?.status),
    release_year: boundedNumber(a?.seasonYear || a?.startDate?.year, 1900, 2100), release_date: animeDate,
    description: a?.description, duration: durationMinutes(a?.duration), total_episodes: boundedNumber(a?.episodes, 1, 100000),
    director: a?.director, studio: a?.studios, country: a?.countryOfOrigin, genres: a?.genres, actor_cast: a?.cast,
    season: ["spring", "summer", "fall", "winter"].includes(a?.season?.toLowerCase()) ? a.season.toLowerCase() : null,
    trailer_url: validUrl(a?.trailer_url), anilist_id: boundedNumber(a?.id, 1, 2147483647),
    mal_id: boundedNumber(a?.idMal, 1, 2147483647), source_type: sourceType,
  }, a?.id);
  addRecord("jikan", j, {
    title: j?.title, original_title: j?.title_japanese || j?.title,
    type: normalizeMediaType(j?.type), status: normalizeStatus(j?.status),
    release_date: validDate(j?.aired?.from), release_year: boundedNumber(j?.year || identityYear(j?.aired?.from), 1900, 2100),
    description: j?.synopsis, duration: durationMinutes(j?.duration), total_episodes: boundedNumber(j?.episodes, 1, 100000),
    studio: j?.studios, genres: j?.genres, season: j?.season,
    age_rating: normalizeAgeRating(j?.rating), trailer_url: validUrl(j?.trailer_url),
    mal_id: boundedNumber(j?.mal_id, 1, 2147483647),
  }, j?.mal_id);
  addRecord("tmdb", t, {
    title: t?.title || t?.name, original_title: t?.original_title || t?.original_name,
    type: normalizeMediaType(t?.media_type), status: normalizeStatus(t?.status),
    release_date: validDate(t?.release_date), release_year: boundedNumber(identityYear(t?.release_date), 1900, 2100),
    description: t?.overview, duration: durationMinutes(t?.duration || t?.runtime || t?.episode_run_time?.[0]),
    total_episodes: boundedNumber(t?.number_of_episodes, 1, 100000),
    director: t?.director, studio: t?.studios, country: t?.countries, genres: t?.genres, actor_cast: t?.cast,
    trailer_url: validUrl(t?.trailer_url), tmdb_id: boundedNumber(t?.id, 1, 2147483647),
    imdb_id: /^tt\d{5,12}$/.test(t?.imdb_id) ? t.imdb_id : null,
  }, t?.id);
  addRecord("omdb", o, {
    title: o?.title, type: normalizeMediaType(o?.type), release_year: boundedNumber(identityYear(o?.year), 1900, 2100),
    release_date: omdbDate(o?.released), description: o?.plot, director: o?.director,
    duration: durationMinutes(o?.runtime), country: o?.country?.split(",").map((country) => country.trim()),
    genres: o?.genre, age_rating: normalizeAgeRating(o?.rated),
    imdb_id: /^tt\d{5,12}$/.test(o?.imdb_id) ? o.imdb_id : null,
    imdb_rating: boundedNumber(o?.imdb_rating, 0, 10, false),
  }, o?.imdb_id);
  return fields;
};

/** Equality for scalar observations; arrays are compared as sets. */
export const fieldValuesEqual = (left, right) => {
  const canonical = (value) => Array.isArray(value)
    ? value.map((item) => typeof item === "object" ? JSON.stringify(item) : normalizeTitle(String(item))).sort().join("|")
    : typeof value === "string" ? normalizeTitle(value) : JSON.stringify(value);
  return canonical(left) === canonical(right);
};

