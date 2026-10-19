/**
 * @file use-broadcast-schedules.js
 * @module Admin/Modules/Calendar/Hooks/UseBroadcastSchedules
 * @description Hook quản lý trạng thái, truy vấn TanStack Query, Socket Realtime và thao tác nghiệp vụ cho trang Quản lý Lịch phát sóng Admin.
 */

import { useState, useCallback, useMemo } from 'react';
import {
  useWeeklyBroadcastScheduleQuery,
  useMovieBroadcastScheduleQuery,
} from '@/hooks/queries/use-broadcast.queries';
import {
  useUpsertBroadcastScheduleMutation,
  useDeleteBroadcastScheduleMutation,
  useOverrideBroadcastCalendarMutation,
  useRestoreBroadcastCalendarMutation,
  useUpdateBroadcastStatusMutation,
  useRegenerateBroadcastCalendarMutation,
} from '@/hooks/mutations/use-broadcast.mutations';
import { useBroadcastRealtime } from '@/hooks/socket/use-broadcast-realtime';

export const useBroadcastSchedules = () => {
  // Lắng nghe realtime từ Socket.IO và tự động âm thầm invalidates cache
  useBroadcastRealtime();

  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedDay, setSelectedDay] = useState('all');
  const [selectedMovieId, setSelectedMovieId] = useState(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [error, setError] = useState(null);

  // Modal Thêm / Chỉnh sửa lịch
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState(null);

  // View Mode: 'table' | 'weekly-grid'
  const [viewMode, setViewMode] = useState('weekly-grid');

  // Query lịch tuần
  const {
    data: schedules = [],
    isLoading: loading,
    error: queryError,
    refetch: fetchWeeklySchedule,
  } = useWeeklyBroadcastScheduleQuery(weekOffset);

  // Query chi tiết lịch của 1 phim khi mở panel
  const {
    data: selectedMovieSchedule = null,
    isLoading: detailLoading,
  } = useMovieBroadcastScheduleQuery(selectedMovieId, {
    enabled: Boolean(selectedMovieId) && isDetailOpen,
  });

  // Mutations
  const upsertMutation = useUpsertBroadcastScheduleMutation({
    onError: (err) => setError(err?.message || 'Lỗi khi lưu lịch phát sóng'),
  });

  const deleteMutation = useDeleteBroadcastScheduleMutation({
    onError: (err) => setError(err?.message || 'Lỗi khi xóa lịch phát sóng'),
  });

  const overrideMutation = useOverrideBroadcastCalendarMutation({
    onError: (err) => setError(err?.message || 'Lỗi khi ghi đè lịch chiếu'),
  });

  const restoreMutation = useRestoreBroadcastCalendarMutation({
    onError: (err) => setError(err?.message || 'Lỗi khi khôi phục lịch chiếu'),
  });

  const statusMutation = useUpdateBroadcastStatusMutation({
    onError: (err) => setError(err?.message || 'Lỗi khi cập nhật trạng thái'),
  });

  const regenerateMutation = useRegenerateBroadcastCalendarMutation({
    onError: (err) => setError(err?.message || 'Lỗi khi tái tạo lịch chiếu'),
  });

  const actionLoading =
    upsertMutation.isPending ||
    deleteMutation.isPending ||
    overrideMutation.isPending ||
    restoreMutation.isPending ||
    statusMutation.isPending ||
    regenerateMutation.isPending;

  /**
   * Mở drawer chi tiết lịch của một phim
   */
  const openDetail = useCallback((movieId) => {
    if (!movieId) return;
    setSelectedMovieId(movieId);
    setIsDetailOpen(true);
  }, []);

  /**
   * Đóng drawer chi tiết
   */
  const closeDetail = useCallback(() => {
    setIsDetailOpen(false);
    setSelectedMovieId(null);
  }, []);

  /**
   * Mở modal thêm mới lịch
   */
  const openAddModal = useCallback(() => {
    setEditingSchedule(null);
    setIsModalOpen(true);
  }, []);

  /**
   * Mở modal chỉnh sửa lịch của một phim
   */
  const openEditModal = useCallback((schedule) => {
    setEditingSchedule(schedule);
    setIsModalOpen(true);
  }, []);

  /**
   * Đóng modal thêm/sửa lịch
   */
  const closeModal = useCallback(() => {
    setIsModalOpen(false);
    setEditingSchedule(null);
  }, []);

  /**
   * Ghi đè thời gian phát sóng của 1 tập
   */
  const handleOverride = useCallback(
    async (calendarId, releaseTime) => {
      setError(null);
      await overrideMutation.mutateAsync({ calendarId, releaseTime });
    },
    [overrideMutation]
  );

  /**
   * Khôi phục mốc giờ mặc định của 1 tập
   */
  const handleRestore = useCallback(
    async (calendarId) => {
      setError(null);
      await restoreMutation.mutateAsync({ calendarId });
    },
    [restoreMutation]
  );

  /**
   * Thay đổi trạng thái lịch chiếu (upcoming / delayed / cancelled / released)
   */
  const handleStatusChange = useCallback(
    async (calendarId, status, delayReason) => {
      setError(null);
      await statusMutation.mutateAsync({ calendarId, status, delayReason });
    },
    [statusMutation]
  );

  /**
   * Cưỡng chế tính toán lại lịch phát sóng cho phim
   */
  const handleRegenerate = useCallback(
    async (movieId) => {
      setError(null);
      await regenerateMutation.mutateAsync({ movieId });
    },
    [regenerateMutation]
  );

  /**
   * Xóa lịch phát sóng phim
   */
  const handleDeleteSchedule = useCallback(
    async (movieId) => {
      setError(null);
      await deleteMutation.mutateAsync({ movieId });
      closeDetail();
    },
    [deleteMutation, closeDetail]
  );

  /**
   * Tạo mới hoặc cập nhật Schedule
   */
  const handleUpsertSchedule = useCallback(
    async ({ movieId, payload }) => {
      setError(null);
      await upsertMutation.mutateAsync({ movieId, payload });
      closeModal();
      openDetail(movieId);
    },
    [upsertMutation, closeModal, openDetail]
  );

  /**
   * Lọc danh sách items theo ngày đã chọn (Thứ 2 - Chủ Nhật)
   */
  const filteredSchedules = useMemo(() => {
    if (selectedDay === 'all') return schedules;

    const dayMap = {
      sun: 0,
      mon: 1,
      tue: 2,
      wed: 3,
      thu: 4,
      fri: 5,
      sat: 6,
    };

    const targetDow = dayMap[selectedDay];
    if (targetDow === undefined) return schedules;

    return schedules.filter((item) => {
      const releaseDate = new Date(item.release_time);
      return releaseDate.getDay() === targetDow;
    });
  }, [schedules, selectedDay]);

  /**
   * Đếm số lượng tập theo từng ngày trong tuần
   */
  const dayCounts = useMemo(() => {
    const counts = { mon: 0, tue: 0, wed: 0, thu: 0, fri: 0, sat: 0, sun: 0 };
    const dayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

    schedules.forEach((item) => {
      const dow = new Date(item.release_time).getDay();
      const key = dayNames[dow];
      if (key && counts[key] !== undefined) {
        counts[key]++;
      }
    });

    return counts;
  }, [schedules]);

  return {
    schedules,
    filteredSchedules,
    loading,
    error: error || (queryError ? queryError.message : null),
    setError,
    weekOffset,
    setWeekOffset,
    selectedDay,
    setSelectedDay,
    dayCounts,
    viewMode,
    setViewMode,
    selectedMovieSchedule,
    isDetailOpen,
    detailLoading,
    actionLoading,
    isModalOpen,
    editingSchedule,
    openDetail,
    closeDetail,
    openAddModal,
    openEditModal,
    closeModal,
    fetchWeeklySchedule,
    handleOverride,
    handleRestore,
    handleStatusChange,
    handleRegenerate,
    handleDeleteSchedule,
    handleUpsertSchedule,
  };
};

export default useBroadcastSchedules;
