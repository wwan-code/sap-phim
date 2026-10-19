/**
 * @file movie-identity.util.js
 * @module AI_Movie_Identity
 * @description Pure identity comparisons that preserve remake, season and adaptation boundaries.
 */

import crypto from "node:crypto";

/** Normalize complete titles without discarding season numbers or non-Latin text. */
export const normalizeTitle = (value) => typeof value === "string"
  ? value.normalize("NFKC").toLocaleLowerCase().replace(/[\p{P}\p{S}\s]+/gu, " ").trim()
  : "";

/** Normalize source formats to application media types; unknown stays unknown. */
export const normalizeMediaType = (value) => {
  const format = String(value || "").toLowerCase().replace(/_/g, " ");
  if (["tv", "tv short", "series", "miniseries"].includes(format)) return "series";
  if (["movie", "film"].includes(format)) return "movie";
  if (["ova", "ona", "special"].includes(format)) return format;
  return null;
};

/** Extract only an explicit valid four-digit release year. */
export const identityYear = (value) => {
  const year = Number(String(value ?? "").match(/^\d{4}/)?.[0]);
  return Number.isInteger(year) && year >= 1888 && year <= 2200 ? year : null;
};

/** Convert source data into a small identity descriptor used throughout collection. */
export const sourceIdentity = (source, data = {}) => {
  const titles = source === "anilist"
    ? [...Object.values(data.title || {}), ...(data.synonyms || [])]
    : [data.title, data.name, data.original_title, data.original_name, data.title_english,
      data.title_japanese, ...(data.titles || []).map((item) => typeof item === "string" ? item : item?.title)];
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

/** Check explicit cross-source IDs before conservative title/year/format comparison. */
export const sameWork = (left = {}, right = {}) => {
  const leftIds = left.sourceIds || {};
  const rightIds = right.sourceIds || {};
  const shared = Object.keys(leftIds).filter((key) => rightIds[key] != null);
  if (shared.some((key) => String(leftIds[key]) !== String(rightIds[key]))) return false;
  if (shared.length > 0) {
    // TMDB movie and TV IDs live in separate namespaces.
    return !(shared.includes("tmdb") && left.mediaType && right.mediaType && left.mediaType !== right.mediaType);
  }
  if (left.isAnimation != null && right.isAnimation != null && left.isAnimation !== right.isAnimation) return false;
  if (!left.year || !right.year || Number(left.year) !== Number(right.year)) return false;
  if (!left.mediaType || !right.mediaType || left.mediaType !== right.mediaType) return false;
  const aliases = new Set([left.title, ...(left.titles || [])].map(normalizeTitle).filter(Boolean));
  return [right.title, ...(right.titles || [])].some((title) => aliases.has(normalizeTitle(title)));
};

/** Stable candidate ID includes source IDs plus media namespace. */
export const candidateFingerprint = (candidate) => crypto.createHash("sha256")
  .update(JSON.stringify({ ids: Object.entries(candidate.sourceIds || {}).sort(), type: candidate.mediaType }))
  .digest("hex").slice(0, 32);

/** Group only identity-compatible candidates; duplicate seasons remain separate. */
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

/** Automatic selection requires a unique exact title match and all requested constraints. */
export const selectUnambiguousCandidate = (candidates, { title, year, mediaType }) => {
  const normalized = normalizeTitle(title);
  const matches = candidates.filter((candidate) => candidate.year && candidate.mediaType
    && [candidate.title, ...candidate.titles].some((alias) => normalizeTitle(alias) === normalized)
    && (!year || Number(year) === candidate.year)
    && (!normalizeMediaType(mediaType) || normalizeMediaType(mediaType) === candidate.mediaType));
  return matches.length === 1 ? matches[0] : null;
};
