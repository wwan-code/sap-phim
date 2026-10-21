/**
 * @file ai.service.js
 * @module AI_Domain_Service
 * @description Service nghiệp vụ AI cốt lõi: Điều phối Pipeline gợi ý phim, crawler đa nguồn, đối soát thực thể và tính điểm tin cậy.
 */

import { evidenceCollector, EvidenceCollectorService } from './evidence-collector.service.js';
import { entityMatcher, EntityMatcherService } from './entity-matcher.service.js';
import { entityKey } from '../helpers/entity-identity.helper.js';
export { evidenceCollector, EvidenceCollectorService, entityMatcher, EntityMatcherService };

import { env } from "../../../config/env.config.js";
import { cacheHelper } from "../../../config/redis.config.js";

import { logger } from "../../../utils/logger.js";
import { AppError } from "../../../utils/app-error.js";


import {
  AI_AUDIT_FLAGS,
  AI_CACHE_TTL,
  AI_ENRICHMENT_LIMITS,
  AI_JOB_STAGES,
  AI_SOURCE_RELIABILITY_MATRIX,
  FIELD_CATEGORIES,
  TRACKED_FIELDS,
  boundedSourceSynopsis,
  buildEvidenceFields,
  cleanSourceText,
  extractVisualAssets,
  fieldValuesEqual,
  foldSearchTitle,
  groupCandidates,
  identityYear,
  matchCountryEvidence,
  matchGenreEvidence,
  normalizeMediaType,
  normalizeTaxonomyName,
  normalizeTitle,
  rankSearchCandidates,
  sameWork,
  selectUnambiguousCandidate,
  sourceIdentity,
  titleSearchRank,
} from "../helpers/ai-metadata.helper.js";

import {
  JikanRateLimiter,
  detectSourceType,
  fetchAniList,
  fetchAniListStaff,
  fetchJikan,
  fetchOMDb,
  fetchTMDB,
  fetchTMDBPerson,
  pause,
  requestJikan,
  searchAniList,
  searchJikan,
  searchOMDb,
  searchTMDB,
} from "../helpers/ai-sources.helper.js";

import {
  AIProviderError,
  AI_EXECUTION_LIMITS,
  MOVIE_SUGGESTION_SYSTEM_PROMPT,
  PROMPT_VERSION,
  buildMovieSuggestionUserPrompt,
  normalizeExecutionBudget,
  geminiProvider,
  openRouterProvider,
  consumeSynthesisPass,
  assertExecutionAvailable,
  normalizeProviderError,
} from "../helpers/ai-providers.helper.js";

import { createMovieCatalogLookup } from "../helpers/ai-job.helper.js";
import { aiOutputValidator } from "../validators/ai.validator.js";

// ============================================================================
// 1. EVIDENCE COLLECTOR (Multi-source aggregation & enrichment)
// ============================================================================



// ============================================================================
// 2. ENTITY MATCHER (Database taxonomy, actors & studios linking)
// ============================================================================



// ============================================================================
// 3. CONFLICT DETECTOR
// ============================================================================

const CONFLICT_LABELS = {
  release_year: "Năm phát hành", release_date: "Ngày phát hành", director: "Đạo diễn",
  total_episodes: "Tổng số tập", duration: "Thời lượng", status: "Trạng thái", studio: "Studio", type: "Định dạng",
};

export class ConflictDetectorService {
  getSourceReliability(source, category = "default") {
    const weights = AI_SOURCE_RELIABILITY_MATRIX[source];
    return weights?.[category] ?? weights?.default ?? 0;
  }

  detectConflicts(snapshot = {}) {
    const fields = buildEvidenceFields(snapshot);
    return Object.entries(CONFLICT_LABELS).flatMap(([field, label]) => {
      const observations = fields[field] || [];
      if (observations.length < 2 || observations.every((item) => fieldValuesEqual(item.value, observations[0].value))) return [];
      const numbers = observations.map((item) => Number(item.value)).filter(Number.isFinite);
      const difference = Math.max(...numbers) - Math.min(...numbers);
      const severity = ["release_year", "director", "type"].includes(field)
        || (field === "total_episodes" && difference > 2) || (field === "duration" && difference > 25)
        ? "high" : field === "studio" ? "low" : "medium";
      const category = FIELD_CATEGORIES[field] || "default";
      return [{
        field, field_label: label, field_category: category, severity,
        difference_summary: `Các nguồn cung cấp giá trị khác nhau cho ${label.toLowerCase()}.`,
        values: observations.map((item) => ({ ...item, reliability: this.getSourceReliability(item.source, category) })),
        resolved: false, resolution_verified: false,
      }];
    });
  }

  resolveConflicts(conflicts = []) {
    return Object.fromEntries(conflicts.map((conflict) => {
      const preferred = [...conflict.values].sort((a, b) => b.reliability - a.reliability)[0];
      return [conflict.field, { preferred_source: preferred?.source, proposed_value: preferred?.value, verified: false }];
    }));
  }
}

export const conflictDetector = new ConflictDetectorService();

// ============================================================================
// 4. CONFIDENCE CALCULATOR
// ============================================================================

const rounded = (num) => Number(num.toFixed(2));

export class ConfidenceCalculatorService {
  calculateConfidenceScore({ parsedData = {}, evidenceSnapshot = {}, conflicts = [], flags = [] } = {}) {
    const fields = Object.fromEntries(Object.entries(buildEvidenceFields(evidenceSnapshot)).map(([field, values]) => {
      if (!["title", "description"].includes(field)) return [field, values];
      return [field, values.filter((item, index) => values.findIndex((other) => other.source === item.source) === index)];
    }));
    const observations = Object.values(fields).flat();
    const activeSources = [...new Set(observations.map((item) => item.source))];
    const observedFields = TRACKED_FIELDS.filter((field) => fields[field]?.length);
    const comparableFields = TRACKED_FIELDS.filter((field) => !["title", "description"].includes(field) && fields[field]?.length >= 2);
    const agreeingFields = comparableFields.filter((field) => fields[field].every((item) => fieldValuesEqual(item.value, fields[field][0].value)));
    const coverage = observedFields.length / TRACKED_FIELDS.length;
    const consensus = comparableFields.length ? agreeingFields.length / comparableFields.length : 0;
    const reliability = observedFields.length ? observedFields.reduce((sum, field) => {
      const matrixCategory = FIELD_CATEGORIES[field] || "default";
      const weights = fields[field].map((item) => AI_SOURCE_RELIABILITY_MATRIX[item.source]?.[matrixCategory] ?? AI_SOURCE_RELIABILITY_MATRIX[item.source]?.default ?? 0);
      return sum + weights.reduce((total, weight) => total + weight, 0) / weights.length;
    }, 0) / observedFields.length : 0;
    let penalty = conflicts.reduce((sum, c) => sum + (c.severity === "high" ? 0.15 : c.severity === "medium" ? 0.05 : 0), 0);
    if (flags.includes(AI_AUDIT_FLAGS.POSSIBLE_DIRECTOR_AUTHOR_CONFUSION)) penalty += 0.1;
    penalty = Math.min(0.45, penalty);
    let computed = activeSources.length ? Math.max(0, Math.min(1, 0.5 * reliability + 0.3 * coverage + 0.2 * consensus - penalty)) : 0;
    const unresolved = conflicts.some((c) => c.severity === "high" && c.resolution_verified !== true);
    const clamped = unresolved && computed > 0.7;
    if (unresolved) computed = Math.min(computed, 0.7);
    const reported = Number(parsedData.confidence_score);
    const fieldScores = Object.fromEntries(Object.entries(fields).map(([field, values]) => {
      const category = FIELD_CATEGORIES[field] || "core_identifiers";
      const average = values.reduce((sum, item) => sum + (AI_SOURCE_RELIABILITY_MATRIX[item.source]?.[category]
        ?? AI_SOURCE_RELIABILITY_MATRIX[item.source]?.default ?? 0), 0) / values.length;
      const chosen = parsedData[field] ?? values[0].value;
      const support = values.filter((item) => fieldValuesEqual(item.value, chosen)).length;
      const agreement = !["title", "description"].includes(field) && values.length >= 2 ? support / values.length : 0;
      let score = average * (0.7 + 0.3 * agreement);
      if (conflicts.some((c) => c.field === field && c.severity === "high" && !c.resolution_verified)) score = Math.min(score, 0.7);
      return [field, rounded(score)];
    }));
    if (parsedData.field_evidence?.description?.some((item) => item.derived)) fieldScores.description = null;
    if (fieldScores.title != null) fieldScores.titles = fieldScores.title;
    return {
      final: rounded(computed), computed: rounded(computed),
      field_scores: fieldScores,
      llm_self_reported: parsedData.confidence_score != null && Number.isFinite(reported) && reported >= 0 && reported <= 1 ? reported : null,
      breakdown: {
        consensus_rate: rounded(consensus), comparable_fields: comparableFields.length, agreeing_fields: agreeingFields.length,
        coverage_rate: rounded(coverage), observed_fields: observedFields, avg_source_reliability: rounded(reliability),
        source_presence_rate: rounded(activeSources.length / 4), active_sources: activeSources,
        conflict_penalty: rounded(penalty), clamped_by_unresolved_conflict: clamped,
      },
    };
  }
}

export const confidenceCalculator = new ConfidenceCalculatorService();

// ============================================================================
// 5. MOVIE RESOLUTION SERVICE
// ============================================================================

const sourceIdsFor = (value = {}) => Object.fromEntries(["tmdb", "anilist", "mal", "imdb"].flatMap((source) => {
  const id = value[`${source}_id`];
  const valid = source === "imdb" ? /^tt\d{5,12}$/.test(id)
    : id != null && id !== "" && typeof id !== "boolean" && Number.isInteger(Number(id)) && Number(id) > 0 && Number(id) <= 2147483647;
  return valid ? [[source, source === "imdb" ? id : Number(id)]] : [];
}));

const safeSourceError = () => {
  const error = new AppError("Các nguồn tra cứu phim đang tạm thời không khả dụng. Vui lòng thử lại sau.", 503);
  error.code = "AI_SOURCES_UNAVAILABLE";
  return error;
};

const waitForLookup = async (pending, signal) => {
  let onAbort;
  const aborted = new Promise((_, reject) => {
    onAbort = () => reject(signal.reason);
    if (signal.aborted) onAbort();
    else signal.addEventListener("abort", onAbort, { once: true });
  });
  try { return await Promise.race([pending, aborted]); }
  finally { signal.removeEventListener("abort", onAbort); }
};

export class MovieResolutionService {
  constructor(collector = evidenceCollector, { catalogLookup = async (input) => { const { sequelize } = await import("../../../config/database.config.js"); return createMovieCatalogLookup({ sequelize })(input); }, timeoutMs = 15000 } = {}) {
    this.collector = collector;
    this.catalogLookup = catalogLookup;
    this.timeoutMs = timeoutMs;
  }

  async resolve({ title, year, mediaType = "all", context = {}, target, signal }) {
    const deadline = new AbortController();
    const onAbort = () => deadline.abort(signal.reason);
    signal?.addEventListener("abort", onAbort, { once: true });
    if (signal?.aborted) onAbort();
    const timer = setTimeout(() => deadline.abort(safeSourceError()), this.timeoutMs);
    const activeSignal = deadline.signal, sourceErrors = [];
    try {
      let local = { matches: [], truncated: false };
      try {
        local = await waitForLookup(Promise.resolve().then(() => {
          activeSignal.throwIfAborted();
          return this.catalogLookup({ title, year, mediaType, target, signal: activeSignal });
        }), activeSignal);
      } catch (error) {
        activeSignal.throwIfAborted();
        sourceErrors.push({ source: "catalog", code: "CATALOG_UNAVAILABLE" });
      }
      const requestedType = normalizeMediaType(mediaType), searchKey = foldSearchTitle(title);
      const compatible = (record) => {
        const knownYear = identityYear(record.release_year || record.release_date), knownType = normalizeMediaType(record.type);
        return (!year || !knownYear || Number(year) === knownYear) && (!requestedType || !knownType || knownType === requestedType);
      };
      const matches = (local.matches || []).filter((record) => compatible(record)
        && (record.titles || []).some((alias) => foldSearchTitle(alias?.title) === searchKey));
      const catalog = matches.length === 1 && !local.truncated ? matches[0] : null;
      const formMatches = [context.current_title, context.romaji_title].some((alias) => alias && foldSearchTitle(alias) === searchKey)
        && compatible({ ...context, type: context.type || requestedType });
      const formIds = formMatches ? sourceIdsFor(context) : {};
      const catalogIds = catalog ? sourceIdsFor(catalog) : {};
      const sourceIds = { ...catalogIds, ...formIds };
      for (const source of Object.keys(formIds)) if (catalogIds[source] && catalogIds[source] !== formIds[source]) delete sourceIds[source];
      const sourceHints = {
        sourceIds,
        year: year || identityYear(catalog?.release_year || context.release_year),
        mediaType: requestedType || normalizeMediaType(catalog?.type || (formMatches ? context.type : null)),
      };
      const priorities = ["english", "romaji", "native", "synonym", "default", "vietnamese"];
      const aliases = [...(catalog?.titles || [])].sort((a, b) => priorities.indexOf(a.type) - priorities.indexOf(b.type));
      if (formMatches) aliases.push({ title: context.romaji_title }, { title: context.current_title });
      const alternateTitle = aliases.find((alias) => typeof alias.title === "string" && alias.title.trim()
        && alias.title.length <= 500 && foldSearchTitle(alias.title) !== searchKey)?.title;
      let primaryResult;
      const input = {
        title, year, mediaType, sourceHints, alternateTitle, signal: activeSignal,
        onPrimaryResult: (res) => { primaryResult = res; },
      };
      const pending = this.collector.searchCandidateResult(input);
      let result;
      try { result = await waitForLookup(pending, activeSignal); }
      catch (error) {
        if (signal?.aborted || !activeSignal.aborted || !primaryResult?.candidates?.length) throw error;
        result = { ...primaryResult, source_errors: [...primaryResult.source_errors, { source: "search", code: "SUPPLEMENTAL_TIMEOUT" }] };
      }
      signal?.throwIfAborted();
      if (result.sources_attempted?.length && !result.sources_succeeded?.length) throw safeSourceError();
      const candidates = (result.candidates || []).map((candidate) => ({ ...candidate,
        catalog_id: (local.matches || []).find((record) => sameWork(candidate, { sourceIds: sourceIdsFor(record), mediaType: normalizeMediaType(record.type) }))?.id || null,
        match_reason: result.direct ? 'source_id' : titleSearchRank(candidate, title) === 3 ? 'exact_title' : titleSearchRank(candidate, title) === 2 ? 'folded_title' : 'related_title',
      }));
      const selectedCandidate = result.direct && candidates.length === 1 ? candidates[0]
        : local.truncated || matches.length > 1 ? null : selectUnambiguousCandidate(candidates, { title, year, mediaType });
      return {
        candidates, requiresSelection: candidates.length > 0 && !selectedCandidate, selectedCandidate,
        source_errors: [...sourceErrors, ...(result.source_errors || [])], sources_attempted: result.sources_attempted || [],
        sources_succeeded: result.sources_succeeded || [],
      };
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
    }
  }
}

export const movieResolutionService = new MovieResolutionService();

// ============================================================================
// 6. PIPELINE & DOMAIN SERVICE (AIPipelineService)
// ============================================================================

const EMPTY_SNAPSHOT = () => ({
  tmdb: null, anilist: null, jikan: null, omdb: null,
  source_presence: { tmdb: false, anilist: false, jikan: false, omdb: false },
  source_errors: [], rejected_sources: [], visual_assets: { posters: [], covers: [], banners: [] },
});

const boundedRead = async (read, signal) => {
  signal?.throwIfAborted();
  let onAbort;
  const aborted = new Promise((_, reject) => {
    onAbort = () => reject(signal.reason || new AIProviderError("AI_CANCELLED", "Yêu cầu đã được hủy."));
    signal?.addEventListener("abort", onAbort, { once: true });
  });
  try {
    const pending = Promise.resolve().then(() => { signal?.throwIfAborted(); return read(); });
    return await Promise.race([pending, aborted]);
  } finally { signal?.removeEventListener("abort", onAbort); }
};

export const projectSuggestionScope = (result, scope) => {
  const selections = {
    cast: ["actor_cast", "suggested_entities"],
    synopsis: ["description"],
    seo: ["seo_keywords", "meta_title", "meta_description"],
  };
  const metadata = ["title", "original_title", "slug", "titles", "type", "status", "release_date", "release_year", "duration",
    "season", "season_number", "total_episodes", "age_rating", "director", "director_metadata", "trailer_url", "imdb_id", "imdb_rating", "tmdb_id",
    "mal_id", "anilist_id", "category_id", "country_id", "studio_id", "studio_candidate", "series_id", "genre_ids", "source_type", "suggested_entities"];
  const fields = scope === "metadata" ? metadata : selections[scope];
  if (!fields) return result;
  const operational = ["entity_contract_version", "candidate_id", "confidence_score", "confidence_breakdown", "field_confidence", "conflicts", "flags", "field_provenance", "field_evidence",
    "field_provenance_reasoning", "visual_assets", "evidence_summary", "evidenceSummary", "web_citations", "search_queries",
    "grounding_metadata", "completeness", "partial_reason", "retryAfter", "provider_error", "relationship_labels", "_execution"];
  return Object.fromEntries([...fields, ...operational].filter((f) => Object.hasOwn(result, f)).map((f) => [f, result[f]]));
};

// ============================================================================
// 6. AI ORCHESTRATOR (Multi-provider LLM synthesis execution)
// ============================================================================

const TERMINAL_CODES = new Set([
  "AI_CANCELLED", "AI_DEADLINE_EXCEEDED", "AI_REQUEST_BUDGET_EXCEEDED",
  "AI_PASS_BUDGET_EXCEEDED", "AI_BUDGET_PERSIST_FAILED",
]);

export class AIOrchestratorService {
  constructor({ gemini = geminiProvider, openrouter = openRouterProvider, log = logger } = {}) {
    this.providers = [gemini, openrouter];
    this.log = log;
  }

  calculateEstimatedCost() {
    return 0;
  }

  async execute({
    systemPrompt, userPrompt, mode = "auto", timeoutMs, signal, executionBudget, onBudgetUpdate,
  }) {
    const budget = normalizeExecutionBudget(executionBudget, mode);
    await consumeSynthesisPass(budget, signal, onBudgetUpdate);
    let lastError;
    let fallbackUsed = false;
    for (const provider of this.providers) {
      assertExecutionAvailable(budget, signal);
      try {
        const result = await provider.generateStructuredOutput({
          systemPrompt, userPrompt, mode: budget.mode, timeoutMs, signal,
          executionBudget: budget, onBudgetUpdate,
        });
        return { ...result, estimatedCostUsd: 0, circuitBreakerTripped: fallbackUsed };
      } catch (cause) {
        const error = normalizeProviderError(cause, provider.name);
        if (TERMINAL_CODES.has(error.code)) throw error;
        if (!lastError || error.code !== "AI_DISABLED") lastError = error;
        fallbackUsed = true;
        this.log.warn("[AI Orchestrator] " + provider.name + ": " + error.code);
      }
    }
    throw lastError || new AIProviderError("AI_PROVIDER_UNAVAILABLE", "Không có provider miễn phí khả dụng.", { retryable: true });
  }
}

export const aiOrchestrator = new AIOrchestratorService();

// ============================================================================
// 7. AI PIPELINE SERVICE
// ============================================================================

export class AIPipelineService {
  constructor(dependencies = {}) {
    this.collector = dependencies.collector || evidenceCollector;
    this.matcher = dependencies.matcher || entityMatcher;
    this.orchestrator = dependencies.orchestrator || aiOrchestrator;
    this.audit = dependencies.audit || null;
  }

  async matchRelationships(snapshot, title, signal) {
    const db = await boundedRead(() => this.matcher.loadDatabaseEntities(), signal);
    const fields = buildEvidenceFields(snapshot);
    const names = (field) => (fields[field] || []).flatMap((item) => Array.isArray(item.value) ? item.value : [item.value]);
    const genreIds = this.matcher.matchGenres(names("genres"), db.genres);
    const countryIds = [...new Set(names("country").map((country) => this.matcher.matchCountry(country, db.countries)).filter(Boolean))];
    const countryId = countryIds.length === 1 ? countryIds[0] : null;

    const rawStudios = snapshot.tmdb?.studio_details || snapshot.anilist?.studio_details || names("studio");
    const studioCandidate = this.matcher.resolveStudioCandidate(rawStudios, db.studios);
    const studioId = studioCandidate?.studio_id || null;

    const actorNames = names("actor_cast").filter((item) => item && typeof (item.actor_name || item.name) === "string");
    const seenActors = new Set();
    const uniqueActors = actorNames.filter((item) => {
      const key = entityKey('actor', item);
      if (!key || seenActors.has(key)) return false;
      seenActors.add(key); return true;
    }).slice(0, 20);
    const matchedActors = await boundedRead(() => this.matcher.matchActors(uniqueActors), signal);

    const enrichedActors = await boundedRead(() => this.collector.enrichActorDetails(matchedActors, { signal }), signal);

    const directorName = names("director")[0] || snapshot.tmdb?.director || snapshot.anilist?.director || null;
    const tmdbDirectorId = snapshot.tmdb?.director_source_id || null;
    const anilistStaffId = snapshot.anilist?.director_source_id || null;
    const directorMetadata = await boundedRead(() => this.collector.enrichDirectorDetails({ directorName, tmdbDirectorId, anilistStaffId, signal }), signal);

    const series = await boundedRead(() => this.matcher.matchSeries(title, { includeDetails: true }), signal);
    const seriesId = typeof series === "string" ? series : series?.id || null;
    return {
      matched_genre_ids: genreIds, matched_country_id: countryId, matched_studio_id: studioId,
      matched_series_id: seriesId,
      studio_candidate: studioCandidate,
      director_metadata: directorMetadata,
      actors: enrichedActors,
      matched_actors: enrichedActors.filter((actor) => actor.actor_id),
      suggested_actors: enrichedActors.filter((actor) => !actor.actor_id),
      labels: {
        country_id: db.countries.find((country) => country.id === countryId)?.name || null,
        studio_id: db.studios.find((studio) => studio.id === studioId)?.name || null,
        genre_ids: db.genres.filter((genre) => genreIds.includes(genre.id)).map(({ id, name }) => ({ id, name })),
        series_id: typeof series === "object" ? series?.name || null : null,
      },
      suggested_names: {
        studio_name: names("studio")[0] || null,
        country_name: names("country").join(", ") || null,
        actor_names: enrichedActors.filter((actor) => !actor.actor_id).map((actor) => actor.actor_name),
      },
    };
  }

  async executePipeline({
    jobId, userId, title, year, type = "all", mediaType = "all", mode = "auto", forceRefresh = false,
    enableWebSearch = false, selectedCandidate, formContext = {}, onProgress = async () => {},
    signal, executionBudget, onBudgetUpdate, auditHandledExternally = true,
  }) {
    const budget = normalizeExecutionBudget(executionBudget, mode);
    const startedAt = Date.now(), stageTimings = {};
    const limits = AI_EXECUTION_LIMITS[budget.mode];
    const deadline = new AbortController();
    const onAbort = () => deadline.abort(signal.reason || new AIProviderError("AI_CANCELLED", "Yêu cầu đã được hủy."));
    signal?.addEventListener("abort", onAbort, { once: true });
    if (signal?.aborted) onAbort();
    const remainingMs = budget.startedAt + limits.deadlineMs - Date.now();
    const deadlineError = new AIProviderError("AI_DEADLINE_EXCEEDED", "Đã hết thời gian xử lý; giữ dữ liệu nguồn đã xác minh.", { retryable: true });
    const timer = setTimeout(() => deadline.abort(deadlineError), Math.max(0, remainingMs));
    if (remainingMs <= 0) deadline.abort(deadlineError);
    const activeSignal = deadline.signal;
    const assertNotCancelled = () => {
      if (signal?.aborted && signal.reason?.code !== "AI_DEADLINE_EXCEEDED") {
        throw new AIProviderError("AI_CANCELLED", "Yêu cầu đã được hủy.");
      }
    };
    let snapshot = EMPTY_SNAPSHOT(), synthesis = null, providerFailure = null;
    if (!auditHandledExternally) await this.audit.createInitialAudit({ jobId, userId, title, year, type, promptVersion: PROMPT_VERSION });
    try {
      await onProgress(AI_JOB_STAGES.EVIDENCE_COLLECTION, null, `Đang xác minh nguồn cho "${title}"...`);
      const evidenceStart = Date.now();
      try {
        snapshot = await this.collector.collectEvidence({ title, year, mediaType, selectedCandidate, forceRefresh, signal: activeSignal });
      } catch (error) {
        assertNotCancelled();
        if (activeSignal.aborted) providerFailure = activeSignal.reason || deadlineError;
        else throw error;
      }
      stageTimings.evidence_collection_ms = Date.now() - evidenceStart;
      assertNotCancelled();
      let conflicts = conflictDetector.detectConflicts(snapshot);
      await onProgress(AI_JOB_STAGES.ENTITY_MATCHING, null, "Đang đối soát các quan hệ đã có trong cơ sở dữ liệu...");
      const matchingStart = Date.now();
      let relationships;
      try { relationships = await this.matchRelationships(snapshot, selectedCandidate?.title || title, activeSignal); }
      catch (error) {
        assertNotCancelled();
        if (activeSignal.aborted) providerFailure ||= activeSignal.reason || deadlineError;
        logger.warn("[AI][Pipeline] Database matching unavailable", { code: error.code || "DATABASE_UNAVAILABLE" });
        snapshot.source_errors.push({ source: "database", code: activeSignal.aborted ? "DEADLINE_EXCEEDED" : "DATABASE_UNAVAILABLE" });
        relationships = { matched_genre_ids: [], matched_actors: [], suggested_actors: [], labels: {}, suggested_names: {}, actors: [], director_metadata: { schema_version: 1, primary: null, people: [] } };
      }
      stageTimings.entity_matching_ms = Date.now() - matchingStart;
      assertNotCancelled();
      const runSynthesis = async (stage) => {
        await onProgress(stage, null, "Đang tổng hợp dữ liệu từ các nguồn đã xác minh...");
        const llmStart = Date.now();
        try {
          return await this.orchestrator.execute({
            systemPrompt: MOVIE_SUGGESTION_SYSTEM_PROMPT,
            userPrompt: buildMovieSuggestionUserPrompt({ queryTitle: title, queryYear: year, queryType: type,
              formContext, evidenceSnapshot: snapshot, conflicts, dbRelationships: relationships }),
            mode, signal: activeSignal, executionBudget: budget, onBudgetUpdate, enableWebSearch: false,
          });
        } finally {
          stageTimings[stage === AI_JOB_STAGES.LLM_REFINEMENT ? "llm_refinement_ms" : "llm_reasoning_ms"] = Date.now() - llmStart;
        }
      };
      if (!["metadata", "cast"].includes(type) && Object.values(snapshot.source_presence).some(Boolean) && !activeSignal.aborted) {
        try { synthesis = await runSynthesis(AI_JOB_STAGES.LLM_REASONING); }
        catch (error) { assertNotCancelled(); providerFailure = error; }
      } else if (!Object.values(snapshot.source_presence).some(Boolean) || activeSignal.aborted) providerFailure ||= activeSignal.reason || new AIProviderError("AI_NO_VERIFIED_EVIDENCE", "Chưa thu thập được bằng chứng cho đúng tác phẩm.", { retryable: true });

      if (synthesis && mode !== "fast" && !activeSignal.aborted && Object.values(snapshot.source_presence).filter(Boolean).length < 4) {
        const aliases = (snapshot.selected_candidate?.titles || []).filter((alias) => alias !== title);
        if (aliases.length) {
          await onProgress(AI_JOB_STAGES.SECONDARY_EVIDENCE_SEARCH, null, "Đang đối chiếu nguồn còn thiếu bằng tên đã xác minh...");
          try {
            const enrichment = await this.collector.enrichEvidenceWithTitles({
              previousSnapshot: snapshot, candidateTitles: { verified: aliases[0] }, signal: activeSignal,
            });
            snapshot = enrichment.snapshot;
            if (enrichment.newlyFoundCount > 0) {
              conflicts = conflictDetector.detectConflicts(snapshot);
              relationships = await this.matchRelationships(snapshot, selectedCandidate?.title || title, activeSignal);
              const refined = await runSynthesis(AI_JOB_STAGES.LLM_REFINEMENT);
              synthesis = { ...refined, usage: {
                promptTokens: (synthesis.usage?.promptTokens || 0) + (refined.usage?.promptTokens || 0),
                completionTokens: (synthesis.usage?.completionTokens || 0) + (refined.usage?.completionTokens || 0),
                totalTokens: (synthesis.usage?.totalTokens || 0) + (refined.usage?.totalTokens || 0),
              } };
            }
          } catch (error) { assertNotCancelled(); providerFailure = error; }
        }
      }
      assertNotCancelled();
      if (activeSignal.aborted) providerFailure ||= activeSignal.reason || deadlineError;
      await onProgress(AI_JOB_STAGES.SELF_AUDIT_VALIDATION, null, "Đang kiểm định giá trị, bằng chứng và mức độ tin cậy...");
      const validationStart = Date.now();
      const validated = aiOutputValidator.validateAndSanitize(synthesis?.parsedJson || {}, snapshot, conflicts);
      const data = validated.sanitizedData;
      const confidence = confidenceCalculator.calculateConfidenceScore({
        parsedData: data, evidenceSnapshot: snapshot, conflicts, flags: validated.flags,
      });
      const provenance = { ...data.field_provenance };
      const fieldConfidence = { ...confidence.field_scores };
      const relationEvidence = { ...data.field_evidence };
      const evidenceFields = buildEvidenceFields(snapshot);
      for (const field of ["country_id", "studio_id", "series_id", "genre_ids", "actor_cast"]) {
        const matched = field === "genre_ids" ? relationships.matched_genre_ids : field === "actor_cast"
          ? relationships.matched_actors : relationships[`matched_${field}`];
        if (Array.isArray(matched) ? matched.length : matched) {
          const basisField = ({ country_id: "country", studio_id: "studio", series_id: "title", genre_ids: "genres", actor_cast: "actor_cast" })[field];
          const basis = evidenceFields[basisField] || [];
          const sources = [...new Set(basis.map((item) => item.source))];
          provenance[field] = `database_match${sources.length ? ` (${sources.join(" + ")})` : ""}`;
          relationEvidence[field] = basis.map((item) => ({ ...item, derived: true, matched_value: matched }));
          if (confidence.field_scores[basisField] != null) fieldConfidence[field] = confidence.field_scores[basisField];
        }
      }
      const observedFields = buildEvidenceFields(snapshot);
      const missingFields = TRACKED_FIELDS.filter((field) => !observedFields[field]?.length);
      const hasGaps = missingFields.length > 0 || !snapshot.source_presence || Object.values(snapshot.source_presence).filter(Boolean).length === 0
        || snapshot.source_errors?.length > 0 || snapshot.rejected_sources?.length > 0 || conflicts.length > 0;
      const needsLocalizedSynopsis = !["metadata", "cast"].includes(type);
      const localizationIncomplete = needsLocalizedSynopsis && validated.flags.includes("LOCALIZATION_INCOMPLETE");
      const visibleFlags = needsLocalizedSynopsis ? validated.flags : validated.flags.filter((flag) => flag !== "LOCALIZATION_INCOMPLETE");
      const partial = Boolean(providerFailure || hasGaps || localizationIncomplete);
      const summary = {
        has_tmdb: Boolean(snapshot.source_presence.tmdb), has_anilist: Boolean(snapshot.source_presence.anilist),
        has_jikan: Boolean(snapshot.source_presence.jikan), has_omdb: Boolean(snapshot.source_presence.omdb),
        missing_fields: missingFields,
        rejected_sources: snapshot.rejected_sources || [], source_errors: snapshot.source_errors || [],
      };
      const safeError = providerFailure ? {
        code: providerFailure.code || "AI_PROVIDER_UNAVAILABLE",
        message: providerFailure.code ? providerFailure.message : "Dịch vụ tổng hợp AI chưa khả dụng; giữ lại dữ liệu nguồn đã xác minh.",
        retryable: providerFailure.retryable !== false,
      } : null;
      stageTimings.self_audit_ms = Date.now() - validationStart;

      const committedRelationships = relationships;

      const suggestedEntities = {
        schema_version: 2,
        studio_name: relationships.suggested_names?.studio_name || null,
        country_name: relationships.suggested_names?.country_name || null,
        actor_names: relationships.suggested_names?.actor_names || [],
        studio: committedRelationships.studio_candidate ? {
          entity_key: committedRelationships.studio_candidate.entity_key,
          id: committedRelationships.studio_candidate.studio_id || null,
          name: committedRelationships.studio_candidate.name,
          logo_url: committedRelationships.studio_candidate.logo_url || null,
          country: committedRelationships.studio_candidate.country || null,
          source: committedRelationships.studio_candidate.source || null,
          source_id: committedRelationships.studio_candidate.source_id || null,
          match_status: committedRelationships.studio_candidate.match_status,
          auto_created_in_request: Boolean(committedRelationships.studio_candidate.auto_created_in_request),
          is_new: Boolean(committedRelationships.studio_candidate.is_new),
        } : null,
        director: {
          name: data.director || relationships.director_metadata?.people?.[0]?.name || null,
          metadata: relationships.director_metadata || { schema_version: 1, primary: null, people: [] },
        },
        actors: (committedRelationships.actors || []).map((actor) => ({
          entity_key: actor.entity_key,
          actor_id: actor.actor_id || null,
          actor_name: actor.actor_name,
          actor_image_url: actor.actor_image_url || null,
          character_name: actor.character_name || null,
          role_name: actor.role_name || "Lồng tiếng",
          is_main_cast: Boolean(actor.is_main_cast),
          is_new: Boolean(actor.is_new),
          match_status: actor.match_status || (actor.actor_id ? "existing" : "suggested_unverified"),
          auto_created_in_request: Boolean(actor.auto_created_in_request),
          source: actor.source || null,
          source_id: actor.source_id || null,
          gender: actor.gender || null,
          birth_date: actor.birth_date || null,
          nationality: actor.nationality || null,
          biography: actor.biography || null,
          aliases: actor.aliases || [],
          enrichment_status: actor.enrichment_status || "skipped",
        })),
      };

      const result = {
        entity_contract_version: 1, candidate_id: selectedCandidate?.candidateId || null,
        ...data, country_id: relationships.matched_country_id || null, studio_id: committedRelationships.matched_studio_id || null,
        series_id: relationships.matched_series_id || null, genre_ids: relationships.matched_genre_ids || [],
        director: data.director || relationships.director_metadata?.people?.[0]?.name || null,
        director_metadata: relationships.director_metadata || { schema_version: 1, primary: null, people: [] },
        studio_candidate: suggestedEntities.studio?.match_status === "new_verified" ? suggestedEntities.studio : null,
        actor_cast: (committedRelationships.actors || []).filter((actor) => actor.actor_id || actor.entity_key), suggested_entities: suggestedEntities,
        relationship_labels: relationships.labels || {},
        confidence_score: confidence.final, confidence_breakdown: confidence,
        field_confidence: fieldConfidence,
        field_provenance: provenance, field_evidence: relationEvidence, conflicts, flags: visibleFlags,
        visual_assets: snapshot.visual_assets, evidence_summary: summary, evidenceSummary: summary,
        web_citations: [], search_queries: [], grounding_metadata: null,
        completeness: partial ? "partial" : "complete",
        partial_reason: safeError || (localizationIncomplete ? { code: "LOCALIZATION_INCOMPLETE", message: "Chưa có bản giới thiệu tiếng Việt đạt yêu cầu. Các thông tin nguồn đã xác minh vẫn được giữ lại.", retryable: true }
          : hasGaps ? { code: "EVIDENCE_INCOMPLETE", message: "Một số nguồn hoặc trường còn thiếu hay mâu thuẫn; cần quản trị viên kiểm tra.", retryable: true } : null),
        retryAfter: providerFailure?.retryAfterMs ? Math.ceil(providerFailure.retryAfterMs / 1000) : null,
        provider_error: safeError ? { ...safeError, retryAfterMs: providerFailure.retryAfterMs || 0 } : null,
        _execution: { provider: synthesis?.provider || "evidence", model: synthesis?.model || "verified_sources",
          usage: synthesis?.usage || {}, estimatedCostUsd: 0, policyDecision: synthesis?.policyDecision || "evidence_only", stageTimings, latencyMs: Date.now() - startedAt,
          evidenceSnapshot: snapshot, providerError: safeError, promptVersion: PROMPT_VERSION },
      };
      if (!auditHandledExternally) await this.audit.recordSuccess(jobId, {
        ...result._execution, confidenceScore: confidence.final, confidenceBreakdown: confidence,
        conflicts, flags: result.flags, fieldProvenance: provenance,
      });
      return projectSuggestionScope(result, type);
    } catch (error) {
      if (!auditHandledExternally) await this.audit.recordFailure(jobId, error, { latencyMs: Date.now() - startedAt, stageTimings });
      throw error;
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
    }
  }
}

export const aiPipeline = new AIPipelineService();
export const aiService = aiPipeline;

export default {
  aiService,
  aiPipeline,
  AIPipelineService,
  aiOrchestrator,
  AIOrchestratorService,
  projectSuggestionScope,
  evidenceCollector,
  EvidenceCollectorService,
  entityMatcher,
  EntityMatcherService,
  conflictDetector,
  ConflictDetectorService,
  confidenceCalculator,
  ConfidenceCalculatorService,
  movieResolutionService,
  MovieResolutionService,
};
