/**
 * @file movie-resolution.service.js
 * @module AI_Movie_Resolution
 * @description Resolve source candidates before requesting AI synthesis for a selected work.
 */

import { evidenceCollector } from "./evidence-collector.service.js";
import { selectUnambiguousCandidate } from "./movie-identity.util.js";

export class MovieResolutionService {
  constructor(collector = evidenceCollector) { this.collector = collector; }

  /** Return explicit candidates; ambiguous identity requires administrator selection. */
  async resolve({ title, year, mediaType = "all", signal }) {
    const candidates = await this.collector.searchCandidates({ title, year, mediaType, signal });
    const selectedCandidate = selectUnambiguousCandidate(candidates, { title, year, mediaType });
    return { candidates, requiresSelection: candidates.length > 0 && !selectedCandidate, selectedCandidate };
  }
}

export const movieResolutionService = new MovieResolutionService();
export default movieResolutionService;
