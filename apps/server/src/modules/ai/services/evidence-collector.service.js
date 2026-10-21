/** Bounded collection and enrichment; no model, queue or entity-write dependency. */
import axios from 'axios';
import crypto from 'node:crypto';
import { env } from '../../../config/env.config.js';
import { createSourceHttp } from '../helpers/source-http.helper.js';
import { cacheHelper, getRedisClient } from '../../../config/redis.config.js';
import { AI_CACHE_TTL, AI_ENRICHMENT_LIMITS, extractVisualAssets, foldSearchTitle, groupCandidates, rankSearchCandidates, sameWork, selectUnambiguousCandidate, sourceIdentity } from '../helpers/ai-metadata.helper.js';
import { JikanRateLimiter, fetchAniList, fetchAniListStaff, fetchJikan, fetchOMDb, fetchTMDB, fetchTMDBPerson, searchAniList, searchJikan, searchOMDb, searchTMDB } from '../helpers/ai-sources.helper.js';
import { parseSourceQuery } from '../../movie/helpers/movie-search.helper.js';
const SOURCES = ["tmdb", "anilist", "jikan", "omdb"];
const TIMEOUT_MS = 10000;

export class EvidenceCollectorService {
  constructor({ http = axios, config = env, cache = cacheHelper } = {}) {
    this.http = http === axios ? createSourceHttp({ http, redis: Object.fromEntries(['get','set','eval'].map((method) => [method, (...args) => getRedisClient()[method](...args)])) }) : http;
    this.config = config;
    this.cache = cache;
    this.jikanLimiter = new JikanRateLimiter(config.jikan?.rateLimit || 3);
  }

  generateQueryHash(title, year, candidate = {}) {
    return crypto.createHash("sha256").update(JSON.stringify({
      version: 5, locale: "vi-VN",
      title: String(title || "").trim().toLowerCase(),
      year: year || null,
      sourceIds: Object.entries(candidate.sourceIds || {}).sort(),
      mediaType: candidate.mediaType || null,
    })).digest("hex");
  }

  async searchCandidateResult({ title, year, signal, mediaType = "all", sourceHints = {}, alternateTitle, onPrimaryResult }) {
    const attempted = [], succeeded = [], sourceErrors = [];
    const enabled = (source) => source === 'anilist' ? this.config.anilist?.enabled !== false : Boolean(this.config[source]?.enabled);
    const run = async (source, search) => {
      signal?.throwIfAborted();
      if (!enabled(source)) { sourceErrors.push({ source, code: "SOURCE_DISABLED" }); return []; }
      attempted.push(source);
      try {
        const records = await search();
        succeeded.push(source);
        return records.map((data) => sourceIdentity(source, data));
      } catch (error) {
        signal?.throwIfAborted();
        sourceErrors.push({ source, code: error.code || "SOURCE_UNAVAILABLE" });
        return [];
      }
    };

    const direct = parseSourceQuery(title);
    if (direct) {
      const source = ({ mal: 'jikan', imdb: 'omdb' })[direct.source] || direct.source;
      const candidate = { sourceIds: { [direct.source]: direct.id }, mediaType: direct.mediaType, isAnimation: ['mal','anilist'].includes(direct.source) ? true : undefined };
      const fetchers = {
        tmdb: () => fetchTMDB(this.http, this.config, { selectedCandidate: candidate, signal }),
        anilist: () => fetchAniList(this.http, { selectedCandidate: candidate, signal }),
        jikan: () => fetchJikan(this.http, this.config, this.jikanLimiter, { malId: direct.id, signal }),
        omdb: () => fetchOMDb(this.http, this.config, { selectedCandidate: candidate, signal }),
      };
      const records = await run(source, async () => { const record = await fetchers[source](); return record ? [record] : []; });
      return { candidates: groupCandidates(records).filter((item) => (!year || item.year === Number(year)) && (!mediaType || mediaType === "all" || item.mediaType === (mediaType === "tv" ? "series" : mediaType))), sources_attempted: attempted, sources_succeeded: succeeded, source_errors: sourceErrors, direct: true };
    }
    const searches = [];
    if (this.config.tmdb?.enabled) searches.push(() => run('tmdb', () => searchTMDB(this.http, this.config, { title, year, signal, mediaType })));
    if (this.config.anilist?.enabled !== false) searches.push(() => run('anilist', () => searchAniList(this.http, { title, year, signal })));
    if (this.config.jikan?.enabled) searches.push(() => run('jikan', () => searchJikan(this.http, this.config, this.jikanLimiter, { title, year, signal })));
    if (this.config.omdb?.enabled) searches.push(() => run('omdb', () => searchOMDb(this.http, this.config, { title, year, signal })));

    const initial = (await Promise.all(searches.map((s) => s()))).flat();
    const primaryCandidates = groupCandidates(initial);
    const primaryResult = {
      candidates: rankSearchCandidates(primaryCandidates, title),
      sources_attempted: [...attempted],
      sources_succeeded: [...succeeded],
      source_errors: [...sourceErrors],
    };
    onPrimaryResult?.(primaryResult);

    const hintIds = sourceHints.sourceIds || {};
    const hasConsensus = primaryCandidates.some((c) =>
      Object.entries(hintIds).some(([src, id]) => c.sourceIds[src] && String(c.sourceIds[src]) === String(id))
      || Object.keys(c.sourceIds).length >= 2
    );

    if (!hasConsensus && alternateTitle && foldSearchTitle(alternateTitle) !== foldSearchTitle(title)) {
      const altInitial = (await Promise.all([
        () => run("tmdb", () => searchTMDB(this.http, this.config, { title: alternateTitle, year, signal, mediaType })),
        () => run("anilist", () => searchAniList(this.http, { title: alternateTitle, year, signal })),
        () => run("jikan", () => searchJikan(this.http, this.config, this.jikanLimiter, { title: alternateTitle, year, signal })),
        () => run("omdb", () => searchOMDb(this.http, this.config, { title: alternateTitle, year, signal })),
      ].map((s) => s()))).flat();

      const combined = groupCandidates([...initial, ...altInitial]);
      return {
        candidates: rankSearchCandidates(combined, title),
        sources_attempted: [...new Set(attempted)],
        sources_succeeded: [...new Set(succeeded)],
        source_errors: sourceErrors,
      };
    }

    return primaryResult;
  }

  async searchCandidates(params) {
    const result = await this.searchCandidateResult(params);
    return result.candidates;
  }

  async collectEvidence({ title, year, mediaType = "all", selectedCandidate = null, forceRefresh = false, signal }) {
    signal?.throwIfAborted();
    let candidate = selectedCandidate;
    if (!candidate && title) {
      const candidates = await this.searchCandidates({ title, year, mediaType, signal });
      candidate = selectUnambiguousCandidate(candidates, { title, year, mediaType });
    }

    if (!candidate) throw Object.assign(new Error("Chưa xác minh tác phẩm."), { code: "AI_IDENTITY_REQUIRED" });
    const queryHash = this.generateQueryHash(title, year, candidate || {});
    const cacheKey = `ai:v5:evidence:${queryHash}`;
    if (!forceRefresh) {
      const cached = await this.cache.get(cacheKey);
      if (cached) return cached;
    }

    const http = forceRefresh && this.http.fresh ? this.http.fresh() : this.http;
    const fetchers = {
      tmdb: (cand, sig) => fetchTMDB(http, this.config, { title, year, selectedCandidate: cand, signal: sig }),
      anilist: (cand, sig) => fetchAniList(http, { title, year, selectedCandidate: cand, signal: sig }),
      jikan: (cand, sig) => fetchJikan(http, this.config, this.jikanLimiter, { title, year, selectedCandidate: cand, signal: sig }),
      omdb: (cand, sig) => fetchOMDb(http, this.config, { title, year, selectedCandidate: cand, signal: sig }),
    };

    const results = await Promise.allSettled(
      SOURCES.map(async (source) => {
        signal?.throwIfAborted();
        const data = source === "anilist" && this.config.anilist?.enabled === false ? null : await fetchers[source](candidate, signal);
        return { source, data };
      })
    );

    signal?.throwIfAborted();
    const snapshot = {
      query: { title, year, mediaType },
      source_presence: {},
      source_errors: [],
      rejected_sources: [],
      visual_assets: { posters: [], covers: [], banners: [] },
      selected_candidate: candidate || null,
    };

    for (let i = 0; i < SOURCES.length; i++) {
      const source = SOURCES[i];
      const outcome = results[i];
      if (outcome.status === "fulfilled" && outcome.value.data) {
        const item = outcome.value.data;
        if (sameWork(candidate, sourceIdentity(source, item))) {
          snapshot[source] = item;
          snapshot.source_presence[source] = true;
        } else {
          snapshot.rejected_sources.push({ source, reason: "IDENTITY_MISMATCH" });
          snapshot.source_presence[source] = false;
        }
      } else {
        snapshot[source] = null;
        snapshot.source_presence[source] = false;
        if (outcome.status === "rejected") {
          snapshot.source_errors.push({ source, code: outcome.reason?.code || "FETCH_FAILED" });
        }
      }
    }

    snapshot.visual_assets = extractVisualAssets(snapshot);
    await this.cache.set(cacheKey, snapshot, snapshot.source_errors.length || !Object.values(snapshot.source_presence).some(Boolean) ? 60 : AI_CACHE_TTL.EVIDENCE_SECONDS);
    return snapshot;
  }

  async enrichEvidenceWithTitles({ previousSnapshot = {}, candidateTitles = {}, signal }) {
    signal?.throwIfAborted();
    const query = candidateTitles.verified || candidateTitles.english || candidateTitles.romaji;
    if (!query) return { snapshot: previousSnapshot, newlyFoundCount: 0 };

    const snapshot = { ...previousSnapshot, source_presence: { ...previousSnapshot.source_presence } };
    const missingSources = SOURCES.filter((s) => !snapshot.source_presence[s] && (s === "anilist" ? this.config.anilist?.enabled !== false : this.config[s]?.enabled));
    if (!missingSources.length) return { snapshot, newlyFoundCount: 0 };

    let newlyFound = 0;
    const fetchers = {
      tmdb: (sig) => fetchTMDB(this.http, this.config, { title: query, selectedCandidate: snapshot.selected_candidate, signal: sig }),
      anilist: (sig) => fetchAniList(this.http, { title: query, selectedCandidate: snapshot.selected_candidate, signal: sig }),
      jikan: (sig) => fetchJikan(this.http, this.config, this.jikanLimiter, { title: query, selectedCandidate: snapshot.selected_candidate, signal: sig }),
      omdb: (sig) => fetchOMDb(this.http, this.config, { title: query, selectedCandidate: snapshot.selected_candidate, signal: sig }),
    };

    const results = await Promise.allSettled(missingSources.map((src) => fetchers[src](signal)));
    for (let i = 0; i < missingSources.length; i++) {
      const source = missingSources[i];
      const outcome = results[i];
      if (outcome.status === "fulfilled" && outcome.value && snapshot.selected_candidate
        && sameWork(snapshot.selected_candidate, sourceIdentity(source, outcome.value))) {
        snapshot[source] = outcome.value;
        snapshot.source_presence[source] = true;
        newlyFound++;
      } else if (outcome.status === "fulfilled" && outcome.value) {
        snapshot.rejected_sources = [...(snapshot.rejected_sources || []), { source, reason: "IDENTITY_MISMATCH" }];
      }
    }

    if (newlyFound > 0) {
      snapshot.visual_assets = extractVisualAssets(snapshot);
    }
    return { snapshot, newlyFoundCount: newlyFound };
  }

  async enrichActorDetails(actors = [], { signal, maxActors = AI_ENRICHMENT_LIMITS.ACTOR_LIMIT, concurrency = AI_ENRICHMENT_LIMITS.MAX_CONCURRENCY } = {}) {
    if (!Array.isArray(actors) || actors.length === 0) return [];

    const scored = actors.map((actor, index) => {
      let score = 0;
      if (actor.is_new && actor.is_main_cast) score = 40;
      else if (actor.is_new) score = 30;
      else if (actor.is_main_cast) score = 20;
      else score = 10;
      return { actor, index, score, hasSource: Boolean(actor.source && actor.source_id) };
    });

    const eligible = scored.filter((item) => item.hasSource);
    eligible.sort((a, b) => b.score - a.score || a.index - b.index);

    const seenIdentities = new Set();
    const toEnrich = [];
    for (const item of eligible) {
      const identityKey = `${item.actor.source}:${item.actor.source_id}`;
      if (!seenIdentities.has(identityKey) && toEnrich.length < maxActors) {
        seenIdentities.add(identityKey);
        toEnrich.push(item);
      }
    }

    const toEnrichIndices = new Set(toEnrich.map((item) => item.index));
    const enrichedResults = new Map();

    const enrichItem = async ({ actor }) => {
      try {
        signal?.throwIfAborted();
        let enriched = null;
        if (actor.source === "tmdb") {
          enriched = await this.fetchTMDBPerson(actor.source_id, { signal });
        } else if (actor.source === "anilist") {
          enriched = await this.fetchAniListStaff(actor.source_id, { signal });
        }
        if (enriched) {
          return {
            ...actor,
            gender: enriched.gender || actor.gender || null,
            birth_date: enriched.birth_date || actor.birth_date || null,
            nationality: enriched.nationality || actor.nationality || null,
            biography: enriched.biography || actor.biography || null,
            aliases: enriched.aliases?.length ? enriched.aliases : (actor.aliases || []),
            actor_image_url: actor.actor_image_url || enriched.image_url || null,
            metadata: {
              ...(actor.metadata || {}),
              ...(enriched.metadata || {}),
              enriched_at: new Date().toISOString(),
            },
            enrichment_status: "enriched",
          };
        }
        return { ...actor, enrichment_status: "failed" };
      } catch {
        signal?.throwIfAborted();
        return { ...actor, enrichment_status: "failed" };
      }
    };

    let cursor = 0;
    await Promise.all(Array.from({ length: Math.min(toEnrich.length, Math.max(1, Math.min(3, Number(concurrency) || 1))) }, async () => {
      while (cursor < toEnrich.length) {
        signal?.throwIfAborted();
        const item = toEnrich[cursor++];
        enrichedResults.set(item.index, await enrichItem(item));
      }
    }));

    return actors.map((actor, idx) => {
      if (toEnrichIndices.has(idx)) {
        return enrichedResults.get(idx) || { ...actor, enrichment_status: "failed" };
      }
      return { ...actor, enrichment_status: actor.source_id ? "skipped" : "unsupported_source" };
    });
  }

  /** Expose source images without downloads or uploads. */
  extractVisualAssets(tmdb, anilist, jikan) {
    if (tmdb && typeof tmdb === "object" && ("tmdb" in tmdb || "anilist" in tmdb || "jikan" in tmdb)) {
      const snap = tmdb;
      tmdb = snap.tmdb;
      anilist = snap.anilist;
      jikan = snap.jikan;
    }
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

  async enrichDirectorDetails({ directorName, tmdbDirectorId, anilistStaffId, signal, timeout = AI_ENRICHMENT_LIMITS.TIMEOUT_MS } = {}) {
    if (!directorName && !tmdbDirectorId && !anilistStaffId) {
      return { schema_version: 1, primary: null, people: [] };
    }

    let enriched = null;
    let source = null;
    let sourceId = null;

    try {
      if (tmdbDirectorId) {
        source = "tmdb";
        sourceId = String(tmdbDirectorId);
        enriched = await this.fetchTMDBPerson(tmdbDirectorId, { signal, timeout });
      } else if (anilistStaffId) {
        source = "anilist";
        sourceId = String(anilistStaffId);
        enriched = await this.fetchAniListStaff(anilistStaffId, { signal, timeout });
      }

      const name = directorName || enriched?.name || null;
      if (!name && !sourceId) {
        return { schema_version: 1, primary: null, people: [] };
      }

      signal?.throwIfAborted();
      const primaryKey = source && sourceId ? `${source}:person:${sourceId}` : null;
      const person = {
        source: source || "unknown",
        source_id: sourceId,
        name,
        credit_role: "Director",
        image_url: enriched?.image_url || null,
        gender: enriched?.gender || null,
        birth_date: enriched?.birth_date || null,
        nationality: enriched?.nationality || null,
        biography: enriched?.biography || null,
      };

      return {
        schema_version: 1,
        primary: primaryKey,
        people: [person],
      };
    } catch {
      signal?.throwIfAborted();
      return {
        schema_version: 1,
        primary: directorName ? `unknown:person:${directorName}` : null,
        people: [{ name: directorName, credit_role: "Director", enrichment_status: "failed" }],
      };
    }
  }

  fetchTMDBPerson(id, options) { return fetchTMDBPerson(this.http, this.config, this.cache, id, options); }
  fetchAniListStaff(id, options) { return fetchAniListStaff(this.http, this.cache, id, options); }
}

export const evidenceCollector = new EvidenceCollectorService();
