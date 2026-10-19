/**
 * @file WeeklyCalendarGrid.jsx
 * @module Admin/Modules/Calendar/Components/WeeklyCalendarGrid
 * @description Thành phần hiển thị lưới lịch phát sóng 7 ngày trong tuần (Thứ 2 - Chủ Nhật) chuẩn The Aesthetic OS.
 */

import React, { useMemo } from 'react';
import { Clock, Film, Sparkles, ChevronRight } from 'lucide-react';
import { CalendarStatusBadge } from './CalendarStatusBadge';
import './weekly-calendar-grid.scss';

const DAY_DEFINITIONS = [
  { key: 'mon', dow: 1, label: 'Thứ 2', short: 'T2' },
  { key: 'tue', dow: 2, label: 'Thứ 3', short: 'T3' },
  { key: 'wed', dow: 3, label: 'Thứ 4', short: 'T4' },
  { key: 'thu', dow: 4, label: 'Thứ 5', short: 'T5' },
  { key: 'fri', dow: 5, label: 'Thứ 6', short: 'T6' },
  { key: 'sat', dow: 6, label: 'Thứ 7', short: 'T7' },
  { key: 'sun', dow: 0, label: 'Chủ Nhật', short: 'CN' },
];

/**
 * @component WeeklyCalendarGrid
 * @description Lưới 7 cột biểu diễn thời gian phát sóng các tập anime/phim trong tuần đã chọn
 * @param {Object} props
 * @param {Array<Object>} props.schedules - Danh sách items phát sóng trong tuần
 * @param {number} props.weekOffset - Độ lệch tuần (0 là tuần hiện tại)
 * @param {Function} props.onItemClick - Callback khi nhấn vào một tập/phim
 * @returns {JSX.Element}
 */
export const WeeklyCalendarGrid = ({
  schedules = [],
  weekOffset = 0,
  onItemClick,
}) => {
  // Tính toán ngày bắt đầu (Thứ 2) của tuần dựa theo weekOffset
  const weekDays = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const currentDay = today.getDay(); // 0 = CN, 1 = T2,...
    const distToMonday = currentDay === 0 ? -6 : 1 - currentDay;

    const baseMonday = new Date(today);
    baseMonday.setDate(today.getDate() + distToMonday + weekOffset * 7);

    return DAY_DEFINITIONS.map((def, idx) => {
      const date = new Date(baseMonday);
      date.setDate(baseMonday.getDate() + idx);

      const isToday =
        date.getDate() === today.getDate() &&
        date.getMonth() === today.getMonth() &&
        date.getFullYear() === today.getFullYear();

      return {
        ...def,
        date,
        dateFormatted: date.toLocaleDateString('vi-VN', {
          day: '2-digit',
          month: '2-digit',
        }),
        isToday,
      };
    });
  }, [weekOffset]);

  // Phân nhóm lịch phát sóng vào 7 ngày theo ngày dương lịch thực tế
  const groupedSchedule = useMemo(() => {
    const groups = {
      1: [], // T2
      2: [], // T3
      3: [], // T4
      4: [], // T5
      5: [], // T6
      6: [], // T7
      0: [], // CN
    };

    schedules.forEach((item) => {
      if (!item.release_time) return;
      const releaseDate = new Date(item.release_time);
      const dow = releaseDate.getDay();
      if (groups[dow]) {
        groups[dow].push(item);
      }
    });

    // Sắp xếp các tập trong cùng 1 ngày theo giờ phát sóng tăng dần
    Object.keys(groups).forEach((dow) => {
      groups[dow].sort((a, b) => new Date(a.release_time) - new Date(b.release_time));
    });

    return groups;
  }, [schedules]);

  const formatTime = (dateStr) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="weekly-calendar-grid">
      <div className="weekly-calendar-grid__track">
        {weekDays.map((day) => {
          const items = groupedSchedule[day.dow] || [];
          const hasItems = items.length > 0;

          return (
            <div
              key={day.key}
              className={`weekly-calendar-grid__column ${
                day.isToday ? 'weekly-calendar-grid__column--today' : ''
              }`}
            >
              {/* Header của cột */}
              <div className="weekly-calendar-grid__column-header">
                <div className="weekly-calendar-grid__date-group">
                  <span className="weekly-calendar-grid__day-name">{day.label}</span>
                  <span className="weekly-calendar-grid__date-num">{day.dateFormatted}</span>
                </div>
                {day.isToday && (
                  <span className="weekly-calendar-grid__today-badge">
                    <Sparkles size={10} /> Hôm nay
                  </span>
                )}
                <span
                  className={`weekly-calendar-grid__count-badge ${
                    hasItems ? 'weekly-calendar-grid__count-badge--active' : ''
                  }`}
                >
                  {items.length}
                </span>
              </div>

              {/* Danh sách các tập trong ngày */}
              <div className="weekly-calendar-grid__items-list">
                {!hasItems ? (
                  <div className="weekly-calendar-grid__empty-slot">
                    <span className="weekly-calendar-grid__empty-text">Trống</span>
                  </div>
                ) : (
                  items.map((entry) => {
                    const movie = entry.schedule?.movie;
                    const episode = entry.episode;
                    const title = movie?.titles?.[0]?.title || movie?.slug || 'Tác phẩm';
                    const posterUrl = movie?.images?.poster?.url || movie?.images?.thumbnail?.url;

                    return (
                      <div
                        key={entry.id}
                        className={`weekly-calendar-grid__card ${
                          entry.is_exception ? 'weekly-calendar-grid__card--exception' : ''
                        }`}
                        onClick={() => onItemClick?.(entry.schedule?.movie_id)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            onItemClick?.(entry.schedule?.movie_id);
                          }
                        }}
                      >
                        {/* Hàng giờ phát & trạng thái */}
                        <div className="weekly-calendar-grid__card-top">
                          <div className="weekly-calendar-grid__card-time">
                            <Clock size={12} />
                            <span>{formatTime(entry.release_time)}</span>
                          </div>
                          <CalendarStatusBadge
                            status={entry.status}
                            delayReason={entry.delay_reason}
                          />
                        </div>

                        {/* Thân thẻ phim */}
                        <div className="weekly-calendar-grid__card-body">
                          {posterUrl ? (
                            <img
                              src={posterUrl}
                              alt={title}
                              className="weekly-calendar-grid__card-poster"
                              loading="lazy"
                            />
                          ) : (
                            <div className="weekly-calendar-grid__card-poster weekly-calendar-grid__card-poster--empty">
                              <Film size={16} />
                            </div>
                          )}

                          <div className="weekly-calendar-grid__card-info">
                            <span className="weekly-calendar-grid__card-title" title={title}>
                              {title}
                            </span>
                            <div className="weekly-calendar-grid__card-episode-row">
                              <span className="weekly-calendar-grid__card-ep">
                                Tập {entry.episode_number || episode?.episode_number || '—'}
                              </span>
                              {entry.is_exception && (
                                <span
                                  className="weekly-calendar-grid__card-override"
                                  title="Đã đổi lịch chiếu thủ công"
                                >
                                  (Đổi)
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Mũi tên hover action */}
                        <div className="weekly-calendar-grid__card-hover-hint">
                          <span>Chi tiết</span>
                          <ChevronRight size={12} />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default WeeklyCalendarGrid;
