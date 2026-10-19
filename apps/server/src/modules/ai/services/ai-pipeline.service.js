/**
 * @file ai-pipeline.service.js
 * @module AI_Pipeline_Service
 * @description Identity-safe evidence synthesis; the worker owns persistence and terminal job events.
 */

import { evidenceCollector } from "./evidence-collector.service.js";
import { entityMatcher } from "./entity-matcher.service.js";
import { aiOrchestrator } from "./ai-orchestrator.service.js";
import { aiAuditService } from "./audit.service.js";
import { conflictDetector } from "./conflict-detector.service.js";
import { confidenceCalculator } from "./confidence-calculator.service.js";
import { aiOutputValidator } from "../validators/ai-output.validator.js";
import { MOVIE_SUGGESTION_SYSTEM_PROMPT, buildMovieSuggestionUserPrompt, PROMPT_VERSION } from "../prompts/movie-suggestion.prompt.js";
import { AI_JOB_STAGES } from "../constants/ai.constants.js";
import { AIProviderError, AI_EXECUTION_LIMITS, normalizeExecutionBudget } from "../providers/ai-provider-policy.js";
import { buildEvidenceFields, TRACKED_FIELDS } from "./evidence-fields.util.js";
import { logger } from "../../../utils/logger.js";

const EMPTY_SNAPSHOT = () => ({
  tmdb: null, anilist: null, jikan: null, omdb: null,
  source_presence: { tmdb: false, anilist: false, jikan: false, omdb: false },
  source_errors: [], rejected_sources: [], visual_assets: { posters: [], covers: [], banners: [] },
});

/** Stop waiting for an uncancellable DB read; late settlement is still handled. */
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

/** Project suggestion scope without changing the selected work's media format. */
export const projectSuggestionScope = (result, scope) => {
  const selections = {
    cast: ["actor_cast", "suggested_entities"],
    synopsis: ["description"],
    seo: ["seo_keywords", "meta_title", "meta_description"],
  };
  const metadata = ["title", "original_title", "slug", "titles", "type", "status", "release_date", "release_year", "duration",
    "season", "season_number", "total_episodes", "age_rating", "director", "trailer_url", "imdb_id", "imdb_rating", "tmdb_id",
    "mal_id", "anilist_id", "category_id", "country_id", "studio_id", "series_id", "genre_ids", "source_type", "suggested_entities"];
  const fields = scope === "metadata" ? metadata : selections[scope];
  if (!fields) return result;
  const operational = ["confidence_score", "confidence_breakdown", "field_confidence", "conflicts", "flags", "field_provenance", "field_evidence",
    "field_provenance_reasoning", "visual_assets", "evidence_summary", "evidenceSummary", "web_citations", "search_queries",
    "grounding_metadata", "completeness", "partial_reason", "retryAfter", "provider_error", "relationship_labels", "_execution"];
  return Object.fromEntries([...fields, ...operational].filter((field) => Object.hasOwn(result, field)).map((field) => [field, result[field]]));
};

export class AIPipelineService {
  constructor(dependencies = {}) {
    this.collector = dependencies.collector || evidenceCollector;
    this.matcher = dependencies.matcher || entityMatcher;
    this.orchestrator = dependencies.orchestrator || aiOrchestrator;
    this.audit = dependencies.audit || aiAuditService;
  }

  /** Match verified source names to existing DB rows; no source-country assumptions or LLM IDs. */
  async matchRelationships(snapshot, title, signal) {
    const db = await boundedRead(() => this.matcher.loadDatabaseEntities(), signal);
    const fields = buildEvidenceFields(snapshot);
    const names = (field) => (fields[field] || []).flatMap((item) => Array.isArray(item.value) ? item.value : [item.value]);
    const genreIds = this.matcher.matchGenres(names("genres"), db.genres);
    const countryIds = [...new Set(names("country").map((country) => this.matcher.matchCountry(country, db.countries)).filter(Boolean))];
    const countryId = countryIds.length === 1 ? countryIds[0] : null;
    const studioId = this.matcher.matchStudio(names("studio"), db.studios);
    const actorNames = names("actor_cast").filter((item) => item && typeof (item.actor_name || item.name) === "string");
    const seen = new Set();
    const uniqueActors = actorNames.filter((item) => {
      const key = `${item.actor_name || item.name}:${item.character_name || item.character || ""}`;
      if (seen.has(key)) return false;
      seen.add(key); return true;
    }).slice(0, 20);
    const actors = await boundedRead(() => this.matcher.matchActors(uniqueActors), signal);
    const series = await boundedRead(() => this.matcher.matchSeries(title, { includeDetails: true }), signal);
    const seriesId = typeof series === "string" ? series : series?.id || null;
    return {
      matched_genre_ids: genreIds, matched_country_id: countryId, matched_studio_id: studioId,
      matched_series_id: seriesId, matched_actors: actors.filter((actor) => actor.actor_id),
      suggested_actors: actors.filter((actor) => !actor.actor_id),
      labels: {
        country_id: db.countries.find((country) => country.id === countryId)?.name || null,
        studio_id: db.studios.find((studio) => studio.id === studioId)?.name || null,
        genre_ids: db.genres.filter((genre) => genreIds.includes(genre.id)).map(({ id, name }) => ({ id, name })),
        series_id: typeof series === "object" ? series?.name || null : null,
      },
      suggested_names: { studio_name: names("studio")[0] || null, country_name: names("country").join(", ") || null,
        actor_names: actors.filter((actor) => !actor.actor_id).map((actor) => actor.actor_name) },
    };
  }

  /**
   * Execute source collection and at most two synthesis passes inside one durable budget.
   * @param {object} params Request, selected candidate, cancellation signal and awaited progress callback.
   * @returns {Promise<object>} Validated complete/partial form suggestion plus execution diagnostics.
   */
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
        relationships = { matched_genre_ids: [], matched_actors: [], suggested_actors: [], labels: {}, suggested_names: {} };
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
      if (Object.values(snapshot.source_presence).some(Boolean) && !activeSignal.aborted) {
        try { synthesis = await runSynthesis(AI_JOB_STAGES.LLM_REASONING); }
        catch (error) { assertNotCancelled(); providerFailure = error; }
      } else providerFailure ||= activeSignal.reason || new AIProviderError("AI_NO_VERIFIED_EVIDENCE", "Chưa thu thập được bằng chứng cho đúng tác phẩm.", { retryable: true });

      // Additional collection is constrained to source-verified aliases, never speculative model names.
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
      const partial = Boolean(providerFailure || hasGaps);
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
      const result = {
        ...data, country_id: relationships.matched_country_id || null, studio_id: relationships.matched_studio_id || null,
        series_id: relationships.matched_series_id || null, genre_ids: relationships.matched_genre_ids || [],
        actor_cast: relationships.matched_actors || [], suggested_entities: relationships.suggested_names || {},
        relationship_labels: relationships.labels || {},
        confidence_score: confidence.final, confidence_breakdown: confidence,
        field_confidence: fieldConfidence,
        field_provenance: provenance, field_evidence: relationEvidence, conflicts, flags: validated.flags,
        visual_assets: snapshot.visual_assets, evidence_summary: summary, evidenceSummary: summary,
        web_citations: [], search_queries: [], grounding_metadata: null,
        completeness: partial ? "partial" : "complete",
        partial_reason: safeError || (hasGaps ? { code: "EVIDENCE_INCOMPLETE", message: "Một số nguồn hoặc trường còn thiếu hay mâu thuẫn; cần quản trị viên kiểm tra.", retryable: true } : null),
        retryAfter: providerFailure?.retryAfterMs ? Math.ceil(providerFailure.retryAfterMs / 1000) : null,
        provider_error: safeError ? { ...safeError, retryAfterMs: providerFailure.retryAfterMs || 0 } : null,
        _execution: { provider: synthesis?.provider || "evidence", model: synthesis?.model || "verified_sources",
          usage: synthesis?.usage || {}, estimatedCostUsd: 0, stageTimings, latencyMs: Date.now() - startedAt,
          evidenceSnapshot: snapshot, providerError: safeError, promptVersion: PROMPT_VERSION },
      };
      if (!auditHandledExternally) await this.audit.recordSuccess(jobId, {
        ...result._execution, confidenceScore: confidence.final, confidenceBreakdown: confidence,
        conflicts, flags: result.flags, fieldProvenance: provenance,
      });
      // Persistence and completion notification must happen in the worker, after this returns.
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
export default aiPipeline;

