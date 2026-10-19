/**
 * @file confidence-calculator.service.js
 * @module AI_Confidence_Calculator
 * @description Compute confidence from observed coverage, reliability and real cross-source agreement.
 */

import { AI_SOURCE_RELIABILITY_MATRIX, AI_AUDIT_FLAGS } from "../constants/ai.constants.js";
import { buildEvidenceFields, FIELD_CATEGORIES, TRACKED_FIELDS, fieldValuesEqual } from "./evidence-fields.util.js";

const rounded = (number) => Number(number.toFixed(2));

export class ConfidenceCalculatorService {
  /** LLM confidence is diagnostic only and cannot raise the computed score. */
  calculateConfidenceScore({ parsedData = {}, evidenceSnapshot = {}, conflicts = [], flags = [] } = {}) {
    const fields = buildEvidenceFields(evidenceSnapshot);
    const observations = Object.values(fields).flat();
    const activeSources = [...new Set(observations.map((item) => item.source))];
    const observedFields = TRACKED_FIELDS.filter((field) => fields[field]?.length);
    const comparableFields = TRACKED_FIELDS.filter((field) => fields[field]?.length >= 2);
    const agreeingFields = comparableFields.filter((field) => fields[field].every((item) => fieldValuesEqual(item.value, fields[field][0].value)));
    const coverage = observedFields.length / TRACKED_FIELDS.length;
    const consensus = comparableFields.length ? agreeingFields.length / comparableFields.length : 0;
    const reliability = observedFields.length ? observedFields.reduce((sum, field) => {
      const matrixCategory = FIELD_CATEGORIES[field] || "default";
      const weights = fields[field].map((item) => AI_SOURCE_RELIABILITY_MATRIX[item.source]?.[matrixCategory] ?? AI_SOURCE_RELIABILITY_MATRIX[item.source]?.default ?? 0);
      return sum + weights.reduce((total, weight) => total + weight, 0) / weights.length;
    }, 0) / observedFields.length : 0;
    let penalty = conflicts.reduce((sum, conflict) => sum + (conflict.severity === "high" ? 0.15 : conflict.severity === "medium" ? 0.05 : 0), 0);
    if (flags.includes(AI_AUDIT_FLAGS.POSSIBLE_DIRECTOR_AUTHOR_CONFUSION)) penalty += 0.1;
    penalty = Math.min(0.45, penalty);
    let computed = activeSources.length ? Math.max(0, Math.min(1, 0.5 * reliability + 0.3 * coverage + 0.2 * consensus - penalty)) : 0;
    const unresolved = conflicts.some((conflict) => conflict.severity === "high" && conflict.resolution_verified !== true);
    const clamped = unresolved && computed > 0.7;
    if (unresolved) computed = Math.min(computed, 0.7);
    const reported = Number(parsedData.confidence_score);
    const fieldScores = Object.fromEntries(Object.entries(fields).map(([field, values]) => {
      const category = FIELD_CATEGORIES[field] || "core_identifiers";
      const average = values.reduce((sum, item) => sum + (AI_SOURCE_RELIABILITY_MATRIX[item.source]?.[category]
        ?? AI_SOURCE_RELIABILITY_MATRIX[item.source]?.default ?? 0), 0) / values.length;
      const chosen = parsedData[field] ?? values[0].value;
      const support = values.filter((item) => fieldValuesEqual(item.value, chosen)).length;
      const agreement = values.length >= 2 ? support / values.length : 0;
      let score = average * (0.7 + 0.3 * agreement);
      if (conflicts.some((conflict) => conflict.field === field && conflict.severity === "high" && !conflict.resolution_verified)) score = Math.min(score, 0.7);
      return [field, rounded(score)];
    }));
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
export default confidenceCalculator;

