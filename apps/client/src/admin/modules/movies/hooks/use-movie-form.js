/**
 * @file use-movie-form.js
 * @module Admin/Modules/Movies/Hooks
 * @description Hook điều phối logic cho MovieFormPage: State, Form, Queries, Mutations, AI Job, Permissions.
 */

import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';

import { ROUTES } from '@/shared/constants/routes.constants';
import { PERMISSIONS } from '@/shared/constants/roles.constants';
import { useAuth } from '@/hooks/use-auth';
import {
  useAdminMovieDetailQuery,
  useAdminMovieMetadataQuery,
  MOVIE_QUERY_KEYS,
} from '@/hooks/queries/use-movie.queries';
import {
  useAdminCreateMovieMutation,
  useAdminUpdateMovieMutation,
} from '@/hooks/mutations/use-movie.mutations';
import { useJobSocket } from '@/hooks/socket/use-job-socket';
import { useJobStore } from '@/store/use-job-store';

import { movieSchema, movieDefaultValues } from '../schemas/movie-form.schema';
import {
  mapMovieToFormValues,
  buildMovieSubmission,
  extractImagePreviews,
} from '../mappers/movie-form.mapper';
import { useMovieAi } from './use-movie-ai';

/** @hook useMovieForm @description Coordinate movie form data, permissions and isolated background work. @returns {object} */
export const useMovieForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const { user, isBoss, permissions } = useAuth();

  // 1. Xác định mode & quyền
  const isCreate = location.pathname.includes('/movies/create');
  const isView = location.pathname.includes('/movies/detail');
  const isEdit = Boolean(id) && !isView;

  const hasCreatePerm = isBoss || permissions.includes(PERMISSIONS.MOVIES_CREATE);
  const hasEditPerm = isBoss || permissions.includes(PERMISSIONS.MOVIES_EDIT);
  const hasViewPerm = isBoss || permissions.includes(PERMISSIONS.MOVIES_VIEW);

  // Read Only flag
  const isReadOnly = isView || (isCreate ? !hasCreatePerm : isEdit ? !hasEditPerm : true);

  // Redirect nếu không có quyền
  useEffect(() => {
    if (isCreate && !hasCreatePerm) {
      toast.error('Bạn không có quyền tạo phim mới!');
      navigate(ROUTES.ADMIN.MOVIES);
    }
    if (isEdit && !hasEditPerm) {
      toast.error('Bạn không có quyền chỉnh sửa phim!');
      navigate(ROUTES.ADMIN.MOVIES);
    }
    if (isView && !hasViewPerm) {
      toast.error('Bạn không có quyền xem chi tiết phim!');
      navigate(ROUTES.ADMIN.MOVIES);
    }
  }, [isCreate, isEdit, isView, hasCreatePerm, hasEditPerm, hasViewPerm, navigate]);

  // 2. Form Setup
  const form = useForm({
    resolver: yupResolver(movieSchema),
    defaultValues: movieDefaultValues,
  });
  const { reset, handleSubmit, formState } = form;
  const { isDirty, isSubmitting } = formState;

  // 3. File State
  const [imageFiles, setImageFiles] = useState({
    poster: null,
    banner: null,
    cover: null,
    logo: null,
  });
  const [imagePreviews, setImagePreviews] = useState({
    poster: '',
    banner: '',
    cover: '',
    logo: '',
  });

  // 4. Queries & Mutations
  const queryClient = useQueryClient();
  const { data: metadata } = useAdminMovieMetadataQuery();
  const { data: movieData, isLoading: isLoadingMovie } = useAdminMovieDetailQuery(id, {
    enabled: Boolean(id),
  });
  const createMutation = useAdminCreateMovieMutation();
  const updateMutation = useAdminUpdateMovieMutation();

  const slugManuallyEdited = useRef(false);
  const allowNavigationRef = useRef(false);
  const [allowNavigation, setAllowNavigation] = useState(false);
  const [activeMediaJobId, setActiveMediaJobId] = useState(null);

  // Lấp đầy form khi có data edit/view
  useEffect(() => {
    if (movieData && (isEdit || isView)) {
      const formValues = mapMovieToFormValues(movieData);
      reset(formValues);

      // Chỉ ghi đè previews từ server nếu không có job xử lý ảnh đang chạy nền
      if (!activeMediaJobId) {
        const previews = extractImagePreviews(movieData);
        setImagePreviews(previews);
      }

      if (movieData.slug) {
        slugManuallyEdited.current = true;
      }
    }
  }, [movieData, isEdit, isView, reset, activeMediaJobId]);

  const ai = useMovieAi({ ownerId: user?.id, movieId: id, isReadOnly, form, requestedJobId: location.state?.aiJobId });
  const activeJobIds = useJobStore((state) => state.activeJobIds);
  const jobs = useJobStore((state) => state.jobs);

  // Phục hồi Job Media đang chạy khi tải trang hoặc chuyển trang
  useEffect(() => {
    if (!activeMediaJobId) {
      const ongoingMediaJobId = activeJobIds.find(
        (jid) => jobs[jid]?.jobType === 'movie' && !jobs[jid]?.isDismissed && jobs[jid]?.isActive
      );
      if (ongoingMediaJobId) {
        setActiveMediaJobId(ongoingMediaJobId);
      }
    }
  }, [activeJobIds, jobs, activeMediaJobId]);

  // Lắng nghe tiến trình xử lý ảnh nền (Sharp/Upscale worker)
  useJobSocket(activeMediaJobId, {
    jobType: 'movie',
    onComplete: (job) => {
      let resultData = job?.outputs || job?.result || job?.finalImages;
      if (!resultData && job?.jobId) {
        const storeJob = useJobStore.getState().jobs[job.jobId];
        resultData = storeJob?.outputs || storeJob?.result || storeJob?.finalImages;
      }

      const images = resultData?.images || resultData;
      if (images && typeof images === 'object') {
        const previews = extractImagePreviews({ images });
        setImagePreviews((prev) => ({
          ...prev,
          ...Object.fromEntries(
            Object.entries(previews).filter(([_, v]) => Boolean(v))
          ),
        }));
      }

      if (id) {
        queryClient.invalidateQueries({ queryKey: MOVIE_QUERY_KEYS.adminDetail(id) });
      }
      queryClient.invalidateQueries({ queryKey: MOVIE_QUERY_KEYS.all });
      toast.success('Đã hoàn tất xử lý và cập nhật hình ảnh mới!');
      setActiveMediaJobId(null);
    },
    onError: (job) => {
      setActiveMediaJobId(null);
      toast.error(job?.error || 'Xử lý hình ảnh thất bại.');
    },
  });

  // 6. Submit Logic
  const onSubmit = async (values) => {
    let actualJobId = null;
    try {
      // Build submission payload
      const jobId = Object.values(imageFiles).some(Boolean) ? `movie-job-${Date.now()}` : null;
      const submission = buildMovieSubmission(values, imageFiles, jobId);
      const { payload, isMultipart, hasNewFiles, primaryTitle } = submission;
      actualJobId = submission.jobId;
      const displayTitle = primaryTitle || values.title || 'Tác phẩm mới';

      if (actualJobId) {
        useJobStore.getState().registerJob(actualJobId, {
          jobType: 'movie',
          title: `Đang lưu phim: ${displayTitle}`,
        });
        setActiveMediaJobId(actualJobId);
      }

      let res;
      if (isEdit) {
        res = await updateMutation.mutateAsync({ id, payload, data: payload, isMultipart, jobId: actualJobId });
        toast.success(
          hasNewFiles
            ? 'Đã cập nhật phim! Đang xử lý ảnh trong nền...'
            : 'Cập nhật phim thành công!'
        );
        setImageFiles({ poster: null, banner: null, cover: null, logo: null });
        reset(values); // Reset dirty state
      } else {
        res = await createMutation.mutateAsync({ payload, data: payload, isMultipart, jobId: actualJobId });
        const newId = res?.data?.id || res?.id;
        ai.completeAiDraft();
        toast.success(
          hasNewFiles
            ? 'Đã tạo phim! Đang xử lý ảnh nền và sẽ chuyển sang trang chỉnh sửa...'
            : 'Tạo phim thành công!'
        );
        allowNavigationRef.current = true;
        setAllowNavigation(true);
        setImageFiles({ poster: null, banner: null, cover: null, logo: null });
        reset(values);
        
        if (newId) {
          // Replace: true để tránh lấp lịch sử, mượt mà chuyển URL
          navigate(ROUTES.ADMIN.MOVIE_EDIT(newId), { replace: true });
        }
      }

      // Xử lý đối chiếu (Reconciliation) cho Job lưu phim
      if (actualJobId) {
        const isAsyncImageQueued = Boolean(res?.meta?.async && res?.meta?.imageStatus === 'queued');

        if (!isAsyncImageQueued) {
          // Không có hàng đợi ảnh nền hoặc backend đã hoàn tất ngay tức thì
          useJobStore.getState().updateJobProgress({
            jobId: actualJobId,
            jobType: 'movie',
            status: 'completed',
            percent: 100,
            stage: 'completed',
            stageLabel: 'Hoàn tất',
            message: isEdit ? 'Đã cập nhật phim thành công' : 'Đã tạo phim thành công',
            terminal: true,
          });
          setActiveMediaJobId(null);
        } else {
          // Có ảnh đưa vào hàng đợi nền: cập nhật tiến trình bước đầu
          useJobStore.getState().updateJobProgress({
            jobId: actualJobId,
            jobType: 'movie',
            status: 'processing',
            percent: 25,
            stage: 'QUEUED',
            stageLabel: 'Đang xếp hàng xử lý ảnh...',
            message: 'Đang đợi hàng đợi xử lý ảnh...',
          });

          // Cơ chế an toàn: Sau 25s nếu socket lỡ gói tin, tự hoàn tất
          setTimeout(() => {
            const currentJob = useJobStore.getState().jobs[actualJobId];
            if (currentJob && !currentJob.isTerminal && !currentJob.isDismissed) {
              useJobStore.getState().updateJobProgress({
                jobId: actualJobId,
                jobType: 'movie',
                status: 'completed',
                percent: 100,
                stage: 'completed',
                stageLabel: 'Hoàn tất',
                message: 'Đã hoàn tất lưu phim',
                terminal: true,
              });
            }
          }, 25000);
        }
      }
    } catch (err) {
      if (actualJobId) {
        useJobStore.getState().updateJobProgress({
          jobId: actualJobId,
          jobType: 'movie',
          status: 'failed',
          error: err?.message || 'Có lỗi xảy ra khi lưu phim.',
          terminal: true,
        });
        setActiveMediaJobId(null);
      }
      toast.error(err?.message || 'Có lỗi xảy ra khi lưu phim.');
    }
  };

  return {
    // Mode & Auth
    mode: isView ? 'view' : isEdit ? 'edit' : 'create',
    isReadOnly,
    hasEditPerm,
    isLoadingMovie,

    // Form
    form,
    onSubmit: handleSubmit(onSubmit),
    isSubmitting: isSubmitting || createMutation.isPending || updateMutation.isPending,
    isDirty,
    
    // Metadata (genres, etc)
    metadata,

    // Media
    imageFiles,
    imagePreviews,
    setImageFiles,
    setImagePreviews,
    activeMediaJobId,

    // AI state is isolated by authenticated account and movie/draft target.
    ...ai,

    // Navigation
    navigate,
    slugManuallyEdited,
    allowNavigation,
    allowNavigationRef,
  };
};
