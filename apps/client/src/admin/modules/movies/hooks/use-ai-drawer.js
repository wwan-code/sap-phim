/**
 * @file use-ai-drawer.js
 * @module Admin/Movies/Hooks
 * @description Presentation model for compatible result-only and real-job drawer states.
 */
import { useEffect, useRef } from 'react';

import { getAiProgressView } from '../utils/ai-review.util';
import { useAiSuggestionReview } from './use-ai-suggestion-review';

/** @hook useAiDrawer @description Bind progress and review to one explicitly viewed job. */
export const useAiDrawer = ({ job, suggestionData, suggestionId, isOpen, ...options }) => {
  const compatible = !job?.jobId || !suggestionId || job.jobId === suggestionId;
  const result = (compatible ? suggestionData : null) || job?.result || job?.outputs || null;
  const review = useAiSuggestionReview({ ...options, suggestionData: result, suggestionId: job?.jobId || suggestionId });
  const progress = getAiProgressView(job || {});
  const ready = Boolean(result) && (!job || job.status === 'completed');
  const headingRef = useRef(null);
  const previous = useRef(null);
  const identity = job?.jobId || suggestionId;
  useEffect(() => {
    if (isOpen && ready && previous.current === identity) headingRef.current?.focus({ preventScroll: true });
    previous.current = !ready ? identity : null;
  }, [isOpen, ready, identity]);
  const formats = { movie: 'Phim điện ảnh', series: 'Phim bộ', tv: 'Phim truyền hình', ova: 'OVA', ona: 'ONA', special: 'Đặc biệt' };
  const title = result?.titles?.find((item) => item.type === 'default')?.title || result?.title || job?.title || 'Gợi ý thông tin phim';
  const subtitle = [result?.release_year, formats[result?.type]].filter(Boolean).join(' · ');
  return { result, review, progress, ready, headingRef, title, subtitle, hasContent: Boolean(job || result),
    changedCount: review.fields.filter((field) => field.isDirty).length,
    attentionCount: review.fields.filter((field) => field.hasError || field.conflicts.length || field.confidence == null || field.confidence === 0).length,
  };
};
