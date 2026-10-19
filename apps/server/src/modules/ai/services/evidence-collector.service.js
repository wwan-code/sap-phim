/**
 * @file evidence-collector.service.js
 * @module AI_Evidence_Collector
 * @description Collect source evidence only after checking the selected movie identity.
 */

import axios from "axios";
import crypto from "node:crypto";

import { env } from "../../../config/env.config.js";
import { cacheHelper } from "../../../config/redis.config.js";
import { logger } from "../../../utils/logger.js";
import { AI_CACHE_TTL } from "../constants/ai.constants.js";
import { groupCandidates, normalizeMediaType, sameWork, selectUnambiguousCandidate, sourceIdentity } from "./movie-identity.util.js";

const SOURCES = ["tmdb", "anilist", "jikan", "omdb"];
const TIMEOUT_MS = 10000;
const animeFields = `id idMal title { romaji english native userPreferred } synonyms format status source
  description(asHtml:false) season seasonYear startDate { year month day } countryOfOrigin episodes duration genres averageScore
  studios(isMain:true) { nodes { name } } staff(perPage:25) { edges { role node { name { full native } } } }
  characters(sort:ROLE,perPage:12) { edges { role node { name { full native } } voiceActors(language:JAPANESE) { name { full native } image { large } } } }
  trailer { id site } coverImage { extraLarge large } bannerImage`;

/** Wait with cancellation, including the local source rate limiter. */
const pause = (milliseconds, signal) => new Promise((resolve, reject) => {
  if (signal?.aborted) return reject(signal.reason || new Error("Aborted"));
  const onAbort = () => { clearTimeout(timer); reject(signal.reason || new Error("Aborted")); };
  const timer = setTimeout(() => { signal?.removeEventListener("abort", onAbort); resolve(); }, milliseconds);
  signal?.addEventListener("abort", onAbort, { once: true });
});

/** Preserve explicit country, full release date and real voice actors. */
const normalizeAnime = (media) => ({
  ...media,
  studios: (media.studios?.nodes || []).map((studio) => studio.name),
  staff: (media.staff?.edges || []).map((edge) => ({ role: edge.role, name: edge.node?.name?.full })),
  director: media.staff?.edges?.find((edge) => /^director$/i.test(edge.role))?.node?.name?.full || null,
  season: media.season?.toLowerCase() || null,
  cover_image: media.coverImage?.extraLarge || media.coverImage?.large || null,
  banner_image: media.bannerImage || null,
  trailer_url: media.trailer?.site === "youtube" ? `https://www.youtube.com/watch?v=${media.trailer.id}` : null,
  cast: (media.characters?.edges || []).flatMap((edge) => (edge.voiceActors || []).slice(0, 1).map((actor) => ({
    actor_name: actor.name?.full || actor.name?.native,
    actor_image_url: actor.image?.large || null,
    character_name: edge.node?.name?.full || edge.node?.name?.native || "",
    role_name: "Lồng tiếng", is_main_cast: edge.role === "MAIN",
  }))),
});

/** Retain raw Jikan dates rather than manufacturing release dates from years. */
const normalizeJikan = (anime) => ({
  ...anime, genres: (anime.genres || []).map((genre) => genre.name),
  studios: (anime.studios || []).map((studio) => studio.name),
  image_url: anime.images?.jpg?.large_image_url || anime.images?.webp?.large_image_url || null,
  trailer_url: anime.trailer?.url || null,
});

export class EvidenceCollectorService {
  constructor({ http = axios, config = env, cache = cacheHelper } = {}) {
    this.http = http;
    this.config = config;
    this.cache = cache;
    this.jikanSlots = Promise.resolve();
    this.jikanNextAt = 0;
  }

  /** Versioned source cache includes exact identity and media namespace. */
  generateQueryHash(title, year, candidate = {}) {
    return crypto.createHash("sha256").update(JSON.stringify({ version: 3,
      title: String(title || "").trim().toLowerCase(), year: year || null,
      sourceIds: Object.entries(candidate.sourceIds || {}).sort(), mediaType: candidate.mediaType || null,
    })).digest("hex");
  }

  /** Bounded transient retries never swallow cancellation. */
  async fetchWithRetry(call, retries = 1, delay = 500, signal) {
    for (let attempt = 0; ; attempt++) {
      signal?.throwIfAborted();
      try { return await call(); } catch (error) {
        if (signal?.aborted || attempt >= retries || !error.response || error.response.status < 500) throw error;
        await pause(delay, signal);
      }
    }
  }

  /** Serialize starts to honor configured requests per second for Jikan. */
  async requestJikan(path, params, signal) {
    const previous = this.jikanSlots;
    let release;
    this.jikanSlots = new Promise((resolve) => { release = resolve; });
    await previous;
    try {
      await pause(Math.max(0, this.jikanNextAt - Date.now()), signal);
      this.jikanNextAt = Date.now() + Math.ceil(1000 / Math.max(1, this.config.jikan.rateLimit || 3));
    } finally { release(); }
    return this.http.get(`${this.config.jikan.baseUrl.replace(/\/$/, "")}/${path}`, { params, signal, timeout: TIMEOUT_MS });
  }

  /** Return all plausible source candidates; first search hit is never authoritative. */
  async searchCandidates({ title, year, mediaType = "all", signal }) {
    const results = await Promise.allSettled([
      this.searchTMDB(title, year, signal), this.searchAniList(title, year, signal),
      this.searchJikan(title, year, signal), this.searchOMDb(title, year, signal),
    ]);
    signal?.throwIfAborted();
    const candidates = results.flatMap((result, index) => result.status === "fulfilled"
      ? result.value.map((data) => sourceIdentity(SOURCES[index], data)) : []);
    const type = normalizeMediaType(mediaType);
    return groupCandidates(candidates.filter((candidate) => (!year || Number(year) === candidate.year) && (!type || type === candidate.mediaType)));
  }

  /** Collect selected IDs and conservative cross-source matches with rejected-source diagnostics. */
  async collectEvidence({ title, year, mediaType = "all", selectedCandidate, forceRefresh = false, signal }) {
    const candidate = selectedCandidate || selectUnambiguousCandidate(
      await this.searchCandidates({ title, year, mediaType, signal }), { title, year, mediaType });
    const cacheKey = `ai:v3:evidence:${this.generateQueryHash(title, year, candidate || {})}`;
    if (!forceRefresh && candidate) {
      const cached = await this.cache.get(cacheKey);
      signal?.throwIfAborted();
      if (cached) return cached;
    }
    const empty = {
      query: { title, year, collected_at: new Date().toISOString() }, selected_candidate: candidate,
      source_presence: Object.fromEntries(SOURCES.map((source) => [source, false])),
      rejected_sources: [], source_errors: [], tmdb: null, anilist: null, jikan: null, omdb: null,
    };
    if (!candidate) return { ...empty, visual_assets: this.extractVisualAssets(), detected_source_type: null };
    const options = { signal, selectedCandidate: candidate };
    const results = await Promise.allSettled([
      this.fetchTMDB(title || candidate.title, candidate.year, options),
      this.fetchAniList(title || candidate.title, candidate.year, options),
      this.fetchJikan(title || candidate.title, candidate.year, candidate.sourceIds?.mal, options),
      this.fetchOMDb(title || candidate.title, candidate.year, options),
    ]);
    const snapshot = { ...empty };
    const verifiedIdentity = { ...candidate, sourceIds: { ...candidate.sourceIds } };
    results.forEach((result, index) => {
      const source = SOURCES[index];
      if (result.status === "rejected") {
        snapshot.source_errors.push({ source, code: signal?.aborted ? "ABORTED" : "SOURCE_UNAVAILABLE" });
      } else if (result.value) {
        const identity = sourceIdentity(source, result.value);
        if (sameWork(verifiedIdentity, identity)) {
          snapshot[source] = result.value;
          snapshot.source_presence[source] = true;
          Object.assign(verifiedIdentity.sourceIds, identity.sourceIds);
        } else snapshot.rejected_sources.push({ source, reason: "IDENTITY_MISMATCH" });
      }
    });
    if (!snapshot.jikan && snapshot.anilist?.idMal && !signal?.aborted) {
      try {
        const jikan = await this.fetchJikan("", null, snapshot.anilist.idMal, { signal });
        if (jikan && sameWork(verifiedIdentity, sourceIdentity("jikan", jikan))) {
          snapshot.jikan = jikan; snapshot.source_presence.jikan = true;
        }
      } catch { snapshot.source_errors.push({ source: "jikan", code: "SOURCE_UNAVAILABLE" }); }
    }
    snapshot.visual_assets = this.extractVisualAssets(snapshot.tmdb, snapshot.anilist, snapshot.jikan);
    snapshot.detected_source_type = this.detectSourceType(snapshot.anilist);
    if (!signal?.aborted && Object.values(snapshot.source_presence).some(Boolean)) {
      await this.cache.set(cacheKey, snapshot, AI_CACHE_TTL.EVIDENCE_SECONDS);
    }
    logger.info("[AI][Evidence] Source verification complete", {
      verified: Object.values(snapshot.source_presence).filter(Boolean).length, rejected: snapshot.rejected_sources.length,
    });
    return snapshot;
  }

  /** Enrich using only aliases already verified by source data. */
  async enrichEvidenceWithTitles({ previousSnapshot = {}, candidateTitles = {}, signal }) {
    const anchor = previousSnapshot.selected_candidate;
    if (!anchor || signal?.aborted) return { snapshot: previousSnapshot, newlyFoundCount: 0 };
    const trusted = new Set([...(anchor.titles || []), ...SOURCES.flatMap((source) =>
      previousSnapshot[source] ? sourceIdentity(source, previousSnapshot[source]).titles : [])]);
    const title = Object.values(candidateTitles).find((value) => trusted.has(value));
    if (!title) return { snapshot: previousSnapshot, newlyFoundCount: 0 };
    const found = await this.collectEvidence({ title, year: anchor.year, selectedCandidate: anchor, forceRefresh: true, signal });
    const snapshot = { ...found, ...previousSnapshot, source_presence: { ...previousSnapshot.source_presence } };
    let newlyFoundCount = 0;
    for (const source of SOURCES) if (!snapshot[source] && found[source]) {
      snapshot[source] = found[source]; snapshot.source_presence[source] = true; newlyFoundCount++;
    }
    snapshot.visual_assets = this.extractVisualAssets(snapshot.tmdb, snapshot.anilist, snapshot.jikan);
    snapshot.detected_source_type = this.detectSourceType(snapshot.anilist);
    return { snapshot, newlyFoundCount };
  }

  /** Search TMDB movie and TV namespaces, excluding people. */
  async searchTMDB(title, year, signal) {
    if (!this.config.tmdb.enabled) return [];
    const response = await this.http.get(`${this.config.tmdb.baseUrl}/search/multi`, {
      params: { api_key: this.config.tmdb.apiKey, query: title, language: "vi-VN", include_adult: false },
      signal, timeout: TIMEOUT_MS,
    });
    return (response.data?.results || []).filter((item) => ["movie", "tv"].includes(item.media_type)).slice(0, 10).map((item) => ({
      ...item, poster_path: item.poster_path ? `${this.config.tmdb.imageBaseUrl}/w185${item.poster_path}` : null,
    }));
  }

  /** Search a page of anime to preserve ambiguity between seasons. */
  async searchAniList(title, year, signal) {
    const response = await this.http.post("https://graphql.anilist.co", {
      query: `query($search:String,$year:Int) { Page(perPage:10) { media(search:$search,seasonYear:$year,type:ANIME,sort:SEARCH_MATCH) { ${animeFields} } } }`,
      variables: { search: title, year: year ? Number(year) : undefined },
    }, { signal, timeout: TIMEOUT_MS });
    return (response.data?.data?.Page?.media || []).map(normalizeAnime);
  }

  /** Search configured Jikan endpoint and bounded candidate page. */
  async searchJikan(title, year, signal) {
    if (!this.config.jikan.enabled) return [];
    const response = await this.requestJikan("anime", { q: title, limit: 10,
      ...(year ? { start_date: `${year}-01-01`, end_date: `${year}-12-31` } : {}) }, signal);
    return (response.data?.data || []).map(normalizeJikan);
  }

  /** Search IMDb candidates; title-only detail queries are deliberately avoided. */
  async searchOMDb(title, year, signal) {
    if (!this.config.omdb.enabled) return [];
    const response = await this.http.get(this.config.omdb.baseUrl, {
      params: { apikey: this.config.omdb.apiKey, s: title, y: year || undefined }, signal, timeout: TIMEOUT_MS,
    });
    return (response.data?.Search || []).slice(0, 10).map((item) => ({
      ...item, title: item.Title, year: item.Year, type: item.Type, imdb_id: item.imdbID,
    }));
  }

  /** Fetch complete TMDB metadata including runtime, countries, studios and external IDs. */
  async fetchTMDB(title, year, { selectedCandidate, signal } = {}) {
    if (!this.config.tmdb.enabled) return null;
    let identity = selectedCandidate;
    if (!identity?.sourceIds?.tmdb) {
      const candidates = (await this.searchTMDB(title, year, signal)).map((data) => sourceIdentity("tmdb", data));
      identity = selectedCandidate ? candidates.find((candidate) => sameWork(selectedCandidate, candidate))
        : selectUnambiguousCandidate(candidates, { title, year });
    }
    if (!identity?.sourceIds?.tmdb) return null;
    const mediaType = identity.mediaType === "series" ? "tv" : "movie";
    const response = await this.http.get(`${this.config.tmdb.baseUrl}/${mediaType}/${identity.sourceIds.tmdb}`, {
      params: { api_key: this.config.tmdb.apiKey, language: "vi-VN", append_to_response: "credits,videos,external_ids,alternative_titles" },
      signal, timeout: TIMEOUT_MS,
    });
    const detail = response.data;
    const trailer = detail.videos?.results?.find((video) => video.site === "YouTube" && ["Trailer", "Teaser"].includes(video.type));
    const image = (path, size = "original") => path ? `${this.config.tmdb.imageBaseUrl}/${size}${path}` : null;
    return {
      ...detail, media_type: mediaType, title: detail.title || detail.name, original_title: detail.original_title || detail.original_name,
      release_date: detail.release_date || detail.first_air_date || null,
      titles: (detail.alternative_titles?.titles || detail.alternative_titles?.results || []).map((item) => item.title),
      is_animation: (detail.genres || []).some((genre) => genre.id === 16), genres: (detail.genres || []).map((genre) => genre.name),
      countries: (detail.production_countries || []).map((country) => country.iso_3166_1),
      studios: (detail.production_companies || []).map((studio) => studio.name),
      duration: detail.runtime || detail.episode_run_time?.[0] || null, imdb_id: detail.external_ids?.imdb_id || detail.imdb_id || null,
      director: detail.credits?.crew?.find((crew) => crew.job === "Director")?.name || null,
      poster_path: image(detail.poster_path), backdrop_path: image(detail.backdrop_path),
      trailer_url: trailer ? `https://www.youtube.com/watch?v=${trailer.key}` : null,
      cast: (detail.credits?.cast || []).slice(0, 12).map((actor) => ({
        actor_name: actor.name || actor.original_name, actor_image_url: image(actor.profile_path, "w185"),
        character_name: actor.character, role_name: "Diễn viên", is_main_cast: actor.order < 3, cast_order: actor.order,
      })),
    };
  }

  /** Fetch AniList using known IDs or a conservative cross-source match. */
  async fetchAniList(title, year, { selectedCandidate, signal } = {}) {
    if (selectedCandidate?.isAnimation === false) return null;
    if (!selectedCandidate?.sourceIds?.anilist && !selectedCandidate?.sourceIds?.mal) {
      const records = await this.searchAniList(title, year, signal);
      const candidates = records.map((data) => sourceIdentity("anilist", data));
      const choice = selectedCandidate ? candidates.find((candidate) => sameWork(selectedCandidate, candidate))
        : selectUnambiguousCandidate(candidates, { title, year });
      return records.find((data) => data.id === choice?.sourceIds?.anilist) || null;
    }
    const response = await this.http.post("https://graphql.anilist.co", {
      query: `query($id:Int,$mal:Int) { Media(id:$id,idMal:$mal,type:ANIME) { ${animeFields} } }`,
      variables: {
        id: selectedCandidate.sourceIds.anilist ? Number(selectedCandidate.sourceIds.anilist) : undefined,
        mal: !selectedCandidate.sourceIds.anilist && selectedCandidate.sourceIds.mal ? Number(selectedCandidate.sourceIds.mal) : undefined,
      },
    }, { signal, timeout: TIMEOUT_MS });
    return response.data?.data?.Media ? normalizeAnime(response.data.data.Media) : null;
  }

  /** Fetch MAL identity or one exact conservative Jikan match. */
  async fetchJikan(title, year, malId, { selectedCandidate, signal } = {}) {
    if (!this.config.jikan.enabled || selectedCandidate?.isAnimation === false) return null;
    if (malId) {
      const response = await this.requestJikan(`anime/${Number(malId)}/full`, {}, signal);
      return response.data?.data ? normalizeJikan(response.data.data) : null;
    }
    const records = await this.searchJikan(title, year, signal);
    const candidates = records.map((data) => sourceIdentity("jikan", data));
    const choice = selectedCandidate ? candidates.find((candidate) => sameWork(selectedCandidate, candidate))
      : selectUnambiguousCandidate(candidates, { title, year });
    return records.find((data) => data.mal_id === choice?.sourceIds?.mal) || null;
  }

  /** Fetch OMDb using explicit IMDb identity. */
  async fetchOMDb(title, year, { selectedCandidate, signal } = {}) {
    if (!this.config.omdb.enabled) return null;
    let id = selectedCandidate?.sourceIds?.imdb;
    if (!id) {
      const candidates = (await this.searchOMDb(title, year, signal)).map((data) => sourceIdentity("omdb", data));
      const choice = selectedCandidate ? candidates.find((candidate) => sameWork(selectedCandidate, candidate))
        : selectUnambiguousCandidate(candidates, { title, year });
      id = choice?.sourceIds?.imdb;
    }
    if (!id) return null;
    const response = await this.http.get(this.config.omdb.baseUrl, {
      params: { apikey: this.config.omdb.apiKey, i: id, plot: "full" }, signal, timeout: TIMEOUT_MS,
    });
    const data = response.data;
    if (data.Response === "False") return null;
    const available = (value) => value && value !== "N/A" ? value : null;
    return {
      imdb_id: data.imdbID, title: data.Title, year: data.Year, type: data.Type, rated: available(data.Rated), released: available(data.Released),
      runtime: available(data.Runtime), genre: available(data.Genre)?.split(",").map((genre) => genre.trim()) || [],
      director: available(data.Director), plot: available(data.Plot), country: available(data.Country),
      imdb_rating: available(data.imdbRating) ? Number(data.imdbRating) : null,
    };
  }

  /** Expose source images without downloads or uploads. */
  extractVisualAssets(tmdb, anilist, jikan) {
    const asset = (url, source, ratio) => ({ url, source, ratio, label: `${source} (${ratio})` });
    return {
      posters: [
        tmdb?.poster_path && asset(tmdb.poster_path, "TMDB", "2:3"),
        anilist?.cover_image && asset(anilist.cover_image, "AniList", "2:3"),
        jikan?.image_url && asset(jikan.image_url, "MyAnimeList", "2:3"),
      ].filter(Boolean),
      covers: tmdb?.backdrop_path ? [asset(tmdb.backdrop_path, "TMDB", "16:9")] : [],
      banners: anilist?.banner_image ? [asset(anilist.banner_image, "AniList", "21:9")] : [],
    };
  }

  /** Map only explicitly supplied source material. */
  detectSourceType(anilist) {
    const source = String(anilist?.source || "").toUpperCase();
    return ({
      MANGA: "manga", WEB_MANGA: "manga", DOUJINSHI: "manga", LIGHT_NOVEL: "light_novel", ORIGINAL: "original",
      MULTIMEDIA_PROJECT: "original", VIDEO_GAME: "game", VISUAL_NOVEL: "visual_novel", NOVEL: "novel", OTHER: "other",
    })[source] || null;
  }
}

export const evidenceCollector = new EvidenceCollectorService();
export default evidenceCollector;

