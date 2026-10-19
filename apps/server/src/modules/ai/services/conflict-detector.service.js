/**
 * @file conflict-detector.service.js
 * @module AI_Conflict_Detector
 * @description Detect factual disagreement without treating source preference as verified resolution.
 */

import { AI_SOURCE_RELIABILITY_MATRIX } from "../constants/ai.constants.js";
import { buildEvidenceFields, FIELD_CATEGORIES, fieldValuesEqual } from "./evidence-fields.util.js";
import { normalizeTitle } from "./movie-identity.util.js";

const LABELS = { release_year: "Năm phát hành", release_date: "Ngày phát hành", director: "Đạo diễn",
  total_episodes: "Tổng số tập", duration: "Thời lượng", status: "Trạng thái", studio: "Studio", type: "Định dạng" };

export class ConflictDetectorService {
  /** Source weights select review preferences, not truth claims. */
  getSourceReliability(source, category = "default") {
    const weights = AI_SOURCE_RELIABILITY_MATRIX[source];
    return weights?.[category] ?? weights?.default ?? 0;
  }

  normalizeString(value) { return normalizeTitle(value); }

  /** Only fields observed in at least two sources are eligible for disagreement. */
  detectConflicts(snapshot = {}) {
    const fields = buildEvidenceFields(snapshot);
    return Object.entries(LABELS).flatMap(([field, label]) => {
      const observations = fields[field] || [];
      if (observations.length < 2 || observations.every((item) => fieldValuesEqual(item.value, observations[0].value))) return [];
      const numbers = observations.map((item) => Number(item.value)).filter(Number.isFinite);
      const difference = Math.max(...numbers) - Math.min(...numbers);
      const severity = ["release_year", "director", "type"].includes(field) || (field === "total_episodes" && difference > 2) || (field === "duration" && difference > 25)
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

  /** A suggested preferred value remains unresolved until independent evidence verifies it. */
  resolveConflicts(conflicts = []) {
    return Object.fromEntries(conflicts.map((conflict) => {
      const preferred = [...conflict.values].sort((a, b) => b.reliability - a.reliability)[0];
      return [conflict.field, { preferred_source: preferred?.source, proposed_value: preferred?.value, verified: false }];
    }));
  }
}

export const conflictDetector = new ConflictDetectorService();
export default conflictDetector;

