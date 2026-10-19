/**
 * @file use-episode.mutations.js
 * @module Hooks/Mutations/Episode
 * @description Các React Query Mutation Hooks phục vụ thao tác CRUD tập phim, yêu cầu token upload, thử lại transcode và quản lý phụ đề.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";

import episodeService from "@/shared/services/episode.service";
import { EPISODE_QUERY_KEYS } from "@/hooks/queries/use-episode.queries";

/**
 * Mutation tạo mới tập phim
 */
export function useCreateEpisodeMutation(options = {}) {
  const queryClient = useQueryClient();
  const { onSuccess, onError, onSettled, ...restOptions } = options;

  return useMutation({
    ...restOptions,
    mutationFn: (data) => episodeService.create(data),
    onSuccess: async (data, variables, context) => {
      await queryClient.invalidateQueries({ queryKey: EPISODE_QUERY_KEYS.all });
      await onSuccess?.(data, variables, context);
    },
    onError: (err, variables, context) => {
      onError?.(err, variables, context);
    },
    onSettled: (data, error, variables, context) => {
      onSettled?.(data, error, variables, context);
    },
  });
}

/**
 * Mutation cập nhật thông tin tập phim
 */
export function useUpdateEpisodeMutation(options = {}) {
  const queryClient = useQueryClient();
  const { onSuccess, onError, onSettled, ...restOptions } = options;

  return useMutation({
    ...restOptions,
    mutationFn: ({ id, data }) => episodeService.update(id, data),
    onSuccess: async (data, variables, context) => {
      await queryClient.invalidateQueries({ queryKey: EPISODE_QUERY_KEYS.detail(variables.id) });
      await queryClient.invalidateQueries({ queryKey: EPISODE_QUERY_KEYS.all });
      await onSuccess?.(data, variables, context);
    },
    onError: (err, variables, context) => {
      onError?.(err, variables, context);
    },
    onSettled: (data, error, variables, context) => {
      onSettled?.(data, error, variables, context);
    },
  });
}

/**
 * Mutation xóa tập phim
 */
export function useDeleteEpisodeMutation(options = {}) {
  const queryClient = useQueryClient();
  const { onSuccess, onError, onSettled, ...restOptions } = options;

  return useMutation({
    ...restOptions,
    mutationFn: (id) => episodeService.delete(id),
    onSuccess: async (data, variables, context) => {
      await queryClient.invalidateQueries({ queryKey: EPISODE_QUERY_KEYS.all });
      await onSuccess?.(data, variables, context);
    },
    onError: (err, variables, context) => {
      onError?.(err, variables, context);
    },
    onSettled: (data, error, variables, context) => {
      onSettled?.(data, error, variables, context);
    },
  });
}

/**
 * Mutation xin cấp TUS Upload Token
 */
export function useUploadTokenMutation(options = {}) {
  const { onSuccess, onError, onSettled, ...restOptions } = options;

  return useMutation({
    ...restOptions,
    mutationFn: (id) => episodeService.requestUploadToken(id),
    onSuccess: async (data, variables, context) => {
      await onSuccess?.(data, variables, context);
    },
    onError: (err, variables, context) => {
      onError?.(err, variables, context);
    },
    onSettled: (data, error, variables, context) => {
      onSettled?.(data, error, variables, context);
    },
  });
}

/**
 * Mutation yêu cầu chạy lại tiến trình chuyển mã bị lỗi
 */
export function useRetryJobMutation(options = {}) {
  const queryClient = useQueryClient();
  const { onSuccess, onError, onSettled, ...restOptions } = options;

  return useMutation({
    ...restOptions,
    mutationFn: (id) => episodeService.retryJob(id),
    onSuccess: async (data, variables, context) => {
      await queryClient.invalidateQueries({ queryKey: EPISODE_QUERY_KEYS.all });
      await onSuccess?.(data, variables, context);
    },
    onError: (err, variables, context) => {
      onError?.(err, variables, context);
    },
    onSettled: (data, error, variables, context) => {
      onSettled?.(data, error, variables, context);
    },
  });
}

/**
 * Mutation xóa tài nguyên video của tập phim
 */
export function useDeleteVideoAssetMutation(options = {}) {
  const queryClient = useQueryClient();
  const { onSuccess, onError, onSettled, ...restOptions } = options;

  return useMutation({
    ...restOptions,
    mutationFn: (id) => episodeService.deleteVideoAsset(id),
    onSuccess: async (data, variables, context) => {
      await queryClient.invalidateQueries({ queryKey: EPISODE_QUERY_KEYS.all });
      await onSuccess?.(data, variables, context);
    },
    onError: (err, variables, context) => {
      onError?.(err, variables, context);
    },
    onSettled: (data, error, variables, context) => {
      onSettled?.(data, error, variables, context);
    },
  });
}

/**
 * Mutation tải lên tệp phụ đề
 */
export function useUploadSubtitleMutation(options = {}) {
  const queryClient = useQueryClient();
  const { onSuccess, onError, onSettled, ...restOptions } = options;

  return useMutation({
    ...restOptions,
    mutationFn: ({ id, formData }) => episodeService.uploadSubtitle(id, formData),
    onSuccess: async (data, variables, context) => {
      const episodeId = variables.id;
      const subEntry = data?.data || data;

      // 1. Cập nhật ngay lập tức cache danh sách phụ đề (0ms lag)
      if (subEntry && (subEntry.id || subEntry.language || subEntry.srclang)) {
        const langKey = subEntry.id || subEntry.language || subEntry.srclang;

        queryClient.setQueryData(EPISODE_QUERY_KEYS.subtitles(episodeId), (old) => {
          const list = Array.isArray(old)
            ? [...old]
            : Array.isArray(old?.data)
              ? [...old.data]
              : [];
          const idx = list.findIndex(
            (s) => (s.id || s.language || s.srclang) === langKey,
          );
          let nextList = [...list];
          if (idx >= 0) {
            nextList[idx] = subEntry;
          } else {
            nextList.push(subEntry);
          }
          if (subEntry.isDefault || subEntry.default) {
            nextList = nextList.map((s) => ({
              ...s,
              isDefault: (s.id || s.language || s.srclang) === langKey,
              default: (s.id || s.language || s.srclang) === langKey,
            }));
          }
          return nextList;
        });

        // 2. Cập nhật ngay cache playback
        queryClient.setQueryData(EPISODE_QUERY_KEYS.playback(episodeId), (old) => {
          if (!old) return old;
          const currentSubs = Array.isArray(old.subtitles) ? [...old.subtitles] : [];
          const idx = currentSubs.findIndex(
            (s) => (s.id || s.language || s.srclang) === langKey,
          );
          let nextSubs = [...currentSubs];
          if (idx >= 0) {
            nextSubs[idx] = subEntry;
          } else {
            nextSubs.push(subEntry);
          }
          if (subEntry.isDefault || subEntry.default) {
            nextSubs = nextSubs.map((s) => ({
              ...s,
              isDefault: (s.id || s.language || s.srclang) === langKey,
              default: (s.id || s.language || s.srclang) === langKey,
            }));
          }
          return {
            ...old,
            subtitles: nextSubs,
          };
        });

        // 3. Cập nhật danh sách tập phim trong Admin table NGAY LẬP TỨC
        queryClient.setQueriesData({ queryKey: EPISODE_QUERY_KEYS.all }, (old) => {
          if (!old) return old;
          const updateEpisode = (ep) => {
            if (ep.id !== episodeId) return ep;
            const oldSubs = Array.isArray(ep.subtitle_sources)
              ? ep.subtitle_sources
              : Array.isArray(ep.subtitles)
                ? ep.subtitles
                : [];
            const idx = oldSubs.findIndex(
              (s) => (s.id || s.language || s.srclang) === langKey,
            );
            const newSubs = [...oldSubs];
            if (idx >= 0) {
              newSubs[idx] = subEntry;
            } else {
              newSubs.push(subEntry);
            }
            return {
              ...ep,
              subtitle_sources: newSubs,
              subtitles: newSubs,
            };
          };

          if (Array.isArray(old)) return old.map(updateEpisode);
          if (Array.isArray(old?.data)) {
            return { ...old, data: old.data.map(updateEpisode) };
          }
          if (Array.isArray(old?.items)) {
            return { ...old, items: old.items.map(updateEpisode) };
          }
          return old;
        });
      }

      await queryClient.invalidateQueries({ queryKey: EPISODE_QUERY_KEYS.subtitles(episodeId), refetchType: 'all' });
      await queryClient.invalidateQueries({ queryKey: EPISODE_QUERY_KEYS.playback(episodeId), refetchType: 'all' });
      await queryClient.invalidateQueries({ queryKey: EPISODE_QUERY_KEYS.all, refetchType: 'all' });

      await onSuccess?.(data, variables, context);
    },
    onError: (err, variables, context) => {
      onError?.(err, variables, context);
    },
    onSettled: (data, error, variables, context) => {
      onSettled?.(data, error, variables, context);
    },
  });
}

/**
 * Mutation xóa phụ đề
 */
export function useDeleteSubtitleMutation(options = {}) {
  const queryClient = useQueryClient();
  const { onSuccess, onError, onSettled, ...restOptions } = options;

  return useMutation({
    ...restOptions,
    mutationFn: ({ id, language }) => episodeService.deleteSubtitle(id, language),
    onSuccess: async (data, variables, context) => {
      const episodeId = variables.id;
      const targetLang = variables.language;

      // 1. Loại bỏ phụ đề khỏi cache danh sách phụ đề NGAY LẬP TỨC (0ms lag)
      queryClient.setQueryData(EPISODE_QUERY_KEYS.subtitles(episodeId), (old) => {
        if (!old) return [];
        const list = Array.isArray(old)
          ? old
          : Array.isArray(old?.data)
            ? old.data
            : [];
        return list.filter(
          (s) =>
            s.id !== targetLang &&
            s.language !== targetLang &&
            s.srclang !== targetLang,
        );
      });

      // 2. Loại bỏ phụ đề khỏi cache Playback của VideoPlayer NGAY LẬP TỨC
      queryClient.setQueryData(EPISODE_QUERY_KEYS.playback(episodeId), (old) => {
        if (!old) return old;
        const currentSubs = Array.isArray(old.subtitles) ? old.subtitles : [];
        return {
          ...old,
          subtitles: currentSubs.filter(
            (s) =>
              s.id !== targetLang &&
              s.language !== targetLang &&
              s.srclang !== targetLang,
          ),
        };
      });

      // 3. Cập nhật danh sách tập phim trong Admin table NGAY LẬP TỨC
      queryClient.setQueriesData({ queryKey: EPISODE_QUERY_KEYS.all }, (old) => {
        if (!old) return old;
        const updateEpisode = (ep) => {
          if (ep.id !== episodeId) return ep;
          const oldSubs = Array.isArray(ep.subtitle_sources)
            ? ep.subtitle_sources
            : Array.isArray(ep.subtitles)
              ? ep.subtitles
              : [];
          const newSubs = oldSubs.filter(
            (s) =>
              s.id !== targetLang &&
              s.language !== targetLang &&
              s.srclang !== targetLang,
          );
          return {
            ...ep,
            subtitle_sources: newSubs,
            subtitles: newSubs,
          };
        };

        if (Array.isArray(old)) return old.map(updateEpisode);
        if (Array.isArray(old?.data)) {
          return {
            ...old,
            data: old.data.map(updateEpisode),
          };
        }
        if (Array.isArray(old?.items)) {
          return {
            ...old,
            items: old.items.map(updateEpisode),
          };
        }
        return old;
      });

      // 4. Invalidate và refetch đồng bộ từ server
      await queryClient.invalidateQueries({ queryKey: EPISODE_QUERY_KEYS.subtitles(episodeId), refetchType: 'all' });
      await queryClient.invalidateQueries({ queryKey: EPISODE_QUERY_KEYS.playback(episodeId), refetchType: 'all' });
      await queryClient.invalidateQueries({ queryKey: EPISODE_QUERY_KEYS.all, refetchType: 'all' });

      await onSuccess?.(data, variables, context);
    },
    onError: (err, variables, context) => {
      onError?.(err, variables, context);
    },
    onSettled: (data, error, variables, context) => {
      onSettled?.(data, error, variables, context);
    },
  });
}

export default {
  useCreateEpisodeMutation,
  useUpdateEpisodeMutation,
  useDeleteEpisodeMutation,
  useUploadTokenMutation,
  useRetryJobMutation,
  useDeleteVideoAssetMutation,
  useUploadSubtitleMutation,
  useDeleteSubtitleMutation,
};
