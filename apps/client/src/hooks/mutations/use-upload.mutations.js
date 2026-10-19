/**
 * @file use-upload.mutations.js
 * @module Hooks/Mutations/Upload
 * @description React Mutation Hooks phục vụ các tác vụ tải lên hình ảnh, avatar, cover, batch, hủy tiến trình và quản lý bộ nhớ đệm TanStack.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import uploadService from "@/shared/services/upload.service";
import { UPLOAD_QUERY_KEYS } from "@/hooks/queries/use-upload.queries";
import { USER_QUERY_KEYS } from "@/hooks/queries/use-user.queries";

/**
 * Mutation tải lên một hình ảnh đơn (hỗ trợ theo dõi tiến độ mạng onUploadProgress và tự tạo jobId nếu có AI)
 * @param {Object} [options={}]
 * @returns {import('@tanstack/react-query').UseMutationResult}
 */
export function useUploadImageMutation(options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (variables) => {
      // Cho phép truyền biến dạng File, FormData hoặc { data, onProgress, signal }
      const data = variables?.data !== undefined ? variables.data : variables;
      const onUploadProgress = variables?.onProgress || options.onProgress;
      const signal = variables?.signal || options.signal;

      return uploadService.uploadImage(data, { onUploadProgress, signal });
    },
    onSuccess: (data, variables, context) => {
      // Nếu là job chạy hàng đợi (queued), chủ động cache trạng thái ban đầu
      if (data?.jobId) {
        queryClient.setQueryData(UPLOAD_QUERY_KEYS.status(data.jobId), {
          jobId: data.jobId,
          status: data.status || "queued",
          percent: data.progress || 0,
          message: data.message || "Đã thêm vào hàng đợi",
        });
      }

      // Làm mới các Query Keys được chỉ định nếu có
      if (options.invalidateQueryKeys) {
        const keys = Array.isArray(options.invalidateQueryKeys[0])
          ? options.invalidateQueryKeys
          : [options.invalidateQueryKeys];
        keys.forEach((key) => queryClient.invalidateQueries({ queryKey: key }));
      }

      options.onSuccess?.(data, variables, context);
    },
    ...options,
  });
}

/**
 * Mutation tải lên ảnh đại diện Avatar (tự động đồng bộ và làm mới Cache thông tin người dùng)
 * @param {Object} [options={}]
 * @returns {import('@tanstack/react-query').UseMutationResult}
 */
export function useUploadAvatarMutation(options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (variables) => {
      const data = variables?.data !== undefined ? variables.data : variables;
      const onUploadProgress = variables?.onProgress || options.onProgress;
      const signal = variables?.signal || options.signal;

      return uploadService.uploadAvatar(data, { onUploadProgress, signal });
    },
    onSuccess: (data, variables, context) => {
      // Tự động làm mới cache User Profile
      queryClient.invalidateQueries({ queryKey: USER_QUERY_KEYS.me() });
      queryClient.invalidateQueries({ queryKey: USER_QUERY_KEYS.all });

      options.onSuccess?.(data, variables, context);
    },
    ...options,
  });
}

/**
 * Mutation tải lên ảnh bìa Cover Banner (tự động đồng bộ và làm mới Cache thông tin người dùng)
 * @param {Object} [options={}]
 * @returns {import('@tanstack/react-query').UseMutationResult}
 */
export function useUploadCoverMutation(options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (variables) => {
      const data = variables?.data !== undefined ? variables.data : variables;
      const onUploadProgress = variables?.onProgress || options.onProgress;
      const signal = variables?.signal || options.signal;

      return uploadService.uploadCover(data, { onUploadProgress, signal });
    },
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: USER_QUERY_KEYS.me() });
      queryClient.invalidateQueries({ queryKey: USER_QUERY_KEYS.all });

      options.onSuccess?.(data, variables, context);
    },
    ...options,
  });
}

/**
 * Mutation tải lên nhiều hình ảnh hàng loạt (Batch Upload)
 * @param {Object} [options={}]
 * @returns {import('@tanstack/react-query').UseMutationResult}
 */
export function useUploadBatchMutation(options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (variables) => {
      const data = variables?.data !== undefined ? variables.data : variables;
      const onUploadProgress = variables?.onProgress || options.onProgress;
      const signal = variables?.signal || options.signal;

      return uploadService.uploadBatch(data, { onUploadProgress, signal });
    },
    onSuccess: (data, variables, context) => {
      if (options.invalidateQueryKeys) {
        const keys = Array.isArray(options.invalidateQueryKeys[0])
          ? options.invalidateQueryKeys
          : [options.invalidateQueryKeys];
        keys.forEach((key) => queryClient.invalidateQueries({ queryKey: key }));
      }

      options.onSuccess?.(data, variables, context);
    },
    ...options,
  });
}

/**
 * Mutation xóa tệp tin đã tải lên khỏi Storage
 * @param {Object} [options={}]
 * @returns {import('@tanstack/react-query').UseMutationResult}
 */
export function useDeleteFileMutation(options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (variables) => {
      const url = typeof variables === "string" ? variables : variables?.url;
      return uploadService.deleteFile(url, { signal: variables?.signal });
    },
    onSuccess: (data, variables, context) => {
      if (options.invalidateQueryKeys) {
        const keys = Array.isArray(options.invalidateQueryKeys[0])
          ? options.invalidateQueryKeys
          : [options.invalidateQueryKeys];
        keys.forEach((key) => queryClient.invalidateQueries({ queryKey: key }));
      }

      options.onSuccess?.(data, variables, context);
    },
    ...options,
  });
}

/**
 * Mutation hủy công việc tải lên/xử lý đang thực hiện
 * @param {Object} [options={}]
 * @returns {import('@tanstack/react-query').UseMutationResult}
 */
export function useCancelUploadJobMutation(options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (variables) => {
      const jobId = typeof variables === "string" ? variables : variables?.jobId;
      return uploadService.cancelJob(jobId, { signal: variables?.signal });
    },
    onSuccess: (data, variables, context) => {
      const jobId = typeof variables === "string" ? variables : variables?.jobId;
      if (jobId) {
        // Cập nhật ngay trạng thái trong cache thành cancelled
        queryClient.setQueryData(UPLOAD_QUERY_KEYS.status(jobId), (old) => ({
          ...(old || {}),
          status: "cancelled",
          message: "Công việc đã bị hủy",
        }));
      }

      options.onSuccess?.(data, variables, context);
    },
    ...options,
  });
}

/**
 * Mutation yêu cầu xử lý lại ảnh đã có trong Storage (Reprocess Image)
 * @param {Object} [options={}]
 * @returns {import('@tanstack/react-query').UseMutationResult}
 */
export function useReprocessImageMutation(options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload) => uploadService.reprocessExisting(payload),
    onSuccess: (data, variables, context) => {
      if (data?.jobId) {
        queryClient.setQueryData(UPLOAD_QUERY_KEYS.status(data.jobId), {
          jobId: data.jobId,
          status: "queued",
          message: "Đã thêm vào hàng đợi xử lý lại",
        });
      }

      options.onSuccess?.(data, variables, context);
    },
    ...options,
  });
}

export default {
  useUploadImageMutation,
  useUploadAvatarMutation,
  useUploadCoverMutation,
  useUploadBatchMutation,
  useDeleteFileMutation,
  useCancelUploadJobMutation,
  useReprocessImageMutation,
};
