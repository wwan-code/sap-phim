/**
 * @file BroadcastCalendarPage.jsx
 * @module Admin/Modules/Calendar/Pages/BroadcastCalendarPage
 * @description Trang quản lý lịch phát sóng tuần (Thứ 2 đến Chủ Nhật) cho các anime/phim định kỳ,
 * hỗ trợ chế độ xem Lưới 7 Ngày (Weekly Grid) & Bảng Dữ Liệu (Table View), đồng bộ Socket.IO Realtime và Modal cấu hình Dual-Mode.
 */

import React from 'react';
import {
  Clock,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Eye,
  AlertTriangle,
  Film,
  Plus,
  LayoutGrid,
  List,
} from 'lucide-react';
import Button from '@/shared/components/ui/button/Button';
import { SectionCard } from '@/admin/shared/components/layout/section-card/SectionCard';
import { useBroadcastSchedules } from '../hooks/use-broadcast-schedules';
import { CalendarStatusBadge } from '../components/CalendarStatusBadge';
import { ScheduleDetailPanel } from '../components/ScheduleDetailPanel';
import { WeeklyCalendarGrid } from '../components/WeeklyCalendarGrid';
import { ScheduleModal } from '../components/ScheduleModal';
import './broadcast-calendar-page.scss';

const DAY_TABS = [
  { id: 'all', name: 'Cả tuần' },
  { id: 'mon', name: 'Thứ 2', dow: 1 },
  { id: 'tue', name: 'Thứ 3', dow: 2 },
  { id: 'wed', name: 'Thứ 4', dow: 3 },
  { id: 'thu', name: 'Thứ 5', dow: 4 },
  { id: 'fri', name: 'Thứ 6', dow: 5 },
  { id: 'sat', name: 'Thứ 7', dow: 6 },
  { id: 'sun', name: 'Chủ Nhật', dow: 0 },
];

const DAY_NAMES_VI = ['Chủ Nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];

export const BroadcastCalendarPage = () => {
  const {
    schedules,
    filteredSchedules,
    loading,
    error,
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
  } = useBroadcastSchedules();

  const getWeekLabel = (offset) => {
    if (offset === 0) return 'Tuần hiện tại';
    if (offset > 0) return `Tuần sau (+${offset})`;
    return `Tuần trước (${offset})`;
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDateShort = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return `${DAY_NAMES_VI[d.getDay()]} (${d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })})`;
  };

  return (
    <div className="broadcast-calendar-page">
      {/* Header */}
      <div className="broadcast-calendar-page__header">
        <div className="broadcast-calendar-page__title-group">
          <h1 className="broadcast-calendar-page__title">Quản Lý Lịch Phát Sóng</h1>
          <p className="broadcast-calendar-page__subtitle">
            Cấu hình khung giờ và ngày phát hành tập mới trong tuần cho anime và phim bộ.
          </p>
        </div>

        <div className="broadcast-calendar-page__header-actions">
          {/* Nút Thêm Lịch Mới */}
          <Button
            type="button"
            variant="filled"
            startIcon={<Plus size={16} />}
            onClick={openAddModal}
          >
            Thêm Lịch Mới
          </Button>

          {/* View Mode Switcher (Grid vs Table) */}
          <div className="broadcast-calendar-page__view-toggle" role="group" aria-label="Chế độ hiển thị">
            <button
              type="button"
              className={`broadcast-calendar-page__view-btn ${
                viewMode === 'weekly-grid' ? 'broadcast-calendar-page__view-btn--active' : ''
              }`}
              onClick={() => setViewMode('weekly-grid')}
              title="Xem dạng lưới 7 ngày"
            >
              <LayoutGrid size={15} />
              <span>Lưới Tuần</span>
            </button>
            <button
              type="button"
              className={`broadcast-calendar-page__view-btn ${
                viewMode === 'table' ? 'broadcast-calendar-page__view-btn--active' : ''
              }`}
              onClick={() => setViewMode('table')}
              title="Xem dạng bảng danh sách"
            >
              <List size={15} />
              <span>Bảng Chi Tiết</span>
            </button>
          </div>

          {/* Week Navigator */}
          <div className="broadcast-calendar-page__week-navigator">
            <button
              type="button"
              className="broadcast-calendar-page__nav-btn"
              onClick={() => setWeekOffset(weekOffset - 1)}
              title="Tuần trước"
              aria-label="Tuần trước"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="broadcast-calendar-page__nav-label">
              {getWeekLabel(weekOffset)}
            </span>
            <button
              type="button"
              className="broadcast-calendar-page__nav-btn"
              onClick={() => setWeekOffset(weekOffset + 1)}
              title="Tuần sau"
              aria-label="Tuần sau"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {weekOffset !== 0 && (
            <button
              type="button"
              className="broadcast-calendar-page__nav-today-btn"
              onClick={() => setWeekOffset(0)}
            >
              Về tuần này
            </button>
          )}

          <button
            type="button"
            className="broadcast-calendar-page__refresh-btn"
            onClick={() => fetchWeeklySchedule()}
            title="Làm mới"
            aria-label="Làm mới dữ liệu"
          >
            <RefreshCw className={loading ? 'broadcast-calendar-page__spinner' : ''} size={16} />
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="broadcast-calendar-page__error-banner" role="alert">
          <span>{error}</span>
          <button
            type="button"
            className="broadcast-calendar-page__error-close"
            onClick={() => setError(null)}
          >
            &times;
          </button>
        </div>
      )}

      {/* RENDER VIEW THEO VIEW MODE */}
      {viewMode === 'weekly-grid' ? (
        <div className="broadcast-calendar-page__grid-section">
          {loading ? (
            <div className="broadcast-calendar-page__state-container">
              <RefreshCw className="broadcast-calendar-page__spinner" size={28} />
              <p>Đang tải dữ liệu lịch phát sóng...</p>
            </div>
          ) : (
            <WeeklyCalendarGrid
              schedules={schedules}
              weekOffset={weekOffset}
              onItemClick={openDetail}
            />
          )}
        </div>
      ) : (
        <>
          {/* Filter Tabs (cho chế độ Bảng) */}
          <div className="broadcast-calendar-page__tabs-container">
            {DAY_TABS.map((tab) => {
              const count = tab.id === 'all' ? schedules.length : dayCounts[tab.id] || 0;
              return (
                <button
                  key={tab.id}
                  type="button"
                  className={`broadcast-calendar-page__tab ${
                    selectedDay === tab.id ? 'broadcast-calendar-page__tab--active' : ''
                  }`}
                  onClick={() => setSelectedDay(tab.id)}
                >
                  <span>{tab.name}</span>
                  <span className="broadcast-calendar-page__tab-badge">{count}</span>
                </button>
              );
            })}
          </div>

          {/* Table Section */}
          <SectionCard noPadding>
            {loading ? (
              <div className="broadcast-calendar-page__state-container">
                <RefreshCw className="broadcast-calendar-page__spinner" size={28} />
                <p>Đang tải dữ liệu lịch phát sóng...</p>
              </div>
            ) : filteredSchedules.length === 0 ? (
              <div className="broadcast-calendar-page__state-container">
                <Film size={36} />
                <p>Không có lịch chiếu nào trong tuần hoặc ngày này.</p>
              </div>
            ) : (
              <div className="broadcast-calendar-page__table-wrapper">
                <table className="broadcast-calendar-page__table">
                  <thead>
                    <tr>
                      <th>Ngày Trong Tuần</th>
                      <th>Khung Giờ</th>
                      <th>Tác Phẩm</th>
                      <th>Tập Chiếu</th>
                      <th>Trạng Thái</th>
                      <th className="broadcast-calendar-page__actions-cell">Thao Tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSchedules.map((entry) => {
                      const movie = entry.schedule?.movie;
                      const episode = entry.episode;
                      const title = movie?.titles?.[0]?.title || movie?.slug || 'Tác phẩm';
                      const posterUrl = movie?.images?.poster?.url || movie?.images?.thumbnail?.url;

                      return (
                        <tr key={entry.id}>
                          {/* Ngày trong tuần */}
                          <td>
                            <span className="broadcast-calendar-page__day-badge">
                              {formatDateShort(entry.release_time)}
                            </span>
                          </td>

                          {/* Khung giờ */}
                          <td>
                            <div className="broadcast-calendar-page__time-cell">
                              <Clock size={14} />
                              <span>{formatTime(entry.release_time)}</span>
                            </div>
                          </td>

                          {/* Tác phẩm */}
                          <td>
                            <div className="broadcast-calendar-page__movie-cell">
                              {posterUrl ? (
                                <img
                                  src={posterUrl}
                                  alt={title}
                                  className="broadcast-calendar-page__movie-poster"
                                  loading="lazy"
                                />
                              ) : (
                                <div className="broadcast-calendar-page__movie-poster" />
                              )}
                              <div className="broadcast-calendar-page__movie-info">
                                <span
                                  className="broadcast-calendar-page__movie-title"
                                  onClick={() => openDetail(entry.schedule?.movie_id)}
                                  role="button"
                                  tabIndex={0}
                                >
                                  {title}
                                </span>
                                {movie?.genres && movie.genres.length > 0 && (
                                  <span className="broadcast-calendar-page__movie-genres">
                                    {movie.genres.map((g) => g.name).join(', ')}
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Tập chiếu */}
                          <td>
                            <span className="broadcast-calendar-page__ep-badge">
                              Tập {entry.episode_number || episode?.episode_number || '—'}
                              {entry.is_exception && (
                                <span className="broadcast-calendar-page__ep-override" title="Đã chỉnh sửa thủ công">
                                  (Đổi)
                                </span>
                              )}
                            </span>
                          </td>

                          {/* Trạng thái */}
                          <td>
                            <CalendarStatusBadge
                              status={entry.status}
                              delayReason={entry.delay_reason}
                            />
                          </td>

                          {/* Thao tác */}
                          <td className="broadcast-calendar-page__actions-cell">
                            <button
                              type="button"
                              className="broadcast-calendar-page__action-btn"
                              onClick={() => openDetail(entry.schedule?.movie_id)}
                              title="Xem chi tiết lịch phát sóng"
                            >
                              <Eye size={14} />
                              <span>Chi tiết</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>
        </>
      )}

      {/* Slide-out Detail Panel */}
      <ScheduleDetailPanel
        isOpen={isDetailOpen}
        loading={detailLoading}
        actionLoading={actionLoading}
        schedule={selectedMovieSchedule}
        onClose={closeDetail}
        onOverride={handleOverride}
        onRestore={handleRestore}
        onStatusChange={handleStatusChange}
        onRegenerate={handleRegenerate}
        onDelete={handleDeleteSchedule}
        onEdit={openEditModal}
      />

      {/* Dual-Mode Add / Edit Schedule Modal */}
      <ScheduleModal
        isOpen={isModalOpen}
        initialSchedule={editingSchedule}
        onClose={closeModal}
        onSave={handleUpsertSchedule}
        loading={actionLoading}
      />
    </div>
  );
};

export default BroadcastCalendarPage;
