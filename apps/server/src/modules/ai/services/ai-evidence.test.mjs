/**
 * @file ai-evidence.test.mjs
 * @module AI_Evidence_Tests
 * @description Offline fixtures for identity, evidence validation, confidence and pipeline failure behavior.
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { registerHooks } from "node:module";

import { groupCandidates, sameWork, sourceIdentity, selectUnambiguousCandidate } from "./movie-identity.util.js";
import { validDate, validUrl, buildEvidenceFields } from "./evidence-fields.util.js";
import { aiOutputValidator } from "../validators/ai-output.validator.js";
import { confidenceCalculator } from "./confidence-calculator.service.js";
import { conflictDetector } from "./conflict-detector.service.js";
import { AIProviderError } from "../providers/ai-provider-policy.js";

// Prevent production module initialization from loading .env, DB, queue or Redis.
const hook = registerHooks({
  resolve(specifier, context, nextResolve) {
    let source;
    if (specifier.endsWith("/env.config.js")) source = "export const env = {};";
    if (specifier.endsWith("/redis.config.js")) source = "export const cacheHelper = {get:async()=>null,set:async()=>true};";
    if (specifier.endsWith("/logger.js")) source = "export const logger = {info(){},warn(){},error(){}};";
    if (specifier.endsWith("/entity-matcher.service.js")) source = "export const entityMatcher = {};";
    if (specifier.endsWith("/ai-orchestrator.service.js")) source = "export const aiOrchestrator = {};";
    if (specifier.endsWith("/audit.service.js")) source = "export const aiAuditService = {};";
    return source ? { url: `data:text/javascript,${encodeURIComponent(source)}`, shortCircuit: true } : nextResolve(specifier, context);
  },
});
const { EvidenceCollectorService } = await import("./evidence-collector.service.js");
const { MovieResolutionService } = await import("./movie-resolution.service.js");
const { AIPipelineService, projectSuggestionScope } = await import("./ai-pipeline.service.js");
hook.deregister();

const candidate = (source, data) => sourceIdentity(source, data);
const anime = (id = 10, year = 2024) => ({
  id, idMal: 20, title: { romaji: "Example", english: "Example", native: "例" },
  format: "TV", seasonYear: year, status: "FINISHED", countryOfOrigin: "JP",
  genres: ["Action"], studios: ["Studio"], description: "A verified synopsis",
  episodes: 12, duration: 24, director: "Director", cast: [{ actor_name: "Known Actor", character_name: "Hero" }],
});
const snapshot = () => ({
  anilist: anime(), jikan: null, tmdb: null, omdb: null,
  selected_candidate: { ...candidate("anilist", anime()), candidateId: "fixture" },
  source_presence: { anilist: true, jikan: false, tmdb: false, omdb: false },
  source_errors: [], rejected_sources: [], visual_assets: { posters: [], covers: [], banners: [] },
});

test("identity keeps remakes, seasons, formats and live-action separate", () => {
  const original = candidate("anilist", anime());
  assert.equal(sameWork(original, candidate("jikan", { mal_id: 20, title: "Any canonical alias", year: 2024, type: "TV" })), true);
  assert.equal(sameWork(original, candidate("anilist", { ...anime(11), idMal: 21 })), false);
  assert.equal(sameWork(original, candidate("tmdb", { id: 5, title: "Example", release_date: "2024-02-01", media_type: "tv", genre_ids: [] })), false);
  assert.equal(sameWork(original, candidate("tmdb", { id: 5, title: "Example", release_date: "2023-02-01", media_type: "tv", genre_ids: [16] })), false);
  assert.equal(sameWork(original, candidate("tmdb", { id: 5, title: "Example Season 2", release_date: "2024-02-01", media_type: "tv", genre_ids: [16] })), false);
  assert.equal(sameWork(original, candidate("tmdb", { id: 5, title: "Example", release_date: "2024-02-01", media_type: "movie", genre_ids: [16] })), false);
  const movie = candidate("tmdb", { id: 5, title: "Same", release_date: "2024-02-01", media_type: "movie" });
  const tv = candidate("tmdb", { id: 5, title: "Same", first_air_date: "2024-02-01", media_type: "tv" });
  assert.equal(sameWork(movie, tv), false, "TMDB media IDs have distinct namespaces");
});

test("candidate grouping merges linked MAL records but never automatically chooses remakes", () => {
  const candidates = groupCandidates([
    candidate("anilist", anime()),
    candidate("jikan", { mal_id: 20, title: "Example", year: 2024, type: "TV" }),
    candidate("tmdb", { id: 100, title: "Example", release_date: "2020-01-02", media_type: "tv", genre_ids: [16] }),
  ]);
  assert.equal(candidates.length, 2);
  assert.deepEqual(candidates[0].sourceIds, { anilist: 10, mal: 20 });
  assert.equal(selectUnambiguousCandidate(candidates, { title: "Example" }), null);
  assert.equal(selectUnambiguousCandidate(candidates, { title: "Example", year: 2024 }).sourceIds.anilist, 10);
  assert.equal(selectUnambiguousCandidate(candidates, { title: "Examp" }), null);
});

test("resolver returns candidates and requires selection instead of choosing first hit", async () => {
  const values = groupCandidates([
    candidate("tmdb", { id: 1, title: "Example", release_date: "2020-02-01", media_type: "movie" }),
    candidate("tmdb", { id: 2, title: "Example", release_date: "2024-02-01", media_type: "movie" }),
  ]);
  const resolver = new MovieResolutionService({ searchCandidates: async () => values });
  const ambiguous = await resolver.resolve({ title: "Example" });
  assert.equal(ambiguous.requiresSelection, true);
  assert.equal(ambiguous.selectedCandidate, null);
  assert.equal((await resolver.resolve({ title: "Example", year: 2024 })).selectedCandidate.sourceIds.tmdb, 2);
  assert.equal((await new MovieResolutionService({ searchCandidates: async () => [] }).resolve({ title: "Missing" })).requiresSelection, false);
});

test("real dates, URLs and integer IDs are validated without manufactured January dates", () => {
  assert.equal(validDate("2024"), null);
  assert.equal(validDate("2023-02-29"), null);
  assert.equal(validDate("2024-02-30"), null);
  assert.equal(validDate("2024/2/29"), "2024-02-29");
  assert.equal(validUrl("javascript:alert(1)"), null);
  assert.equal(validUrl("https://user:secret@example.test"), null);
  const { sanitizedData: data, flags } = aiOutputValidator.validateAndSanitize({
    release_date: "2024", release_year: 2024, tmdb_id: 999999,
    country_id: "invented", genre_ids: ["invented"], actor_cast: [{ actor_id: "invented" }],
    type: "cartoon", status: "made-up", trailer_url: "javascript:alert(1)",
    titles: [{ type: "native", title: "Invented" }, null, { type: "invalid", title: "Example" }],
    field_provenance: { director: "web_search", tmdb_id: "tmdb" },
    director: "Invented Director", confidence_score: 1,
  }, snapshot());
  assert.equal(data.release_date, undefined);
  assert.equal(data.release_year, 2024);
  assert.equal(data.tmdb_id, undefined);
  assert.equal(data.country_id, null);
  assert.deepEqual(data.genre_ids, []);
  assert.deepEqual(data.actor_cast, []);
  assert.equal(data.director, "Director");
  assert.equal(data.field_provenance.director, "anilist");
  assert.equal(data.field_provenance.tmdb_id, undefined);
  assert.equal(data.field_provenance.titles, "anilist");
  assert.equal(data.field_evidence.titles.some((item) => item.value === "例"), true);
  assert.equal(data.type, "series");
  assert.equal(data.quality, null);
  assert.equal(data.sub_dub_type, null);
  assert.equal(data.titles.some((item) => item.title === "Invented"), false);
  assert.equal(flags.includes("INVALID_RELEASE_DATE"), true);
});

test("missing evidence cannot produce a default status, classification or confidence boost", () => {
  const { sanitizedData } = aiOutputValidator.validateAndSanitize({
    title: "Invented", type: "movie", status: "completed", age_rating: "PG-13", release_date: "2024-01-01",
    description: "Invented", confidence_score: 1, field_provenance: { title: "tmdb" },
  }, {});
  assert.equal(sanitizedData.title, undefined);
  assert.equal(sanitizedData.status, undefined);
  assert.equal(sanitizedData.description, undefined);
  const confidence = confidenceCalculator.calculateConfidenceScore({ parsedData: sanitizedData, evidenceSnapshot: { source_presence: { tmdb: true } } });
  assert.equal(confidence.final, 0);
  assert.equal(confidence.llm_self_reported, 1);
  assert.equal(confidence.breakdown.comparable_fields, 0);
  assert.equal(confidence.breakdown.consensus_rate, 0);
  assert.deepEqual(confidence.field_scores, {});
});

test("source-only synthesis retains explicit native, romaji and English title roles", () => {
  const evidence = snapshot();
  evidence.anilist.title = { userPreferred: "Example", native: "例", romaji: "Rei", english: "Example" };
  const data = aiOutputValidator.validateAndSanitize({}, evidence).sanitizedData;
  assert.deepEqual(data.titles, [
    { type: "default", title: "Example" }, { type: "native", title: "例" },
    { type: "romaji", title: "Rei" }, { type: "english", title: "Example" },
  ]);
  assert.equal(data.original_title, "例");
  assert.equal(data.field_evidence.titles.some((item) => item.type === "native" && item.value === "例"), true);
});

test("LLM cannot relabel a known English alias as native or replace the selected default", () => {
  const evidence = snapshot();
  evidence.anilist.title = { userPreferred: "Example", native: "例", romaji: "Rei", english: "Example" };
  const { sanitizedData: data, flags } = aiOutputValidator.validateAndSanitize({ titles: [
    { type: "native", title: "Example" }, { type: "default", title: "Rei" },
    { type: "vietnamese", title: "Example" }, { type: "english", title: "Example" },
    { type: "english", title: "Example" },
  ] }, evidence);
  assert.equal(data.titles.some((item) => item.type === "native" && item.title === "Example"), false);
  assert.equal(data.titles.some((item) => item.type === "vietnamese"), false);
  assert.deepEqual(data.titles.find((item) => item.type === "default"), { type: "default", title: "Example" });
  assert.equal(data.titles.filter((item) => item.type === "english" && item.title === "Example").length, 1);
  assert.equal(flags.includes("UNSUPPORTED_TITLE_TYPE_REMOVED"), true);
});

test("Jikan and TMDB typed source titles survive without inferred language for generic aliases", () => {
  const evidence = { jikan: { mal_id: 20, title: "Example", title_japanese: "例", title_english: "Example", type: "TV", year: 2024,
    titles: [{ type: "Japanese", title: "例" }, { type: "English", title: "Example" }, { type: "Synonym", title: "Alternate" }] },
    tmdb: { id: 1, title: "Example", original_title: "例", media_type: "tv", release_date: "2024-01-01" },
    source_presence: { jikan: true, tmdb: true } };
  const data = aiOutputValidator.validateAndSanitize({}, evidence).sanitizedData;
  assert.equal(data.titles.filter((item) => item.type === "native" && item.title === "例").length, 1);
  assert.equal(data.titles.filter((item) => item.type === "english" && item.title === "Example").length, 1);
  assert.equal(data.titles.some((item) => item.type === "synonym" && item.title === "Alternate"), true);
  assert.equal(data.titles.some((item) => item.type === "romaji" || item.type === "vietnamese"), false);
  const omdbOnly = aiOutputValidator.validateAndSanitize({}, { omdb: { title: "Example", imdb_id: "tt1234567", type: "movie", year: "2024" } }).sanitizedData;
  assert.equal(omdbOnly.titles.some((item) => ["native", "romaji", "english", "vietnamese"].includes(item.type)), false);
});

test("consensus uses only comparable observations and LLM narrative never resolves high conflicts", () => {
  const evidence = snapshot();
  evidence.jikan = { mal_id: 20, title: "Example", type: "TV", year: 2024, episodes: 24, status: "Finished Airing" };
  evidence.source_presence.jikan = true;
  const conflicts = conflictDetector.detectConflicts(evidence);
  const episodes = conflicts.find((conflict) => conflict.field === "total_episodes");
  assert.equal(episodes.severity, "high");
  assert.equal(episodes.resolution_verified, false);
  const data = aiOutputValidator.validateAndSanitize({ confidence_score: 1,
    field_provenance_reasoning: { total_episodes: "Trust me, I resolved it" } }, evidence, conflicts);
  assert.equal(data.flags.includes("SEVERE_UNRESOLVED_CONFLICT"), true);
  const confidence = confidenceCalculator.calculateConfidenceScore({ parsedData: data.sanitizedData, evidenceSnapshot: evidence, conflicts });
  assert.equal(confidence.final <= 0.7, true);
  const low = confidenceCalculator.calculateConfidenceScore({ parsedData: { confidence_score: 0 }, evidenceSnapshot: evidence, conflicts });
  assert.equal(low.final, confidence.final);
  assert.equal(low.llm_self_reported, 0);
  assert.equal(confidence.field_scores.total_episodes <= 0.7, true);
  assert.equal(confidence.breakdown.comparable_fields > 0, true);
});

const sourceConfig = {
  tmdb: { enabled: false }, omdb: { enabled: false },
  jikan: { enabled: true, baseUrl: "https://configured.test/v4", rateLimit: 1000 },
};
const noCache = { get: async () => null, set: async () => true };

test("collector uses configured Jikan URL and rejects a source response for another identity", async () => {
  const requests = [];
  const collector = new EvidenceCollectorService({
    config: sourceConfig, cache: noCache,
    http: { get: async (url, options) => {
      requests.push({ url, options });
      return { data: { data: { mal_id: 999, title: "Wrong Film", type: "TV", year: 2024 } } };
    } },
  });
  collector.fetchAniList = async () => null;
  const chosen = candidate("jikan", { mal_id: 20, title: "Example", type: "TV", year: 2024 });
  const result = await collector.collectEvidence({ title: "Example", selectedCandidate: chosen });
  assert.equal(requests[0].url, "https://configured.test/v4/anime/20/full");
  assert.equal(result.jikan, null);
  assert.equal(result.source_presence.jikan, false);
  assert.equal(result.rejected_sources[0].reason, "IDENTITY_MISMATCH");
});

test("TMDB detail extraction retains runtime, episodes, country, studios, director and external ID", async () => {
  const collector = new EvidenceCollectorService({
    config: { ...sourceConfig, tmdb: { enabled: true, apiKey: "fake", baseUrl: "https://tmdb.test", imageBaseUrl: "https://images.test" } },
    cache: noCache, http: { get: async () => ({ data: {
      id: 9, name: "Example", first_air_date: "2024-02-29", episode_run_time: [24], number_of_episodes: 12,
      number_of_seasons: 1, production_countries: [{ iso_3166_1: "JP" }], production_companies: [{ name: "Studio" }],
      genres: [{ id: 16, name: "Animation" }], external_ids: { imdb_id: "tt1234567" }, credits: { crew: [{ job: "Director", name: "Director" }], cast: [] },
    } }) },
  });
  const result = await collector.fetchTMDB("Example", 2024, { selectedCandidate: { sourceIds: { tmdb: 9 }, mediaType: "series" } });
  assert.equal(result.duration, 24);
  assert.equal(result.number_of_episodes, 12);
  assert.equal(result.number_of_seasons, 1);
  assert.deepEqual(result.countries, ["JP"]);
  assert.deepEqual(result.studios, ["Studio"]);
  assert.equal(result.imdb_id, "tt1234567");
  assert.equal(buildEvidenceFields({ tmdb: result }).release_date[0].value, "2024-02-29");
});

test("explicit cross references reject plausible title/year hits with conflicting IDs", async () => {
  const collector = new EvidenceCollectorService({ config: sourceConfig, cache: noCache });
  collector.fetchTMDB = async () => ({ id: 1, title: "Example", media_type: "movie", release_date: "2024-02-01", imdb_id: "tt1111111" });
  collector.fetchAniList = async () => null;
  collector.fetchJikan = async () => null;
  collector.fetchOMDb = async () => ({ title: "Example", type: "movie", year: "2024", imdb_id: "tt9999999" });
  const result = await collector.collectEvidence({ title: "Example", selectedCandidate: candidate("tmdb", {
    id: 1, title: "Example", media_type: "movie", release_date: "2024-02-01",
  }) });
  assert.equal(result.source_presence.tmdb, true);
  assert.equal(result.source_presence.omdb, false);
  assert.equal(result.rejected_sources[0].source, "omdb");
});

const matcher = {
  loadDatabaseEntities: async () => ({ genres: [{ id: "genre-db", name: "Action" }], countries: [{ id: "country-db", name: "Japan" }], studios: [{ id: "studio-db", name: "Studio" }] }),
  matchGenres: () => ["genre-db"], matchCountry: () => "country-db", matchStudio: () => "studio-db", matchSeries: async () => null,
  matchActors: async () => [{ actor_id: "actor-db", actor_name: "Known Actor", character_name: "Hero" }, { actor_id: null, actor_name: "Unmatched Actor" }],
};
const pipelineFixture = (options = {}) => {
  const stages = [], audits = [];
  const pipeline = new AIPipelineService({
    collector: options.collector || {
      collectEvidence: async () => options.evidence || snapshot(),
      enrichEvidenceWithTitles: async ({ previousSnapshot }) => ({ snapshot: previousSnapshot, newlyFoundCount: 0 }),
    },
    matcher: options.matcher || matcher,
    orchestrator: options.orchestrator || { execute: async () => { throw new AIProviderError("AI_QUOTA_EXHAUSTED", "Quota exhausted", { retryable: true, retryAfterMs: 30000 }); } },
    audit: { createInitialAudit: async () => audits.push("create"), recordSuccess: async () => audits.push("success"), recordFailure: async () => audits.push("failure") },
  });
  const run = (params = {}) => pipeline.executePipeline({
    jobId: "fixture", title: "Example", year: 2024, selectedCandidate: snapshot().selected_candidate,
    mode: "fast", onProgress: async (stage) => { await Promise.resolve(); stages.push(stage.stage); },
    ...params,
  });
  return { run, stages, audits };
};

test("quota failure yields verified evidence, existing actor IDs, partial reason and no terminal callbacks/audits", async () => {
  const fixture = pipelineFixture();
  const result = await fixture.run();
  assert.equal(result.completeness, "partial");
  assert.equal(result.partial_reason.code, "AI_QUOTA_EXHAUSTED");
  assert.equal(result.retryAfter, 30);
  assert.equal(result.title, "Example");
  assert.equal(result.country_id, "country-db");
  assert.equal(result.actor_cast[0].actor_id, "actor-db");
  assert.equal(result.actor_cast.length, 1);
  assert.equal(result.field_provenance.actor_cast, "database_match (anilist)");
  assert.equal(result.field_confidence.actor_cast > 0, true);
  assert.deepEqual(result.suggested_entities.actor_names, ["Unmatched Actor"]);
  assert.equal(result.web_citations.length, 0);
  assert.equal(fixture.stages.includes("COMPLETED") || fixture.stages.includes("FAILED"), false);
  assert.deepEqual(fixture.audits, []);
});

test("deadline abort retains evidence and no model relation/actor IDs can pass through", async () => {
  const fixture = pipelineFixture({ orchestrator: { execute: async () => ({
    provider: "fake", model: "free", parsedJson: { country_id: "made-up", actor_cast: [{ actor_id: "invented" }], tmdb_id: 999 },
  }) } });
  const result = await fixture.run({ executionBudget: { startedAt: Date.now() - 60000 } });
  assert.equal(result.partial_reason.code, "AI_DEADLINE_EXCEEDED");
  assert.equal(result.tmdb_id, undefined);
  assert.deepEqual(result.actor_cast, []);
});

test("external cancellation propagates without completion or failure events", async () => {
  const cancellation = new AbortController();
  cancellation.abort();
  const fixture = pipelineFixture();
  await assert.rejects(fixture.run({ signal: cancellation.signal }), (error) => error.code === "AI_CANCELLED");
  assert.equal(fixture.stages.includes("COMPLETED") || fixture.stages.includes("FAILED"), false);
});

test("scope projection prevents metadata replacement for cast/synopsis/SEO requests", async () => {
  const fixture = pipelineFixture();
  const result = await fixture.run({ type: "cast" });
  assert.equal(result.title, undefined);
  assert.equal(result.country_id, undefined);
  assert.equal(result.actor_cast[0].actor_id, "actor-db");
  const scoped = projectSuggestionScope({ title: "Example", description: "Story", confidence_score: 0 }, "synopsis");
  assert.deepEqual(scoped, { description: "Story", confidence_score: 0 });
});

test("pipeline without verified sources never calls the LLM and returns confidence zero", async () => {
  const fixture = pipelineFixture({
    evidence: { ...snapshot(), anilist: null, source_presence: { anilist: false, jikan: false, tmdb: false, omdb: false } },
    matcher: { ...matcher, matchGenres: () => [], matchStudio: () => null, matchActors: async () => [] },
    orchestrator: { execute: async () => assert.fail("No-evidence request must not invoke the provider") },
  });
  const result = await fixture.run();
  assert.equal(result.title, undefined);
  assert.equal(result.confidence_score, 0);
  assert.equal(result.partial_reason.code, "AI_NO_VERIFIED_EVIDENCE");
  assert.deepEqual(result.actor_cast, []);
  assert.deepEqual(result.genre_ids, []);
});

test("source cancellation at the deadline keeps an already verified source", async () => {
  const collector = new EvidenceCollectorService({ config: sourceConfig, cache: noCache });
  collector.fetchTMDB = async () => ({ id: 1, title: "Example", media_type: "movie", release_date: "2024-02-01" });
  collector.fetchAniList = async (title, year, { signal }) => new Promise((resolve, reject) => {
    if (signal.aborted) reject(signal.reason);
    else signal.addEventListener("abort", () => reject(signal.reason), { once: true });
  });
  collector.fetchJikan = async () => null;
  collector.fetchOMDb = async () => null;
  const fixture = pipelineFixture({ collector, orchestrator: { execute: async () => assert.fail("Provider must not start after the deadline") } });
  const chosen = candidate("tmdb", { id: 1, title: "Example", media_type: "movie", release_date: "2024-02-01" });
  const result = await fixture.run({ selectedCandidate: chosen, executionBudget: { startedAt: Date.now() - 29980 } });
  assert.equal(result.partial_reason.code, "AI_DEADLINE_EXCEEDED");
  assert.equal(result.title, "Example");
  assert.equal(result.evidence_summary.has_tmdb, true);
  assert.equal(result.evidence_summary.source_errors[0].code, "ABORTED");
});

test("request-budget exhaustion yields a partial suggestion without resetting counters", async () => {
  const budget = { startedAt: Date.now(), requestCount: 2, passCount: 1 };
  const fixture = pipelineFixture({ orchestrator: { execute: async ({ executionBudget }) => {
    assert.equal(executionBudget, budget);
    assert.equal(executionBudget.requestCount, 2);
    throw new AIProviderError("AI_REQUEST_BUDGET_EXCEEDED", "Budget exhausted");
  } } });
  const result = await fixture.run({ executionBudget: budget });
  assert.equal(result.partial_reason.code, "AI_REQUEST_BUDGET_EXCEEDED");
  assert.equal(result.title, "Example");
  assert.equal(budget.requestCount, 2);
});

test("deadline bounds a hanging DB read and does not start subsequent queries", async () => {
  let rejectRead;
  let followupQueries = 0;
  const fixture = pipelineFixture({ matcher: {
    ...matcher,
    loadDatabaseEntities: () => new Promise((resolve, reject) => { rejectRead = reject; }),
    matchActors: async () => { followupQueries++; return []; },
    matchSeries: async () => { followupQueries++; return null; },
  } });
  const result = await fixture.run({ executionBudget: { startedAt: Date.now() - 29980 } });
  assert.equal(result.title, "Example");
  assert.equal(result.partial_reason.code, "AI_DEADLINE_EXCEEDED");
  assert.equal(followupQueries, 0);
  rejectRead(new Error("Late DB timeout is handled by the abandoned Promise.race"));
  await new Promise((resolve) => setImmediate(resolve));
});

test("cancelling during a DB read propagates promptly and starts no later DB queries", async () => {
  const signal = new AbortController();
  let followupQueries = 0;
  const fixture = pipelineFixture({ matcher: {
    ...matcher,
    loadDatabaseEntities: () => new Promise(() => { signal.abort(new AIProviderError("AI_CANCELLED", "Cancelled")); }),
    matchActors: async () => { followupQueries++; return []; },
  } });
  await assert.rejects(fixture.run({ signal: signal.signal }), (error) => error.code === "AI_CANCELLED");
  assert.equal(followupQueries, 0);
});

test("series matching returns a reviewable name while keeping legacy ID matcher compatibility", async () => {
  const fixture = pipelineFixture({ matcher: { ...matcher, matchSeries: async (title, options) => {
    assert.equal(title, "Example");
    assert.equal(options.includeDetails, true);
    return { id: "series-db", name: "Example" };
  } } });
  const result = await fixture.run();
  assert.equal(result.series_id, "series-db");
  assert.equal(result.relationship_labels.series_id, "Example");
  assert.equal(result.field_confidence.series_id > 0, true);
});

