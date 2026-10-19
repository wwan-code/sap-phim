/**
 * @file use-ai.mutations.js
 * @module Hooks/Mutations/AI
 * @description React Query Mutation hooks cho các tác vụ AI DataOps Platform.
 */

import { useMutation, useQuery } from "@tanstack/react-query";
import aiService from "@/shared/services/ai.service";

export const AI_QUERY_KEYS = {
  all: ["ai"],
  job: (jobId) => ["ai", "job", jobId],
  history: (params) => ["ai", "history", params],
};

/**
 * Hook Mutation gửi yêu cầu gợi ý thông tin phim bằng AI
 */
export function useSuggestMovieAiMutation(options = {}) {
  return useMutation({
    mutationFn: (payload) => aiService.suggestMovie(payload),
    ...options,
  });
}

/**
 * Hook Query tra cứu trạng thái Job AI
 */
export function useAiJobStatusQuery(jobId, options = {}) {
  return useQuery({
    queryKey: AI_QUERY_KEYS.job(jobId),
    queryFn: () => aiService.getJobStatus(jobId),
    enabled: Boolean(jobId),
    ...options,
  });
}

export default {
  useSuggestMovieAiMutation,
  useAiJobStatusQuery,
};
