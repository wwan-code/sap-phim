/**
 * @file ScheduleDetailPanel.jsx
 * @module Admin/Modules/Calendar/Components/ScheduleDetailPanel
 * @description Dumb component hiển thị drawer / panel chi tiết lịch phát sóng của 1 phim,
 * cho phép xem danh sách quy tắc RRULE, chi tiết từng tập, sửa mốc chiếu, đổi trạng thái và tái tạo lịch.
 */

import React, { useState } from 'react';
import PropTypes from 'prop-types';
import {
  X,
  RotateCcw,
  RefreshCw,
  Trash2,
  Clock,
  Calendar as CalendarIcon,
  AlertCircle,
  Edit2,
  Check,
} from 'lucide-react';
import { CalendarStatusBadge } from './CalendarStatusBadge';
import TextField from '@/shared/components/ui/text-field';
import { DateTimePicker } from '@/shared/components/ui/date-time-picker';
import './schedule-detail-panel.scss';

export const ScheduleDetailPanel = ({
  isOpen = false,
  loading = false,
  actionLoading = false,
  schedule = null,
  onClose,
  onOverride,
  onRestore,
  onStatusChange,
  onRegenerate,
  onDelete,
  onEdit,
}) => {
  const [editingCalendarId, setEditingCalendarId] = useState(null);
  const [editReleaseTime, setEditReleaseTime] = useState('');
  const [delayingCalendarId, setDelayingCalendarId] = useState(null);
  const [delayReasonInput, setDelayReasonInput] = useState('');

  if (!isOpen) return null;

  const movie = schedule?.movie;
  const rules = schedule?.rules || [];
  const calendars = schedule?.calendars || [];

  const handleStartEdit = (entry) => {
    setEditingCalendarId(entry.id);
    const dateObj = new Date(entry.release_time);
    const localIso = new Date(dateObj.getTime() - dateObj.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
    setEditReleaseTime(localIso);
  };

  const handleSaveEdit = async (calendarId) => {
    if (!editReleaseTime) return;
    try {
      await onOverride(calendarId, new Date(editReleaseTime).toISOString());
      setEditingCalendarId(null);
    } catch (_) {
      // Error handled by parent
    }
  };

  const handleStartDelay = (calendarId) => {
    setDelayingCalendarId(calendarId);
    setDelayReasonInput('');
  };

  const handleConfirmDelay = async (calendarId) => {
    try {
      await onStatusChange(calendarId, 'delayed', delayReasonInput);
      setDelayingCalendarId(null);
    } catch (_) {
      // Error handled by parent
    }
  };

  const formatDateTime = (dateStr) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  return (
    <div className="schedule-detail-panel">
      <div className="schedule-detail-panel__backdrop" onClick={onClose} />
      <div className="schedule-detail-panel__container" role="dialog" aria-modal="true">
        {/* Header */}
        <div className="schedule-detail-panel__header">
          <div className="schedule-detail-panel__title-group">
            <h2 className="schedule-detail-panel__title">Chi Tiết Lịch Phát Sóng</h2>
            <span className="schedule-detail-panel__subtitle">
              {movie?.titles?.[0]?.title || movie?.slug || schedule?.movie_id}
            </span>
          </div>
          <button
            type="button"
            className="schedule-detail-panel__close-btn"
            onClick={onClose}
            aria-label="Đóng"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="schedule-detail-panel__body">
          {loading ? (
            <div className="schedule-detail-panel__loading">
              <RefreshCw className="schedule-detail-panel__spinner" size={24} />
              <span>Đang tải thông tin lịch phát sóng...</span>
            </div>
          ) : !schedule ? (
            <div className="schedule-detail-panel__empty">
              <AlertCircle size={32} />
              <p>Chưa có cấu hình lịch phát sóng cho tác phẩm này.</p>
            </div>
          ) : (
            <>
              {/* Meta Info */}
              <div className="schedule-detail-panel__meta-grid">
                <div className="schedule-detail-panel__meta-item">
                  <span className="schedule-detail-panel__meta-label">Múi giờ</span>
                  <span className="schedule-detail-panel__meta-value">{schedule.timezone}</span>
                </div>
                <div className="schedule-detail-panel__meta-item">
                  <span className="schedule-detail-panel__meta-label">Trạng thái</span>
                  <span className="schedule-detail-panel__meta-value">
                    <span className={`schedule-detail-panel__badge schedule-detail-panel__badge--${schedule.status}`}>
                      {schedule.status}
                    </span>
                  </span>
                </div>
                <div className="schedule-detail-panel__meta-item">
                  <span className="schedule-detail-panel__meta-label">Ngày neo (Anchor)</span>
                  <span className="schedule-detail-panel__meta-value">
                    {schedule.anchor_date ? formatDateTime(schedule.anchor_date) : 'Mặc định'}
                  </span>
                </div>
                <div className="schedule-detail-panel__meta-item">
                  <span className="schedule-detail-panel__meta-label">Tự động phát</span>
                  <span className="schedule-detail-panel__meta-value">
                    {schedule.auto_publish ? 'Bật (Auto-Publish)' : 'Tắt'}
                  </span>
                </div>
              </div>

              {/* Rules List */}
              <div className="schedule-detail-panel__section">
                <h3 className="schedule-detail-panel__section-title">
                  <CalendarIcon size={16} />
                  <span>Quy Tắc Lặp Lại (RRULE RFC 5545)</span>
                </h3>
                {rules.length === 0 ? (
                  <p className="schedule-detail-panel__hint">Chưa có quy tắc lặp lại nào được cấu hình.</p>
                ) : (
                  <div className="schedule-detail-panel__rules-list">
                    {rules.map((rule, idx) => (
                      <div key={rule.id || idx} className="schedule-detail-panel__rule-card">
                        <div className="schedule-detail-panel__rule-type">
                          <span>{rule.type?.toUpperCase()}</span>
                          {rule.release_time && (
                            <span className="schedule-detail-panel__rule-time">
                              <Clock size={12} />
                              {rule.release_time}
                            </span>
                          )}
                        </div>
                        <div className="schedule-detail-panel__rule-rrule">
                          <code>{rule.rrule_string || 'N/A'}</code>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Calendar Entries Table */}
              <div className="schedule-detail-panel__section">
                <div className="schedule-detail-panel__section-header">
                  <h3 className="schedule-detail-panel__section-title">
                    <Clock size={16} />
                    <span>Lịch Chiếu Từng Tập ({calendars.length})</span>
                  </h3>
                  <button
                    type="button"
                    className="schedule-detail-panel__btn schedule-detail-panel__btn--secondary"
                    disabled={actionLoading}
                    onClick={() => onRegenerate(schedule.movie_id)}
                  >
                    <RefreshCw className={actionLoading ? 'schedule-detail-panel__spinner' : ''} size={14} />
                    <span>Tái tạo lịch</span>
                  </button>
                </div>

                {calendars.length === 0 ? (
                  <p className="schedule-detail-panel__hint">Chưa có tập phim nào được sinh lịch chiếu.</p>
                ) : (
                  <div className="schedule-detail-panel__table-wrapper">
                    <table className="schedule-detail-panel__table">
                      <thead>
                        <tr>
                          <th>Tập</th>
                          <th>Thời Gian Chiếu</th>
                          <th>Trạng Thái</th>
                          <th className="schedule-detail-panel__col-actions">Thao Tác</th>
                        </tr>
                      </thead>
                      <tbody>
                        {calendars.map((entry) => {
                          const isEditing = editingCalendarId === entry.id;
                          const isDelaying = delayingCalendarId === entry.id;

                          return (
                            <tr key={entry.id}>
                              <td>
                                <span className="schedule-detail-panel__ep-number">
                                  Tập {entry.episode_number}
                                </span>
                                {entry.is_exception && (
                                  <span className="schedule-detail-panel__override-badge" title="Đã chỉnh sửa thủ công">
                                    Override
                                  </span>
                                )}
                              </td>
                              <td>
                                {isEditing ? (
                                  <div className="schedule-detail-panel__edit-group">
                                    <DateTimePicker
                                      size="small"
                                      value={editReleaseTime ? new Date(editReleaseTime) : null}
                                      onChange={(newDate) => {
                                        if (newDate && !isNaN(newDate.getTime())) {
                                          const localIso = new Date(
                                            newDate.getTime() - newDate.getTimezoneOffset() * 60000
                                          )
                                            .toISOString()
                                            .slice(0, 16);
                                          setEditReleaseTime(localIso);
                                        }
                                      }}
                                    />
                                    <button
                                      type="button"
                                      className="schedule-detail-panel__mini-btn schedule-detail-panel__mini-btn--save"
                                      onClick={() => handleSaveEdit(entry.id)}
                                      disabled={actionLoading}
                                      title="Lưu thời gian mới"
                                    >
                                      <Check size={12} />
                                    </button>
                                    <button
                                      type="button"
                                      className="schedule-detail-panel__mini-btn"
                                      onClick={() => setEditingCalendarId(null)}
                                      title="Hủy"
                                    >
                                      <X size={12} />
                                    </button>
                                  </div>
                                ) : (
                                  <span className="schedule-detail-panel__time-text">
                                    {formatDateTime(entry.release_time)}
                                  </span>
                                )}
                              </td>
                              <td>
                                {isDelaying ? (
                                  <div className="schedule-detail-panel__delay-group">
                                    <TextField
                                      size="small"
                                      placeholder="Nhập lý do hoãn..."
                                      value={delayReasonInput}
                                      onChange={(e) => setDelayReasonInput(e.target.value)}
                                    />
                                    <button
                                      type="button"
                                      className="schedule-detail-panel__mini-btn schedule-detail-panel__mini-btn--save"
                                      onClick={() => handleConfirmDelay(entry.id)}
                                    >
                                      Lưu
                                    </button>
                                    <button
                                      type="button"
                                      className="schedule-detail-panel__mini-btn"
                                      onClick={() => setDelayingCalendarId(null)}
                                    >
                                      Hủy
                                    </button>
                                  </div>
                                ) : (
                                  <CalendarStatusBadge
                                    status={entry.status}
                                    delayReason={entry.delay_reason}
                                  />
                                )}
                              </td>
                              <td className="schedule-detail-panel__col-actions">
                                <div className="schedule-detail-panel__actions">
                                  {entry.status !== 'released' && (
                                    <>
                                      <button
                                        type="button"
                                        className="schedule-detail-panel__action-btn"
                                        title="Sửa giờ chiếu"
                                        onClick={() => handleStartEdit(entry)}
                                      >
                                        <Edit2 size={13} />
                                      </button>

                                      {entry.status !== 'delayed' ? (
                                        <button
                                          type="button"
                                          className="schedule-detail-panel__action-btn schedule-detail-panel__action-btn--warning"
                                          title="Hoãn chiếu"
                                          onClick={() => handleStartDelay(entry.id)}
                                        >
                                          Hoãn
                                        </button>
                                      ) : (
                                        <button
                                          type="button"
                                          className="schedule-detail-panel__action-btn schedule-detail-panel__action-btn--success"
                                          title="Tiếp tục chiếu"
                                          onClick={() => onStatusChange(entry.id, 'upcoming')}
                                        >
                                          Tiếp tục
                                        </button>
                                      )}

                                      {entry.is_exception && (
                                        <button
                                          type="button"
                                          className="schedule-detail-panel__action-btn"
                                          title="Khôi phục mốc giờ mặc định"
                                          onClick={() => onRestore(entry.id)}
                                        >
                                          <RotateCcw size={13} />
                                        </button>
                                      )}
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {schedule && (
          <div className="schedule-detail-panel__footer">
            {onEdit && (
              <button
                type="button"
                className="schedule-detail-panel__btn schedule-detail-panel__btn--secondary"
                onClick={() => onEdit(schedule)}
              >
                <Edit2 size={14} />
                <span>Sửa Cấu Hình</span>
              </button>
            )}
            <button
              type="button"
              className="schedule-detail-panel__btn schedule-detail-panel__btn--danger"
              disabled={actionLoading}
              onClick={() => {
                if (window.confirm('Bạn có chắc chắn muốn xóa toàn bộ lịch phát sóng của phim này?')) {
                  onDelete(schedule.movie_id);
                }
              }}
            >
              <Trash2 size={14} />
              <span>Xóa Lịch Phát Sóng</span>
            </button>
            <button
              type="button"
              className="schedule-detail-panel__btn schedule-detail-panel__btn--default"
              onClick={onClose}
            >
              Đóng
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

ScheduleDetailPanel.propTypes = {
  isOpen: PropTypes.bool,
  loading: PropTypes.bool,
  actionLoading: PropTypes.bool,
  schedule: PropTypes.object,
  onClose: PropTypes.func.isRequired,
  onOverride: PropTypes.func.isRequired,
  onRestore: PropTypes.func.isRequired,
  onStatusChange: PropTypes.func.isRequired,
  onRegenerate: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
  onEdit: PropTypes.func,
};

export default ScheduleDetailPanel;
