/**
 * @file ai-sources.helper.js
 * @module AI_Sources_Helper
 * @description Tổng hợp các adapter kết nối nguồn dữ liệu ngoài (TMDB, AniList, Jikan, OMDb) và Rate Limiter.
 */

import { logger } from "../../../utils/logger.js";
import {
  AI_CACHE_TTL,
  cleanSourceText,
  identityYear,
  normalizeMediaType,
  sameWork,
  selectUnambiguousCandidate,
  sourceIdentity,
} from "./ai-metadata.helper.js";

const DEFAULT_TIMEOUT_MS = 10000;

// ============================================================================
// 1. TMDB SOURCE ADAPTER
// ============================================================================

export const tmdbImage = (baseUrl, path, size = "original") =>
  path ? `${baseUrl}/${size}${path}` : null;

export async function searchTMDB(http, config, { title, year, signal, mediaType = "all", timeout = DEFAULT_TIMEOUT_MS } = {}) {
  const type = normalizeMediaType(mediaType);
  if (type && !["movie", "series"].includes(type)) return [];
  const namespaces = type ? [type === "series" ? "tv" : "movie"] : ["movie", "tv"];

  const results = await Promise.allSettled(namespaces.map(async (namespace) => {
    const response = await http.get(`${config.tmdb.baseUrl}/search/${namespace}`, {
      params: {
        api_key: config.tmdb.apiKey,
        query: title,
        language: "vi-VN",
        include_adult: false,
        ...(year ? { [namespace === "tv" ? "first_air_date_year" : "primary_release_year"]: Number(year) } : {}),
      },
      signal,
      timeout,
    });
    if (!Array.isArray(response.data?.results)) throw new Error("Invalid source response");
    return response.data.results
      .filter((item) => (!item.media_type || item.media_type === namespace)
        && (!year || identityYear(namespace === "tv" ? item.first_air_date : item.release_date) === Number(year)))
      .slice(0, 10)
      .map((item) => ({
        ...item,
        media_type: namespace,
        poster_path: item.poster_path ? `${config.tmdb.imageBaseUrl}/w185${item.poster_path}` : null,
      }));
  }));

  signal?.throwIfAborted();
  const errors = results.flatMap((result, index) => result.status === "rejected"
    ? [{ source: "tmdb", namespace: namespaces[index], code: "SOURCE_UNAVAILABLE" }] : []);
  if (errors.length === namespaces.length) {
    const error = new Error("Source unavailable");
    error.source_errors = errors;
    throw error;
  }
  const records = results.flatMap((result) => result.status === "fulfilled" ? result.value : []);
  Object.defineProperty(records, "source_errors", { value: errors });
  return records;
}

export async function fetchTMDB(http, config, { title, year, selectedCandidate, signal, timeout = DEFAULT_TIMEOUT_MS, searchFn } = {}) {
  if (!config.tmdb.enabled) return null;
  let identity = selectedCandidate;
  if (!identity?.sourceIds?.tmdb) {
    const search = searchFn || ((t, y, s, m) => searchTMDB(http, config, { title: t, year: y, signal: s, mediaType: m, timeout }));
    const candidates = (await search(title, year, signal, selectedCandidate?.mediaType)).map((data) => sourceIdentity("tmdb", data));
    identity = selectedCandidate
      ? candidates.find((candidate) => sameWork(selectedCandidate, candidate))
      : selectUnambiguousCandidate(candidates, { title, year });
  }
  if (!identity?.sourceIds?.tmdb) return null;

  const mediaType = identity.mediaType === "series" ? "tv" : "movie";
  const response = await http.get(`${config.tmdb.baseUrl}/${mediaType}/${identity.sourceIds.tmdb}`, {
    params: {
      api_key: config.tmdb.apiKey,
      language: "vi-VN",
      append_to_response: "credits,videos,external_ids,alternative_titles,translations",
    },
    signal,
    timeout,
  });

  const detail = response.data;
  if (!detail?.id) throw new Error("Invalid source response");
  const translations = (detail.translations?.translations || []).filter((item) => typeof item.iso_639_1 === "string");
  const trailer = detail.videos?.results?.find((video) => video.site === "YouTube" && ["Trailer", "Teaser"].includes(video.type));
  const image = (path, size = "original") => tmdbImage(config.tmdb.imageBaseUrl, path, size);
  const tmdbDirector = detail.credits?.crew?.find((crew) => crew.job === "Director");

  return {
    ...detail,
    media_type: mediaType,
    title: detail.title || detail.name,
    original_title: detail.original_title || detail.original_name,
    release_date: detail.release_date || detail.first_air_date || null,
    titles: (detail.alternative_titles?.titles || detail.alternative_titles?.results || []).map((item) => item.title),
    localized_titles: translations.flatMap((item) => {
      const value = item.data?.title || item.data?.name;
      return typeof value === "string" && value.trim() ? [{
        title: value.trim(),
        language: item.iso_639_1,
        region: item.iso_3166_1 || null,
        type: item.iso_639_1 === "vi" ? "vietnamese" : item.iso_639_1 === "en" ? "english" : "synonym",
      }] : [];
    }),
    localized_overviews: translations.flatMap((item) => typeof item.data?.overview === "string" && item.data.overview.trim()
      ? [{ text: item.data.overview.trim(), language: item.iso_639_1, region: item.iso_3166_1 || null }] : []),
    is_animation: (detail.genres || []).some((genre) => genre.id === 16),
    genres: (detail.genres || []).map((genre) => genre.name),
    countries: (detail.production_countries || []).map((country) => country.iso_3166_1),
    studios: (detail.production_companies || []).map((studio) => studio.name),
    studio_details: (detail.production_companies || []).map((studio) => ({
      source: "tmdb",
      source_id: studio.id ? String(studio.id) : null,
      name: studio.name,
      logo_url: image(studio.logo_path, "w185"),
      country: studio.origin_country || null,
    })),
    duration: detail.runtime || detail.episode_run_time?.[0] || null,
    imdb_id: detail.external_ids?.imdb_id || detail.imdb_id || null,
    director: tmdbDirector?.name || null,
    director_source: tmdbDirector ? "tmdb" : null,
    director_source_id: tmdbDirector?.id ? String(tmdbDirector.id) : null,
    poster_path: image(detail.poster_path),
    backdrop_path: image(detail.backdrop_path),
    trailer_url: trailer ? `https://www.youtube.com/watch?v=${trailer.key}` : null,
    cast: (detail.credits?.cast || []).slice(0, 12).map((actor) => ({
      source: "tmdb",
      source_id: actor.id ? String(actor.id) : null,
      actor_name: actor.name || actor.original_name,
      actor_image_url: image(actor.profile_path, "w185"),
      character_name: (actor.character || "").replace(/\s*\((voice|lồng tiếng)\)/gi, "").trim(),
      role_name: "Diễn viên",
      is_main_cast: actor.order < 3,
      cast_order: actor.order,
    })),
  };
}

export async function fetchTMDBPerson(http, config, cache, personId, { signal, locale = "vi-VN", timeout = DEFAULT_TIMEOUT_MS } = {}) {
  if (!config.tmdb?.enabled || !personId) return null;
  const cacheKey = `ai:v2:person:tmdb:${personId}:${locale}`;
  const cached = await cache.get(cacheKey);
  signal?.throwIfAborted();
  if (cached) {
    if (cached.not_found) return null;
    return cached;
  }
  try {
    const response = await http.get(`${config.tmdb.baseUrl}/person/${personId}`, {
      params: {
        api_key: config.tmdb.apiKey,
        language: locale,
        append_to_response: "translations",
      },
      signal,
      timeout,
    });
    const data = response.data;
    if (!data?.id || Number(data.id) !== Number(personId)) throw new Error("Invalid person identity");
    const image = (path, size = "w300") => tmdbImage(config.tmdb.imageBaseUrl, path, size);

    const genderMap = { 1: "female", 2: "male", 3: "other" };
    const gender = genderMap[data.gender] || "unknown";

    const birthDate = typeof data.birthday === "string" && /^\d{4}-\d{2}-\d{2}$/.test(data.birthday)
      ? data.birthday : null;

    let biography = cleanSourceText(data.biography, 2000);
    if (!biography && Array.isArray(data.translations?.translations)) {
      const enTrans = data.translations.translations.find((t) => t.iso_639_1 === "en");
      if (enTrans?.data?.biography) biography = cleanSourceText(enTrans.data.biography, 2000);
    }

    const result = {
      source: "tmdb",
      source_id: String(data.id),
      name: data.name,
      gender,
      birth_date: birthDate,
      nationality: null,
      biography: biography || null,
      image_url: image(data.profile_path),
      aliases: Array.isArray(data.also_known_as) ? data.also_known_as.filter((item) => typeof item === "string" && item.trim()) : [],
      metadata: {
        source: "tmdb",
        source_id: String(data.id),
        place_of_birth: data.place_of_birth || null,
        known_for_department: data.known_for_department || null,
      },
    };

    await cache.set(cacheKey, result, AI_CACHE_TTL.PERSON_ENRICHMENT_SECONDS);
    return result;
  } catch (error) {
    signal?.throwIfAborted();
    if (error.response?.status === 404) {
      await cache.set(cacheKey, { not_found: true }, AI_CACHE_TTL.NEGATIVE_ENRICHMENT_SECONDS);
      return null;
    }
    logger.warn(`[AI][TMDB Source] Error fetching Person ${personId}: ${error.message}`);
    return null;
  }
}

// ============================================================================
// 2. ANILIST SOURCE ADAPTER
// ============================================================================

export const ANILIST_GRAPHQL_ENDPOINT = "https://graphql.anilist.co";

export const ANIME_FIELDS = `id idMal title { romaji english native userPreferred } synonyms format status source
  description(asHtml:false) season seasonYear startDate { year month day } countryOfOrigin episodes duration genres averageScore
  studios(isMain:true) { nodes { id name } } staff(perPage:25) { edges { role node { id name { full native } } } }
  characters(sort:ROLE,perPage:12) { edges { role node { id name { full native } } voiceActors(language:JAPANESE) { id name { full native } image { large } } } }
  trailer { id site } coverImage { extraLarge large } bannerImage`;

export const normalizeAnime = (media) => {
  const directorEdge = (media.staff?.edges || []).find((edge) =>
    /^(chief )?director$/i.test(edge.role || "")
  );
  return {
    ...media,
    studios: (media.studios?.nodes || []).map((studio) => studio.name),
    studio_details: (media.studios?.nodes || []).map((studio) => ({
      source: "anilist",
      source_id: studio.id ? String(studio.id) : null,
      name: studio.name,
      logo_url: null,
      country: null,
    })),
    staff: (media.staff?.edges || []).map((edge) => ({
      role: edge.role,
      name: edge.node?.name?.full,
      id: edge.node?.id ? String(edge.node.id) : null,
    })),
    director: directorEdge?.node?.name?.full || null,
    director_source: directorEdge ? "anilist" : null,
    director_source_id: directorEdge?.node?.id ? String(directorEdge.node.id) : null,
    season: media.season?.toLowerCase() || null,
    cover_image: media.coverImage?.extraLarge || media.coverImage?.large || null,
    banner_image: media.bannerImage || null,
    trailer_url: media.trailer?.site === "youtube" ? `https://www.youtube.com/watch?v=${media.trailer.id}` : null,
    cast: (media.characters?.edges || []).flatMap((edge) => (edge.voiceActors || []).slice(0, 1).map((actor) => ({
      source: "anilist",
      source_id: actor.id ? String(actor.id) : null,
      actor_name: actor.name?.full || actor.name?.native,
      actor_image_url: actor.image?.large || null,
      character_name: (edge.node?.name?.full || edge.node?.name?.native || "").replace(/\s*\((voice|lồng tiếng)\)/gi, "").trim(),
      role_name: "Lồng tiếng",
      is_main_cast: edge.role === "MAIN",
    }))),
  };
};

export const detectSourceType = (anilist) => {
  const source = String(anilist?.source || "").toUpperCase();
  return ({
    MANGA: "manga", WEB_MANGA: "manga", DOUJINSHI: "manga", LIGHT_NOVEL: "light_novel", ORIGINAL: "original",
    MULTIMEDIA_PROJECT: "original", VIDEO_GAME: "game", VISUAL_NOVEL: "visual_novel", NOVEL: "novel", OTHER: "other",
  })[source] || null;
};

export async function searchAniList(http, { title, year, signal, timeout = DEFAULT_TIMEOUT_MS } = {}) {
  const response = await http.post(ANILIST_GRAPHQL_ENDPOINT, {
    query: `query($search:String,$year:Int) { Page(perPage:10) { media(search:$search,seasonYear:$year,type:ANIME,sort:SEARCH_MATCH) { ${ANIME_FIELDS} } } }`,
    variables: { search: title, year: year ? Number(year) : undefined },
  }, { signal, timeout });
  if (response.data?.errors?.length || !Array.isArray(response.data?.data?.Page?.media)) throw new Error("Invalid source response");
  return response.data.data.Page.media.map(normalizeAnime);
}

export async function fetchAniList(http, { title, year, selectedCandidate, signal, timeout = DEFAULT_TIMEOUT_MS, searchFn } = {}) {
  if (selectedCandidate?.isAnimation === false) return null;
  if (!selectedCandidate?.sourceIds?.anilist && !selectedCandidate?.sourceIds?.mal) {
    const search = searchFn || ((t, y, s) => searchAniList(http, { title: t, year: y, signal: s, timeout }));
    const records = await search(title, year, signal);
    const candidates = records.map((data) => sourceIdentity("anilist", data));
    const choice = selectedCandidate
      ? candidates.find((candidate) => sameWork(selectedCandidate, candidate))
      : selectUnambiguousCandidate(candidates, { title, year });
    return records.find((data) => data.id === choice?.sourceIds?.anilist) || null;
  }
  const response = await http.post(ANILIST_GRAPHQL_ENDPOINT, {
    query: `query($id:Int,$mal:Int) { Media(id:$id,idMal:$mal,type:ANIME) { ${ANIME_FIELDS} } }`,
    variables: {
      id: selectedCandidate.sourceIds.anilist ? Number(selectedCandidate.sourceIds.anilist) : undefined,
      mal: !selectedCandidate.sourceIds.anilist && selectedCandidate.sourceIds.mal ? Number(selectedCandidate.sourceIds.mal) : undefined,
    },
  }, { signal, timeout });
  if (response.data?.errors?.length) throw new Error("Invalid source response");
  return response.data?.data?.Media ? normalizeAnime(response.data.data.Media) : null;
}

export async function fetchAniListStaff(http, cache, staffId, { signal, timeout = DEFAULT_TIMEOUT_MS } = {}) {
  if (!staffId) return null;
  const cacheKey = `ai:v2:person:anilist:${staffId}:default`;
  const cached = await cache.get(cacheKey);
  signal?.throwIfAborted();
  if (cached) {
    if (cached.not_found) return null;
    return cached;
  }
  try {
    const query = `query($id: Int) {
      Staff(id: $id) {
        id
        name { full native alternative userPreferred }
        image { large }
        description(asHtml: false)
        gender
        dateOfBirth { year month day }
        homeTown
        primaryOccupations
      }
    }`;
    const response = await http.post(
      ANILIST_GRAPHQL_ENDPOINT,
      { query, variables: { id: Number(staffId) } },
      { signal, timeout }
    );
    if (response.data?.errors?.length || !response.data?.data?.Staff) {
      throw new Error("Invalid staff response");
    }
    const staff = response.data.data.Staff;
    if (Number(staff.id) !== Number(staffId)) throw new Error("Invalid staff identity");

    const rawGender = String(staff.gender || "").trim().toLowerCase();
    let gender = "unknown";
    if (/^female$/i.test(rawGender)) gender = "female";
    else if (/^male$/i.test(rawGender)) gender = "male";
    else if (rawGender) gender = "other";

    let birthDate = null;
    const dob = staff.dateOfBirth;
    if (dob && Number.isInteger(dob.year) && Number.isInteger(dob.month) && Number.isInteger(dob.day)) {
      if (dob.year >= 1900 && dob.year <= 2100 && dob.month >= 1 && dob.month <= 12 && dob.day >= 1 && dob.day <= 31) {
        birthDate = `${dob.year}-${String(dob.month).padStart(2, "0")}-${String(dob.day).padStart(2, "0")}`;
      }
    }

    const biography = cleanSourceText(staff.description, 2000);
    const aliases = [
      ...(Array.isArray(staff.name?.alternative) ? staff.name.alternative : []),
      staff.name?.native,
    ].filter((alias) => typeof alias === "string" && alias.trim());

    const result = {
      source: "anilist",
      source_id: String(staff.id),
      name: staff.name?.full || staff.name?.userPreferred || staff.name?.native,
      gender,
      birth_date: birthDate,
      nationality: null,
      biography: biography || null,
      image_url: staff.image?.large || null,
      aliases,
      metadata: {
        source: "anilist",
        source_id: String(staff.id),
        homeTown: staff.homeTown || null,
        partial_dob: !birthDate && dob ? dob : null,
      },
    };

    await cache.set(cacheKey, result, AI_CACHE_TTL.PERSON_ENRICHMENT_SECONDS);
    return result;
  } catch (error) {
    signal?.throwIfAborted();
    if (error.response?.status === 404 || error.message?.includes("Not Found")) {
      await cache.set(cacheKey, { not_found: true }, AI_CACHE_TTL.NEGATIVE_ENRICHMENT_SECONDS);
      return null;
    }
    logger.warn(`[AI][AniList Source] Error fetching Staff ${staffId}: ${error.message}`);
    return null;
  }
}

// ============================================================================
// 3. JIKAN (MYANIMELIST) SOURCE ADAPTER & RATE LIMITER
// ============================================================================

export const pause = (milliseconds, signal) => new Promise((resolve, reject) => {
  if (signal?.aborted) return reject(signal.reason || new Error("Aborted"));
  const onAbort = () => { clearTimeout(timer); reject(signal.reason || new Error("Aborted")); };
  const timer = setTimeout(() => { signal?.removeEventListener("abort", onAbort); resolve(); }, milliseconds);
  signal?.addEventListener("abort", onAbort, { once: true });
});

export const normalizeJikan = (anime) => ({
  ...anime,
  genres: (anime.genres || []).map((genre) => genre.name),
  studios: (anime.studios || []).map((studio) => studio.name),
  image_url: anime.images?.jpg?.large_image_url || anime.images?.webp?.large_image_url || null,
  trailer_url: anime.trailer?.url || null,
});

export class JikanRateLimiter {
  constructor(rateLimit = 3) {
    this.rateLimit = rateLimit;
    this.slots = Promise.resolve();
    this.nextAt = 0;
  }

  async acquire(signal) {
    const previous = this.slots;
    let release;
    this.slots = new Promise((resolve) => { release = resolve; });
    await previous;
    try {
      await pause(Math.max(0, this.nextAt - Date.now()), signal);
      this.nextAt = Date.now() + Math.ceil(1000 / Math.max(1, this.rateLimit));
    } finally {
      release();
    }
  }
}

export async function requestJikan(http, config, limiter, path, params, signal, timeout = DEFAULT_TIMEOUT_MS) {
  if (limiter?.acquire) {
    await limiter.acquire(signal);
  }
  return http.get(`${config.jikan.baseUrl.replace(/\/$/, "")}/${path}`, {
    params,
    signal,
    timeout,
  });
}

export async function searchJikan(http, config, limiter, { title, year, signal, timeout = DEFAULT_TIMEOUT_MS } = {}) {
  if (!config.jikan.enabled) return [];
  const response = await requestJikan(http, config, limiter, "anime", {
    q: title,
    limit: 10,
    ...(year ? { start_date: `${year}-01-01`, end_date: `${year}-12-31` } : {}),
  }, signal, timeout);
  if (!Array.isArray(response.data?.data)) throw new Error("Invalid source response");
  return response.data.data.map(normalizeJikan);
}

export async function fetchJikan(http, config, limiter, { title, year, malId, selectedCandidate, signal, timeout = DEFAULT_TIMEOUT_MS, searchFn } = {}) {
  if (!config.jikan.enabled || selectedCandidate?.isAnimation === false) return null;
  malId ||= selectedCandidate?.sourceIds?.mal;
  if (malId) {
    const response = await requestJikan(http, config, limiter, `anime/${Number(malId)}/full`, {}, signal, timeout);
    return response.data?.data ? normalizeJikan(response.data.data) : null;
  }
  const search = searchFn || ((t, y, s) => searchJikan(http, config, limiter, { title: t, year: y, signal: s, timeout }));
  const records = await search(title, year, signal);
  const candidates = records.map((data) => sourceIdentity("jikan", data));
  const choice = selectedCandidate
    ? candidates.find((candidate) => sameWork(selectedCandidate, candidate))
    : selectUnambiguousCandidate(candidates, { title, year });
  return records.find((data) => data.mal_id === choice?.sourceIds?.mal) || null;
}

// ============================================================================
// 4. OMDB SOURCE ADAPTER
// ============================================================================

export async function searchOMDb(http, config, { title, year, signal, timeout = DEFAULT_TIMEOUT_MS } = {}) {
  if (!config.omdb.enabled) return [];
  const response = await http.get(config.omdb.baseUrl, {
    params: { apikey: config.omdb.apiKey, s: title, y: year || undefined },
    signal,
    timeout,
  });
  if (response.data?.Response === "False" && !/not found|too many results/i.test(response.data.Error || "")) {
    throw new Error("Source unavailable");
  }
  return (response.data?.Search || []).slice(0, 10).map((item) => ({
    ...item,
    title: item.Title,
    year: item.Year,
    type: item.Type,
    imdb_id: item.imdbID,
  }));
}

export async function fetchOMDb(http, config, { title, year, selectedCandidate, signal, timeout = DEFAULT_TIMEOUT_MS, searchFn } = {}) {
  if (!config.omdb.enabled) return null;
  let id = selectedCandidate?.sourceIds?.imdb;
  if (!id) {
    const search = searchFn || ((t, y, s) => searchOMDb(http, config, { title: t, year: y, signal: s, timeout }));
    const candidates = (await search(title, year, signal)).map((data) => sourceIdentity("omdb", data));
    const choice = selectedCandidate
      ? candidates.find((candidate) => sameWork(selectedCandidate, candidate))
      : selectUnambiguousCandidate(candidates, { title, year });
    id = choice?.sourceIds?.imdb;
  }
  if (!id) return null;

  const response = await http.get(config.omdb.baseUrl, {
    params: { apikey: config.omdb.apiKey, i: id, plot: "full" },
    signal,
    timeout,
  });
  const data = response.data;
  if (data.Response === "False") {
    if (!/not found/i.test(data.Error || "")) throw new Error("Source unavailable");
    return null;
  }
  const available = (value) => (value && value !== "N/A" ? value : null);
  return {
    imdb_id: data.imdbID,
    title: data.Title,
    year: data.Year,
    type: data.Type,
    rated: available(data.Rated),
    released: available(data.Released),
    runtime: available(data.Runtime),
    genre: available(data.Genre)?.split(",").map((genre) => genre.trim()) || [],
    director: available(data.Director),
    plot: available(data.Plot),
    country: available(data.Country),
    imdb_rating: available(data.imdbRating) ? Number(data.imdbRating) : null,
  };
}

export default {
  tmdbImage, searchTMDB, fetchTMDB, fetchTMDBPerson,
  ANILIST_GRAPHQL_ENDPOINT, ANIME_FIELDS, normalizeAnime, detectSourceType, searchAniList, fetchAniList, fetchAniListStaff,
  pause, normalizeJikan, JikanRateLimiter, requestJikan, searchJikan, fetchJikan,
  searchOMDb, fetchOMDb,
};
